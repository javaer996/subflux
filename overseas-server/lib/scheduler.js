import { refreshSource, isRefreshing } from './refresher.js';
import { pushProfile, nextPushAt } from './pusher.js';
import { inQuietHours, quietHoursLabel, afterQuietHours, serverTimezone, formatInZone } from './quiet-hours.js';

export class Scheduler {
  constructor(store, tester, siteTester) {
    this.store = store;
    this.tester = tester;
    this.siteTester = siteTester;
    this.timer = null;
    this.ticking = false;
    this.started = false;
  }

  start() {
    if (this.started) return;
    this.started = true;
    // Recover sources left in a transient state by a previous process.
    for (const source of this.store.state.sources) {
      if (source.status === 'refreshing') source.status = 'idle';
      if (source.enabled && source.kind !== 'text' && source.autoRefresh !== false && !source.nextRefreshAt) {
        source.nextRefreshAt = new Date(Date.now() + 3000).toISOString();
      }
      if (source.autoRefresh === false) source.nextRefreshAt = null;
    }
    for (const profile of this.store.state.profiles) {
      if (profile.push?.enabled && !profile.push.nextPushAt) {
        profile.push.nextPushAt = nextPushAt(profile.push);
      }
    }
    const settings = this.store.state.settings;
    if (settings.latencyAuto === false) {
      settings.latencyNextAt = null;
    } else if (!settings.latencyNextAt || Number.isNaN(new Date(settings.latencyNextAt).getTime())) {
      settings.latencyNextAt = new Date(Date.now() + 60_000).toISOString();
    }
    const quietNow = inQuietHours(settings);
    settings.quietActive = quietNow;
    settings.quietUntilAt = quietNow ? new Date(afterQuietHours(settings, Date.now())).toISOString() : null;
    this.store.touch();
    setTimeout(() => this.tick(), 1600).unref?.();
    this.timer = setInterval(() => this.tick(), 30_000);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = Date.now();
      const settings = this.store.state.settings;
      const quiet = inQuietHours(settings, now);
      const quietNote = this.syncQuietNote(quiet);
      // 夜间模式期间不启动任何定时任务；到点没跑的任务不会丢，
      // 夜间结束后 tick 继续看到它仍然过期，会立刻补跑一次。
      if (quietNote) this.store.touch();
      if (quiet) return;
      const autoSources = this.store.state.settings.autoRefresh === false ? [] : this.store.state.sources
        .filter((s) => s.enabled && s.kind !== 'text' && s.autoRefresh !== false && !isRefreshing(s.id))
        .filter((s) => {
          if (!s.nextRefreshAt) return true;
          return new Date(s.nextRefreshAt).getTime() <= now;
        })
        .slice(0, 2);
      const duePushes = this.store.state.profiles
        .filter((p) => p.push?.enabled && Array.isArray(p.push.targets) && p.push.targets.length)
        .filter((p) => !p.push.nextPushAt || new Date(p.push.nextPushAt).getTime() <= now)
        .slice(0, 2);
      const latencyDue = this.latencyDue(now);
      if (!autoSources.length && !duePushes.length && !latencyDue) return;
      await Promise.all([
        ...(latencyDue ? [this.runLatencyTest()] : []),
        ...autoSources.map((source) => refreshSource(this.store, source, { tester: this.tester, siteTester: this.siteTester })),
        ...duePushes.map((profile) => pushProfile(this.store, profile).catch((err) => {
          console.error('[push]', err.message);
          profile.push.nextPushAt = nextPushAt(profile.push);
          this.store.touch();
        })),
      ]);
    } catch (err) {
      console.error('[scheduler]', err);
    } finally {
      this.ticking = false;
    }
  }

  /** 夜间模式状态变化时记一条事件，并在设置里记下预计恢复时间。 */
  /**
   * 同步夜间模式状态：状态切换时记事件，区间被改动时及时刷新预计恢复时间。
   * 返回是否需要写库。
   */
  syncQuietNote(quiet) {
    const settings = this.store.state.settings;
    const active = quiet === true;
    const label = quietHoursLabel(settings) || '夜间模式';
    const untilIso = active ? new Date(afterQuietHours(settings)).toISOString() : null;
    const changed = settings.quietActive !== active;
    const untilChanged = (settings.quietUntilAt || null) !== untilIso;
    if (!changed && !untilChanged) return false;
    settings.quietActive = active;
    settings.quietUntilAt = untilIso;
    if (!changed) return true;
    this.store.addEvent(active ? 'info' : 'success', active
      ? `进入${label}，暂停全部定时任务，${formatInZone(afterQuietHours(settings), serverTimezone())} 起恢复`
      : `${label}结束，定时任务恢复`);
    return true;
  }


  latencyDue(now = Date.now()) {
    const settings = this.store.state.settings;
    if (settings.latencyAuto === false) return false;
    if (!settings.latencyNextAt) return true;
    const at = new Date(settings.latencyNextAt).getTime();
    return Number.isFinite(at) ? at <= now : true;
  }

  /**
   * 定时测速：用 Mihomo 真实握手测连通性与延迟（TCP/UDP 协议一致），不做 IP 画像。
   * 如果当前已有测速任务，本轮跳过，等任务结束后下一个 tick 再补跑。
   */
  async runLatencyTest() {
    const settings = this.store.state.settings;
    if (settings.latencyAuto === false) {
      settings.latencyNextAt = null;
      this.store.touch();
      return null;
    }
    if (this.tester.status()?.running) return null;
    const interval = Math.max(5, Number(settings.latencyIntervalMinutes) || 60);
    const nodes = this.store.state.nodes.filter((node) => node && !node.disabled);
    settings.latencyLastAt = new Date().toISOString();
    settings.latencyNextAt = new Date(Date.now() + interval * 60_000).toISOString();
    this.store.touch();
    if (!nodes.length) return null;
    const job = this.tester.start(nodes, { connect: true, quality: false, label: '定时握手测速', auto: true });
    if (job) this.store.addEvent('info', `定时握手测速开始：${nodes.length} 个节点`);
    return job;
  }

  async refreshAll() {
    const list = this.store.state.sources.filter((s) => s.enabled && !isRefreshing(s.id));
    for (const source of list) {
      // 关闭自动刷新的源只在手动触发时刷新，不写回排期
      if (source.autoRefresh !== false && source.kind !== 'text') {
        source.nextRefreshAt = new Date(0).toISOString();
      }
    }
    this.store.touch();
    const results = [];
    // Run in two lanes to avoid a burst of outbound requests.
    for (let i = 0; i < list.length; i += 2) {
      const batch = list.slice(i, i + 2);
      const settled = await Promise.all(batch.map((s) => refreshSource(this.store, s, { tester: this.tester, siteTester: this.siteTester })));
      results.push(...settled.map((r, idx) => ({ name: batch[idx].name, ...r })));
    }
    return results;
  }
}
