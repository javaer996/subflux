import { refreshSource, isRefreshing } from './refresher.js';
import { pushProfile, nextPushAt } from './pusher.js';

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
      if (!autoSources.length && !duePushes.length) return;
      await Promise.all([
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
