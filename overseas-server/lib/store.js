import fs from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { uid, clamp, cleanText } from './util.js';
import { DEFAULT_SITES, normalizeSites } from './sites.js';
import { DEFAULT_ROUTING, normalizeRouting, normalizeRuleList, parseCustomRules } from './routing.js';

export const DEFAULT_SETTINGS = {
  testUrl: 'https://www.gstatic.com/generate_204',
  defaultInterval: 360,
  renameTemplate: '{flag} {region} · {type} · {quality}{score} · {seq:02}',
  autoQuality: true,
  excludeDepleted: true,
  userAgent: 'clash.meta/1.19.8',
  maxNodesPerSource: 3000,
  qualityTTLHours: 168,
  tcpTimeoutMs: 2500,
  requestTimeoutMs: 25000,
  autoRefresh: true,
  autoTcp: true,
  autoSite: true,
  fetchProxy: '',
  chinaProbeUrl: '',
  chinaProbeToken: '',
  chinaProbeReverseUrl: '',
  chinaProbeTestUrl: 'https://www.qq.com/',
  chinaProbeTimeoutMs: 5000,
  siteCheckLimit: 30,
  mihomoPath: '',
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
      include: '',
      exclude: '',
      maxNodes: 500,
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
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const data = JSON.parse(raw);
      this.state = this.migrate(data);
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
    }
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
    state.settings.siteCheckLimit = clamp(Number.parseInt(data.settings?.siteCheckLimit, 10) || 30, 5, 200);
    state.settings.mihomoPath = cleanText(data.settings?.mihomoPath, 500);
    // Repair profile filter/group shapes from older snapshots.
    state.profiles = state.profiles.map((p) => {
      const profile = {
        ...defaultProfile(),
        ...p,
        filters: { ...defaultProfile().filters, ...(p.filters || {}) },
        groups: { ...defaultProfile().groups, ...(p.groups || {}) },
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
    const body = JSON.stringify(this.state);
    this._writing = (async () => {
      await fs.writeFile(tmp, body, 'utf8');
      await fs.rename(tmp, this.file);
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
  return clamp(Number.parseInt(value, 10) || fallback, 5, 10080);
}

export { defaultProfile };
