import axios from "axios"

/**
 * [레거시] HTTP 기반 제어 API.
 * 제어 명령은 Game/useControl.ts 의 WebSocket 방식으로 대체되었다.
 * 성능 비교(before 재현)와 폴백 참고용으로 남겨둔다. (bench/latency-bench.js 참고)
 */
export function moveCtrl(dir: string, status: string) {
    return axios({
        url: process.env.REACT_APP_DOMAIN + '/ctrl/control',
        method: 'POST',
        headers: {
            'Accept':'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,

          },
          data: {
            dir,
            status
          }
    })
}

export function fallCtrl() {
    return axios({
        url: process.env.REACT_APP_DOMAIN + '/ctrl/control',
        method: 'POST',
        headers: {
            'Accept':'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,

          },
          data: {
            dir: 'fall',
            status: 'on'
          }
    })
}

