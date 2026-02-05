import 'dotenv/config';
import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { WebClient } from '@slack/web-api';

const app = express();
const PORT = process.env.PORT || 3005;

// Slack 설정
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
if (!SLACK_BOT_TOKEN) {
  console.error('[Error] SLACK_BOT_TOKEN 환경변수가 필요합니다!');
  process.exit(1);
}
const slack = new WebClient(SLACK_BOT_TOKEN);

// 브릿지 디렉토리 설정
const BRIDGE_DIR = join(homedir(), '.claude', 'slack-bridge');
const INBOX_FILE = join(BRIDGE_DIR, 'inbox.json');
const SESSIONS_FILE = join(BRIDGE_DIR, 'sessions.json');
const THREADS_FILE = join(BRIDGE_DIR, 'threads.json');

// 디렉토리 생성
if (!existsSync(BRIDGE_DIR)) {
  mkdirSync(BRIDGE_DIR, { recursive: true });
}

// inbox.json 초기화
if (!existsSync(INBOX_FILE)) {
  writeFileSync(INBOX_FILE, JSON.stringify({ messages: [], lastChecked: null }, null, 2));
}

// sessions.json 초기화 (사용자별 세션 ID 저장)
if (!existsSync(SESSIONS_FILE)) {
  writeFileSync(SESSIONS_FILE, JSON.stringify({}, null, 2));
}

// threads.json 초기화 (활성 스레드 추적)
if (!existsSync(THREADS_FILE)) {
  writeFileSync(THREADS_FILE, JSON.stringify({}, null, 2));
}

// 세션 관리 함수
function getSessions() {
  return JSON.parse(readFileSync(SESSIONS_FILE, 'utf-8'));
}

function saveSession(userId, sessionId) {
  const sessions = getSessions();
  sessions[userId] = sessionId;
  writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function getSession(userId) {
  const sessions = getSessions();
  return sessions[userId];
}

function clearSession(userId) {
  const sessions = getSessions();
  delete sessions[userId];
  writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

// 스레드 관리 함수
function getThreads() {
  return JSON.parse(readFileSync(THREADS_FILE, 'utf-8'));
}

function saveThread(threadKey, userId) {
  const threads = getThreads();
  threads[threadKey] = { userId, createdAt: new Date().toISOString() };
  writeFileSync(THREADS_FILE, JSON.stringify(threads, null, 2));
}

function isActiveThread(threadKey) {
  const threads = getThreads();
  return !!threads[threadKey];
}

function getThreadUser(threadKey) {
  const threads = getThreads();
  return threads[threadKey]?.userId;
}

app.use(express.json());

// Slack Events API 엔드포인트
app.post('/slack/events', (req, res) => {
  const { type, challenge, event } = req.body;

  // URL 검증 (Event Subscriptions 설정 시 필요)
  if (type === 'url_verification') {
    console.log('[Slack] URL verification received');
    return res.json({ challenge });
  }

  // 이벤트 처리
  if (type === 'event_callback' && event) {
    handleSlackEvent(event);
  }

  // Slack에게 즉시 200 응답 (3초 내 응답 필요)
  res.status(200).send('OK');
});

async function handleSlackEvent(event) {
  // 봇 자신의 메시지는 무시
  if (event.bot_id || event.subtype === 'bot_message') {
    return;
  }

  // DM, 멘션, 또는 활성 스레드 메시지 처리
  const isDM = event.type === 'message' && event.channel_type === 'im';
  const isMention = event.type === 'app_mention';
  const threadKey = event.thread_ts ? `${event.channel}-${event.thread_ts}` : null;
  const isThreadReply = threadKey && isActiveThread(threadKey);

  if (!isDM && !isMention && !isThreadReply) {
    return;
  }

  // 멘션에서 봇 ID 제거 (예: "<@U0AA8NX69FU> 안녕" → "안녕")
  let userMessage = event.text || '';
  userMessage = userMessage.replace(/<@[A-Z0-9]+>\s*/g, '').trim();
  const userId = event.user;
  // 스레드 ts 결정: 스레드 내 메시지면 thread_ts, 아니면 현재 메시지 ts
  const replyThreadTs = event.thread_ts || event.ts;
  console.log(`[Slack] Message from ${userId}: ${userMessage.substring(0, 50)}...`);

  // 특수 명령어 처리 (! 또는 / 접두사 지원)
  const msg = userMessage.toLowerCase();
  if (msg === '!new' || msg === '!reset' || msg === '/new' || msg === '/reset') {
    clearSession(userId);
    await slack.chat.postMessage({
      channel: event.channel,
      text: '🔄 새 세션이 시작되었습니다.',
      thread_ts: replyThreadTs
    });
    return;
  }

  // 세션 전환 명령어: !session <id>
  const sessionMatch = userMessage.match(/^[!\/]session\s+(.+)$/i);
  if (sessionMatch) {
    const newSessionId = sessionMatch[1].trim();
    saveSession(userId, newSessionId);
    await slack.chat.postMessage({
      channel: event.channel,
      text: `🔗 세션이 전환되었습니다: \`${newSessionId}\``,
      thread_ts: replyThreadTs
    });
    return;
  }

  // 현재 세션 확인 명령어: !session 또는 !sessions
  if (msg === '!session' || msg === '!sessions' || msg === '/session' || msg === '/sessions') {
    const currentSession = getSession(userId);
    await slack.chat.postMessage({
      channel: event.channel,
      text: currentSession
        ? `📍 현재 세션: \`${currentSession}\``
        : '❌ 활성 세션이 없습니다.',
      thread_ts: replyThreadTs
    });
    return;
  }

  // 멘션으로 시작된 스레드 저장
  if (isMention && !event.thread_ts) {
    const newThreadKey = `${event.channel}-${event.ts}`;
    saveThread(newThreadKey, userId);
    console.log(`[Slack] New thread started: ${newThreadKey}`);
  }

  // inbox에 메시지 추가
  const inbox = JSON.parse(readFileSync(INBOX_FILE, 'utf-8'));
  inbox.messages.push({
    id: `${event.channel}-${event.ts}`,
    type: 'dm',
    channel: event.channel,
    user: userId,
    text: userMessage,
    ts: event.ts,
    receivedAt: new Date().toISOString()
  });
  writeFileSync(INBOX_FILE, JSON.stringify(inbox, null, 2));

  // "처리 중" 메시지 전송
  try {
    await slack.chat.postMessage({
      channel: event.channel,
      text: `⏳ 처리 중...`,
      thread_ts: replyThreadTs
    });
  } catch (err) {
    console.error('[Slack] Failed to send processing message:', err.message);
  }

  // Claude Code 실행
  try {
    const result = await runClaudeCode(userId, userMessage);

    // 결과를 Slack으로 전송 (4000자 제한 고려)
    const maxLen = 3900;
    const response = result.length > maxLen
      ? result.substring(0, maxLen) + '\n\n... (truncated)'
      : result;

    await slack.chat.postMessage({
      channel: event.channel,
      text: response || '(빈 응답)',
      thread_ts: replyThreadTs
    });
    console.log(`[Slack] Response sent to ${event.channel}`);
  } catch (err) {
    console.error('[Claude] Error:', err.message);
    await slack.chat.postMessage({
      channel: event.channel,
      text: `❌ 오류 발생: ${err.message}`,
      thread_ts: replyThreadTs
    });
  }
}

function runClaudeCode(userId, prompt) {
  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';

    // 기존 세션 확인
    let sessionId = getSession(userId);
    let args;

    // 환경변수에서 옵션 구성
    const allowedDirs = process.env.CLAUDE_ALLOWED_DIRS || '';
    const skipPermissions = process.env.CLAUDE_SKIP_PERMISSIONS === 'true';
    const model = process.env.CLAUDE_MODEL || 'opus';

    let baseOpts = `--model ${model}`;
    if (allowedDirs) {
      baseOpts += ' ' + allowedDirs.split(',').map(d => `--add-dir ${d.trim()}`).join(' ');
    }
    if (skipPermissions) {
      baseOpts += ' --dangerously-skip-permissions';
    }

    if (sessionId) {
      // 기존 세션 이어가기
      console.log(`[Claude] Resuming session ${sessionId} for user ${userId}`);
      args = `echo ${JSON.stringify(prompt)} | claude -p --resume ${sessionId} ${baseOpts}`;
    } else {
      // 새 세션 시작
      sessionId = randomUUID();
      saveSession(userId, sessionId);
      console.log(`[Claude] New session ${sessionId} for user ${userId}`);
      args = `echo ${JSON.stringify(prompt)} | claude -p --session-id ${sessionId} ${baseOpts}`;
    }

    const claude = spawn('sh', ['-c', args], {
      env: { ...process.env, TERM: 'dumb' }
    });

    claude.stdout.on('data', (data) => {
      output += data.toString();
    });

    claude.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    claude.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim() || errorOutput.trim());
      } else {
        // 세션 오류 시 세션 초기화 후 재시도
        if (errorOutput.includes('session') || errorOutput.includes('resume')) {
          clearSession(userId);
        }
        reject(new Error(errorOutput.trim() || `Exit code: ${code}`));
      }
    });

    claude.on('error', (err) => {
      reject(err);
    });

    // 5분 타임아웃
    setTimeout(() => {
      claude.kill();
      reject(new Error('Timeout: 5분 초과'));
    }, 5 * 60 * 1000);
  });
}

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// inbox 상태 확인 (디버깅용)
app.get('/inbox', (req, res) => {
  const inbox = JSON.parse(readFileSync(INBOX_FILE, 'utf-8'));
  res.json(inbox);
});

// inbox 클리어 (디버깅용)
app.delete('/inbox', (req, res) => {
  writeFileSync(INBOX_FILE, JSON.stringify({ messages: [], lastChecked: null }, null, 2));
  res.json({ status: 'cleared' });
});

// 세션 목록 (디버깅용)
app.get('/sessions', (req, res) => {
  res.json(getSessions());
});

app.listen(PORT, () => {
  console.log(`[Server] Slack Bridge running on port ${PORT}`);
  console.log(`[Server] Inbox file: ${INBOX_FILE}`);
  console.log(`[Server] Sessions file: ${SESSIONS_FILE}`);
  console.log(`[Server] Endpoints:`);
  console.log(`         POST /slack/events - Slack webhook`);
  console.log(`         GET  /health       - Health check`);
  console.log(`         GET  /inbox        - View inbox`);
  console.log(`         DELETE /inbox      - Clear inbox`);
  console.log(`         GET  /sessions     - View sessions`);
  console.log(`[Server] Commands:`);
  console.log(`         /new, /reset       - Start new session`);
});
