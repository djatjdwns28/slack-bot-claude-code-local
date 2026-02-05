# Slack-Claude Bridge

Slack에서 Claude Code를 제어할 수 있는 브릿지 서버입니다.

## 기능

- Slack DM으로 Claude Code와 대화
- 채널에서 @멘션으로 Claude Code 호출
- 스레드에서 대화 이어가기
- 세션 유지 (대화 맥락 기억)
- 파일 편집, Git 명령어 등 Claude Code 전체 기능 사용

## 요구 사항

- Node.js 18+
- [Claude Code CLI](https://github.com/anthropics/claude-code) 설치 및 로그인
- Slack 워크스페이스 관리자 권한

## 설치

```bash
git clone https://github.com/your-username/slack-claude-bridge.git
cd slack-claude-bridge
npm install
```

## Slack 앱 설정

1. [Slack API](https://api.slack.com/apps)에서 새 앱 생성

2. **OAuth & Permissions** 설정
   - Bot Token Scopes 추가:
     - `chat:write` - 메시지 전송
     - `im:history` - DM 읽기
     - `im:read` - DM 채널 접근
     - `app_mentions:read` - 멘션 읽기
     - `channels:history` - 채널 메시지 읽기 (스레드용)

3. **Event Subscriptions** 설정
   - Request URL: `https://your-domain.com/slack/events`
   - Subscribe to bot events:
     - `message.im` - DM 메시지
     - `app_mention` - 멘션
     - `message.channels` - 채널 메시지 (스레드용)

4. 앱을 워크스페이스에 설치

5. Bot User OAuth Token 복사

## 환경 설정

```bash
cp .env.example .env
```

`.env` 파일 수정:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
PORT=3005
CLAUDE_ALLOWED_DIRS=~/projects,~/work
CLAUDE_SKIP_PERMISSIONS=true
```

## 실행

### 개발 환경 (ngrok 사용)

```bash
# 터미널 1: 서버 실행
node index.js

# 터미널 2: ngrok 터널
ngrok http 3005
```

ngrok URL을 Slack Event Subscriptions의 Request URL에 설정

### 프로덕션

```bash
# PM2 사용
pm2 start index.js --name slack-claude-bridge

# 또는 직접 실행
node index.js
```

## 사용법

### DM으로 대화

봇에게 DM을 보내면 Claude Code가 응답합니다.

### 채널에서 멘션

```
@Claude ~/projects/my-app에서 git status 해줘
```

### 스레드에서 이어가기

멘션으로 시작한 대화는 스레드에서 멘션 없이 이어갈 수 있습니다.

### 특수 명령어

- `/new` 또는 `/reset` - 새 세션 시작 (대화 기록 초기화)

## API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/slack/events` | POST | Slack 웹훅 |
| `/health` | GET | 헬스 체크 |
| `/inbox` | GET | 수신 메시지 확인 |
| `/inbox` | DELETE | 수신 메시지 초기화 |
| `/sessions` | GET | 활성 세션 목록 |

## 주의사항

- `CLAUDE_SKIP_PERMISSIONS=true`는 모든 권한 확인을 건너뜁니다. 신뢰할 수 있는 사용자만 접근하도록 하세요.
- Claude Code CLI가 설치되어 있고 로그인된 상태여야 합니다.
- 첫 번째 메시지는 Claude Code 초기화로 인해 응답이 느릴 수 있습니다.

## 라이선스

MIT
