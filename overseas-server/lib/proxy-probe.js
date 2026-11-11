import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import YAML from 'yaml';
import { uid, sleep, errMessage } from './util.js';
import { describeEngine } from './engine.js';
import { nodeUsesTls } from './tls.js';

/** 这些协议没有可探测的 TCP 入口，只能靠真正的代理握手来判断。 */
export const UDP_PROTOCOLS = new Set(['hysteria', 'hysteria2', 'tuic', 'wireguard']);

export function isUdpProtocol(protocol) {
  return UDP_PROTOCOLS.has(String(protocol || '').toLowerCase());
}

/** 每批放进引擎的节点数：一批一个测速分组，避免一次并发太多把本机打满。 */
const DEFAULT_BATCH_SIZE = 40;
const MAX_BATCH_SIZE = 80;
/** 失败节点补查具体错误时的并发。 */
const ERROR_CONCURRENCY = 32;
/** 最多对多少个失败节点单独追查具体原因，其余直接给通用结论。 */
const MAX_ERROR_DETAIL = 60;
/** 同时进行的分组批次数量。 */
const BATCH_WORKERS = 4;
/** 严格证书校验用的分组名。 */
const STRICT_GROUP = 'STRICT_CERT';

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

/** Mihomo 的报错只有两三种，翻译成能直接看懂的原因。 */
export function explainProbeError(raw) {
  const text = String(raw || '').trim();
  if (!text) return '握手失败';
  if (/timeout/i.test(text)) return '超时（节点无响应）';
  if (/An error occurred in the delay test/i.test(text)) return '握手失败（证书、认证或协议被拒）';
  return text.slice(0, 120);
}

function delayUrl(apiBase, target, url, timeoutMs) {
  return `${apiBase}${target}/delay?url=${encodeURIComponent(url)}&timeout=${Math.max(1000, timeoutMs)}`;
}

/**
 * 用 Mihomo 内核做真实的代理握手测试。
 *
 * 与裸 TCP 探测的区别：TCP 只证明「端口开着」，这里让引擎真正把一条
 * CONNECT/QUIC 会话建到目标网站，因此 TLS 证书、认证、UDP 中转是否有
 * 问题都会暴露出来，HTTP/HTTPS/SOCKS5/HY2/TUIC 一视同仁。
 */
export class ProxyProbe {
  constructor(store) {
    this.store = store;
  }

  engineInfo() {
    return describeEngine(this.store.state.settings.mihomoPath || '');
  }

  /**
   * @param {Array} nodes 需要测试的节点（会读取 node.raw）
   * @param {{timeoutMs?: number, onProgress?: Function, url?: string}} options
   * @returns {Promise<{results: Map<string, {ok: boolean, latency: number|null, error: string}>, batches: number, elapsed: number}>}
   */
  async probe(nodes, options = {}) {
    const settings = this.store.state.settings;
    const timeoutMs = Math.max(1000, Number(options.timeoutMs || settings.connectTimeoutMs) || 5000);
    const url = String(options.url || settings.testUrl || 'https://www.gstatic.com/generate_204').trim();
    const info = this.engineInfo();
    if (!info.available || !info.path) {
      throw new Error(`未找到可执行的 Mihomo 引擎：${info.path || '未配置'}（可在设置里指定 Mihomo 路径）`);
    }
    const usable = nodes.filter((node) => node && node.raw && typeof node.raw === 'object');
    const results = new Map();
    if (!usable.length) return { results, batches: 0, elapsed: 0 };

    const runtimeDir = path.join(this.store.dataDir, `.probe-${uid(6)}`);
    await fs.mkdir(runtimeDir, { recursive: true });
    const configPath = path.join(runtimeDir, 'config.yaml');
    const mixedPort = await getFreePort();
    let apiPort = await getFreePort();
    while (apiPort === mixedPort) apiPort = await getFreePort();
    const secret = uid(16);
    const tagToNode = new Map();
    const strictMap = new Map();
    const proxies = [];
    usable.forEach((node, index) => {
      const tag = `P${String(index + 1).padStart(3, '0')}`;
      const raw = structuredClone(node.raw);
      raw.name = tag;
      delete raw['dialer-proxy'];
      delete raw['interface-name'];
      proxies.push(raw);
      tagToNode.set(tag, node);
    });

    // 严格证书副本：只在需要时查询，不放进任何测速分组。
    usable.filter((node) => {
      const raw = node.raw || {};
      const type = String(raw.type || '').toLowerCase();
      return (type === 'http' || type === 'https') && nodeUsesTls(node)
        && (raw['skip-cert-verify'] === true || raw['skip-cert-verify'] === 'true');
    }).forEach((node, index) => {
      const tag = `S${String(index + 1).padStart(3, '')}`;
      const raw = structuredClone(node.raw);
      raw.name = tag;
      delete raw['dialer-proxy'];
      delete raw['interface-name'];
      delete raw['skip-cert-verify'];
      proxies.push(raw);
      strictMap.set(tag, node);
    });

    const batchSize = Math.max(1, Math.min(MAX_BATCH_SIZE, Number(settings.connectConcurrency) || DEFAULT_BATCH_SIZE));
    const batches = [];
    const tags = [...tagToNode.keys()];
    for (let i = 0; i < tags.length; i += batchSize) {
      const slice = tags.slice(i, i + batchSize);
      batches.push({ name: `PROBE_${batches.length + 1}`, tags: slice });
    }

    const config = {
      'mixed-port': mixedPort,
      'allow-lan': false,
      mode: 'rule',
      'log-level': 'warning',
      'external-controller': `127.0.0.1:${apiPort}`,
      secret,
      'unified-delay': true,
      'tcp-concurrent': true,
      proxies,
      'proxy-groups': [
        ...batches.map((batch) => ({ name: batch.name, type: 'select', proxies: batch.tags })),
        ...(strictMap.size ? [{ name: STRICT_GROUP, type: 'select', proxies: [...strictMap.keys()] }] : []),
      ],
      rules: ['MATCH,DIRECT'],
    };
    await fs.writeFile(configPath, YAML.stringify(config, { lineWidth: 0 }), 'utf8');

    let engine = null;
    const logs = [];
    const apiBase = `http://127.0.0.1:${apiPort}`;
    const auth = { Authorization: `Bearer ${secret}` };
    const stop = async () => {
      if (engine && engine.exitCode == null) {
        engine.kill('SIGTERM');
        await Promise.race([new Promise((resolve) => engine.once('exit', resolve)), sleep(1800)]);
        if (engine.exitCode == null) engine.kill('SIGKILL');
      }
      engine = null;
    };
    const started = performance.now();
    const abort = new AbortController();
    const cancelWatch = setInterval(() => {
      if (options.shouldCancel?.()) abort.abort();
    }, 250);
    cancelWatch.unref?.();
    try {
      engine = spawn(info.path, ['-f', configPath, '-d', runtimeDir], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NO_COLOR: '1' },
      });
      const collect = (buf) => {
        logs.push(String(buf));
        if (logs.length > 40) logs.shift();
      };
      engine.stdout.on('data', collect);
      engine.stderr.on('data', collect);
      let bootError = '';
      engine.once('error', (err) => { bootError = `Mihomo 启动失败：${err.message}`; });

      let ready = false;
      for (let i = 0; i < 60; i += 1) {
        if (bootError) break;
        try {
          const res = await fetch(`${apiBase}/version`, { headers: auth, signal: AbortSignal.timeout(800) });
          if (res.ok) { ready = true; break; }
        } catch { /* 引擎仍在启动 */ }
        await sleep(180);
      }
      if (bootError) throw new Error(bootError);
      if (!ready) {
        const tail = logs.join('').replace(/\x1b\[[0-9;]*m/g, '').trim().slice(-800);
        throw new Error(`Mihomo 引擎启动失败${tail ? `：${tail}` : ''}`);
      }

      const cancelled = () => Boolean(options.shouldCancel?.());
      // 分组探测一旦发出就要等整批跑完，点取消后不能干等着：用一个
      // AbortController 在取消时立刻掐断在途请求，已得出的批次结果保留。
      const readDelay = async (target) => {
        try {
          const res = await fetch(delayUrl(apiBase, target, url, timeoutMs), {
            headers: auth,
            signal: AbortSignal.any([AbortSignal.timeout(timeoutMs + 15_000), abort.signal]),
          });
          const body = await res.json().catch(() => ({}));
          return { status: res.status, body: body && typeof body === 'object' ? body : {} };
        } catch (err) {
          return { status: 0, body: { message: errMessage(err) } };
        }
      };

      // 分批并发探测：批内由 Mihomo 并行完成，多批同时进行，避免节点多时
      // 排成一长串串行等待。
      let batchCursor = 0;
      await Promise.all(Array.from({ length: Math.min(BATCH_WORKERS, batches.length) }, async () => {
        while (batchCursor < batches.length) {
          if (cancelled()) return;
          const batch = batches[batchCursor++];
          const { body } = await readDelay(`/group/${encodeURIComponent(batch.name)}`);
          // 被取消掐断的这批没有结果，不能把整批标成不可达；已经跑完的
          // 批次结果保留，用户能看到取消前测出的部分。
          if (abort.signal.aborted) return;
          const measured = body && typeof body === 'object' ? body : {};
          for (const tag of batch.tags) {
            const node = tagToNode.get(tag);
            const value = Number(measured?.[tag]);
            if (Number.isFinite(value) && value > 0) {
              // 没开 skip-cert-verify 的 HTTP(S) 节点，主流程本身就是严格校验，
              // 能握手成功即代表证书可信；开了的留给下面的严格副本复核。
              const raw = node.raw || {};
              const type = String(raw.type || '').toLowerCase();
              const skipCert = raw['skip-cert-verify'] === true || raw['skip-cert-verify'] === 'true';
              // 明文 HTTP 代理没有证书，不能算「证书可信」。
              const certTrusted = (type === 'http' || type === 'https') && nodeUsesTls(node) && !skipCert ? true : undefined;
              results.set(node.id, { ok: true, latency: Math.round(value), error: '', ...(certTrusted === true ? { certTrusted: true } : {}) });
            } else {
              results.set(node.id, { ok: false, latency: null, error: '握手超时或失败' });
            }
          }
          options.onProgress?.(results.size, tagToNode.size);
          if (cancelled()) return;
        }
      }));

      // 未通过的节点再问一次，拿到具体原因（超时 / 协议被拒 / 认证失败）。
      const failed = cancelled() ? [] : [...tagToNode.entries()].filter(([, node]) => {
        const r = results.get(node.id);
        return r && !r.ok;
      });
      // 全部失败节点逐个追问会让大列表慢得离谱，只对前 N 个追原因，
      // 剩下的沿用批次阶段的通用结论，用户仍能看到「不可达」。
      const detailed = failed.slice(0, MAX_ERROR_DETAIL);
      let failCursor = 0;
      await Promise.all(Array.from({ length: Math.min(ERROR_CONCURRENCY, detailed.length) }, async () => {
        while (failCursor < detailed.length) {
          const [tag, node] = detailed[failCursor++];
          const { status, body } = await readDelay(`/proxies/${encodeURIComponent(tag)}`);
          if (abort.signal.aborted) return;
          const ms = Number(body?.delay);
          if (status === 200 && Number.isFinite(ms) && ms > 0) {
            results.set(node.id, { ok: true, latency: Math.round(ms), error: '' });
          } else {
            results.set(node.id, { ok: false, latency: null, error: explainProbeError(body?.message || `HTTP ${status}`) });
          }
        }
      }));

      // 证书可信度：对开了 skip-cert-verify 的 HTTP(S) 节点再跑一次严格校验。
      // 严格能过说明证书本身有效；过不了就是「面板可达但客户端连不上」，
      // 单独标记，不改变可达判定。
      const strictTags = cancelled() ? [] : [...strictMap.keys()];
      if (strictTags.length) {
        const measured = new Set();
        const { status, body } = await readDelay(`/group/${encodeURIComponent(STRICT_GROUP)}`);
        if (abort.signal.aborted) return { results, batches: batches.length, elapsed: Math.round(performance.now() - started) };
        if (status === 200 && body && typeof body === 'object') {
          for (const tag of strictTags) {
            const ms = Number(body[tag]);
            if (Number.isFinite(ms) && ms > 0) measured.add(tag);
          }
        } else {
          // 分组探测失败时退回逐个查询，保证结果不丢。
          let cursor = 0;
          await Promise.all(Array.from({ length: Math.min(ERROR_CONCURRENCY, strictTags.length) }, async () => {
            while (cursor < strictTags.length) {
              const tag = strictTags[cursor++];
              const r = await readDelay(`/proxies/${encodeURIComponent(tag)}`);
              const ms = Number(r.body?.delay);
              if (r.status === 200 && Number.isFinite(ms) && ms > 0) measured.add(tag);
            }
          }));
        }
        for (const tag of strictTags) {
          const node = strictMap.get(tag);
          const current = results.get(node.id) || { ok: false, latency: null, error: '' };
          results.set(node.id, measured.has(tag)
            ? { ...current, certTrusted: true, certError: '' }
            : { ...current, certTrusted: false, certError: '证书不受信任或域名不匹配，客户端需要「允许不安全」才能连' });
        }
      }

      return { results, batches: batches.length, elapsed: Math.round(performance.now() - started) };
    } finally {
      clearInterval(cancelWatch);
      await stop();
      try { await fs.rm(runtimeDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}
