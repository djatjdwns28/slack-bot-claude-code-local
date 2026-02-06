import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { unlink, rm } from 'fs/promises';
import { join } from 'path';
import { homedir, tmpdir } from 'os';
import { spawn, execSync } from 'child_process';
import { randomUUID } from 'crypto';
import pkg from '@slack/bolt';
const { App } = pkg;

// Slack 설정
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN;
const ALLOWED_USERS = process.env.ALLOWED_USERS?.split(',').map(u => u.trim()) || [];
const WATCH_USER_ID = process.env.WATCH_USER_ID || ''; // 멘션 감시 대상 사용자 ID
const TTS_VOICE = process.env.TTS_VOICE || 'Yuna'; // macOS TTS 음성

if (!SLACK_BOT_TOKEN) {
  console.error('[Error] SLACK_BOT_TOKEN 환경변수가 필요합니다!');
  process.exit(1);
}
if (!SLACK_APP_TOKEN) {
  console.error('[Error] SLACK_APP_TOKEN 환경변수가 필요합니다!');
  process.exit(1);
}
if (ALLOWED_USERS.length === 0) {
  console.error('[Error] ALLOWED_USERS가 필요합니다! 보안을 위해 허용된 사용자를 설정하세요.');
  console.error('        예: ALLOWED_USERS=U0XXXXXXXX,U0YYYYYYYY');
  process.exit(1);
}
console.log(`[Security] 허용된 사용자: ${ALLOWED_USERS.join(', ')}`);

// Bolt App 초기화 (Socket Mode)
const app = new App({
  token: SLACK_BOT_TOKEN,
  appToken: SLACK_APP_TOKEN,
  socketMode: true,
});

// 브릿지 디렉토리 설정
const BRIDGE_DIR = join(homedir(), '.claude', 'slack-bridge');
const INBOX_FILE = join(BRIDGE_DIR, 'inbox.json');
const SESSIONS_FILE = join(BRIDGE_DIR, 'sessions.json');
const THREADS_FILE = join(BRIDGE_DIR, 'threads.json');

// 이미지 임시 저장 설정
const TEMP_IMAGE_DIR = join(tmpdir(), 'slack-claude-images');
const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const VIDEO_FPS = 1; // 초당 1프레임 추출
const SUPPORTED_AUDIO_TYPES = ['audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/wav', 'audio/x-m4a', 'audio/aac', 'audio/flac'];
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB
const WHISPER_MODEL = join(homedir(), '.cache', 'whisper-cpp', 'ggml-medium.bin');
const VIDEO_URL_PATTERNS = [
  /https?:\/\/(?:www\.)?youtube\.com\/watch\?[^\s>]+/gi,
  /https?:\/\/youtu\.be\/[^\s>]+/gi,
  /https?:\/\/(?:www\.)?loom\.com\/share\/[^\s>]+/gi,
  /https?:\/\/(?:www\.)?vimeo\.com\/[^\s>]+/gi,
  /https?:\/\/[^\s>]+\.(?:mp4|mov|webm|avi)(?:\?[^\s>]*)?/gi,
];

// 디렉토리 생성
if (!existsSync(BRIDGE_DIR)) {
  mkdirSync(BRIDGE_DIR, { recursive: true });
}
if (!existsSync(TEMP_IMAGE_DIR)) {
  mkdirSync(TEMP_IMAGE_DIR, { recursive: true });
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

// 사용자 화이트리스트 검증 함수
function isUserAllowed(userId) {
  return ALLOWED_USERS.includes(userId);
}

// 이미지 다운로드 함수
async function downloadSlackImages(files) {
  if (!files || files.length === 0) return [];

  const imageFiles = files.filter(f =>
    SUPPORTED_IMAGE_TYPES.includes(f.mimetype) && f.size <= MAX_IMAGE_SIZE
  );
  if (imageFiles.length === 0) return [];

  const downloaded = [];
  for (const file of imageFiles) {
    try {
      const response = await fetch(file.url_private_download, {
        headers: { 'Authorization': `Bearer ${SLACK_BOT_TOKEN}` }
      });
      if (!response.ok) {
        console.error(`[Image] Download failed ${file.name}: ${response.statusText}`);
        continue;
      }
      const ext = file.name?.split('.').pop() || 'png';
      const filePath = join(TEMP_IMAGE_DIR, `${randomUUID()}.${ext}`);
      writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
      console.log(`[Image] Downloaded: ${file.name} -> ${filePath}`);
      downloaded.push({ path: filePath, name: file.name });
    } catch (err) {
      console.error(`[Image] Error downloading ${file.name}:`, err.message);
    }
  }
  return downloaded;
}

// 임시 파일 정리 (파일 목록 + 디렉토리 목록)
async function cleanupTempFiles(files, dirs) {
  for (const file of files) {
    try { await unlink(file.path); } catch (_) {}
  }
  for (const dir of dirs) {
    try { await rm(dir, { recursive: true, force: true }); } catch (_) {}
  }
}

// Slack 영상 다운로드
async function downloadSlackVideo(file) {
  const response = await fetch(file.url_private_download, {
    headers: { 'Authorization': `Bearer ${SLACK_BOT_TOKEN}` }
  });
  if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);
  const ext = file.name?.split('.').pop() || 'mp4';
  const videoPath = join(TEMP_IMAGE_DIR, `${randomUUID()}.${ext}`);
  writeFileSync(videoPath, Buffer.from(await response.arrayBuffer()));
  console.log(`[Video] Downloaded: ${file.name} -> ${videoPath}`);
  return videoPath;
}

// ffmpeg로 영상에서 프레임 추출
function extractVideoFrames(videoPath, fps = VIDEO_FPS) {
  const framesDir = join(TEMP_IMAGE_DIR, `frames_${Date.now()}`);
  mkdirSync(framesDir, { recursive: true });

  try {
    execSync(
      `ffmpeg -i "${videoPath}" -vf "fps=${fps},scale=1920:-1" "${framesDir}/frame_%04d.png" -y`,
      { stdio: 'pipe', timeout: 120000 }
    );
  } catch (err) {
    console.error('[Video] ffmpeg error:', err.stderr?.toString().slice(-200));
    throw new Error('프레임 추출 실패');
  }

  const frames = readdirSync(framesDir)
    .filter(f => f.endsWith('.png'))
    .sort()
    .map(f => ({ path: join(framesDir, f), name: f }));

  console.log(`[Video] Extracted ${frames.length} frames from ${videoPath}`);
  return { frames, framesDir };
}

// 메시지 텍스트에서 영상 URL 추출
function extractVideoUrls(text) {
  const urls = [];
  for (const pattern of VIDEO_URL_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Slack이 URL을 <url|label> 형태로 감싸므로 정리
      let url = match[0].replace(/[<>]/g, '').split('|')[0];
      // Slack 내부 파일 URL은 제외 (event.files로 이미 처리됨)
      if (url.includes('.slack.com/files/')) continue;
      if (!urls.includes(url)) urls.push(url);
    }
  }
  return urls;
}

// yt-dlp로 URL 영상 다운로드
function downloadVideoFromUrl(url) {
  const videoPath = join(TEMP_IMAGE_DIR, `${randomUUID()}.mp4`);
  try {
    execSync(
      `yt-dlp -f "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best" --merge-output-format mp4 -o "${videoPath}" --no-playlist --max-filesize ${MAX_VIDEO_SIZE} "${url}"`,
      { stdio: 'pipe', timeout: 180000 }
    );
    if (!existsSync(videoPath)) throw new Error('다운로드 파일 없음');
    console.log(`[Video URL] Downloaded: ${url} -> ${videoPath}`);
    return videoPath;
  } catch (err) {
    console.error(`[Video URL] yt-dlp error for ${url}:`, err.stderr?.toString().slice(-200) || err.message);
    throw new Error(`URL 영상 다운로드 실패: ${url}`);
  }
}

// Slack 음성 파일 다운로드
async function downloadSlackAudio(file) {
  const response = await fetch(file.url_private_download, {
    headers: { 'Authorization': `Bearer ${SLACK_BOT_TOKEN}` }
  });
  if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);
  const ext = file.name?.split('.').pop() || 'webm';
  const audioPath = join(TEMP_IMAGE_DIR, `${randomUUID()}.${ext}`);
  writeFileSync(audioPath, Buffer.from(await response.arrayBuffer()));
  console.log(`[Audio] Downloaded: ${file.name} -> ${audioPath}`);
  return audioPath;
}

// whisper-cpp로 음성을 텍스트로 변환 (STT)
function transcribeAudio(audioPath) {
  // whisper-cpp는 16kHz WAV만 지원 → ffmpeg로 변환
  const wavPath = join(TEMP_IMAGE_DIR, `${randomUUID()}.wav`);
  try {
    execSync(
      `ffmpeg -i "${audioPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${wavPath}" -y`,
      { stdio: 'pipe', timeout: 60000 }
    );
  } catch (err) {
    console.error('[STT] ffmpeg conversion error:', err.message);
    throw new Error('오디오 변환 실패');
  }

  try {
    const result = execSync(
      `whisper-cli -m "${WHISPER_MODEL}" -l ko --no-prints "${wavPath}"`,
      { stdio: 'pipe', timeout: 300000, encoding: 'utf-8' }
    );
    // 임시 WAV 삭제
    try { execSync(`rm "${wavPath}"`, { stdio: 'pipe' }); } catch (_) {}
    // 타임스탬프 제거: "[00:00:00.000 --> 00:00:02.580]  텍스트" → "텍스트"
    const text = result
      .replace(/\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]\s*/g, '')
      .trim();
    console.log(`[STT] Transcribed (${text.length} chars): ${text.substring(0, 80)}...`);
    return text;
  } catch (err) {
    console.error('[STT] whisper-cpp error:', err.message);
    try { execSync(`rm "${wavPath}"`, { stdio: 'pipe' }); } catch (_) {}
    throw new Error('음성 인식 실패');
  }
}

// macOS TTS로 텍스트를 음성 파일로 변환
function textToAudio(text) {
  const audioPath = join(TEMP_IMAGE_DIR, `tts_${randomUUID()}.aiff`);
  const mp4Path = audioPath.replace('.aiff', '.m4a');
  try {
    // say로 AIFF 생성 후 ffmpeg로 m4a 변환 (Slack 호환)
    execSync(`say -v "${TTS_VOICE}" -o "${audioPath}" ${JSON.stringify(text)}`, {
      stdio: 'pipe', timeout: 60000
    });
    execSync(`ffmpeg -i "${audioPath}" -c:a aac -b:a 128k "${mp4Path}" -y`, {
      stdio: 'pipe', timeout: 30000
    });
    // AIFF 원본 삭제
    try { execSync(`rm "${audioPath}"`, { stdio: 'pipe' }); } catch (_) {}
    console.log(`[TTS] Generated: ${mp4Path}`);
    return mp4Path;
  } catch (err) {
    console.error('[TTS] Error:', err.message);
    return null;
  }
}

// @Evan 멘션 감지 → 이슈 분석 → DM 전송
async function handleWatchUserMention(event) {
  if (!WATCH_USER_ID) return;

  const rawText = event.text || '';
  // 메시지에 감시 대상 사용자가 멘션되었는지 확인
  if (!rawText.includes(`<@${WATCH_USER_ID}>`)) return;

  // 봇 자신의 메시지 무시
  if (event.bot_id || event.subtype === 'bot_message') return;
  // 감시 대상 본인이 보낸 메시지 무시
  if (event.user === WATCH_USER_ID) return;

  console.log(`[Watch] @${WATCH_USER_ID} mentioned in ${event.channel} by ${event.user}`);

  // 보낸 사람 정보 조회
  let senderName = event.user;
  try {
    const userInfo = await app.client.users.info({ user: event.user });
    senderName = userInfo.user?.profile?.display_name || userInfo.user?.real_name || event.user;
  } catch (_) {}

  // 채널 정보 조회
  let channelName = event.channel;
  try {
    const channelInfo = await app.client.conversations.info({ channel: event.channel });
    channelName = channelInfo.channel?.name || event.channel;
  } catch (_) {}

  // 메시지 텍스트 정리 (멘션 제거)
  const cleanText = rawText.replace(/<@[A-Z0-9]+>/g, '').trim();

  // 스레드 컨텍스트 수집 (스레드 내 메시지인 경우)
  let threadContext = '';
  if (event.thread_ts) {
    try {
      const replies = await app.client.conversations.replies({
        channel: event.channel,
        ts: event.thread_ts,
        limit: 20
      });
      if (replies.messages && replies.messages.length > 1) {
        const threadMsgs = replies.messages
          .filter(m => m.ts !== event.ts)
          .slice(-10)
          .map(m => m.text?.replace(/<@[A-Z0-9]+>/g, '').trim())
          .filter(Boolean);
        if (threadMsgs.length > 0) {
          threadContext = `\n\n[스레드 이전 대화]\n${threadMsgs.join('\n')}`;
        }
      }
    } catch (_) {}
  }

  // 미디어 처리 (이미지/영상)
  let mediaFiles = [];
  let mediaDirs = [];
  let mediaPrompt = '';

  if (event.files && event.files.length > 0) {
    // 이미지 다운로드
    const images = await downloadSlackImages(event.files);
    mediaFiles.push(...images);

    // 영상 처리
    const videoFiles = event.files.filter(f =>
      SUPPORTED_VIDEO_TYPES.includes(f.mimetype) && f.size <= MAX_VIDEO_SIZE
    );
    for (const vf of videoFiles) {
      try {
        const videoPath = await downloadSlackVideo(vf);
        const { frames, framesDir } = extractVideoFrames(videoPath);
        mediaFiles.push(...frames);
        mediaDirs.push(framesDir);
        mediaFiles.push({ path: videoPath, name: vf.name });
      } catch (err) {
        console.error(`[Watch Video] Failed: ${err.message}`);
      }
    }
  }

  // 음성 파일 처리 (STT)
  let watchTranscribed = '';
  if (event.files && event.files.length > 0) {
    const audioFiles = event.files.filter(f =>
      SUPPORTED_AUDIO_TYPES.includes(f.mimetype) && f.size <= MAX_AUDIO_SIZE
    );
    for (const af of audioFiles) {
      try {
        const audioPath = await downloadSlackAudio(af);
        const text = transcribeAudio(audioPath);
        if (text) watchTranscribed += (watchTranscribed ? '\n' : '') + text;
        mediaFiles.push({ path: audioPath, name: af.name });
      } catch (err) {
        console.error(`[Watch Audio] STT failed: ${err.message}`);
      }
    }
  }

  // URL 영상 처리
  const videoUrls = extractVideoUrls(rawText);
  for (const url of videoUrls) {
    try {
      const videoPath = downloadVideoFromUrl(url);
      const { frames, framesDir } = extractVideoFrames(videoPath);
      mediaFiles.push(...frames);
      mediaDirs.push(framesDir);
      mediaFiles.push({ path: videoPath, name: url });
    } catch (_) {}
  }

  // 미디어 프롬프트 구성
  if (mediaFiles.length > 0) {
    const frameImages = mediaFiles.filter(f => /^frame_\d+\.png$/.test(f.name));
    const staticImages = mediaFiles.filter(f =>
      !(/^frame_\d+\.png$/.test(f.name)) &&
      !SUPPORTED_VIDEO_TYPES.some(t => f.name?.endsWith(t.split('/')[1])) &&
      !f.name?.startsWith('http')
    );

    if (frameImages.length > 0) {
      mediaPrompt += `\n\n[영상 프레임 ${frameImages.length}개 - Read tool로 분석]\n` +
        frameImages.map((f, i) => `Frame ${i + 1}: ${f.path}`).join('\n');
    }
    if (staticImages.length > 0) {
      mediaPrompt += `\n\n[첨부 이미지 - Read tool로 분석]\n` +
        staticImages.map((f, i) => `Image ${i + 1} (${f.name}): ${f.path}`).join('\n');
    }
  }

  // 음성 메시지 프롬프트
  const audioPrompt = watchTranscribed
    ? `\n\n[음성 메시지 내용]\n${watchTranscribed}`
    : '';

  // Claude로 이슈 분석
  const analysisPrompt = `다음은 Slack #${channelName} 채널에서 ${senderName}님이 나(Evan)를 태그한 메시지입니다.
이슈를 파악하고 한국어로 간결하게 정리해주세요.

[메시지]
${cleanText}${threadContext}${audioPrompt}${mediaPrompt}

다음 형식으로 정리해주세요:
- 채널: #${channelName}
- 보낸 사람: ${senderName}
- 이슈 요약: (핵심 내용 1-2문장)
- 상세 내용: (필요한 경우 부연 설명)
- 미디어 분석: (이미지/영상/음성이 있는 경우 분석 결과)
- 필요한 액션: (내가 해야 할 일)`;

  try {
    const analysis = await runClaudeCode(WATCH_USER_ID, analysisPrompt, [], []);

    // TTS 음성 생성 (요약만 읽기)
    const ttsText = analysis.length > 500 ? analysis.substring(0, 500) : analysis;
    const audioPath = textToAudio(ttsText);

    // Evan에게 DM 전송
    const dmResult = await app.client.chat.postMessage({
      channel: WATCH_USER_ID,
      text: analysis || '(분석 결과 없음)',
    });

    // 음성 파일 업로드
    if (audioPath && existsSync(audioPath)) {
      try {
        await app.client.files.uploadV2({
          channel_id: WATCH_USER_ID,
          thread_ts: dmResult.ts,
          file: audioPath,
          filename: 'issue_summary.m4a',
          title: '이슈 요약 음성',
        });
      } catch (err) {
        console.error('[Watch] Audio upload failed:', err.message);
      }
      // 음성 파일 정리
      try { await unlink(audioPath); } catch (_) {}
    }

    console.log(`[Watch] DM sent to ${WATCH_USER_ID}`);

    // 미디어 임시 파일 정리
    if (mediaFiles.length > 0 || mediaDirs.length > 0) {
      await cleanupTempFiles(mediaFiles, mediaDirs);
    }
  } catch (err) {
    console.error('[Watch] Analysis failed:', err.message);
    // 실패해도 최소한 알림은 전송
    try {
      await app.client.chat.postMessage({
        channel: WATCH_USER_ID,
        text: `#${channelName}에서 ${senderName}님이 태그했습니다:\n> ${cleanText.substring(0, 500)}`,
      });
    } catch (_) {}
    // 미디어 정리
    if (mediaFiles.length > 0 || mediaDirs.length > 0) {
      await cleanupTempFiles(mediaFiles, mediaDirs);
    }
  }
}

// 공통 이벤트 처리 함수
async function handleSlackEvent({ event, say }) {
  const userId = event.user;

  // 봇 자신의 메시지는 무시
  if (event.bot_id || event.subtype === 'bot_message') {
    return;
  }

  // 사용자 화이트리스트 검증
  if (!isUserAllowed(userId)) {
    console.warn(`[Security] 허용되지 않은 사용자: ${userId}`);
    return;
  }

  // 멘션에서 봇 ID 제거 (예: "<@U0AA8NX69FU> 안녕" → "안녕")
  let userMessage = event.text || '';
  userMessage = userMessage.replace(/<@[A-Z0-9]+>\s*/g, '').trim();

  // 스레드 ts 결정: 스레드 내 메시지면 thread_ts, 아니면 현재 메시지 ts
  const replyThreadTs = event.thread_ts || event.ts;
  console.log(`[Slack] Message from ${userId}: ${userMessage.substring(0, 50)}...`);

  // 이미지/영상 다운로드
  let downloadedImages = [];
  let tempDirs = [];
  if (event.files && event.files.length > 0) {
    // 이미지 처리
    downloadedImages = await downloadSlackImages(event.files);

    // 영상 처리: 프레임 추출 → 이미지로 변환
    const videoFiles = event.files.filter(f =>
      SUPPORTED_VIDEO_TYPES.includes(f.mimetype) && f.size <= MAX_VIDEO_SIZE
    );
    for (const vf of videoFiles) {
      try {
        const videoPath = await downloadSlackVideo(vf);
        const { frames, framesDir } = extractVideoFrames(videoPath);
        downloadedImages.push(...frames);
        tempDirs.push(framesDir);
        // 원본 영상 파일도 정리 대상에 추가
        downloadedImages.push({ path: videoPath, name: vf.name });
      } catch (err) {
        console.error(`[Video] Failed to process ${vf.name}:`, err.message);
      }
    }

    if (downloadedImages.length > 0) {
      console.log(`[Slack] Total media files: ${downloadedImages.length}`);
    }
  }

  // 메시지 텍스트에서 영상 URL 감지 및 처리
  const videoUrls = extractVideoUrls(userMessage);
  let hasUrlVideo = false;
  if (videoUrls.length > 0) {
    hasUrlVideo = true;
    console.log(`[Slack] Video URLs detected: ${videoUrls.join(', ')}`);
    for (const url of videoUrls) {
      try {
        const videoPath = downloadVideoFromUrl(url);
        const { frames, framesDir } = extractVideoFrames(videoPath);
        downloadedImages.push(...frames);
        tempDirs.push(framesDir);
        downloadedImages.push({ path: videoPath, name: url });
      } catch (err) {
        console.error(`[Video URL] Failed: ${err.message}`);
      }
    }
  }

  // 음성 파일 처리 (STT)
  let transcribedText = '';
  if (event.files && event.files.length > 0) {
    const audioFiles = event.files.filter(f =>
      SUPPORTED_AUDIO_TYPES.includes(f.mimetype) && f.size <= MAX_AUDIO_SIZE
    );
    for (const af of audioFiles) {
      try {
        const audioPath = await downloadSlackAudio(af);
        const text = transcribeAudio(audioPath);
        if (text) transcribedText += (transcribedText ? '\n' : '') + text;
        downloadedImages.push({ path: audioPath, name: af.name }); // 정리 대상
      } catch (err) {
        console.error(`[Audio] STT failed for ${af.name}:`, err.message);
      }
    }
    if (transcribedText) {
      console.log(`[Slack] Transcribed audio: ${transcribedText.substring(0, 80)}...`);
      // 음성 텍스트를 메시지에 추가
      userMessage = userMessage
        ? `${userMessage}\n\n[음성 메시지 내용]\n${transcribedText}`
        : transcribedText;
    }
  }

  // 특수 명령어 처리 (! 또는 / 접두사 지원)
  const msg = userMessage.toLowerCase();

  // !whoami - 사용자 정보 확인
  if (msg === '!whoami' || msg === '/whoami') {
    try {
      const userInfo = await app.client.users.info({ user: userId });
      const profile = userInfo.user?.profile || {};
      await say({
        text: `👤 *사용자 정보*\n• ID: \`${userId}\`\n• 이름: ${profile.real_name || 'N/A'}\n• 표시 이름: ${profile.display_name || 'N/A'}\n• 이메일: ${profile.email || 'N/A'}`,
        thread_ts: replyThreadTs
      });
    } catch (err) {
      await say({
        text: `👤 User ID: \`${userId}\`\n(상세 정보 조회 실패: ${err.message})`,
        thread_ts: replyThreadTs
      });
    }
    return;
  }

  if (msg === '!new' || msg === '!reset' || msg === '/new' || msg === '/reset') {
    clearSession(userId);
    await say({
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
    await say({
      text: `🔗 세션이 전환되었습니다: \`${newSessionId}\``,
      thread_ts: replyThreadTs
    });
    return;
  }

  // 현재 세션 확인 명령어: !session 또는 !sessions
  if (msg === '!session' || msg === '!sessions' || msg === '/session' || msg === '/sessions') {
    const currentSession = getSession(userId);
    await say({
      text: currentSession
        ? `📍 현재 세션: \`${currentSession}\``
        : '❌ 활성 세션이 없습니다.',
      thread_ts: replyThreadTs
    });
    return;
  }

  // 멘션으로 시작된 스레드 저장
  if (event.type === 'app_mention' && !event.thread_ts) {
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
    await say({
      text: '⏳ 처리 중...',
      thread_ts: replyThreadTs
    });
  } catch (err) {
    console.error('[Slack] Failed to send processing message:', err.message);
  }

  // Claude Code 실행
  try {
    // 미디어가 있으면 프롬프트에 파일 경로 추가
    let fullPrompt = userMessage;
    const hasVideo = hasUrlVideo || event.files?.some(f => SUPPORTED_VIDEO_TYPES.includes(f.mimetype));

    if (downloadedImages.length > 0) {
      // 영상 프레임만 필터 (frame_XXXX.png 패턴)
      const frameImages = downloadedImages.filter(img => /^frame_\d+\.png$/.test(img.name));
      const staticImages = downloadedImages.filter(img =>
        !(/^frame_\d+\.png$/.test(img.name)) && !SUPPORTED_VIDEO_TYPES.some(t => img.name?.endsWith(t.split('/')[1]))
      );

      if (hasVideo && frameImages.length > 0) {
        const frameList = frameImages
          .map((img, i) => `Frame ${i + 1}: ${img.path}`)
          .join('\n');
        fullPrompt = `${userMessage || '이 영상을 분석해줘'}\n\n[영상에서 추출된 프레임 (${frameImages.length}개) - Read tool로 각 프레임을 분석해주세요]\n${frameList}\n\n분석 지침:\n- 각 프레임에서 보이는 UI 요소, 텍스트, 상태를 파악하세요\n- 프레임 간 변화를 추적하세요 (화면 전환, 사용자 액션 등)\n- 에러 화면, UI 깨짐, 기능 오동작 등 문제 상황을 감지하세요`;
      }

      if (staticImages.length > 0) {
        const imageList = staticImages
          .map((img, i) => `Image ${i + 1} (${img.name}): ${img.path}`)
          .join('\n');
        const prefix = hasVideo ? fullPrompt : (userMessage || '이 이미지를 분석해줘');
        fullPrompt = `${prefix}\n\n[첨부 이미지 - Read tool로 분석해주세요]\n${imageList}`;
      }
    }

    const result = await runClaudeCode(userId, fullPrompt, downloadedImages, tempDirs);

    // 결과를 Slack으로 전송 (4000자 제한 고려)
    const maxLen = 3900;
    const response = result.length > maxLen
      ? result.substring(0, maxLen) + '\n\n... (truncated)'
      : result;

    await say({
      text: response || '(빈 응답)',
      thread_ts: replyThreadTs
    });
    console.log(`[Slack] Response sent to ${event.channel}`);
  } catch (err) {
    console.error('[Claude] Error:', err.message);
    await say({
      text: `❌ 오류 발생: ${err.message}`,
      thread_ts: replyThreadTs
    });
  }
}

function runClaudeCode(userId, prompt, filesToCleanup = [], dirsToCleanup = []) {
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
      if (filesToCleanup.length > 0 || dirsToCleanup.length > 0) cleanupTempFiles(filesToCleanup, dirsToCleanup);
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
      if (filesToCleanup.length > 0 || dirsToCleanup.length > 0) cleanupTempFiles(filesToCleanup, dirsToCleanup);
      reject(err);
    });

    // 5분 타임아웃
    setTimeout(() => {
      claude.kill();
      if (filesToCleanup.length > 0 || dirsToCleanup.length > 0) cleanupTempFiles(filesToCleanup, dirsToCleanup);
      reject(new Error('Timeout: 5분 초과'));
    }, 5 * 60 * 1000);
  });
}

// DM 메시지 핸들러
app.message(async ({ event, say }) => {
  // @Evan 멘션 감시 (봇 DM이 아닌 채널 메시지에서)
  if (event.channel_type !== 'im') {
    handleWatchUserMention(event).catch(err =>
      console.error('[Watch] Handler error:', err.message)
    );
  }
  await handleSlackEvent({ event, say });
});

// 멘션 핸들러 (봇 멘션)
app.event('app_mention', async ({ event, say }) => {
  // @Evan 멘션 감시 (봇 멘션 메시지에도 @Evan이 있을 수 있음)
  handleWatchUserMention(event).catch(err =>
    console.error('[Watch] Handler error:', err.message)
  );
  await handleSlackEvent({ event, say });
});

// 앱 시작
(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running in Socket Mode!');
  console.log(`[Server] Inbox file: ${INBOX_FILE}`);
  console.log(`[Server] Sessions file: ${SESSIONS_FILE}`);
  if (WATCH_USER_ID) {
    console.log(`[Watch] Monitoring mentions of user: ${WATCH_USER_ID}`);
  }
  console.log(`[Server] Commands:`);
  console.log(`         !new, !reset       - Start new session`);
  console.log(`         !session <id>      - Switch session`);
  console.log(`         !session           - View current session`);
  console.log(`         !whoami            - User info`);
})();
