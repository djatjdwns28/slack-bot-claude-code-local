# Slack-Claude Bridge

Slack에서 Claude Code를 제어할 수 있는 브릿지 서버입니다.

스마트폰의 Slack 앱에서도 Claude Code와 대화하고, 파일 편집, Git 명령어 실행 등이 가능합니다.

---

## 주요 기능

- **Slack DM**: 봇에게 DM으로 Claude Code와 대화
- **채널 멘션**: `@봇이름 질문` 형태로 채널에서 호출
- **스레드 대화**: 멘션 후 스레드에서 대화 이어가기
- **세션 유지**: 대화 맥락을 기억해서 연속 작업 가능
- **파일 편집**: 코드 수정, Git 명령어 등 Claude Code 전체 기능

---

## 사전 준비물

시작하기 전에 아래 항목들이 필요합니다:

| 항목 | 설명 | 설치 방법 |
|------|------|----------|
| Node.js | 버전 18 이상 | [nodejs.org](https://nodejs.org/) |
| Claude Code | Anthropic CLI 도구 | `npm install -g @anthropic-ai/claude-code` |
| ngrok | 로컬 서버를 인터넷에 노출 | [ngrok.com](https://ngrok.com/download) |
| Slack 워크스페이스 | 관리자 권한 필요 | - |

### Claude Code 설치 확인

터미널에서 아래 명령어가 동작하는지 확인하세요:

```bash
claude --version
```

로그인이 안 되어 있다면:

```bash
claude
# 안내에 따라 로그인
```

---

## 1단계: 프로젝트 설치

### 1-1. 코드 다운로드

```bash
git clone https://github.com/djatjdwns28/slack-bot-claude-code-local.git
cd slack-bot-claude-code-local
```

### 1-2. 패키지 설치

```bash
npm install
```

---

## 2단계: Slack 앱 만들기

### 2-1. 새 앱 생성

1. [Slack API](https://api.slack.com/apps) 접속
2. **Create New App** 클릭
3. **From scratch** 선택
4. 앱 이름 입력 (예: `Claude Bot`)
5. 워크스페이스 선택 후 **Create App**

### 2-2. 권한 설정

1. 왼쪽 메뉴에서 **OAuth & Permissions** 클릭
2. **Scopes** 섹션으로 스크롤
3. **Bot Token Scopes**에서 **Add an OAuth Scope** 클릭
4. 아래 권한들을 모두 추가:

| Scope | 설명 |
|-------|------|
| `chat:write` | 메시지 보내기 |
| `im:history` | DM 읽기 |
| `im:read` | DM 채널 접근 |
| `app_mentions:read` | 멘션 읽기 |
| `channels:history` | 채널 메시지 읽기 |

### 2-3. 앱 설치

1. 같은 페이지 상단의 **Install to Workspace** 클릭
2. **허용** 클릭
3. **Bot User OAuth Token** 복사 (xoxb-로 시작)

> ⚠️ 이 토큰을 안전한 곳에 저장하세요!

---

## 3단계: ngrok 설정

ngrok은 로컬 서버를 인터넷에서 접근 가능하게 해줍니다.

### 3-1. ngrok 설치

**Mac (Homebrew):**
```bash
brew install ngrok
```

**Windows / 직접 다운로드:**
[ngrok.com/download](https://ngrok.com/download)에서 다운로드

### 3-2. ngrok 계정 연결 (선택사항)

1. [ngrok.com](https://ngrok.com/)에서 무료 계정 생성
2. Dashboard에서 **Your Authtoken** 복사
3. 터미널에서:

```bash
ngrok config add-authtoken 복사한토큰
```

### 3-3. ngrok 실행

```bash
ngrok http 3005
```

실행하면 이런 화면이 나타납니다:

```
Forwarding    https://abc123.ngrok-free.dev -> http://localhost:3005
```

**`https://abc123.ngrok-free.dev`** 부분을 복사하세요! (매번 바뀜)

> 💡 ngrok 창은 계속 열어두세요!

---

## 4단계: Slack 이벤트 연결

### 4-1. Event Subscriptions 설정

1. [Slack API](https://api.slack.com/apps)에서 앱 선택
2. 왼쪽 메뉴 **Event Subscriptions** 클릭
3. **Enable Events** 토글 켜기
4. **Request URL**에 입력:

```
https://abc123.ngrok-free.dev/slack/events
```

(abc123 부분은 본인의 ngrok URL로 변경)

5. ✅ **Verified** 표시 확인

> ⚠️ Verified가 안 뜨면 서버가 실행 중인지 확인하세요 (5단계 먼저 진행)

### 4-2. 이벤트 구독

같은 페이지에서 **Subscribe to bot events** 클릭 후 추가:

| Event | 설명 |
|-------|------|
| `message.im` | DM 메시지 |
| `app_mention` | @멘션 |
| `message.channels` | 채널 메시지 (스레드용) |

### 4-3. 저장

페이지 하단 **Save Changes** 클릭

> 💡 권한이 추가되면 앱 재설치가 필요할 수 있습니다.

---

## 5단계: 서버 설정 및 실행

### 5-1. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열고 수정:

```env
# 필수: 2-3단계에서 복사한 Bot Token
SLACK_BOT_TOKEN=xoxb-여기에-토큰-붙여넣기

# 서버 포트 (기본값 3005, 변경 불필요)
PORT=3005

# Claude가 접근할 수 있는 디렉토리 (쉼표로 구분)
CLAUDE_ALLOWED_DIRS=~/projects,~/work

# 권한 확인 건너뛰기 (true 권장)
CLAUDE_SKIP_PERMISSIONS=true

# 사용할 Claude 모델 (opus, sonnet, haiku)
CLAUDE_MODEL=opus
```

### 5-2. 서버 실행

```bash
npm start
```

정상 실행 시:

```
[Server] Slack Bridge running on port 3005
[Server] Commands:
         !new, !reset       - Start new session
```

---

## 사용 방법

### DM으로 대화

1. Slack에서 봇 찾기 (앱 이름으로 검색)
2. DM 보내기

```
안녕! 파일 목록 보여줘
```

### 채널에서 멘션

```
@Claude ~/projects/my-app에서 git status 해줘
```

> 💡 채널에서 사용하려면 먼저 봇을 채널에 초대: `/invite @봇이름`

### 스레드에서 이어가기

멘션으로 시작한 대화는 스레드에서 멘션 없이 계속할 수 있습니다.

---

## 특수 명령어

Slack에서 아래 명령어를 사용할 수 있습니다:

| 명령어 | 설명 |
|--------|------|
| `!new` | 새 세션 시작 (대화 초기화) |
| `!reset` | 새 세션 시작 (위와 동일) |
| `!session` | 현재 세션 ID 확인 |
| `!session 세션ID` | 특정 세션으로 전환 |

> 💡 `/`가 아닌 `!`를 사용하세요 (Slack 슬래시 명령어 충돌 방지)

---

## 터미널 ↔ Slack 세션 공유

터미널에서 작업하던 세션을 Slack에서 이어갈 수 있습니다.

### 터미널 → Slack

1. 터미널에서 Claude Code 실행: `claude`
2. `/sessions` 입력해서 세션 ID 확인
3. Slack에서: `!session 세션ID`

### Slack → 터미널

> ⚠️ Slack에서 시작한 세션은 터미널에서 이어갈 수 없습니다 (기술적 제한)

---

## 문제 해결

### "Verified" 안 뜸

- 서버가 실행 중인지 확인
- ngrok이 실행 중인지 확인
- URL이 정확한지 확인 (`/slack/events` 포함)

### 봇이 응답 안 함

- 서버 로그 확인: `npm start`로 실행 후 로그 확인
- ngrok 터미널에서 요청이 들어오는지 확인
- Slack 앱 권한 확인 (모든 scope 추가했는지)

### "처리 중..."에서 멈춤

- Claude Code가 설치되어 있는지 확인
- Claude Code에 로그인되어 있는지 확인
- 첫 번째 요청은 초기화로 인해 느릴 수 있음 (30초~1분)

### ngrok URL이 바뀜

ngrok을 재시작하면 URL이 바뀝니다. 바뀔 때마다:
1. Slack 앱 → Event Subscriptions → Request URL 업데이트
2. Save Changes

---

## 고급 설정

### PM2로 백그라운드 실행

```bash
npm install -g pm2
pm2 start index.js --name slack-claude
pm2 save
```

### 환경 변수 옵션

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `SLACK_BOT_TOKEN` | Slack Bot 토큰 | (필수) |
| `PORT` | 서버 포트 | 3005 |
| `CLAUDE_ALLOWED_DIRS` | 접근 허용 디렉토리 | - |
| `CLAUDE_SKIP_PERMISSIONS` | 권한 확인 건너뛰기 | false |
| `CLAUDE_MODEL` | 사용할 모델 | opus |

---

## 라이선스

MIT
