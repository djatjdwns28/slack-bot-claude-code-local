# Slack-Claude Bridge

Control Claude Code from anywhere via Slack.

Chat with Claude Code from your phone's Slack app - edit files, run Git commands, and more.

**[한국어 버전은 아래에 있습니다](#한국어-버전)**

---

## Features

- **Slack DM**: Chat with Claude Code via direct messages
- **Channel Mentions**: Call the bot with `@botname question` in channels
- **Thread Conversations**: Continue conversations in threads after mentioning
- **Session Persistence**: Maintains conversation context for continuous work
- **Full Claude Code Access**: File editing, Git commands, and all Claude Code features

---

## Prerequisites

| Item | Description | Installation |
|------|-------------|--------------|
| Node.js | Version 18+ | [nodejs.org](https://nodejs.org/) |
| Claude Code | Anthropic CLI tool | `npm install -g @anthropic-ai/claude-code` |
| ngrok | Expose local server to internet | [ngrok.com](https://ngrok.com/download) |
| Slack Workspace | Admin access required | - |

### Verify Claude Code Installation

```bash
claude --version
```

If not logged in:

```bash
claude
# Follow the login prompts
```

---

## Step 1: Install the Project

### 1-1. Download the Code

```bash
git clone https://github.com/djatjdwns28/slack-bot-claude-code-local.git
cd slack-bot-claude-code-local
```

### 1-2. Install Dependencies

```bash
npm install
```

---

## Step 2: Create a Slack App

### 2-1. Create New App

1. Go to [Slack API](https://api.slack.com/apps)
2. Click **Create New App**
3. Select **From scratch**
4. Enter app name (e.g., `Claude Bot`)
5. Select workspace and click **Create App**

### 2-2. Configure Permissions

1. Click **OAuth & Permissions** in the left menu
2. Scroll to **Scopes** section
3. Under **Bot Token Scopes**, click **Add an OAuth Scope**
4. Add all of these permissions:

| Scope | Description |
|-------|-------------|
| `chat:write` | Send messages |
| `im:history` | Read DM history |
| `im:read` | Access DM channels |
| `app_mentions:read` | Read mentions |
| `channels:history` | Read channel messages |

### 2-3. Install the App

1. Click **Install to Workspace** at the top
2. Click **Allow**
3. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

> ⚠️ Keep this token secure!

---

## Step 3: Set Up ngrok

ngrok exposes your local server to the internet.

### 3-1. Install ngrok

**Mac (Homebrew):**
```bash
brew install ngrok
```

**Windows / Direct Download:**
Download from [ngrok.com/download](https://ngrok.com/download)

### 3-2. Connect ngrok Account (Optional)

1. Create a free account at [ngrok.com](https://ngrok.com/)
2. Copy **Your Authtoken** from the Dashboard
3. Run in terminal:

```bash
ngrok config add-authtoken YOUR_TOKEN
```

### 3-3. Run ngrok

```bash
ngrok http 3005
```

You'll see output like:

```
Forwarding    https://abc123.ngrok-free.dev -> http://localhost:3005
```

Copy the **`https://abc123.ngrok-free.dev`** URL (changes each time)

> 💡 Keep the ngrok window open!

---

## Step 4: Connect Slack Events

### 4-1. Configure Event Subscriptions

1. Go to [Slack API](https://api.slack.com/apps) and select your app
2. Click **Event Subscriptions** in the left menu
3. Toggle **Enable Events** on
4. Enter in **Request URL**:

```
https://abc123.ngrok-free.dev/slack/events
```

(Replace `abc123` with your ngrok URL)

5. Verify you see ✅ **Verified**

> ⚠️ If not verified, make sure your server is running (Step 5)

### 4-2. Subscribe to Events

On the same page, click **Subscribe to bot events** and add:

| Event | Description |
|-------|-------------|
| `message.im` | DM messages |
| `app_mention` | @mentions |
| `message.channels` | Channel messages (for threads) |

### 4-3. Save

Click **Save Changes** at the bottom

> 💡 You may need to reinstall the app if permissions were added.

---

## Step 5: Configure and Run the Server

### 5-1. Set Environment Variables

```bash
cp .env.example .env
```

Edit the `.env` file:

```env
# Required: Bot Token from Step 2-3
SLACK_BOT_TOKEN=xoxb-paste-your-token-here

# Server port (default 3005, no change needed)
PORT=3005

# Directories Claude can access (comma-separated)
CLAUDE_ALLOWED_DIRS=~/projects,~/work

# Skip permission prompts (recommended: true)
CLAUDE_SKIP_PERMISSIONS=true

# Claude model to use (opus, sonnet, haiku)
CLAUDE_MODEL=opus
```

### 5-2. Start the Server

```bash
npm start
```

On success:

```
[Server] Slack Bridge running on port 3005
[Server] Commands:
         !new, !reset       - Start new session
```

---

## Usage

### DM Conversations

1. Find the bot in Slack (search by app name)
2. Send a DM

```
Hey! Show me the file list
```

### Channel Mentions

```
@Claude run git status in ~/projects/my-app
```

> 💡 To use in a channel, first invite the bot: `/invite @botname`

### Continue in Threads

Conversations started with a mention can continue in the thread without mentioning again.

---

## Special Commands

Use these commands in Slack:

| Command | Description |
|---------|-------------|
| `!new` | Start new session (reset conversation) |
| `!reset` | Start new session (same as above) |
| `!session` | Check current session ID |
| `!session SESSION_ID` | Switch to a specific session |

> 💡 Use `!` instead of `/` to avoid Slack slash command conflicts

---

## Share Sessions Between Terminal & Slack

You can continue a terminal session in Slack.

### Terminal → Slack

1. Run Claude Code in terminal: `claude`
2. Type `/sessions` to get the session ID
3. In Slack: `!session SESSION_ID`

### Slack → Terminal

> ⚠️ Sessions started in Slack cannot be continued in terminal (technical limitation)

---

## Troubleshooting

### "Verified" Not Showing

- Check if server is running
- Check if ngrok is running
- Verify URL is correct (includes `/slack/events`)

### Bot Not Responding

- Check server logs: run with `npm start` and watch output
- Check if requests appear in ngrok terminal
- Verify all Slack app scopes are added

### Stuck at "Processing..."

- Verify Claude Code is installed
- Verify Claude Code is logged in
- First request may be slow due to initialization (30s-1min)

### ngrok URL Changed

When ngrok restarts, the URL changes. Each time:
1. Slack App → Event Subscriptions → Update Request URL
2. Save Changes

---

## Advanced Setup

### Run in Background with PM2

```bash
npm install -g pm2
pm2 start index.js --name slack-claude
pm2 save
```

### Environment Variable Options

| Variable | Description | Default |
|----------|-------------|---------|
| `SLACK_BOT_TOKEN` | Slack Bot token | (required) |
| `PORT` | Server port | 3005 |
| `CLAUDE_ALLOWED_DIRS` | Allowed directories | - |
| `CLAUDE_SKIP_PERMISSIONS` | Skip permission prompts | false |
| `CLAUDE_MODEL` | Model to use | opus |

---

## License

MIT

---

---

# 한국어 버전

Slack으로 어디서든 Claude Code를 제어하세요.

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

| 항목 | 설명 | 설치 방법 |
|------|------|----------|
| Node.js | 버전 18 이상 | [nodejs.org](https://nodejs.org/) |
| Claude Code | Anthropic CLI 도구 | `npm install -g @anthropic-ai/claude-code` |
| ngrok | 로컬 서버를 인터넷에 노출 | [ngrok.com](https://ngrok.com/download) |
| Slack 워크스페이스 | 관리자 권한 필요 | - |

### Claude Code 설치 확인

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
