# Slack-Claude Bridge v2.0

Slack에서 AI(Claude)와 대화할 수 있는 개인용 봇입니다.
폰에서도 Slack 앱으로 Claude에게 코드 수정, 파일 관리, 질문 등을 시킬 수 있습니다.

**Control Claude Code from anywhere via Slack.**
Chat with Claude from your phone - edit files, run commands, analyze images/videos, and more.

---

## 이런 걸 할 수 있어요

- Slack DM으로 Claude와 대화
- 채널에서 `@봇이름`으로 호출
- 이미지 보내면 분석
- 영상 보내면 프레임 추출해서 분석 (YouTube/Loom URL도 가능)
- 음성 메시지 보내면 텍스트로 변환해서 처리
- 누가 나를 @멘션하면 이슈 분석해서 DM으로 알려줌

---

## 시작하기 전에 필요한 것

| 필요한 것 | 왜 필요한지 |
|----------|-----------|
| Mac 또는 Linux 컴퓨터 | 서버를 돌릴 컴퓨터 |
| Slack 워크스페이스 | 봇을 설치할 Slack (관리자 권한 필요) |

아래 과정에서 나머지는 하나씩 설치합니다.

---

## 1단계: 터미널 열기

> "터미널"은 컴퓨터에게 텍스트로 명령을 내리는 프로그램입니다.

### Mac에서 터미널 여는 법
1. `Cmd + Space` 를 누르면 Spotlight 검색창이 뜹니다
2. `터미널` 또는 `Terminal` 이라고 입력
3. "Terminal" 앱을 클릭

검은색(또는 흰색) 창이 뜨면 성공입니다. 여기에 명령어를 붙여넣으면 됩니다.

> 이후 모든 명령어는 이 터미널 창에 **그대로 복사해서 붙여넣기** 하면 됩니다.
> 붙여넣기 후 **Enter** 키를 누르면 실행됩니다.

---

## 2단계: 필수 프로그램 설치

### 2-1. Homebrew 설치 (Mac 전용 프로그램 설치 도구)

> Homebrew는 Mac에서 프로그램을 쉽게 설치할 수 있게 도와주는 도구입니다.
> 이미 설치되어 있을 수 있습니다.

터미널에 아래를 **한 줄 전체** 복사해서 붙여넣기:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

- 비밀번호를 묻는 경우: Mac 로그인 비밀번호를 입력 (입력해도 화면에 안 보이는 게 정상)
- 시간이 좀 걸릴 수 있습니다 (1~5분)

### 2-2. Node.js 설치

> Node.js는 이 봇 서버를 실행하는 데 필요한 프로그램입니다.

```bash
brew install node
```

설치 확인:

```bash
node --version
```

`v18.0.0` 이상의 숫자가 나오면 성공입니다.

### 2-3. Claude Code 설치

> Claude Code는 AI Claude를 터미널에서 사용할 수 있게 해주는 도구입니다.

```bash
npm install -g @anthropic-ai/claude-code
```

설치 후 로그인:

```bash
claude
```

화면에 나오는 안내를 따라 로그인합니다. (Anthropic 계정 필요)

---

## 3단계: 봇 코드 다운로드

> `git clone`은 인터넷에 있는 코드를 내 컴퓨터로 복사하는 명령어입니다.

```bash
git clone https://github.com/djatjdwns28/slack-bot-claude-code-local.git
```

> 만약 `git: command not found` 에러가 나오면:
> ```bash
> brew install git
> ```
> 설치 후 위 명령어를 다시 실행하세요.

다운로드한 폴더로 이동:

```bash
cd slack-bot-claude-code-local
```

필요한 패키지 설치:

```bash
npm install
```

> `npm install`은 이 프로젝트가 사용하는 추가 도구들을 자동으로 다운로드합니다.
> 경고(WARN) 메시지가 나와도 괜찮습니다. 에러(ERR!)만 아니면 됩니다.

---

## 4단계: Slack 앱 만들기

이 단계는 터미널이 아니라 **웹 브라우저**에서 진행합니다.

### 4-1. 새 앱 생성

1. 브라우저에서 [https://api.slack.com/apps](https://api.slack.com/apps) 접속
2. 오른쪽 위 **Create New App** 버튼 클릭
3. **From scratch** 선택
4. **App Name**: 원하는 이름 입력 (예: `Claude Bot`)
5. **Pick a workspace**: 봇을 설치할 Slack 워크스페이스 선택
6. **Create App** 클릭

### 4-2. Socket Mode 켜기

> Socket Mode를 켜면 외부 URL 없이도 봇이 Slack과 통신할 수 있습니다.

1. 왼쪽 메뉴에서 **Socket Mode** 클릭
2. **Enable Socket Mode** 토글을 켜기
3. 토큰 이름을 입력하라고 나오면 아무 이름이나 입력 (예: `socket-token`)
4. **Generate** 클릭
5. `xapp-` 로 시작하는 토큰이 나타남 → **복사해서 메모장에 저장**

### 4-3. 권한(Scope) 설정

> 봇이 Slack에서 어떤 일을 할 수 있는지 허용 범위를 설정합니다.

1. 왼쪽 메뉴에서 **OAuth & Permissions** 클릭
2. 스크롤을 내려서 **Scopes** 섹션 찾기
3. **Bot Token Scopes** 아래에 있는 **Add an OAuth Scope** 버튼 클릭
4. 아래 목록을 **하나씩** 검색해서 추가:

| 추가할 Scope | 하는 일 |
|-------------|--------|
| `chat:write` | 봇이 메시지를 보냄 |
| `im:history` | 봇이 DM을 읽음 |
| `im:read` | 봇이 DM 채널에 접근 |
| `app_mentions:read` | 봇이 @멘션을 읽음 |
| `channels:history` | 봇이 채널 메시지를 읽음 |
| `files:read` | 봇이 첨부파일(이미지, 영상, 음성)을 읽음 |
| `files:write` | 봇이 파일을 업로드 (음성 응답용) |
| `users:read` | 봇이 사용자 정보를 읽음 |

### 4-4. 이벤트 구독 설정

> 봇이 어떤 일이 일어났을 때 알림을 받을지 설정합니다.

1. 왼쪽 메뉴에서 **Event Subscriptions** 클릭
2. **Enable Events** 토글을 켜기
3. 아래쪽 **Subscribe to bot events** 클릭해서 펼치기
4. **Add Bot User Event** 버튼을 눌러 아래 3개를 추가:

| 추가할 Event | 하는 일 |
|-------------|--------|
| `message.im` | 누가 봇에게 DM을 보냈을 때 |
| `app_mention` | 누가 채널에서 @봇이름 했을 때 |
| `message.channels` | 채널에 메시지가 올라왔을 때 |

5. 페이지 하단 **Save Changes** 클릭

### 4-5. 앱 설치

1. 왼쪽 메뉴에서 **OAuth & Permissions** 클릭
2. 페이지 상단의 **Install to Workspace** 버튼 클릭
3. **허용** 클릭
4. `xoxb-` 로 시작하는 **Bot User OAuth Token**이 나타남 → **복사해서 메모장에 저장**

> 이제 메모장에 토큰 2개가 있어야 합니다:
> - `xapp-...` (Socket Mode 토큰)
> - `xoxb-...` (Bot 토큰)

---

## 5단계: 서버 설정

다시 **터미널**로 돌아옵니다.

### 5-1. 환경 변수 파일 만들기

> 환경 변수 파일은 봇의 비밀 설정값(토큰 등)을 저장하는 파일입니다.

```bash
cp .env.example .env
```

> 이 명령은 예시 파일을 복사해서 `.env` 파일을 만듭니다.

### 5-2. 설정 파일 편집

아래 명령어로 편집기를 엽니다:

```bash
nano .env
```

> `nano`는 터미널에서 텍스트 파일을 편집하는 프로그램입니다.
> 마우스는 작동하지 않고, 키보드 화살표로 이동합니다.

파일 내용을 **전부 지우고** 아래 내용을 붙여넣기 합니다.
`여기에-붙여넣기` 부분을 아까 메모장에 저장한 값으로 바꿔주세요:

```env
SLACK_BOT_TOKEN=xoxb-여기에-Bot-토큰-붙여넣기
SLACK_APP_TOKEN=xapp-여기에-Socket-토큰-붙여넣기
ALLOWED_USERS=여기에-내-Slack-ID
CLAUDE_SKIP_PERMISSIONS=true
CLAUDE_MODEL=sonnet
```

**내 Slack ID 확인 방법:**
1. Slack 앱에서 내 프로필 사진 클릭
2. **프로필 보기** 또는 **Profile** 클릭
3. 점 세 개(`...`) 메뉴 클릭
4. **멤버 ID 복사** 클릭
5. `U` 로 시작하는 코드가 복사됨 (예: `U0AA8NX69FU`)

편집이 끝나면:
1. `Ctrl + O` 누르기 (저장)
2. `Enter` 누르기 (파일명 확인)
3. `Ctrl + X` 누르기 (편집기 종료)

### 5-3. 서버 실행

```bash
npm start
```

아래와 비슷한 메시지가 나오면 성공:

```
⚡️ Bolt app is running in Socket Mode!
```

> 이 터미널 창은 **닫지 마세요!** 닫으면 봇이 꺼집니다.
> 봇을 끄고 싶으면 `Ctrl + C` 를 누르세요.

---

## 6단계: 사용하기

### Slack에서 봇과 대화하기

1. Slack 앱을 엽니다 (폰이든 PC든)
2. 왼쪽 메뉴에서 **앱** 섹션을 찾거나, 상단 검색에서 봇 이름 검색
3. 봇에게 DM을 보냅니다

```
안녕! 넌 뭘 할 수 있어?
```

### 채널에서 사용하기

1. 채널에서 `/invite @봇이름` 입력해서 봇 초대
2. `@봇이름 질문` 형태로 멘션

```
@Claude 오늘 날씨 어때?
```

멘션 후에는 스레드에서 @멘션 없이 대화를 이어갈 수 있습니다.

### 이미지 보내기

메시지에 이미지를 첨부하면 Claude가 분석해줍니다.

### 영상 보내기

- Slack에 영상 파일을 직접 올리거나
- YouTube, Loom, Vimeo URL을 보내면
- 자동으로 프레임을 추출해서 분석합니다

### 음성 메시지 보내기

Slack에서 음성 메시지를 녹음해서 보내면 텍스트로 변환 후 처리합니다.
(whisper-cpp 설치 필요 - 아래 "추가 설치" 참고)

---

## 특수 명령어

채팅창에 아래 명령어를 입력할 수 있습니다:

| 입력 | 하는 일 |
|------|--------|
| `!new` | 대화 초기화 (새로 시작) |
| `!reset` | 대화 초기화 (위와 같음) |
| `!session` | 현재 세션 ID 보기 |
| `!session 세션ID` | 다른 세션으로 전환 |
| `!whoami` | 내 Slack 정보 보기 |

---

## 컴퓨터 껐다 켰을 때 다시 시작하는 법

1. 터미널을 열고
2. 아래 명령어를 순서대로 실행:

```bash
cd slack-bot-claude-code-local
npm start
```

---

## 항상 켜두고 싶다면 (PM2)

> PM2는 서버를 백그라운드에서 자동으로 실행해주는 도구입니다.
> 터미널을 닫아도 봇이 계속 돌아갑니다.

```bash
npm install -g pm2
```

```bash
pm2 start ecosystem.config.cjs
```

```bash
pm2 save
```

잘 돌아가는지 확인:

```bash
pm2 status
```

`online` 이라고 나오면 성공입니다.

로그 확인:

```bash
pm2 logs
```

> 종료: `pm2 stop slack-claude`
> 재시작: `pm2 restart slack-claude`
> 완전 삭제: `pm2 delete slack-claude`

---

## 추가 설치 (멀티미디어 기능)

영상 분석, 음성 인식 기능을 쓰려면 추가 설치가 필요합니다.
**기본 대화, 이미지 분석만 쓸 거라면 건너뛰어도 됩니다.**

### ffmpeg (영상 프레임 추출용)

```bash
brew install ffmpeg
```

### yt-dlp (YouTube 등 URL 영상 다운로드용)

```bash
brew install yt-dlp
```

### whisper-cpp (음성 → 텍스트 변환용)

이 설치는 조금 복잡합니다. 음성 기능이 필요 없다면 건너뛰세요.

```bash
brew install whisper-cpp
```

모델 다운로드 (약 1.5GB):

```bash
mkdir -p ~/.cache/whisper-cpp
curl -L "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin" -o ~/.cache/whisper-cpp/ggml-medium.bin
```

---

## @멘션 감시 기능

누군가 Slack에서 나를 @멘션하면, 봇이 자동으로 이슈를 분석해서 DM으로 알려주는 기능입니다.

사용하려면 `.env` 파일에 아래 줄을 추가:

```env
WATCH_USER_ID=내-Slack-ID
```

(내 Slack ID는 5단계에서 확인한 `U...` 코드)

설정 후 서버를 재시작하면 됩니다.

---

## 환경 변수 전체 목록

`.env` 파일에 넣을 수 있는 설정값들:

| 설정 | 설명 | 필수? |
|------|------|------|
| `SLACK_BOT_TOKEN` | Slack Bot 토큰 (`xoxb-`로 시작) | 필수 |
| `SLACK_APP_TOKEN` | Slack App 토큰 (`xapp-`로 시작) | 필수 |
| `ALLOWED_USERS` | 봇을 사용할 수 있는 사용자 ID (여러 명이면 쉼표로 구분) | 필수 |
| `WATCH_USER_ID` | 멘션 감시할 사용자 ID | 선택 |
| `TTS_VOICE` | 음성 알림 목소리 (Mac 전용, 기본: `Yuna`) | 선택 |
| `CLAUDE_ALLOWED_DIRS` | Claude가 접근할 수 있는 폴더 (쉼표로 구분) | 선택 |
| `CLAUDE_SKIP_PERMISSIONS` | 권한 확인 건너뛰기 (`true` 추천) | 선택 |
| `CLAUDE_MODEL` | AI 모델 (`opus`=최고성능, `sonnet`=빠름, `haiku`=가벼움) | 선택 |

---

## 문제가 생겼을 때

### "command not found" 에러

해당 프로그램이 설치 안 된 것입니다. 2단계로 돌아가서 설치하세요.

### 봇이 응답을 안 해요

- 터미널에서 서버가 실행 중인지 확인 (`npm start` 실행 상태여야 함)
- `.env` 파일에 토큰이 제대로 들어갔는지 확인
- Slack 앱 설정에서 Socket Mode가 켜져 있는지 확인

### "처리 중..."에서 멈춰요

- Claude Code가 로그인되어 있는지 확인 (터미널에서 `claude` 입력)
- 첫 요청은 30초~1분 걸릴 수 있습니다
- 5분 넘게 멈추면 `Ctrl + C`로 서버 종료 후 `npm start`로 재시작

### 영상/음성이 안 돼요

"추가 설치" 섹션의 프로그램들이 설치되어 있는지 확인하세요.

---

## License

MIT
