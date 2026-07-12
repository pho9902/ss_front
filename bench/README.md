# 제어 지연(latency) 개선 — 재현 벤치 & 프로토콜 스펙

원격 인형뽑기의 **제어 명령 전송**을 HTTP(axios POST)에서 **WebSocket(socket.io)** 으로
전환하며 지연을 줄인 작업의 근거 자료.

## 1. 문제

- 제어 경로(사용자 → 기계)가 `POST /ctrl/control` (axios) 였다.
- 방향키 입력마다 별도 HTTP 요청 → **연결 재사용이 안 되면 명령마다 TCP 핸드셰이크**,
  그리고 **매 요청 JWT 헤더 검증**이 반복된다.
- 영상 경로(기계 → 사용자)는 WebRTC(저지연)인데 제어만 HTTP라 **체감 지연이 비대칭**.
- 버튼을 떼는 `off` 명령이 왕복 지연만큼 늦게 도착 → 크레인이 목표를 지나침.

## 2. 재현 벤치 (before 수치)

실제 서버/기계 없이 동일 조건에서 전송 방식별 왕복 지연을 재현한다.

```
node bench/latency-bench.js [RTT_ms] [반복횟수]
# 예: node bench/latency-bench.js 60 50   (모바일 LTE 가정)
#     node bench/latency-bench.js 30 50   (양호한 Wi-Fi 가정)
```

측정 대상: HTTP 신규연결 / HTTP keep-alive / 지속연결(WS 대변).
결과는 **절대 ms가 아니라 상대 개선율·왕복 횟수**로 해석한다(로컬 재현 값).

예시 결과(RTT 60ms): HTTP 신규연결 avg ~124ms, 지속연결(WS) avg ~61ms → 약 50% 감소.

## 3. 개선 (after)

- `src/Game/useControl.ts` : 제어 전용 소켓 훅.
  - 게임 진입 시 **소켓 1회 연결 + handshake `auth` 로 인증 1회**.
  - 명령은 열린 커넥션 위에서 `emit` → 서버 `ack` 왕복만.
  - `transports: ['websocket']` 로 long-polling 폴백 배제.
- 실환경 after 수치가 필요하면 `emit~ack` 구간에 `performance.now()` 계측을
  일시적으로 추가해 측정할 수 있다(상시 계측 코드는 제품에서 제외).

## 4. 백엔드가 맞춰야 할 소켓 스펙

프런트가 기대하는 서버 인터페이스(서버 코드는 이 저장소에 없음):

| 방향 | 이벤트 | 페이로드 | 비고 |
|---|---|---|---|
| C→S | (connect) | `auth: { token }` | 연결 시 1회 JWT 검증 |
| C→S | `join_room` | `{ room }` | 해당 기계 방 입장 |
| C→S | `control` | `{ dir, status, room }` | `dir`: forward/back/left/right/fall, `status`: on/off. **ack 콜백 필수** |

- 서버는 `control` 수신 시 즉시 **ack 콜백을 호출**해야 프런트가 왕복 지연을 측정할 수 있다.
- 인증은 연결 시 1회만. 명령마다 재검증하지 않는다(이 부분이 지연 개선의 핵심).
