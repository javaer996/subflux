import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';

/**
 * 文件日志：按天写入 DATA_DIR/logs/app-YYYY-MM-DD.log，
 * 只保留最近 24 小时的文件（跨天时最多同时存在两个文件）。
 * 同时可以回显到 stdout（docker logs 由 compose 的 max-size 限制）。
 */

let logDir = '';
let stream = null;
let currentDay = '';
let echo = true;
let keepMs = 24 * 60 * 60 * 1000;
let pruneTimer = null;
let installed = false;

const originals = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function formatArgs(args) {
  return args
    .map((item) => (typeof item === 'string' ? item : util.inspect(item, { depth: 4, breakLength: 120, colors: false })))
    .join(' ');
}

function openStream(day) {
  try {
    if (stream) {
      stream.end();
      stream = null;
    }
    stream = fs.createWriteStream(path.join(logDir, `app-${day}.log`), { flags: 'a' });
    stream.on('error', () => { stream = null; });
    currentDay = day;
  } catch {
    stream = null;
  }
}

function prune() {
  let names = [];
  try {
    names = fs.readdirSync(logDir);
  } catch {
    return;
  }
  const now = Date.now();
  for (const name of names) {
    if (!/^app-\d{4}-\d{2}-\d{2}\.log$/.test(name)) continue;
    const file = path.join(logDir, name);
    try {
      const stat = fs.statSync(file);
      if (now - stat.mtimeMs > keepMs) fs.unlinkSync(file);
    } catch {
      // 忽略单个文件的清理失败。
    }
  }
}

function write(level, args) {
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${formatArgs(args)}`;
  try {
    const day = dayKey();
    if (!stream || day !== currentDay) openStream(day);
    stream?.write(`${line}\n`);
  } catch {
    // 日志写入失败不能影响主流程。
  }
  if (echo) {
    const fn = originals[level === 'info' ? 'log' : level] || originals.log;
    fn(line);
  }
}

export function initLogger(dataDir, options = {}) {
  logDir = path.join(dataDir, 'logs');
  echo = options.echo !== false && process.env.LOG_STDOUT !== '0';
  keepMs = Math.max(60 * 60 * 1000, Number(options.keepMs) || 24 * 60 * 60 * 1000);
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {
    return { dir: logDir, ok: false };
  }
  openStream(dayKey());
  prune();
  if (pruneTimer) clearInterval(pruneTimer);
  pruneTimer = setInterval(prune, 60 * 60 * 1000);
  pruneTimer.unref?.();
  if (!installed) {
    installed = true;
    console.log = (...args) => write('info', args);
    console.info = (...args) => write('info', args);
    console.warn = (...args) => write('warn', args);
    console.error = (...args) => write('error', args);
    console.debug = (...args) => write('debug', args);
  }
  return { dir: logDir, ok: true };
}

export function logDirPath() {
  return logDir;
}

export function closeLogger() {
  if (pruneTimer) clearInterval(pruneTimer);
  pruneTimer = null;
  try {
    stream?.end();
  } catch {
    // ignore
  }
  stream = null;
}
