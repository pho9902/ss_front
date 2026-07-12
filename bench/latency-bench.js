/**
 * 원격 인형뽑기 제어 명령 왕복 지연(latency) 재현 벤치마크
 * ------------------------------------------------------------
 * 목적: 실제 서버/기계가 없는 상태에서, "제어 명령"을 보내는 두 가지
 *       전송 방식의 왕복 지연 차이를 동일 조건에서 재현/정량화한다.
 *
 *   A) HTTP (신규 연결)   - 매 명령마다 새 TCP 연결 + 매 요청 JWT 검증
 *                           (현행 axios POST 방식의 최악 케이스: keep-alive 미재사용)
 *   B) HTTP (연결 재사용) - keep-alive로 TCP는 재사용, 단 매 요청 JWT 검증은 유지
 *                           (현행 방식의 낙관 케이스)
 *   C) 지속 연결 (WS 대변) - 연결 1회 + 인증 1회 후, 명령은 프레임만 왕복
 *                           (개선안: socket.io 채널로 제어 이전)
 *
 * 모델 가정 (측정 조건으로 이력서에 명시할 것):
 *   - RTT_MS         : 네트워크 왕복 지연(ms). 편도가 아니라 왕복 1회 비용.
 *   - HANDSHAKE      : 신규 TCP 연결 시 3-way handshake 왕복 1회(= RTT_MS) 추가.
 *   - JWT_VERIFY_MS  : 서버가 매 HTTP 요청마다 토큰을 검증하는 처리 비용.
 *   - 지속 연결은 인증을 연결 시 1회만 수행하므로 명령당 JWT 비용 = 0.
 *   - 직렬화/파싱/이벤트루프 비용은 실제 loopback 통신으로 측정에 자연 포함.
 *
 * 실행: node bench/latency-bench.js [RTT_MS] [N]
 *   예: node bench/latency-bench.js 60 50
 */

const net = require('net');

const RTT_MS = Number(process.argv[2] ?? 60); // 네트워크 왕복 지연(ms)
const N = Number(process.argv[3] ?? 50); // 명령 반복 횟수
const JWT_VERIFY_MS = 1.5; // 매 요청 토큰 검증 처리 비용(ms)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Number(process.hrtime.bigint()) / 1e6; // ms

// --- 서버: 한 줄(JSON) 요청을 받고, 방식에 맞는 지연 후 ack를 돌려준다 ---
// req.kind: 'new' | 'keepalive' | 'persistent'
const server = net.createServer((socket) => {
  let buf = '';
  socket.on('data', async (chunk) => {
    buf += chunk.toString();
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (!line) continue;
      const req = JSON.parse(line);

      let delay = RTT_MS; // 명령 요청/응답 왕복 1회
      if (req.kind === 'new') delay += RTT_MS; // + TCP handshake 왕복 1회
      if (req.kind !== 'persistent') delay += JWT_VERIFY_MS; // 매 요청 인증 검증

      await sleep(delay);
      socket.write(JSON.stringify({ ok: true, id: req.id }) + '\n');
    }
  });
});

function once(socket, target) {
  return new Promise((resolve) => {
    let buf = '';
    const onData = (chunk) => {
      buf += chunk.toString();
      if (buf.includes('\n')) {
        socket.off('data', onData);
        resolve();
      }
    };
    socket.on('data', onData);
  });
}

// 신규 연결 방식: 명령마다 connect → send → ack → close
async function measureNewConn(port, id) {
  const t0 = now();
  await new Promise((resolve, reject) => {
    const s = net.connect(port, '127.0.0.1', async () => {
      s.write(JSON.stringify({ kind: 'new', id }) + '\n');
      await once(s, s);
      s.end();
      resolve();
    });
    s.on('error', reject);
  });
  return now() - t0;
}

// 지속 연결 방식(keep-alive / persistent 공용): 하나의 소켓으로 반복
async function measureOnSocket(socket, kind, id) {
  const t0 = now();
  socket.write(JSON.stringify({ kind, id }) + '\n');
  await once(socket, socket);
  return now() - t0;
}

function stats(arr) {
  const a = [...arr].sort((x, y) => x - y);
  const sum = a.reduce((s, v) => s + v, 0);
  const q = (p) => a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
  return {
    avg: sum / a.length,
    median: q(50),
    p95: q(95),
    min: a[0],
    max: a[a.length - 1],
  };
}

function fmt(label, s) {
  const r = (n) => n.toFixed(1).padStart(7);
  return `${label.padEnd(24)} avg ${r(s.avg)} | median ${r(s.median)} | p95 ${r(s.p95)} | min ${r(s.min)} | max ${r(s.max)}  (ms)`;
}

async function main() {
  const port = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });

  // A) HTTP 신규 연결
  const aNew = [];
  for (let i = 0; i < N; i++) aNew.push(await measureNewConn(port, i));

  // B) HTTP keep-alive (연결 1개 재사용, 단 매 요청 인증 유지)
  const ka = await new Promise((resolve) =>
    net.connect(port, '127.0.0.1', function () { resolve(this); })
  );
  const aKeep = [];
  for (let i = 0; i < N; i++) aKeep.push(await measureOnSocket(ka, 'keepalive', i));
  ka.end();

  // C) 지속 연결(WS 대변): 인증 1회 후 명령 프레임만 왕복
  const ws = await new Promise((resolve) =>
    net.connect(port, '127.0.0.1', function () { resolve(this); })
  );
  const aWs = [];
  for (let i = 0; i < N; i++) aWs.push(await measureOnSocket(ws, 'persistent', i));
  ws.end();

  server.close();

  const sNew = stats(aNew);
  const sKeep = stats(aKeep);
  const sWs = stats(aWs);

  console.log('\n원격 제어 명령 왕복 지연 재현 벤치');
  console.log(`조건: RTT=${RTT_MS}ms, 명령/방식당 ${N}회, JWT검증=${JWT_VERIFY_MS}ms/요청, loopback 실측+RTT 모델\n`);
  console.log(fmt('A) HTTP 신규연결', sNew));
  console.log(fmt('B) HTTP keep-alive', sKeep));
  console.log(fmt('C) 지속연결 (WS)', sWs));

  const impVsNew = ((sNew.avg - sWs.avg) / sNew.avg) * 100;
  const impVsKeep = ((sKeep.avg - sWs.avg) / sKeep.avg) * 100;
  console.log('\n개선율 (평균 기준)');
  console.log(`  WS vs HTTP(신규연결)   : ${impVsNew.toFixed(1)}% 감소`);
  console.log(`  WS vs HTTP(keep-alive) : ${impVsKeep.toFixed(1)}% 감소`);
  console.log('\n※ 로컬 재현 실험 값. 절대 ms가 아니라 상대 개선율/왕복 횟수 관점으로 해석할 것.\n');
}

main();
