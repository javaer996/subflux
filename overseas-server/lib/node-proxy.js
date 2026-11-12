import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { ProxyAgent } from 'undici';
import { uid, sleep, errMessage } from './util.js';
import { describeEngine } from './engine.js';

/** 找一个本地空闲端口。 */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function connectable(port, timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/**
 * 用 Mihomo 拉起一个只含单个上游代理的本地混合端口。
 * 返回 { url, dispatcher, close }，close 会停掉引擎并清理临时目录。
 */
async function startLocalProxy(proxyConfig, settings = {}) {
  const engine = describeEngine(settings.mihomoPath || '');
  if (!engine.available || !engine.path) {
    throw new Error('未找到可执行的 Mihomo 引擎，无法通过代理拉取订阅（可在设置里指定引擎路径）');
  }
  const runtimeDir = path.join(os.tmpdir(), `subflux-fetch-${uid(6)}`);
  await fs.mkdir(runtimeDir, { recursive: true });
  const port = await getFreePort();
  const proxy = structuredClone(proxyConfig);
  delete proxy['dialer-proxy'];
  delete proxy['interface-name'];
  proxy.name = 'UPSTREAM';
  const config = {
    'mixed-port': port,
    'allow-lan': false,
    mode: 'rule',
    'log-level': 'silent',
    'unified-delay': true,
    proxies: [proxy],
    'proxy-groups': [{ name: 'FETCH', type: 'select', proxies: ['UPSTREAM'] }],
    rules: ['MATCH,FETCH'],
  };
  const configPath = path.join(runtimeDir, 'config.yaml');
  await fs.writeFile(configPath, YAML.stringify(config, { lineWidth: 0 }), 'utf8');

  const child = spawn(engine.path, ['-f', configPath, '-d', runtimeDir], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1' },
  });
  const logs = [];
  const collect = (buf) => {
    logs.push(String(buf));
    if (logs.length > 30) logs.shift();
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);

  const stop = async () => {
    if (child.exitCode == null) {
      child.kill('SIGTERM');
      await Promise.race([new Promise((resolve) => child.once('exit', resolve)), sleep(1500)]);
      if (child.exitCode == null) child.kill('SIGKILL');
    }
    await fs.rm(runtimeDir, { recursive: true, force: true }).catch(() => {});
  };

  let ready = false;
  for (let i = 0; i < 60; i += 1) {
    if (child.exitCode != null) break;
    if (await connectable(port)) { ready = true; break; }
    await sleep(150);
  }
  if (!ready) {
    const tail = logs.join('').replace(/\x1b\[[0-9;]*m/g, '').trim().slice(-600);
    await stop();
    throw new Error(`代理引擎启动失败${tail ? `：${tail}` : ''}`);
  }

  const dispatcher = new ProxyAgent(`http://127.0.0.1:${port}`);
  return {
    url: `http://127.0.0.1:${port}`,
    dispatcher,
    close: async () => {
      try { await dispatcher.close(); } catch { /* ignore */ }
      await stop();
    },
  };
}

/** 从节点池节点的 Clash 原始配置起一个本地代理。 */
export function startNodeProxy(rawProxy, settings = {}) {
  if (!rawProxy || typeof rawProxy !== 'object') {
    return Promise.reject(new Error('该节点缺少可用的代理配置，无法用于拉取订阅'));
  }
  return startLocalProxy(rawProxy, settings);
}

/**
 * 外部代理地址：
 * - http/https 直接交给 undici ProxyAgent
 * - socks5 交给 Mihomo 转换成本地混合端口（undici 不支持 socks）
 */
export async function startUrlProxy(rawUrl, settings = {}) {
  const url = String(rawUrl || '').trim();
  if (!url) throw new Error('没有填写代理地址');
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`代理地址格式不正确：${url}`);
  }
  const protocol = parsed.protocol.replace(':', '').toLowerCase();
  if (protocol === 'http' || protocol === 'https') {
    const dispatcher = new ProxyAgent(url);
    return {
      url,
      dispatcher,
      close: async () => {
        try { await dispatcher.close(); } catch { /* ignore */ }
      },
    };
  }
  if (protocol === 'socks5' || protocol === 'socks' || protocol === 'socks5h') {
    const port = Number(parsed.port) || 1080;
    const proxy = {
      type: 'socks5',
      server: parsed.hostname,
      port,
    };
    if (parsed.username) proxy.username = decodeURIComponent(parsed.username);
    if (parsed.password) proxy.password = decodeURIComponent(parsed.password);
    return startLocalProxy(proxy, settings);
  }
  throw new Error(`暂不支持的代理协议：${protocol}（可用 http、https、socks5）`);
}

/** 拉取订阅时最多尝试几个出口。 */
export const MAX_FETCH_ATTEMPTS = 3;

/**
 * 节点按「能不能用」排个优先级：
 * 1. 握手可达的排在最前，其次是还没测过的（alive 为 null），明确不可达的直接排除；
 * 2. 同类里质量分高的优先，质量分相同时握手延迟低的优先。
 */
export function rankFetchNodes(nodes = []) {
  const usable = nodes.filter((n) => n && n.raw && !n.disabled && n.alive !== false);
  const score = (n) => {
    const value = Number(n.qualityScore);
    return Number.isFinite(value) ? value : -1;
  };
  const latency = (n) => {
    const value = Number(n.latency);
    return Number.isFinite(value) ? value : Infinity;
  };
  return usable.sort((a, b) => {
    const aliveDiff = (a.alive === true ? 0 : 1) - (b.alive === true ? 0 : 1);
    if (aliveDiff) return aliveDiff;
    const scoreDiff = score(b) - score(a);
    if (scoreDiff) return scoreDiff;
    return latency(a) - latency(b);
  });
}

/**
 * 规划本次抓取的出口顺序（最多 MAX_FETCH_ATTEMPTS 个）。
 *
 * - `direct`：空数组，表示直连；
 * - `auto`：按质量从高到低取最优的可用节点，失败自动换下一个；
 * - `pool`：先试指定节点；该节点失效或拉取失败时，默认继续用其它可用节点兜底
 *   （`proxyFallback === false` 可关掉）；
 * - `custom`：固定外部代理，不需要换出口。
 */
export function fetchProxyPlan(source, settings = {}, nodes = []) {
  const mode = source.proxyMode || (source.useProxy === true ? 'custom' : 'direct');
  if (mode === 'direct') return [];
  if (mode === 'custom') {
    const url = String(source.proxyUrl || settings.fetchProxy || '').trim();
    if (!url) throw new Error('已选择外部代理，但没有填写代理地址');
    return [{ kind: 'url', url }];
  }
  const ranked = rankFetchNodes(nodes);
  const plan = [];
  if (mode === 'pool') {
    const chosen = nodes.find((n) => n.id === source.proxyNodeId);
    if (chosen && chosen.raw) plan.push(chosen);
    if (source.proxyFallback === false) {
      if (!plan.length) throw new Error('指定的拉取出口节点不存在，请重新选择（可能已随订阅刷新被删除）');
      return plan.map((node) => ({ kind: 'node', node }));
    }
  }
  for (const node of ranked) {
    if (plan.some((n) => n.id === node.id)) continue;
    plan.push(node);
    if (plan.length >= MAX_FETCH_ATTEMPTS) break;
  }
  if (!plan.length) {
    throw new Error('节点池里没有可用的代理节点（全部不可达或缺少配置），暂时无法通过代理拉取');
  }
  return plan.slice(0, MAX_FETCH_ATTEMPTS).map((node) => ({ kind: 'node', node }));
}

export { errMessage };
