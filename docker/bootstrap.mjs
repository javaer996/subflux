#!/usr/bin/env node
/**
 * 容器启动引导（不需要 Dockerfile）
 *
 * 1. 依赖安装：把 node_modules 落在宿主机挂载目录里，用 package-lock.json 的哈希做标记，
 *    只在首次启动或 lock 变化时执行 npm ci，重启 / 重建容器都不会重复安装。
 * 2. Mihomo：宿主机上已有可执行文件就复用，没有才按架构从 GitHub 下载并解压。
 * 3. 启动 server.js 或 probe.js，并把 SIGTERM / SIGINT 转发给子进程，保证 docker stop 优雅退出。
 */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  chmodSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';

const APP_DIR = path.resolve(process.env.APP_DIR || '/app');
const ENTRY = process.env.APP_ENTRY || 'server.js';
const MIHOMO_VERSION = String(process.env.MIHOMO_VERSION || '1.19.33').replace(/^v/, '');
const MIHOMO_URL = process.env.MIHOMO_URL || '';
const MIHOMO_MIRROR = process.env.MIHOMO_MIRROR || '';
const MIN_BINARY_BYTES = 1_000_000;

const log = (msg) => console.log(`[bootstrap] ${msg}`);
const warn = (msg) => console.warn(`[bootstrap] ${msg}`);

function mihomoPath() {
  return process.env.MIHOMO_BIN || path.join(APP_DIR, 'bin', 'mihomo');
}

/** 检查 package.json 里的依赖是否都真的装好了 */
function depsResolvable() {
  const pkgFile = path.join(APP_DIR, 'package.json');
  if (!existsSync(pkgFile)) return true;
  let deps = {};
  try {
    deps = JSON.parse(readFileSync(pkgFile, 'utf8')).dependencies || {};
  } catch {
    return false;
  }
  return Object.keys(deps).every((name) => existsSync(path.join(APP_DIR, 'node_modules', name, 'package.json')));
}

function runOnce(cmd, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} 退出码 ${code}`))));
  });
}

async function ensureDeps() {
  const lockFile = path.join(APP_DIR, 'package-lock.json');
  if (!existsSync(lockFile)) {
    log('没有 package-lock.json，跳过依赖安装');
    return;
  }
  const hash = createHash('sha256').update(readFileSync(lockFile)).digest('hex').slice(0, 16);
  const stampFile = path.join(APP_DIR, 'node_modules', '.subflux-deps');
  let stamp = '';
  try {
    stamp = readFileSync(stampFile, 'utf8').trim();
  } catch {
    stamp = '';
  }
  if (stamp === hash && depsResolvable()) {
    log(`依赖已就绪，复用宿主机缓存（lock ${hash}）`);
    return;
  }
  log('安装依赖：npm ci（仅首次启动或 package-lock.json 变化时执行）');
  const started = Date.now();
  await runOnce('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: APP_DIR });
  mkdirSync(path.join(APP_DIR, 'node_modules'), { recursive: true });
  writeFileSync(stampFile, `${hash}\n`);
  log(`依赖安装完成，耗时 ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

function releaseUrl() {
  if (MIHOMO_URL) return MIHOMO_URL;
  const arch = { x64: 'amd64-compatible', arm64: 'arm64' }[os.arch()];
  if (!arch) throw new Error(`不支持的架构：${os.arch()}，请用 MIHOMO_URL 指定二进制地址`);
  const file = `mihomo-linux-${arch}-v${MIHOMO_VERSION}.gz`;
  const base = `https://github.com/MetaCubeX/mihomo/releases/download/v${MIHOMO_VERSION}/${file}`;
  return MIHOMO_MIRROR ? `${MIHOMO_MIRROR.replace(/\/+$/, '')}/${base}` : base;
}

async function downloadMihomo(target, url) {
  const tmp = `${target}.gz.tmp`;
  log(`下载 Mihomo ${MIHOMO_VERSION}：${url}`);
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'subflux-compose' } });
  if (!res.ok || !res.body) throw new Error(`下载失败：HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  const bytes = statSync(tmp).size;
  if (bytes < 1_000) throw new Error(`下载内容异常（${bytes} 字节）`);
  log(`下载完成 ${(bytes / 1048576).toFixed(1)} MB，解压中`);
  if (url.endsWith('.gz')) {
    await pipeline(createReadStream(tmp), createGunzip(), createWriteStream(target));
    unlinkSync(tmp);
  } else {
    await pipeline(createReadStream(tmp), createWriteStream(target));
    unlinkSync(tmp);
  }
  chmodSync(target, 0o755);
  const size = statSync(target).size;
  if (size < MIN_BINARY_BYTES) throw new Error(`解压后的文件过小（${size} 字节），可能不是有效的 Mihomo 二进制`);
  log(`Mihomo 就位：${target}（${(size / 1048576).toFixed(1)} MB）`);
}

async function verifyMihomo(target) {
  try {
    const out = await new Promise((resolve, reject) => {
      const child = spawn(target, ['-v'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let text = '';
      child.stdout.on('data', (chunk) => {
        text += chunk;
      });
      child.stderr.on('data', (chunk) => {
        text += chunk;
      });
      child.on('error', reject);
      child.on('exit', (code) => resolve({ code, text }));
    });
    if (out.code !== 0) throw new Error(out.text.trim() || `退出码 ${out.code}`);
    log(`Mihomo 可用：${out.text.trim()}`);
  } catch (err) {
    warn(`Mihomo 无法运行（${err.message}），站点检测与 CN 实际检测将不可用`);
  }
}

async function ensureMihomo() {
  if (process.env.INSTALL_MIHOMO === '0') {
    log('INSTALL_MIHOMO=0，跳过 Mihomo');
    return;
  }
  const target = mihomoPath();
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target) && statSync(target).size >= MIN_BINARY_BYTES) {
    chmodSync(target, 0o755);
    log(`复用已有 Mihomo：${target}（${(statSync(target).size / 1048576).toFixed(1)} MB）`);
    await verifyMihomo(target);
    return;
  }
  await downloadMihomo(target, releaseUrl());
  await verifyMihomo(target);
}

function startApp() {
  const file = path.join(APP_DIR, ENTRY);
  if (!existsSync(file)) throw new Error(`找不到入口文件：${file}`);
  log(`启动 ${ENTRY}（工作目录 ${APP_DIR}）`);
  const child = spawn(process.execPath, [file], { cwd: APP_DIR, stdio: 'inherit', env: process.env });
  const forward = (signal) => {
    if (child.exitCode === null && !child.killed) {
      log(`收到 ${signal}，转发给 ${ENTRY}`);
      child.kill(signal);
    }
  };
  process.on('SIGTERM', () => forward('SIGTERM'));
  process.on('SIGINT', () => forward('SIGINT'));
  child.on('error', (err) => {
    warn(`启动失败：${err.message}`);
    process.exit(1);
  });
  child.on('exit', (code, signal) => {
    log(`${ENTRY} 退出：code=${code} signal=${signal}`);
    process.exit(code ?? 0);
  });
}

try {
  log(`应用目录 ${APP_DIR}`);
  await ensureDeps();
  await ensureMihomo();
  startApp();
} catch (err) {
  console.error(`[bootstrap] 启动失败：${err.message}`);
  process.exit(1);
}
