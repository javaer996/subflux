import { uid } from './util.js';
import { isUdpProtocol } from './proxy-probe.js';

function snapshotJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    label: job.label,
    running: job.running,
    phase: job.phase,
    total: job.total,
    done: job.done,
    ok: job.ok,
    fail: job.fail,
    skipped: job.skipped || 0,
    concurrency: job.concurrency || 0,
    timeoutMs: job.timeoutMs || 0,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    note: job.note || '',
  };
}

export class Tester {
  constructor(store, quality, probe) {
    this.store = store;
    this.quality = quality;
    this.probe = probe;
    this.job = null;
    this.lastJob = null;
    this.pendingAuto = new Set();
    this.pendingAutoTcp = false;
  }

  status() {
    return snapshotJob(this.job || this.lastJob);
  }

  enqueueAuto(nodes, options = {}) {
    const settings = this.store.state.settings;
    const wantQuality = settings.autoQuality !== false;
    const wantTcp = Boolean(options.connect ?? settings.autoConnect ?? settings.autoTcp);
    if (!wantQuality && !wantTcp) return;
    const full = Boolean(options.all);
    const useful = nodes.filter((n) => n && (full || (
      (wantQuality && (!n.qualityAt || n.ipType === 'unknown'))
      || (wantTcp && n.testedAt == null)
    )));
    if (!useful.length) return;
    if (this.job?.running) {
      for (const n of useful) this.pendingAuto.add(n.id);
      this.pendingAutoTcp = this.pendingAutoTcp || wantTcp;
      return;
    }
    const map = new Map(this.store.state.nodes.map((n) => [n.id, n]));
    this.start(useful.map((n) => map.get(n.id) || n).filter(Boolean), {
      connect: wantTcp,
      quality: wantQuality,
      label: wantTcp ? '自动测速 + IP 画像' : '自动 IP 画像',
      auto: true,
    });
  }

  cancel() {
    if (!this.job?.running) return false;
    this.job.cancelRequested = true;
    this.job.note = '正在取消…';
    return true;
  }

  finishCancelled(job) {
    // 取消请求可能在最后一批结束时才到达，此时结果其实是完整的。
    const completed = job.done >= job.total && job.total > 0;
    job.phase = completed ? 'done' : 'cancelled';
    job.running = false;
    job.finishedAt = new Date().toISOString();
    job.note = completed ? `已完成 ${job.total} 个节点` : `已取消（完成 ${job.done}/${job.total}）`;
    this.lastJob = job;
    this.job = null;
    this.store.addEvent('warn', `${job.label}已取消`);
    this.store.touch();
  }

  start(nodes, options = {}) {
    if (this.job?.running) return null;
    const list = nodes.filter(Boolean);
    if (!list.length) return null;
    const job = {
      id: uid(6),
      label: options.label || '手动测速',
      running: true,
      phase: options.connect === false ? 'quality' : 'connect',
      total: list.length,
      done: 0,
      ok: 0,
      fail: 0,
      skipped: 0,
      concurrency: 0,
      timeoutMs: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      note: '',
    };
    this.job = job;
    this.run(list, job, options).catch((err) => {
      console.error('[tester]', err);
      job.note = err.message;
      job.running = false;
      job.phase = 'error';
      job.finishedAt = new Date().toISOString();
      this.lastJob = job;
      this.job = null;
      this.store.addEvent('error', `节点测试失败：${err.message}`);
    });
    return snapshotJob(job);
  }

  async run(nodes, job, options) {
    if (options.connect !== false) {
      job.phase = 'connect';
      const settings = this.store.state.settings;
      const timeout = Number(settings.connectTimeoutMs || 5000);
      job.timeoutMs = timeout;
      job.concurrency = Math.min(Math.max(1, Math.min(80, Number(settings.connectConcurrency) || 40)), nodes.length);
      // 真实的代理握手：HTTP/HTTPS/SOCKS5/HY2/TUIC 全部走同一套 CONNECT，
      // 因此 UDP 协议也能判定可达，不再被当成「不适用」跳过。
      const result = await this.probe.probe(nodes, {
        timeoutMs: timeout,
        url: settings.testUrl,
        onProgress: (done, total) => {
          job.done = done;
          job.note = `代理握手 ${done}/${total}`;
        },
        shouldCancel: () => Boolean(job.cancelRequested),
      });
      const now = new Date().toISOString();
      // 取消也保留已经测出来的结果，只跳过没轮到的节点。
      for (const node of nodes) {
        const r = result.results.get(node.id);
        if (!r) {
          if (job.cancelRequested) continue;
          node.testedAt = now;
          node.alive = false;
          node.testNote = '代理握手无结果';
          job.fail += 1;
          continue;
        }
        node.testedAt = now;
        node.alive = r.ok;
        node.proxyLatency = r.ok ? r.latency : null;
        node.latency = r.ok ? r.latency : null;
        node.connectError = r.ok ? '' : r.error;
        node.certTrusted = r.certTrusted === undefined ? null : Boolean(r.certTrusted);
        node.certError = r.certError || '';
        node.testNote = r.ok
          ? `${isUdpProtocol(node.protocol) ? 'UDP 代理' : '代理'}握手可达`
          : `不可达：${r.error}`;
        if (r.ok && node.certTrusted === false) node.testNote += ' · 证书不受信';
        if (r.ok) job.ok += 1;
        else job.fail += 1;
      }
      job.done = result.results.size || nodes.length;
      job.skipped = 0;
      job.note = `握手完成：${job.ok} 个可达，${job.fail} 个不可达（耗时 ${Math.round(result.elapsed / 1000)} 秒）`;
      this.store.touch();
      if (job.cancelRequested) {
        this.finishCancelled(job);
        return;
      }
    }

    if (job.cancelRequested) {
      this.finishCancelled(job);
      return;
    }

    if (options.quality !== false) {
      job.phase = 'quality';
      const before = job.done;
      const result = await this.quality.enrich(nodes, {
        onProgress: (done, total) => {
          job.note = `IP 情报 ${done}/${total}`;
        },
      });
      job.note = `画像 ${result.updated}/${nodes.length} 个节点`;
      if (before === 0 && options.connect === false) job.done = nodes.length;
      this.store.addEvent('info', `${job.label}完成：${result.updated} 个节点已更新 IP 画像`);
    }

    job.phase = 'done';
    job.running = false;
    job.finishedAt = new Date().toISOString();
    this.lastJob = job;
    this.job = null;
    this.store.touch();

    if (this.pendingAuto.size) {
      const ids = [...this.pendingAuto];
      this.pendingAuto.clear();
      const map = new Map(this.store.state.nodes.map((n) => [n.id, n]));
      const list = ids.map((id) => map.get(id)).filter(Boolean);
      if (list.length) {
        const tcp = this.pendingAutoTcp;
        this.pendingAutoTcp = false;
        setTimeout(() => {
          this.start(list, { connect: tcp, quality: this.store.state.settings.autoQuality !== false, label: tcp ? '自动测速 + IP 画像' : '自动 IP 画像', auto: true });
        }, 500).unref?.();
      }
    }
  }
}
