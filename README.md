# Slack-Claude Bridge v2.0

Control Claude Code from anywhere via Slack.

Chat with Claude Code from your phone's Slack app - edit files, run Git commands, analyze images/videos/audio, and more.

**[한국어 버전은 아래에 있습니다](#한국어-버전)**

---

## Features

- **Slack DM**: Chat with Claude Code via direct messages
- **Channel Mentions**: Call the bot with `@botname question` in channels
- **Thread Conversations**: Continue conversations in threads after mentioning
- **Session Persistence**: Maintains conversation context for continuous work
- **Image Analysis**: Send images and Claude will analyze them
- **Video Analysis**: Upload videos or share YouTube/Loom/Vimeo URLs - frames are extracted and analyzed
- **Voice Messages (STT)**: Send voice messages - automatically transcribed via whisper-cpp and processed
- **@User Mention Watch**: Monitor channels for mentions of a specific user, analyze the issue, and send a DM summary with TTS audio
- **Full Claude Code Access**: File editing, Git commands, and all Claude Code features
- **Socket Mode**: No ngrok or public URL needed - connects directly via WebSocket

---

## Prerequisites

| Item | Description | Installation |
|------|-------------|--------------|
| Node.js | Version 18+ | [nodejs.org](https://nodejs.org/) |
| Claude Code | Anthropic CLI tool | `npm install -g @anthropic-ai/claude-code` |
| Slack Workspace | Admin access required | - |

### Optional (for multimedia features)

| Item | Description | Installation |
|------|-------------|--------------|
| ffmpeg | Video frame extraction & audio conversion | `brew install ffmpeg` |
| whisper-cpp | Voice message STT (speech-to-text) | [github.com/ggerganov/whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| yt-dlp | YouTube/Loom/Vimeo URL video download | `brew install yt-dlp` |

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

### 2-2. Enable Socket Mode

1. Click **Socket Mode** in the left menu
2. Toggle **Enable Socket Mode** on
3. Create an **App-Level Token** with `connections:write` scope
4. Copy the token (starts with `xapp-`)

### 2-3. Configure Permissions

1. Click **OAuth & Permissions** in the left menu
2. Scroll to **Scopes** section
3. Under **Bot Token Scopes**, add all of these:

| Scope | Description |
|-------|-------------|
| `chat:write` | Send messages |
| `im:history` | Read DM history |
| `im:read` | Access DM channels |
| `app_mentions:read` | Read mentions |
| `channels:history` | Read channel messages |
| `files:read` | Read uploaded files (images, videos, audio) |
| `files:write` | Upload files (TTS audio responses) |
| `users:read` | Read user info (for !whoami and mention watch) |

### 2-4. Configure Event Subscriptions

1. Click **Event Subscriptions** in the left menu
2. Toggle **Enable Events** on
3. Under **Subscribe to bot events**, add:

| Event | Description |
|-------|-------------|
| `message.im` | DM messages |
| `app_mention` | @mentions |
| `message.channels` | Channel messages (for threads & mention watch) |

4. Click **Save Changes**

### 2-5. Install the App

1. Click **Install to Workspace** at the top
2. Click **Allow**
3. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

---

## Step 3: Configure and Run the Server

### 3-1. Set Environment Variables

```bash
cp .env.example .env
```

Edit the `.env` file:

```env
# Required: Bot Token from Step 2-5
SLACK_BOT_TOKEN=xoxb-paste-your-token-here

# Required: App-Level Token from Step 2-2 (Socket Mode)
SLACK_APP_TOKEN=xapp-paste-your-token-here

# Required: Allowed User IDs (comma-separated)
# Find your ID: Slack profile > More > Copy member ID
ALLOWED_USERS=U0XXXXXXXX

# Optional: Monitor mentions of a specific user
# When this user is @mentioned in channels, bot analyzes the issue and sends a DM summary
WATCH_USER_ID=U0YYYYYYYY

# Optional: macOS TTS voice for mention watch audio summaries (default: Yuna)
TTS_VOICE=Yuna

# Optional: Directories Claude can access (comma-separated)
CLAUDE_ALLOWED_DIRS=~/projects,~/work

# Optional: Skip permission prompts (default: false)
CLAUDE_SKIP_PERMISSIONS=true

# Optional: Claude model to use (default: opus)
CLAUDE_MODEL=opus
```

### 3-2. Start the Server

```bash
npm start
```

On success:

```
⚡️ Bolt app is running in Socket Mode!
[Server] Commands:
         !new, !reset       - Start new session
         !session <id>      - Switch session
         !session           - View current session
         !whoami            - User info
```

> No ngrok needed! Socket Mode connects directly via WebSocket.

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

> To use in a channel, first invite the bot: `/invite @botname`

### Continue in Threads

Conversations started with a mention can continue in the thread without mentioning again.

### Image Analysis

Attach an image to your message and Claude will analyze it.

### Video Analysis

- Upload a video file directly to Slack
- Or share a URL (YouTube, Loom, Vimeo, direct .mp4 links)

Frames are extracted at 1 FPS and analyzed by Claude.

### Voice Messages

Send a voice message or audio file - it's automatically transcribed via whisper-cpp and processed as text.

---

## Special Commands

| Command | Description |
|---------|-------------|
| `!new` | Start new session (reset conversation) |
| `!reset` | Start new session (same as above) |
| `!session` | Check current session ID |
| `!session SESSION_ID` | Switch to a specific session |
| `!whoami` | Show your Slack user info |

> Use `!` instead of `/` to avoid Slack slash command conflicts

---

## Share Sessions Between Terminal & Slack

### Terminal → Slack

1. Run Claude Code in terminal: `claude`
2. Type `/sessions` to get the session ID
3. In Slack: `!session SESSION_ID`

### Slack → Terminal

> Sessions started in Slack cannot be continued in terminal (technical limitation)

---

## @User Mention Watch

When `WATCH_USER_ID` is set, the bot monitors all channels for messages that mention that user.

**How it works:**
1. Someone mentions the watched user in a channel (e.g., `@Evan can you check this bug?`)
2. Bot collects the message, thread context, and any attached media
3. Claude analyzes the issue and generates a summary
4. Summary is sent as a DM to the watched user
5. A TTS audio summary is also attached (macOS only)

This works with images, videos, voice messages, and video URLs in the mention.

---

## Troubleshooting

### Bot Not Responding

- Check server logs: run with `npm start` and watch output
- Verify Socket Mode is enabled in Slack App settings
- Verify both `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN` are set
- Verify all Slack app scopes are added

### Stuck at "Processing..."

- Verify Claude Code is installed and logged in
- First request may be slow due to initialization (30s-1min)
- Check timeout: default is 5 minutes

### Multimedia Not Working

- **Images**: Ensure `files:read` scope is added
- **Video frames**: Ensure `ffmpeg` is installed (`brew install ffmpeg`)
- **Voice STT**: Ensure `whisper-cpp` is installed with the medium model at `~/.cache/whisper-cpp/ggml-medium.bin`
- **Video URLs**: Ensure `yt-dlp` is installed (`brew install yt-dlp`)

---

## Advanced Setup

### Run in Background with PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

### Environment Variable Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SLACK_BOT_TOKEN` | Slack Bot token (`xoxb-`) | - | Yes |
| `SLACK_APP_TOKEN` | Slack App-Level token (`xapp-`) | - | Yes |
| `ALLOWED_USERS` | Comma-separated allowed User IDs | - | Yes |
| `WATCH_USER_ID` | User ID to monitor mentions for | - | No |
| `TTS_VOICE` | macOS TTS voice name | `Yuna` | No |
| `CLAUDE_ALLOWED_DIRS` | Allowed directories for Claude | - | No |
| `CLAUDE_SKIP_PERMISSIONS` | Skip permission prompts | `false` | No |
| `CLAUDE_MODEL` | Claude model to use | `opus` | No |

---

## License

MIT

---

---

# 한국어 버전

Slack으로 어디서든 Claude Code를 제어하세요.

스마트폰의 Slack 앱에서도 Claude Code와 대화하고, 파일 편집, Git 명령어, 이미지/영상/음성 분석 등이 가능합니다.

---

## 주요 기능

- **Slack DM**: 봇에게 DM으로 Claude Code와 대화
- **채널 멘션**: `@봇이름 질문` 형태로 채널에서 호출
- **스레드 대화**: 멘션 후 스레드에서 대화 이어가기
- **세션 유지**: 대화 맥락을 기억해서 연속 작업 가능
- **이미지 분석**: 이미지를 첨부하면 Claude가 분석
- **영상 분석**: 영상 파일 업로드 또는 YouTube/Loom/Vimeo URL 공유 시 프레임 추출 후 분석
- **음성 메시지 (STT)**: 음성 메시지 전송 시 whisper-cpp로 자동 변환 후 처리
- **@유저 멘션 감시**: 특정 사용자의 멘션을 모니터링하고 이슈 분석 후 DM + TTS 음성으로 알림
- **파일 편집**: 코드 수정, Git 명령어 등 Claude Code 전체 기능
- **Socket Mode**: ngrok이나 공개 URL 불필요 - WebSocket으로 직접 연결

---

## 사전 준비물

| 항목 | 설명 | 설치 방법 |
|------|------|----------|
| Node.js | 버전 18 이상 | [nodejs.org](https://nodejs.org/) |
| Claude Code | Anthropic CLI 도구 | `npm install -g @anthropic-ai/claude-code` |
| Slack 워크스페이스 | 관리자 권한 필요 | - |

### 선택사항 (멀티미디어 기능용)

| 항목 | 설명 | 설치 방법 |
|------|------|----------|
| ffmpeg | 영상 프레임 추출 & 오디오 변환 | `brew install ffmpeg` |
| whisper-cpp | 음성 메시지 STT (음성→텍스트) | [github.com/ggerganov/whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| yt-dlp | YouTube/Loom/Vimeo URL 영상 다운로드 | `brew install yt-dlp` |

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

### 2-2. Socket Mode 활성화

1. 왼쪽 메뉴에서 **Socket Mode** 클릭
2. **Enable Socket Mode** 토글 켜기
3. `connections:write` 스코프로 **App-Level Token** 생성
4. 토큰 복사 (`xapp-`로 시작)

### 2-3. 권한 설정

1. 왼쪽 메뉴에서 **OAuth & Permissions** 클릭
2. **Scopes** 섹션으로 스크롤
3. **Bot Token Scopes**에서 아래 권한 모두 추가:

| Scope | 설명 |
|-------|------|
| `chat:write` | 메시지 보내기 |
| `im:history` | DM 읽기 |
| `im:read` | DM 채널 접근 |
| `app_mentions:read` | 멘션 읽기 |
| `channels:history` | 채널 메시지 읽기 |
| `files:read` | 업로드된 파일 읽기 (이미지, 영상, 음성) |
| `files:write` | 파일 업로드 (TTS 음성 응답) |
| `users:read` | 사용자 정보 읽기 (!whoami 및 멘션 감시용) |

### 2-4. 이벤트 구독 설정

1. 왼쪽 메뉴에서 **Event Subscriptions** 클릭
2. **Enable Events** 토글 켜기
3. **Subscribe to bot events**에서 추가:

| Event | 설명 |
|-------|------|
| `message.im` | DM 메시지 |
| `app_mention` | @멘션 |
| `message.channels` | 채널 메시지 (스레드 및 멘션 감시용) |

4. **Save Changes** 클릭

### 2-5. 앱 설치

1. 같은 페이지 상단의 **Install to Workspace** 클릭
2. **허용** 클릭
3. **Bot User OAuth Token** 복사 (`xoxb-`로 시작)

---

## 3단계: 서버 설정 및 실행

### 3-1. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열고 수정:

```env
# 필수: 2-5단계에서 복사한 Bot Token
SLACK_BOT_TOKEN=xoxb-여기에-토큰-붙여넣기

# 필수: 2-2단계에서 복사한 App-Level Token (Socket Mode)
SLACK_APP_TOKEN=xapp-여기에-토큰-붙여넣기

# 필수: 허용된 사용자 ID (쉼표로 구분)
# 확인 방법: Slack 프로필 > 더보기 > 멤버 ID 복사
ALLOWED_USERS=U0XXXXXXXX

# 선택: 특정 사용자의 멘션 감시
# 이 사용자가 채널에서 @멘션되면 이슈 분석 후 DM으로 알림 전송
WATCH_USER_ID=U0YYYYYYYY

# 선택: macOS TTS 음성 (기본값: Yuna)
TTS_VOICE=Yuna

# 선택: Claude가 접근할 수 있는 디렉토리 (쉼표로 구분)
CLAUDE_ALLOWED_DIRS=~/projects,~/work

# 선택: 권한 확인 건너뛰기 (기본값: false)
CLAUDE_SKIP_PERMISSIONS=true

# 선택: 사용할 Claude 모델 (기본값: opus)
CLAUDE_MODEL=opus
```

### 3-2. 서버 실행

```bash
npm start
```

정상 실행 시:

```
⚡️ Bolt app is running in Socket Mode!
[Server] Commands:
         !new, !reset       - Start new session
         !session <id>      - Switch session
         !session           - View current session
         !whoami            - User info
```

> ngrok이 필요 없습니다! Socket Mode는 WebSocket으로 직접 연결됩니다.

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

> 채널에서 사용하려면 먼저 봇을 채널에 초대: `/invite @봇이름`

### 스레드에서 이어가기

멘션으로 시작한 대화는 스레드에서 멘션 없이 계속할 수 있습니다.

### 이미지 분석

메시지에 이미지를 첨부하면 Claude가 분석합니다.

### 영상 분석

- Slack에 영상 파일 직접 업로드
- 또는 URL 공유 (YouTube, Loom, Vimeo, .mp4 직접 링크)

1초당 1프레임을 추출하여 Claude가 분석합니다.

### 음성 메시지

음성 메시지나 오디오 파일을 전송하면 whisper-cpp로 자동 변환 후 텍스트로 처리됩니다.

---

## 특수 명령어

| 명령어 | 설명 |
|--------|------|
| `!new` | 새 세션 시작 (대화 초기화) |
| `!reset` | 새 세션 시작 (위와 동일) |
| `!session` | 현재 세션 ID 확인 |
| `!session 세션ID` | 특정 세션으로 전환 |
| `!whoami` | Slack 사용자 정보 확인 |

> `/`가 아닌 `!`를 사용하세요 (Slack 슬래시 명령어 충돌 방지)

---

## 터미널 ↔ Slack 세션 공유

### 터미널 → Slack

1. 터미널에서 Claude Code 실행: `claude`
2. `/sessions` 입력해서 세션 ID 확인
3. Slack에서: `!session 세션ID`

### Slack → 터미널

> Slack에서 시작한 세션은 터미널에서 이어갈 수 없습니다 (기술적 제한)

---

## @유저 멘션 감시

`WATCH_USER_ID`를 설정하면 모든 채널에서 해당 사용자의 멘션을 모니터링합니다.

**작동 방식:**
1. 누군가 감시 대상 사용자를 채널에서 멘션 (예: `@Evan 이 버그 확인해주세요`)
2. 봇이 메시지, 스레드 컨텍스트, 첨부 미디어를 수집
3. Claude가 이슈를 분석하고 요약 생성
4. 감시 대상 사용자에게 DM으로 요약 전송
5. macOS TTS 음성 요약도 첨부 (macOS만 지원)

멘션 메시지에 첨부된 이미지, 영상, 음성 메시지, 영상 URL도 모두 분석합니다.

---

## 문제 해결

### 봇이 응답 안 함

- 서버 로그 확인: `npm start`로 실행 후 로그 확인
- Slack 앱 설정에서 Socket Mode가 활성화되어 있는지 확인
- `SLACK_BOT_TOKEN`과 `SLACK_APP_TOKEN` 둘 다 설정되어 있는지 확인
- Slack 앱 권한 확인 (모든 scope 추가했는지)

### "처리 중..."에서 멈춤

- Claude Code가 설치되어 있는지, 로그인되어 있는지 확인
- 첫 번째 요청은 초기화로 인해 느릴 수 있음 (30초~1분)
- 타임아웃: 기본 5분

### 멀티미디어가 안 됨

- **이미지**: `files:read` scope가 추가되어 있는지 확인
- **영상 프레임**: `ffmpeg` 설치 확인 (`brew install ffmpeg`)
- **음성 STT**: `whisper-cpp` 설치 및 모델 파일 확인 (`~/.cache/whisper-cpp/ggml-medium.bin`)
- **영상 URL**: `yt-dlp` 설치 확인 (`brew install yt-dlp`)

---

## 고급 설정

### PM2로 백그라운드 실행

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

### 환경 변수 레퍼런스

| 변수 | 설명 | 기본값 | 필수 |
|------|------|--------|------|
| `SLACK_BOT_TOKEN` | Slack Bot 토큰 (`xoxb-`) | - | Yes |
| `SLACK_APP_TOKEN` | Slack App-Level 토큰 (`xapp-`) | - | Yes |
| `ALLOWED_USERS` | 허용된 사용자 ID (쉼표 구분) | - | Yes |
| `WATCH_USER_ID` | 멘션 감시 대상 사용자 ID | - | No |
| `TTS_VOICE` | macOS TTS 음성 이름 | `Yuna` | No |
| `CLAUDE_ALLOWED_DIRS` | 접근 허용 디렉토리 | - | No |
| `CLAUDE_SKIP_PERMISSIONS` | 권한 확인 건너뛰기 | `false` | No |
| `CLAUDE_MODEL` | 사용할 모델 | `opus` | No |

---

## License

MIT
