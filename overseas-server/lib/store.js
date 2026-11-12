import fs from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { uid, clamp, cleanText } from './util.js';
import { DEFAULT_SITES, normalizeSites } from './sites.js';
import { DEFAULT_ROUTING, normalizeRouting, normalizeRuleList, parseCustomRules } from './routing.js';
import { initSecrets, encryptState, decryptState, hasPlaintextSecrets } from './secrets.js';
import { normalizeClock, normalizeTimezone } from './quiet-hours.js';

export const DEFAULT_SETTINGS = {
  testUrl: 'https://www.gstatic.com/generate_204',
  defaultInterval: 360,
  renameTemplate: '{flag} {region} · {type} · {quality}{score} · {seq:02}',
  autoQuality: true,
  excludeDepleted: true,
  userAgent: 'clash.meta/1.19.8',
  maxNodesPerSource: 3000,
  qualityTTLHours: 168,
  proxycheckKey: '',
  proxycheckPerDay: 90,
  tcpTimeoutMs: 2500,
  connectTimeoutMs: 5000,
  connectConcurrency: 40,
  requestTimeoutMs: 25000,
  autoRefresh: true,
  autoTcp: true,
  autoConnect: true,
  autoSite: true,
  latencyAuto: true,
  latencyIntervalMinutes: 60,
  latencyLastAt: null,
  latencyNextAt: null,
  quietHoursEnabled: false,
  quietHoursStart: '23:00',
  quietHoursEnd: '07:00',
  quietHoursTz: '',
  tcpConcurrency: 16,
  fetchProxy: '',
  chinaProbeUrl: '',
  chinaProbeToken: '',
  chinaProbeReverseUrl: '',
  chinaProbeTestUrl: 'https://www.qq.com/',
  chinaProbeTimeoutMs: 5000,
  mihomoPath: '',
  subBaseUrl: '',
  sites: DEFAULT_SITES.map((s) => ({ ...s })),
  routing: { ...DEFAULT_ROUTING },
};

const MAX_EVENTS = 240;
const MAX_QUALITY_CACHE = 8000;

function defaultProfile() {
  return {
    id: uid(8),
    name: '我的订阅',
    token: uid(16),
    enabled: true,
    format: 'clash',
    needsReview: false,
    filters: {
      protocols: [],
      regions: [],
      ipTypes: [],
      sourceIds: [],
      minQuality: 0,
      maxLatency: 0,
      onlyAlive: false,
      cert: '',
      include: '',
      exclude: '',
      maxNodes: 500,
      maxPerRegion: 0,
      sites: [],
      china: '',
    },
    appendSites: true,
    customRules: '',
    customRuleList: [],
    groups: {
      manual: true,
      auto: true,
      fallback: true,
      regions: true,
    },
    testUrl: '',
    testInterval: 300,
    renameTemplate: '',
    sort: 'quality',
    push: {
      enabled: false,
      intervalMinutes: 1440,
      targets: [],
      lastPushAt: null,
      nextPushAt: null,
      lastStatus: '',
      lastResults: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function defaultState() {
  const now = new Date().toISOString();
  return {
    version: 1,
    createdAt: now,
    settings: { ...DEFAULT_SETTINGS },
    sources: [],
    nodes: [],
    profiles: [defaultProfile()],
    events: [
      {
        id: uid(6),
        at: now,
        level: 'info',
        message: 'SubFlux 已初始化，等待添加第一个订阅源',
      },
    ],
    qualityCache: {},
  };
}

export class Store extends EventEmitter {
  constructor(dataDir) {
    super();
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'db.json');
    this.state = null;
    this._saveTimer = null;
    this._writing = null;
    this._pending = false;
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await initSecrets(this.dataDir);
    let data;
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      data = JSON.parse(raw);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('[store] 数据文件读取失败，将使用新数据:', err.message);
        try {
          await fs.rename(this.file, `${this.file}.broken-${Date.now()}`);
        } catch {
          // Ignore backup failures.
        }
      }
      this.state = defaultState();
      await this.flush();
      return this;
    }
    // 解密失败必须直接报错，绝不能当成损坏文件覆盖。
    this.state = this.migrate(decryptState(data));
    if (hasPlaintextSecrets(this.state)) await this.flush();
    return this;
  }

  migrate(data) {
    const fresh = defaultState();
    const state = {
      ...fresh,
      ...data,
      settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
      sources: Array.isArray(data.sources) ? data.sources : [],
      nodes: Array.isArray(data.nodes) ? data.nodes : [],
      profiles: Array.isArray(data.profiles) && data.profiles.length ? data.profiles : fresh.profiles,
      events: Array.isArray(data.events) ? data.events.slice(-MAX_EVENTS) : [],
      qualityCache: data.qualityCache && typeof data.qualityCache === 'object' ? data.qualityCache : {},
    };
    state.settings.routing = normalizeRouting({ ...DEFAULT_ROUTING, ...(data.settings?.routing || {}) });
    state.settings.routing.customRuleList = normalizeRuleList([
      ...(state.settings.routing.customRuleList || []),
      ...parseCustomRules(state.settings.routing.customRules).rules,
    ]);
    state.settings.routing.customRules = '';
    state.settings.sites = normalizeSites(data.settings?.sites);
    state.settings.mihomoPath = cleanText(data.settings?.mihomoPath, 500);
    state.settings.proxycheckKey = cleanText(data.settings?.proxycheckKey, 200);
    const pcPerDay = Number.parseInt(data.settings?.proxycheckPerDay, 10);
    state.settings.proxycheckPerDay = Number.isFinite(pcPerDay) ? clamp(pcPerDay, 0, 2000) : DEFAULT_SETTINGS.proxycheckPerDay;
    // 老版本只有 autoTcp（TCP 端口探测），迁移到 autoConnect 时沿用用户的开关意图。
    if (data.settings?.autoConnect === undefined && data.settings?.autoTcp !== undefined) {
      state.settings.autoConnect = data.settings.autoTcp !== false;
    }
    const connTimeout = Number.parseInt(data.settings?.connectTimeoutMs, 10);
    state.settings.connectTimeoutMs = Number.isFinite(connTimeout) ? clamp(connTimeout, 1000, 20000) : DEFAULT_SETTINGS.connectTimeoutMs;
    const connConc = Number.parseInt(data.settings?.connectConcurrency, 10);
    state.settings.connectConcurrency = Number.isFinite(connConc) ? clamp(connConc, 1, 80) : DEFAULT_SETTINGS.connectConcurrency;
    state.settings.subBaseUrl = cleanText(data.settings?.subBaseUrl, 500).replace(/\/+$/, '');
    // 夜间模式：仅接受合法的 HH:MM，缺失时回落到默认区间。
    state.settings.quietHoursEnabled = data.settings?.quietHoursEnabled === true;
    state.settings.quietHoursStart = normalizeClock(data.settings?.quietHoursStart, DEFAULT_SETTINGS.quietHoursStart);
    state.settings.quietHoursEnd = normalizeClock(data.settings?.quietHoursEnd, DEFAULT_SETTINGS.quietHoursEnd);
    state.settings.quietHoursTz = normalizeTimezone(data.settings?.quietHoursTz) || '';
    // Repair profile filter/group shapes from older snapshots.
    state.profiles = state.profiles.map((p) => {
      const profile = {
        ...defaultProfile(),
        ...p,
        filters: { ...defaultProfile().filters, ...(p.filters || {}) },
        groups: { ...defaultProfile().groups, ...(p.groups || {}) },
        push: {
          ...defaultProfile().push,
          ...(p.push && typeof p.push === 'object' ? p.push : {}),
          targets: Array.isArray(p.push?.targets) ? p.push.targets : [],
        },
      };
      profile.customRuleList = normalizeRuleList([
        ...(profile.customRuleList || []),
        ...parseCustomRules(profile.customRules).rules,
      ]);
      profile.customRules = '';
      return profile;
    });
    state.sources = state.sources.map((s) => ({
      kind: 'url',
      enabled: true,
      autoRefresh: true,
      intervalMinutes: state.settings.defaultInterval,
      userAgent: '',
      proxyMode: s.useProxy ? 'custom' : 'direct',
      proxyNodeId: '',
      proxyUrl: '',
      useProxy: false,
      status: 'idle',
      error: null,
      traffic: null,
      nodeCount: 0,
      ...s,
    }));
    state.nodes = state.nodes.map((n) => ({
      disabled: false,
      alive: null,
      latency: null,
      qualityScore: null,
      ipType: 'unknown',
      ...n,
    }));
    return state;
  }

  snapshot() {
    return this.state;
  }

  addEvent(level, message, meta = {}) {
    const event = {
      id: uid(6),
      at: new Date().toISOString(),
      level: ['info', 'success', 'warn', 'error'].includes(level) ? level : 'info',
      message: cleanText(message, 360),
      ...(meta && Object.keys(meta).length ? { meta } : {}),
    };
    this.state.events.push(event);
    if (this.state.events.length > MAX_EVENTS) {
      this.state.events.splice(0, this.state.events.length - MAX_EVENTS);
    }
    this.touch();
    return event;
  }

  pruneQualityCache() {
    const entries = Object.entries(this.state.qualityCache);
    if (entries.length <= MAX_QUALITY_CACHE) return;
    entries.sort((a, b) => (b[1].fetchedAt || 0) - (a[1].fetchedAt || 0));
    this.state.qualityCache = Object.fromEntries(entries.slice(0, MAX_QUALITY_CACHE));
  }

  touch() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.flush().catch((err) => console.error('[store] 保存失败:', err));
    }, 180);
    this._saveTimer.unref?.();
  }

  async flush() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    if (this._writing) {
      this._pending = true;
      await this._writing;
      if (this._pending) {
        this._pending = false;
        return this.flush();
      }
      return;
    }
    const tmp = `${this.file}.tmp`;
    const body = JSON.stringify(encryptState(this.state));
    this._writing = (async () => {
      await fs.writeFile(tmp, body, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(tmp, this.file);
      await fs.chmod(this.file, 0o600).catch(() => {});
    })();
    try {
      await this._writing;
    } finally {
      this._writing = null;
    }
    if (this._pending) {
      this._pending = false;
      return this.flush();
    }
  }

  async close() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    await this.flush();
  }
}

export function ensureUid() {
  return uid(8);
}

export function normalizeInterval(value, fallback = 360) {
  return clamp(Number.parseInt(value, 10) || fallback, 5, 5256000);
}

export { defaultProfile };
