import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import YAML from 'yaml';
import { ProxyAgent, fetch as proxyFetch } from 'undici';
import { uid, sleep, errMessage } from './util.js';
import { evaluateSiteResult } from './sites.js';
import { describeEngine } from './engine.js';

const MAX_TEXT = 220_000;

function jobSnapshot(job) {
  if (!job) return null;
  return {
    id: job.id,
    label: job.label,
    running: job.running,
    phase: job.phase,
    total: job.total,
    done: job.done,
    ok: job.ok,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    note: job.note || '',
    error: job.error || '',
    siteStats: job.siteStats || {},
  };
}

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

async function readPrefix(res, maxBytes = MAX_TEXT) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (size < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const buf = Buffer.from(value);
      const take = Math.min(buf.length, maxBytes - size);
      chunks.push(buf.subarray(0, take));
      size += take;
      if (take < buf.length) break;
    }
  } finally {
    try { await reader.cancel(); } catch { /* ignore */ }
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function fetchSite(site, dispatcher, timeoutMs) {
  const started = performance.now();
  try {
    const res = await proxyFetch(site.url, {
      dispatcher,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    const text = await readPrefix(res);
    return {
      status: res.status,
      finalUrl: res.url,
      text,
      latency: Math.round(performance.now() - started),
      error: '',
    };
  } catch (err) {
    return {
      status: 0,
      finalUrl: '',
      text: '',
      latency: Math.round(performance.now() - started),
      error: errMessage(err),
    };
  }
}

export class SiteTester {
  constructor(store) {
    this.store = store;
    this.job = null;
    this.lastJob = null;
    this.engine = null;
    this.pendingAuto = new Set();
  }

  status() {
    return jobSnapshot(this.job || this.lastJob);
  }

  cancel() {
    if (!this.job?.running) return false;
    this.job.cancelRequested = true;
    this.job.note = '正在取消…';
    return true;
  }

  enqueueAuto(nodes) {
    const settings = this.store.state.settings;
    if (settings.autoSite === false) return;
    if (!this.engineInfo().available) return;
    const sites = (settings.sites || []).filter((site) => site.enabled !== false);
    if (!sites.length) return;
    const useful = nodes.filter((n) => n && !n.siteCheckedAt);
    if (!useful.length) return;
    if (this.job?.running) {
      for (const node of useful) this.pendingAuto.add(node.id);
      return;
    }
    const map = new Map(this.store.state.nodes.map((n) => [n.id, n]));
    this.start(useful.map((n) => map.get(n.id) || n).filter(Boolean), sites, {
      label: '自动站点检测',
      auto: true,
    });
  }

  /** 当前设置下解析出来的引擎信息（含是否可执行）。 */
  engineInfo() {
    return describeEngine(this.store.state.settings.mihomoPath || '');
  }

  enginePath() {
    return this.engineInfo().path;
  }

  async engineAvailable() {
    const info = this.engineInfo();
    if (!info.available || !info.path) return false;
    try {
      await fs.access(info.path, fsConstants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  start(nodes, sites, options = {}) {
    if (this.job?.running) return null;
    const list = nodes.filter(Boolean);
    const enabledSites = sites.filter((s) => s.enabled !== false);
    if (!list.length || !enabledSites.length) return null;
    const job = {
      id: uid(6),
      label: options.label || '站点解锁检测',
      running: true,
      phase: 'starting',
      total: list.length,
      done: 0,
      ok: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      note: '正在启动代理引擎',
      error: '',
      siteStats: Object.fromEntries(enabledSites.map((s) => [s.id, 0])),
    };
    this.job = job;
    this.run(list, enabledSites, job).catch((err) => {
      console.error('[site-tester]', err);
      job.error = errMessage(err);
      job.phase = 'error';
      job.running = false;
      job.finishedAt = new Date().toISOString();
      this.lastJob = job;
      this.job = null;
      this.store.addEvent('error', `站点检测失败：${job.error}`);
    });
    return jobSnapshot(job);
  }

  async run(nodes, sites, job) {
    if (!(await this.engineAvailable())) {
      throw new Error(`未找到可执行的 Mihomo 引擎：${this.enginePath() || '未配置'}`);
    }
    const runtimeDir = path.join(this.store.dataDir, `.site-test-${job.id}`);
    await fs.mkdir(runtimeDir, { recursive: true });
    const configPath = path.join(runtimeDir, 'config.yaml');
    const mixedPort = await getFreePort();
    let apiPort = await getFreePort();
    while (apiPort === mixedPort) apiPort = await getFreePort();
    const secret = uid(16);
    const proxies = [];
    const tagToNode = new Map();
    let skipped = 0;
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (!node.raw || typeof node.raw !== 'object') {
        skipped += 1;
        continue;
      }
      const tag = `SITE_${String(i + 1).padStart(3, '0')}`;
      const raw = structuredClone(node.raw);
      raw.name = tag;
      delete raw['dialer-proxy'];
      delete raw['interface-name'];
      proxies.push(raw);
      tagToNode.set(tag, node);
    }
    if (!proxies.length) throw new Error('没有可用于站点检测的节点配置');

    const config = {
      'mixed-port': mixedPort,
      'allow-lan': false,
      mode: 'rule',
      'log-level': 'warning',
      'external-controller': `127.0.0.1:${apiPort}`,
      secret,
      'unified-delay': true,
      proxies,
      'proxy-groups': [{ name: 'SITE_TEST', type: 'select', proxies: proxies.map((p) => p.name) }],
      rules: ['MATCH,SITE_TEST'],
    };
    await fs.writeFile(configPath, YAML.stringify(config, { lineWidth: 0 }), 'utf8');

    let engine = null;
    let dispatcher = null;
    const logs = [];
    const stopEngine = async () => {
      if (engine && engine.exitCode == null) {
        engine.kill('SIGTERM');
        await Promise.race([
          new Promise((resolve) => engine.once('exit', resolve)),
          sleep(1800),
        ]);
        if (engine.exitCode == null) engine.kill('SIGKILL');
      }
      engine = null;
      if (dispatcher) {
        try { await dispatcher.close(); } catch { /* ignore */ }
        dispatcher = null;
      }
    };

    try {
      job.total = proxies.length;
      job.note = `已载入 ${proxies.length} 个节点，正在启动引擎`;
      engine = spawn(this.enginePath(), ['-f', configPath, '-d', runtimeDir], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NO_COLOR: '1' },
      });
      engine.stdout.on('data', (buf) => {
        logs.push(String(buf));
        if (logs.length > 40) logs.shift();
      });
      engine.stderr.on('data', (buf) => {
        logs.push(String(buf));
        if (logs.length > 40) logs.shift();
      });
      engine.on('error', (err) => {
        job.error = `Mihomo 启动失败：${err.message}`;
      });

      const apiBase = `http://127.0.0.1:${apiPort}`;
      const auth = { Authorization: `Bearer ${secret}` };
      let ready = false;
      for (let i = 0; i < 60; i += 1) {
        if (job.error) break;
        try {
          const res = await proxyFetch(`${apiBase}/version`, { headers: auth, signal: AbortSignal.timeout(800) });
          if (res.ok) { ready = true; break; }
        } catch { /* engine may still be starting */ }
        await sleep(180);
      }
      if (!ready) {
        const tail = logs.join('').replace(/\x1b\[[0-9;]*m/g, '').trim().slice(-900);
        throw new Error(`Mihomo 引擎启动失败${tail ? `：${tail}` : ''}`);
      }

      job.phase = 'testing';
      const timeoutMs = 9000;
      let index = 0;
      for (const [tag, node] of tagToNode) {
        if (job.cancelRequested) break;
        index += 1;
        job.note = `正在检测 ${index}/${tagToNode.size}：${node.name}`;
        let nodeDispatcher = null;
        try {
          nodeDispatcher = new ProxyAgent(`http://127.0.0.1:${mixedPort}`);
          const selectRes = await proxyFetch(`${apiBase}/proxies/SITE_TEST`, {
            method: 'PUT',
            headers: { ...auth, 'content-type': 'application/json' },
            body: JSON.stringify({ name: tag }),
            signal: AbortSignal.timeout(4000),
          });
          if (!selectRes.ok) throw new Error(`切换节点失败 HTTP ${selectRes.status}`);
          await sleep(120);
          const results = await Promise.all(sites.map(async (site) => {
            const response = await fetchSite(site, nodeDispatcher, timeoutMs);
            const ok = evaluateSiteResult(site, response);
            return { site, response, ok };
          }));
          const current = this.store.state.nodes.find((n) => n.id === node.id) || node;
          current.sites = { ...(current.sites || {}) };
          current.siteLatency = {};
          current.siteError = '';
          const reachable = results.filter(({ response }) => response.status > 0);
          if (reachable.length) {
            current.alive = true;
            current.testedAt = new Date().toISOString();
            current.proxyLatency = Math.min(...reachable.map(({ response }) => response.latency));
            if (!Number.isFinite(current.latency)) current.latency = current.proxyLatency;
            current.testNote = '代理实际访问可达';
          }
          for (const { site, response, ok } of results) {
            current.sites[site.id] = ok;
            current.siteLatency[site.id] = response.latency;
            if (ok === true) {
              job.siteStats[site.id] = (job.siteStats[site.id] || 0) + 1;
              job.ok += 1;
            }
          }
          current.siteCheckedAt = new Date().toISOString();
        } catch (err) {
          const current = this.store.state.nodes.find((n) => n.id === node.id) || node;
          current.sites = { ...(current.sites || {}) };
          for (const site of sites) current.sites[site.id] = null;
          current.siteCheckedAt = new Date().toISOString();
          current.siteError = errMessage(err);
        } finally {
          if (nodeDispatcher) {
            try { await nodeDispatcher.close(); } catch { /* ignore */ }
          }
        }
        job.done += 1;
        job.note = `已检测 ${job.done}/${tagToNode.size} 个节点`;
        if (job.done % 3 === 0) this.store.touch();
      }
      if (job.cancelRequested) {
        job.phase = 'cancelled';
        job.running = false;
        job.finishedAt = new Date().toISOString();
        job.note = `已取消（完成 ${job.done}/${tagToNode.size} 个节点）`;
        this.lastJob = job;
        this.job = null;
        this.store.addEvent('warn', '站点检测已取消');
        this.store.touch();
        return;
      }
      job.phase = 'done';
      job.running = false;
      job.finishedAt = new Date().toISOString();
      job.note = `完成 ${job.done} 个节点，${job.ok} 个站点通过`;
      this.store.addEvent('success', `站点检测完成：${job.done} 个节点，${job.ok} 个站点标记支持`);
      this.lastJob = job;
      this.job = null;
      this.store.touch();
      if (this.pendingAuto.size) {
        const ids = [...this.pendingAuto];
        this.pendingAuto.clear();
        const map = new Map(this.store.state.nodes.map((n) => [n.id, n]));
        const list = ids.map((id) => map.get(id)).filter(Boolean);
        const sites = (this.store.state.settings.sites || []).filter((s) => s.enabled !== false);
        if (list.length && sites.length) {
          setTimeout(() => this.start(list, sites, { label: '自动站点检测', auto: true }), 600).unref?.();
        }
      }
    } finally {
      await stopEngine();
      try { await fs.rm(runtimeDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}
