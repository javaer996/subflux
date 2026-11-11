import net from 'node:net';
import { uid } from './util.js';

const UDP_PROTOCOLS = new Set(['hysteria', 'hysteria2', 'tuic', 'wireguard']);

function tcpPing(host, port, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const started = performance.now();
    let settled = false;
    const socket = net.connect({ host, port });
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      const ms = Math.max(1, Math.round(performance.now() - started));
      socket.destroy();
      resolve(ok ? ms : null);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

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
  constructor(store, quality) {
    this.store = store;
    this.quality = quality;
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
    const wantTcp = Boolean(options.tcp ?? settings.autoTcp);
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
      tcp: wantTcp,
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
    const job = {
      id: uid(6),
      label: options.label || '手动测速',
      running: true,
      phase: options.tcp === false ? 'quality' : 'tcp',
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
    if (options.tcp !== false) {
      job.phase = 'tcp';
      const timeout = Number(this.store.state.settings.tcpTimeoutMs || 2500);
      const concurrency = Math.max(1, Math.min(64, Number(this.store.state.settings.tcpConcurrency) || 16));
      job.timeoutMs = timeout;
      job.concurrency = Math.min(concurrency, nodes.length);
      let cursor = 0;
      const workers = Array.from({ length: job.concurrency }, async () => {
        while (cursor < nodes.length) {
          if (job.cancelRequested) break;
          const node = nodes[cursor++];
          if (UDP_PROTOCOLS.has(String(node.protocol).toLowerCase())) {
            node.testedAt = new Date().toISOString();
            node.testNote = 'UDP 协议（HY2/TUIC 等）不适用 TCP 端口探测；请用站点检测做实际代理连通';
            if (node.alive === false) node.alive = null;
            job.skipped += 1;
            job.done += 1;
            continue;
          }
          const latency = await tcpPing(node.server, node.port, timeout);
          if (job.cancelRequested) break;
          node.latency = latency;
          node.testedAt = new Date().toISOString();
          node.alive = latency != null;
          node.testNote = latency != null ? 'TCP 入口可达' : 'TCP 入口不可达';
          if (latency != null) job.ok += 1;
          else job.fail += 1;
          job.done += 1;
          if (job.done % 12 === 0) this.store.touch();
        }
      });
      await Promise.all(workers);
      this.store.touch();
      if (job.cancelRequested) {
        this.finishCancelled(job);
        return;
      }
      if (options.quality === false) {
        job.phase = 'done';
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
      job.note = `画像 ${result.updated}/${nodes.length} 个节点${job.skipped ? ` · ${job.skipped} 个 UDP 节点跳过 TCP 探测` : ''}`;
      if (before === 0 && options.tcp === false) job.done = nodes.length;
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
          this.start(list, { tcp, quality: this.store.state.settings.autoQuality !== false, label: tcp ? '自动测速 + IP 画像' : '自动 IP 画像', auto: true });
        }, 500).unref?.();
      }
    }
  }
}
