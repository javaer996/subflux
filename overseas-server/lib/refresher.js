import { parseSubscription } from './parser.js';
import { nodeFingerprint } from './uri.js';
import { parseTrafficHeader, sha1, errMessage, truncate } from './util.js';
import { trafficInfo } from './traffic.js';
import { fetch as undiciFetch } from 'undici';
import { resolveFetchProxy, startUrlProxy } from './node-proxy.js';

const inflight = new Set();
const MAX_BODY = 15 * 1024 * 1024;
const QUALITY_FIELDS = [
  'ip', 'countryCode', 'country', 'region', 'flag', 'city', 'isp', 'org', 'asn', 'asname',
  'ipType', 'qualityScore', 'qualityLabel', 'qualityNote', 'risk', 'qualityAt',
];

/**
 * 下一次自动刷新时间。
 * - 手动粘贴的内容（kind=text）不会自动刷新，返回 null
 * - autoRefresh === false 的订阅源同样不排期，返回 null
 */
export function nextRunAt(source, settings = {}, nowMs = Date.now()) {
  if (!source || source.kind === 'text') return null;
  if (source.autoRefresh === false) return null;
  const minutes = Math.max(5, Number(source.intervalMinutes) || settings.defaultInterval || 360);
  return new Date(nowMs + minutes * 60000).toISOString();
}

export async function testFetchProxy(url, settings = {}) {
  const started = performance.now();
  const proxy = await startUrlProxy(url, settings);
  try {
    const res = await undiciFetch('https://www.gstatic.com/generate_204', {
      dispatcher: proxy.dispatcher,
      signal: AbortSignal.timeout(15000),
      headers: { 'user-agent': 'subflux-proxy-test/1.0' },
    });
    await res.arrayBuffer();
    return { ok: res.ok, status: res.status, latency: Math.round(performance.now() - started) };
  } finally {
    await proxy.close().catch(() => {});
  }
}

export function isRefreshing(sourceId) {
  return inflight.has(sourceId);
}

async function readLimited(res, maxBytes) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        throw new Error(`订阅内容超过 ${Math.round(maxBytes / 1024 / 1024)}MB 限制`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

export async function fetchSubscription(source, settings, options = {}) {
  if (source.kind === 'text') {
    return {
      text: source.content || '',
      headers: {},
      finalUrl: '',
      status: 200,
    };
  }
  const timeout = Math.max(5000, Math.min(90000, Number(settings.requestTimeoutMs) || 25000));
  const ua = source.userAgent || settings.userAgent || 'clash.meta/1.19.8';
  const proxy = await resolveFetchProxy(source, settings, options.nodes || []);
  try {
    const request = {
      redirect: 'follow',
      headers: {
        'user-agent': ua,
        accept: '*/*',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'cache-control': 'no-cache',
      },
      signal: AbortSignal.timeout(timeout),
      ...(proxy ? { dispatcher: proxy.dispatcher } : {}),
    };
    let res;
    try {
      res = proxy ? await undiciFetch(source.url, request) : await fetch(source.url, request);
    } catch (err) {
      throw new Error(proxy ? `通过代理拉取订阅失败：${errMessage(err)}` : errMessage(err));
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText || ''}`.trim());
    }
    const length = Number(res.headers.get('content-length') || 0);
    if (length && length > MAX_BODY) throw new Error('订阅内容超过 15MB 限制');
    const text = await readLimited(res, MAX_BODY);
    return {
      text,
      headers: Object.fromEntries(res.headers.entries()),
      finalUrl: res.url,
      status: res.status,
    };
  } finally {
    if (proxy) await proxy.close().catch(() => {});
  }
}

function mergeOldState(node, prev, now, source) {
  const merged = {
    ...node,
    id: prev?.id,
    sourceId: source.id,
    sourceName: source.name,
    fingerprint: nodeFingerprint(node),
    disabled: prev?.disabled || false,
    latency: prev?.latency ?? null,
    alive: prev?.alive ?? null,
    testedAt: prev?.testedAt || null,
    addedAt: prev?.addedAt || now,
    updatedAt: now,
  };
  if (prev) {
    for (const key of QUALITY_FIELDS) {
      if (prev[key] !== undefined) merged[key] = prev[key];
    }
  }
  return merged;
}

export async function refreshSource(store, source, deps = {}) {
  if (!source) throw new Error('订阅源不存在');
  if (inflight.has(source.id)) return { ok: false, busy: true, error: '该订阅正在刷新' };
  inflight.add(source.id);
  const state = store.state;
  const started = Date.now();
  const previousTraffic = trafficInfo(source);
  source.status = 'refreshing';
  source.error = null;
  store.touch();
  try {
    const fetched = await fetchSubscription(source, state.settings, { nodes: state.nodes });
    const parsed = parseSubscription(fetched.text, {
      maxNodes: state.settings.maxNodesPerSource,
    });
    if (!parsed.nodes.length) {
      const reason = parsed.warnings?.length ? parsed.warnings.join('；') : '未解析到任何节点';
      throw new Error(reason);
    }
    const now = new Date().toISOString();
    const nowMs = Date.now();
    const oldNodes = new Map(
      state.nodes.filter((n) => n.sourceId === source.id).map((n) => [n.id, n]),
    );
    const nodes = [];
    const usedIds = new Set();
    for (const parsedNode of parsed.nodes) {
      const fp = nodeFingerprint(parsedNode);
      let id = sha1(`${source.id}|${fp}`).slice(0, 20);
      let suffix = 2;
      while (usedIds.has(id) || (oldNodes.has(id) && nodes.some((n) => n.id === id))) {
        id = sha1(`${source.id}|${fp}|${suffix++}`).slice(0, 20);
      }
      usedIds.add(id);
      const prev = oldNodes.get(id);
      const node = mergeOldState(parsedNode, prev, now, source);
      node.id = id;
      nodes.push(node);
    }

    // Replace this source's nodes while preserving nodes from other sources.
    state.nodes = state.nodes.filter((n) => n.sourceId !== source.id).concat(nodes);
    if (state.nodes.length > 12000) {
      const overflow = state.nodes.length - 12000;
      state.nodes.splice(0, overflow);
      store.addEvent('warn', `节点总数超过 12000，已清理最旧的 ${overflow} 个节点`);
    }

    const traffic = parseTrafficHeader(fetched.headers['subscription-userinfo']);
    source.traffic = traffic;
    source.trafficUpdatedAt = traffic ? now : null;
    source.status = 'ok';
    source.error = null;
    source.lastRefreshAt = now;
    source.lastSuccessAt = now;
    source.nextRefreshAt = nextRunAt(source, state.settings, nowMs);
    source.nodeCount = nodes.length;
    source.format = parsed.format;
    source.warnings = parsed.warnings || [];
    source.lastDurationMs = Date.now() - started;
    source.contentBytes = fetched.text.length;
    source.finalUrl = truncate(fetched.finalUrl || '', 500);
    store.touch();

    const newTraffic = trafficInfo(source);
    if (newTraffic.depleted && !previousTraffic.depleted) {
      store.addEvent('warn', `${source.name} ${newTraffic.reason}，节点已从输出订阅中剔除`, { sourceId: source.id });
    }
    const extra = parsed.warnings?.length ? `（${parsed.warnings.join('；')}）` : '';
    store.addEvent('success', `${source.name} 刷新完成：${nodes.length} 个节点${extra}`, { sourceId: source.id });

    if (deps.tester) deps.tester.enqueueAuto(nodes, { tcp: state.settings.autoTcp });
    if (deps.siteTester) deps.siteTester.enqueueAuto(nodes);
    return {
      ok: true,
      nodeCount: nodes.length,
      warnings: parsed.warnings || [],
      traffic: newTraffic,
      format: parsed.format,
      durationMs: source.lastDurationMs,
    };
  } catch (err) {
    const message = errMessage(err);
    source.status = 'error';
    source.error = truncate(message, 400);
    source.lastRefreshAt = new Date().toISOString();
    source.lastErrorAt = source.lastRefreshAt;
    source.nextRefreshAt = nextRunAt(source, state.settings, Date.now());
    source.lastDurationMs = Date.now() - started;
    store.addEvent('error', `${source.name} 刷新失败：${source.error}`, { sourceId: source.id });
    store.touch();
    return { ok: false, error: source.error };
  } finally {
    inflight.delete(source.id);
    store.touch();
  }
}
