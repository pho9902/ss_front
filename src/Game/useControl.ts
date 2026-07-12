import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * 제어 명령 전용 WebSocket 훅.
 *
 * [기존 방식]  방향키 입력마다 axios POST /ctrl/control (api/Ctrl 참고)
 *   - 명령마다 (연결 재사용 안 되면) TCP 핸드셰이크 + 매 요청 JWT 헤더 검증
 *   - 요청/응답 완료를 기다려야 다음 처리가 이어짐
 *
 * [개선 방식]  이 훅
 *   - 게임 진입 시 소켓 1회 연결, 인증도 handshake auth 로 1회만 전달
 *   - 이후 명령은 이미 열린 커넥션 위에서 emit 프레임만 왕복
 *   - transports: ['websocket'] 로 long-polling 폴백을 배제해 초기/유휴 지연 감소
 *   - 서버 ack 로 성공/실패를 판별 (실패 시 reject)
 */

const ACK_TIMEOUT_MS = 3000;

export function useControl(roomName?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('accessToken');
    const socket = io(process.env.REACT_APP_DOMAIN, {
      auth: { token }, // 연결 시 1회 인증 (명령마다 재인증 X)
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (roomName) socket.emit('join_room', { room: roomName });
    });
    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomName]);

  /** 제어 명령 전송. 서버 ack 수신 시 resolve, 실패/타임아웃 시 reject */
  const send = useCallback(
    (payload: { dir: string; status: string }) =>
      new Promise<void>((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) {
          reject(new Error('control socket not connected'));
          return;
        }

        let done = false;
        const timer = setTimeout(() => {
          if (done) return;
          done = true;
          reject(new Error('control ack timeout'));
        }, ACK_TIMEOUT_MS);

        socket.emit('control', { ...payload, room: roomName }, () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve();
        });
      }),
    [roomName]
  );

  const sendMove = useCallback((dir: string, status: string) => send({ dir, status }), [send]);
  const sendFall = useCallback(() => send({ dir: 'fall', status: 'on' }), [send]);

  return { connected, sendMove, sendFall };
}
