import { uid, sleep, errMessage } from './util.js';

const UDP_PROTOCOLS = new Set(['hysteria', 'hysteria2', 'tuic', 'wireguard']);

function snapshot(job) {
  if (!job) return null;
  return {
    id: job.id,
    label: job.label,
    mode: job.mode,
    running: job.running,
    phase: job.phase,
    total: job.total,
    done: job.done,
    reachable: job.reachable,
    blocked: job.blocked,
    skipped: job.skipped || 0,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    note: job.note || '',
    error: job.error || '',
  };
}

function probeEndpoint(base, kind) {
  const url = new URL(String(base || '').trim());
  if (/\/api\/probe\/[^/]+\/?$/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/api\/probe\/[^/]+\/?$/, `/api/probe/${kind}`);
  } else {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/api/probe/${kind}`;
  }
  return url.toString();
}

function probeHealth(base) {
  const url = new URL(String(base || '').trim());
  return `${url.origin}/health`;
}

function authHeaders(token) {
  return { 'content-type': 'application/json', Authorization: `Bearer ${token}` };
}

export class ChinaTester {
  constructor(store) {
    this.store = store;
    this.job = null;
    this.lastJob = null;
  }

  status() {
    return snapshot(this.job || this.lastJob);
  }

  cancel() {
    if (!this.job?.running) return false;
    this.job.cancelRequested = true;
    this.job.note = '正在取消…';
    return true;
  }

  finishCancelled(job) {
    job.phase = 'cancelled';
    job.running = false;
    job.finishedAt = new Date().toISOString();
    job.note = `已取消（完成 ${job.done}/${job.total}）`;
    this.lastJob = job;
    this.job = null;
    this.store.addEvent('warn', `${job.label}已取消`);
    this.store.touch();
  }

  start(nodes, options = {}) {
    if (this.job?.running) return null;
    const list = nodes.filter(Boolean);
    if (!list.length) return null;
    const mode = options.mode === 'proxy' ? 'proxy' : 'tcp';
    const job = {
      id: uid(6),
      label: options.label || (mode === 'proxy' ? '中国实际连通检测' : '中国 TCP 连通检测'),
      mode,
      running: true,
      phase: mode === 'proxy' ? 'proxy' : 'testing',
      total: list.length,
      done: 0,
      reachable: 0,
      blocked: 0,
      skipped: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      note: mode === 'proxy' ? '正在通过中国探针实际代理访问测试地址（支持 UDP）' : '正在通过中国探针检测 TCP 连通性',
      error: '',
    };
    this.job = job;
    this.run(list, job).catch((err) => {
      console.error('[china-tester]', err);
      job.error = errMessage(err);
      job.phase = 'error';
      job.running = false;
      job.finishedAt = new Date().toISOString();
      this.lastJob = job;
      this.job = null;
      this.store.addEvent('error', `中国连通检测失败：${job.error}`);
    });
    return snapshot(job);
  }

  async check() {
    const settings = this.store.state.settings;
    const base = String(settings.chinaProbeUrl || '').trim();
    if (!/^https?:\/\//i.test(base)) throw new Error('未配置中国探针地址');
    const token = String(settings.chinaProbeToken || '').trim();
    if (!token) throw new Error('未配置中国探针 Token');
    const timeoutMs = Math.max(1000, Math.min(15000, Number(settings.chinaProbeTimeoutMs) || 5000));
    const started = performance.now();
    const health = await fetch(probeHealth(base), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(timeoutMs + 3000),
    });
    const outbound = {
      ok: health.ok,
      status: health.status,
      latency: Math.round(performance.now() - started),
    };
    let reverse = null;
    const reverseUrl = String(settings.chinaProbeReverseUrl || '').trim();
    if (reverseUrl) {
      if (!/^https?:\/\//i.test(reverseUrl)) throw new Error('反向测试地址必须是 http(s) URL');
      const res = await fetch(probeEndpoint(base, 'http'), {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ url: reverseUrl }),
        signal: AbortSignal.timeout(timeoutMs + 8000),
      });
      const data = await res.json().catch(() => ({}));
      reverse = {
        ok: Boolean(data.ok),
        status: data.status || 0,
        latency: data.latency || null,
        error: data.error || (res.ok ? '' : `HTTP ${res.status}`),
      };
    }
    return { outbound, reverse, checkedAt: new Date().toISOString() };
  }

  async run(nodes, job) {
    if (job.mode === 'proxy') return this.runProxy(nodes, job);
    return this.runTcp(nodes, job);
  }

  async runTcp(nodes, job) {
    const settings = this.store.state.settings;
    const base = String(settings.chinaProbeUrl || '').trim();
    const token = String(settings.chinaProbeToken || '').trim();
    if (!/^https?:\/\//i.test(base)) throw new Error('未配置中国探针地址');
    if (!token) throw new Error('未配置中国探针 Token');
    const timeoutMs = Math.max(1000, Math.min(15000, Number(settings.chinaProbeTimeoutMs) || 5000));
    const targets = [];
    for (const node of nodes) {
      if (UDP_PROTOCOLS.has(String(node.protocol).toLowerCase())) {
        const current = this.store.state.nodes.find((n) => n.id === node.id) || node;
        current.cnReachable = null;
        current.cnLatency = null;
        current.cnCheckedAt = new Date().toISOString();
        current.cnMethod = 'tcp';
        current.cnError = 'UDP 协议，TCP 探针不可判定；请使用“CN 实际”检测';
        job.skipped += 1;
        job.done += 1;
      } else {
        targets.push(node);
      }
    }
    if (job.skipped) job.note = `${job.skipped} 个 UDP 节点跳过 TCP 探针`;
    const batchSize = 50;
    for (let start = 0; start < targets.length; start += batchSize) {
      if (job.cancelRequested) break;
      const batch = targets.slice(start, start + batchSize);
      const res = await fetch(probeEndpoint(base, 'tcp'), {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          nodes: batch.map((node) => ({ id: node.id, host: node.server, port: node.port })),
          timeoutMs,
        }),
        signal: AbortSignal.timeout(timeoutMs + 5000),
      });
      if (!res.ok) throw new Error(`探针 HTTP ${res.status}`);
      const data = await res.json();
      if (!data?.ok || !Array.isArray(data.results)) throw new Error(data?.error || '探针返回格式异常');
      const map = new Map(data.results.map((row) => [row.id, row]));
      const checkedAt = new Date().toISOString();
      for (const node of batch) {
        const row = map.get(node.id);
        const current = this.store.state.nodes.find((n) => n.id === node.id) || node;
        current.cnCheckedAt = checkedAt;
        current.cnMethod = 'tcp';
        if (!row) {
          current.cnReachable = null;
          current.cnLatency = null;
          current.cnError = '探针未返回结果';
          continue;
        }
        current.cnReachable = Boolean(row.ok);
        current.cnLatency = Number.isFinite(row.latency) ? row.latency : null;
        current.cnError = row.error || '';
        if (row.ok) job.reachable += 1;
        else job.blocked += 1;
        job.done += 1;
      }
      job.note = `已检测 ${job.done}/${job.total} 个节点`;
      this.store.touch();
      if (start + batchSize < targets.length) await sleep(250);
    }
    if (job.cancelRequested) return this.finishCancelled(job);
    job.phase = 'done';
    job.running = false;
    job.finishedAt = new Date().toISOString();
    job.note = `CN 可达 ${job.reachable} · 不可达 ${job.blocked}${job.skipped ? ` · UDP 跳过 ${job.skipped}` : ''}`;
    this.lastJob = job;
    this.job = null;
    this.store.addEvent('info', `中国 TCP 连通检测完成：可达 ${job.reachable}，不可达 ${job.blocked}`);
    this.store.touch();
  }

  async runProxy(nodes, job) {
    const settings = this.store.state.settings;
    const base = String(settings.chinaProbeUrl || '').trim();
    const token = String(settings.chinaProbeToken || '').trim();
    if (!/^https?:\/\//i.test(base)) throw new Error('未配置中国探针地址');
    if (!token) throw new Error('未配置中国探针 Token');
    const testUrl = String(settings.chinaProbeTestUrl || 'https://www.qq.com/');
    if (!/^https?:\/\//i.test(testUrl)) throw new Error('测试地址必须是 http(s) URL');
    const timeoutMs = Math.max(3000, Math.min(20000, Number(settings.chinaProbeTimeoutMs) || 8000));
    const targets = [];
    for (const node of nodes) {
      if (!node?.raw || typeof node.raw !== 'object') {
        const current = this.store.state.nodes.find((n) => n.id === node?.id) || node;
        if (current) {
          current.cnCheckedAt = new Date().toISOString();
          current.cnReachable = null;
          current.cnLatency = null;
          current.cnMethod = 'proxy';
          current.cnError = '缺少 Clash 代理配置，无法实际检测';
        }
        job.skipped += 1;
        job.done += 1;
      } else {
        targets.push(node);
      }
    }
    if (!targets.length) throw new Error('没有可用的 Clash 代理配置；该节点无法进行实际连通检测');
    const batchSize = 20;
    for (let start = 0; start < targets.length; start += batchSize) {
      if (job.cancelRequested) break;
      const batch = targets.slice(start, start + batchSize);
      const res = await fetch(probeEndpoint(base, 'proxy'), {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          nodes: batch.map((node) => ({ id: node.id, proxy: node.raw })),
          testUrl,
          timeoutMs,
        }),
        signal: AbortSignal.timeout(timeoutMs * batch.length + 20000),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `探针 HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data?.ok || !Array.isArray(data.results)) throw new Error(data?.error || '探针返回格式异常');
      const map = new Map(data.results.map((row) => [row.id, row]));
      const checkedAt = new Date().toISOString();
      for (const node of batch) {
        const row = map.get(node.id);
        const current = this.store.state.nodes.find((n) => n.id === node.id) || node;
        current.cnCheckedAt = checkedAt;
        current.cnMethod = 'proxy';
        if (!row) {
          current.cnReachable = null;
          current.cnLatency = null;
          current.cnProxyStatus = 0;
          current.cnError = '探针未返回结果';
          continue;
        }
        current.cnReachable = Boolean(row.ok);
        current.cnLatency = Number.isFinite(row.latency) ? row.latency : null;
        current.cnProxyStatus = Number(row.status) || 0;
        current.cnError = row.error || '';
        if (row.ok) job.reachable += 1;
        else job.blocked += 1;
        job.done += 1;
      }
      job.note = `已实际代理检测 ${job.done}/${job.total} 个节点`;
      this.store.touch();
      if (start + batchSize < targets.length) await sleep(300);
    }
    if (job.cancelRequested) return this.finishCancelled(job);
    job.phase = 'done';
    job.running = false;
    job.finishedAt = new Date().toISOString();
    job.note = `CN 实际可达 ${job.reachable} · 不可达 ${job.blocked}${job.skipped ? ` · 跳过 ${job.skipped}` : ''}`;
    this.lastJob = job;
    this.job = null;
    this.store.addEvent('info', `中国实际代理检测完成：可达 ${job.reachable}，不可达 ${job.blocked}`);
    this.store.touch();
  }
}
