# 💻 SS-NBB (누뽑)

> 웹에서 **실제 인형뽑기 기계**를 원격으로 조종하는 서비스

## 🎮 소개

실제 인형뽑기 기계에 연결해, 사용자가 브라우저에서 **실시간 영상을 보며 크레인을 직접 조작**하고 뽑기를 즐길 수 있는 원격 인형뽑기 웹 서비스입니다.

- **WebRTC** 기반 실시간 영상 스트리밍 (기계 → 사용자)
- **WebSocket(Socket.io)** 기반 저지연 원격 제어 (사용자 → 기계)
- 로그인 · 코인 충전/차감 등 서비스 기능

개발 기간 : 2024.09 ~ 2024.12

<br/>

## 🛠 기술 스택

<h3 align="center">Frontend</h3>
<p align="center">
  <img src="https://img.shields.io/badge/React-black?logo=React"/>
  <img src="https://img.shields.io/badge/TypeScript-black?logo=typescript"/>
  <img src="https://img.shields.io/badge/styled--components-black?logo=styledcomponents"/>
  <img src="https://img.shields.io/badge/WebRTC-black?logo=webrtc"/>
  <img src="https://img.shields.io/badge/Socket.io-black?logo=Socket.io"/>
  <img src="https://img.shields.io/badge/React%20Router-black?logo=reactrouter"/>
  <img src="https://img.shields.io/badge/Axios-black?logo=axios"/>
</p>

<h3 align="center">Backend</h3>
<p align="center">
  <img src="https://img.shields.io/badge/Express.js-black?logo=Express"/>
</p>

<br/>

## 📁 프로젝트 구조

```
ss_front/
├── public/
├── src/
│   ├── api/              # 서버 통신 (Auth · Coin · Ctrl)
│   ├── App/              # 앱 진입 · 라우팅
│   ├── Auth/             # 로그인 / 회원가입
│   ├── Coin/             # 코인 충전
│   ├── Game/             # 게임 화면
│   │   ├── Video/        # WebRTC 실시간 영상
│   │   ├── Timer/        # 플레이 타이머
│   │   └── useControl.ts # WebSocket 원격 제어 훅
│   ├── List/             # 기기 목록
│   ├── Main/             # 메인 페이지
│   ├── Admin/            # 관리자 페이지
│   ├── Footer/
│   └── index.tsx
└── package.json
```

<br/>

## 🚀 시작하기

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정 (.env)
#    REACT_APP_DOMAIN=<백엔드 서버 주소>   예: http://localhost:8080

# 3. 개발 서버 실행
npm start          # http://localhost:3000

# 프로덕션 빌드
npm run build
```

> 실시간 영상(WebRTC)과 원격 제어(Socket.io)를 위해 별도의 백엔드 서버가 필요합니다.
