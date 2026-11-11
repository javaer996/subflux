/* =========================================================
   SubFlux frontend · vanilla ES modules, zero dependencies
   ========================================================= */

const ICONS = {
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/></svg>',
  rss: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.4" fill="currentColor" stroke="none"/></svg>',
  nodes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="12" cy="18" r="2.4"/><path d="M8.2 7.2 10.6 16M15.8 7.2 13.4 16M8.4 6h7.2"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88l-.06-.06L7.03 4.17l.06.06A1.7 1.7 0 0 0 8.97 4.6 1.7 1.7 0 0 0 10 3.04V3h4v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.2.62.78 1.04 1.44 1.04H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/><path d="M3 12A9 9 0 0 1 18.5 5.8L21 8"/><path d="M21 3v5h-5"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 15H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  duplicate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/><path d="M12.5 14.5h4M14.5 12.5v4"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="2.6"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 5 11 7-11 7V5Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.5 4.5L19 7"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/></svg>',
  database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.2 4.3L17.5 8.5l-4.3 1.2L12 14l-1.2-4.3-4.3-1.2 4.3-1.2L12 3Z"/><path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z"/><path d="m5 14 .5 1.8L7.3 16l-1.8.5L5 18.3l-.5-1.8L2.7 16l1.8-.2L5 14Z"/></svg>',
  server: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4.5 6v5.5c0 4.4 3.2 7.9 7.5 9.5 4.3-1.6 7.5-5.1 7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2.5-6 5 12 2.5-6h4"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  pageFirst: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 18-6-6 6-6"/><path d="m11 18-6-6 6-6"/><path d="M5 6v12"/></svg>',
  pageLast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 6 6 6-6 6"/><path d="m13 6 6 6-6 6"/><path d="M19 6v12"/></svg>',
  zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z"/><path d="M9 21v-7h6v7"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H6a4 4 0 0 1-.8-7.9A6 6 0 0 1 17 9a5 5 0 0 1 .5 10Z"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/><path d="M10 21v-3h4v3"/></svg>',
  mobile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></svg>',
  wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19h.01"/><path d="M2 9a15 15 0 0 1 20 0"/></svg>',
  power: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/><path d="m14 4-4 16"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9"/><path d="m17 4 3 3"/><path d="m14 7 3 3"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/></svg>',
  rotate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>',
  terminal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/></svg>',
  traffic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-.9.7-1.5 1.3-1.5 2.5"/><path d="M12 17h.01"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M20 20v.01M20 17h.01M17 20h.01"/></svg>',
};

const VIEW_META = {
  overview: { title: '概览', eyebrow: 'OVERVIEW' },
  sources: { title: '订阅源', eyebrow: 'SOURCES' },
  nodes: { title: '节点池', eyebrow: 'NODE POOL' },
  tasks: { title: '任务中心', eyebrow: 'TASKS' },
  profiles: { title: '输出订阅', eyebrow: 'OUTPUTS' },
  settings: { title: '设置与说明', eyebrow: 'SYSTEM' },
};

const IP_TYPE_META = {
  home: { label: '家宽', icon: 'home', color: 'var(--mint)' },
  dc: { label: '机房', icon: 'building', color: 'var(--orange)' },
  mobile: { label: '移动', icon: 'mobile', color: 'var(--blue)' },
  business: { label: '企业', icon: 'cloud', color: 'var(--violet)' },
  cdn: { label: 'CDN', icon: 'globe', color: 'var(--cyan)' },
  unknown: { label: '未知', icon: 'help', color: 'var(--muted)' },
};

const App = {
  state: null,
  view: 'overview',
  nodeData: null,
  nodeLoading: false,
  nodeLoadSeq: 0,
  nodeFilters: {
    q: '', protocol: '', region: '', ipType: '', sourceId: '', site: '', china: '', status: 'usable',
    qualityMin: '', latencyMax: '', alive: '', sort: 'quality',
  },
  nodePage: 1,
  nodePageSize: 50,
  selected: new Set(),
  csrf: '',
  sourceQuery: '',
  pollTimer: null,
  fastPoll: false,
  refreshingAll: false,
  lastJobRunning: false,
  focusSearch: false,
  modalOpen: false,
  drawer: null,
  saving: false,
};

/* ------------------------- utils ------------------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ico(name, cls = '') {
  return `<span class="icon ${cls}">${ICONS[name] || ''}</span>`;
}

function hydrateIcons(root = document) {
  for (const el of $$('[data-icon]', root)) {
    if (el.dataset.hydrated === '1') continue;
    el.innerHTML = ICONS[el.dataset.icon] || '';
    el.dataset.hydrated = '1';
  }
}

function fmtBytes(value) {
  const n = Number(value) || 0;
  if (n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i >= 3 ? 2 : i >= 2 ? 1 : 0)} ${units[i]}`;
}

function fmtNum(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value) || 0);
}

function fmtTime(iso, fallback = '—') {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return new Intl.DateTimeFormat('zh-CN', sameDay
    ? { hour: '2-digit', minute: '2-digit', hour12: false }
    : { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

function relTime(iso, fallback = '从未') {
  if (!iso) return fallback;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return fallback;
  const diff = Date.now() - t;
  const abs = Math.abs(diff);
  if (abs < 45_000) return diff >= 0 ? '刚刚' : '即将';
  const units = [
    [86_400_000, '天'], [3_600_000, '小时'], [60_000, '分钟'],
  ];
  for (const [ms, label] of units) {
    if (abs >= ms) {
      const n = Math.floor(abs / ms);
      return diff >= 0 ? `${n} ${label}前` : `${n} ${label}后`;
    }
  }
  return diff >= 0 ? '刚刚' : '即将';
}

function uptime(seconds) {
  const s = Number(seconds) || 0;
  if (s < 60) return `${s} 秒`;
  if (s < 3600) return `${Math.floor(s / 60)} 分钟`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时 ${Math.floor((s % 3600) / 60)} 分`;
  return `${Math.floor(s / 86400)} 天 ${Math.floor((s % 86400) / 3600)} 小时`;
}

function fmtLatency(value) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value)} ms`;
}

function latencyClass(value) {
  if (!Number.isFinite(value)) return 'none';
  if (value <= 100) return 'good';
  if (value <= 250) return 'mid';
  return 'bad';
}

function qualityClass(score) {
  if (!Number.isFinite(score)) return 'q-untested';
  if (score >= 82) return 'q-excellent';
  if (score >= 68) return 'q-good';
  if (score >= 52) return 'q-fair';
  return 'q-poor';
}

function qualityLabel(score) {
  if (!Number.isFinite(score)) return '待测';
  if (score >= 82) return '优质';
  if (score >= 68) return '良好';
  if (score >= 52) return '一般';
  return '较差';
}

function typeMeta(type) {
  return IP_TYPE_META[type] || IP_TYPE_META.unknown;
}

function typeBadge(type) {
  const meta = typeMeta(type);
  return `<span class="type-badge type-${esc(type || 'unknown')}">${esc(meta.label)}</span>`;
}

function cnBadge(node) {
  if (!App.state?.meta?.chinaProbeConfigured && !node.cnCheckedAt) return '';
  const method = node.cnMethod === 'proxy' ? '实际代理' : 'TCP';
  if (node.cnReachable === true) return `<span class="badge badge-mint cn-badge" title="中国探针${method}可达">CN ✓</span>`;
  if (node.cnReachable === false) return `<span class="badge badge-red cn-badge" title="中国探针${method}不可达，疑似被墙或 CN 路由不可达">CN ✕</span>`;
  if (node.cnError?.includes('UDP')) return '<span class="badge badge-muted cn-badge" title="UDP 协议，TCP 探针不可判定">CN —</span>';
  return '<span class="badge badge-muted cn-badge" title="尚未进行中国连通检测">CN ?</span>';
}

function nodeSiteBadges(node) {
  const sites = (App.state?.settings?.sites || []).filter((s) => s.enabled !== false);
  if (!sites.length) return '<span class="dim tiny">未配置</span>';
  return `<div class="site-tags">${sites.map((site) => {
    const state = node.sites && site.id in node.sites
      ? node.sites[site.id] === true ? 'ok' : node.sites[site.id] === false ? 'fail' : 'unknown'
      : 'untested';
    const label = state === 'ok' ? '支持' : state === 'fail' ? '不支持' : state === 'unknown' ? '未确认' : '未检测';
    return `<span class="site-tag ${state}" title="${esc(site.name)}：${label}">${esc(site.short)}</span>`;
  }).join('')}</div>`;
}

function formatMeta(format) {
  const map = {
    clash: { label: 'Clash / Mihomo', short: 'YML', cls: 'format-clash' },
    singbox: { label: 'Sing-box', short: 'SB', cls: 'format-singbox' },
    base64: { label: 'Base64 / V2Ray', short: 'B64', cls: 'format-base64' },
    plain: { label: '节点链接', short: 'URI', cls: 'format-plain' },
  };
  return map[format] || map.clash;
}

function statusPill(source) {
  if (!source.enabled) return `<span class="badge badge-muted">已停用</span>`;
  if (source.status === 'refreshing') return `<span class="badge badge-blue">刷新中</span>`;
  if (source.status === 'error') return `<span class="badge badge-red">异常</span>`;
  if (source.traffic?.depleted) return `<span class="badge badge-amber">${source.traffic.expired ? '已过期' : '流量用尽'}</span>`;
  if (source.status === 'ok') return `<span class="badge badge-mint">正常</span>`;
  return `<span class="badge badge-muted">待刷新</span>`;
}

function sourceAvatar(name) {
  const first = String(name || 'S').trim().charAt(0).toUpperCase();
  return `<div class="source-avatar">${esc(first || 'S')}</div>`;
}

function prettyUrl(url) {
  if (!url) return '手动粘贴的节点内容';
  try {
    const u = new URL(url);
    const pathname = u.pathname.length > 42 ? `${u.pathname.slice(0, 41)}…` : u.pathname;
    return `${u.hostname}${pathname}${u.search ? ' · 参数已隐藏' : ''}`;
  } catch {
    return String(url).slice(0, 70);
  }
}

function subBase() {
  const configured = String(App.state?.settings?.subBaseUrl || '').trim().replace(/\/+$/, '');
  return configured || location.origin;
}

function subUrl(profile, format = null) {
  return `${subBase()}/sub/${profile.token}${format ? `/${format}` : ''}`;
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(method !== 'GET' && App.csrf ? { 'x-csrf-token': App.csrf } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 && !String(path).startsWith('/api/auth/')) {
    window.location.href = '/login';
    throw new Error('登录已过期，请重新登录');
  }
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const message = (data && data.error) || (typeof data === 'string' ? data : `请求失败 (${res.status})`);
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function toast(message, type = 'info', timeout = 4200) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const iconName = type === 'success' ? 'check' : type === 'error' ? 'alert' : type === 'warn' ? 'alert' : 'info';
  el.innerHTML = `${ico(iconName)}<div>${esc(message)}</div><span class="toast-close" aria-label="关闭">${ico('x')}</span>`;
  root.appendChild(el);
  const close = () => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 180);
  };
  el.querySelector('.toast-close').addEventListener('click', close);
  if (timeout) setTimeout(close, timeout);
}

async function copyText(text, success = '已复制到剪贴板') {
  try {
    await navigator.clipboard.writeText(text);
    toast(success, 'success');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast(success, 'success');
  }
}

function setBusy(el, busy) {
  if (!el) return;
  el.classList.toggle('is-loading', busy);
  el.disabled = busy;
}

function closeMobile() {
  document.body.classList.remove('sidebar-open');
}

/* ------------------------- chrome ------------------------- */

function updateChrome() {
  const state = App.state;
  if (!state) {
    const top = $('#top-status');
    if (top) top.innerHTML = `<span class="status-dot is-error"></span><span>连接失败</span>`;
    return;
  }
  const stats = state.stats;
  const activeSources = state.sources.filter((s) => s.status === 'refreshing').length;
  const statusText = activeSources ? `正在刷新 ${activeSources} 个源` : '服务运行中';
  const top = $('#top-status');
  if (top) top.innerHTML = `<span class="status-dot ${activeSources ? 'is-loading' : ''}"></span><span>${statusText}</span>`;
  const sideDot = $('#side-status-dot');
  if (sideDot) sideDot.className = `status-dot ${activeSources ? 'is-loading' : ''}`;
  const sideText = $('#side-status-text');
  if (sideText) sideText.textContent = activeSources ? '正在同步订阅' : '服务运行中';
  const mem = $('#side-memory');
  if (mem) mem.textContent = `${state.meta.memoryMB} MB`;
  const runningTasks = (state.job?.running ? 1 : 0) + (state.siteJob?.running ? 1 : 0) + (state.chinaJob?.running ? 1 : 0) + activeSources;
  const badges = {
    'nav-badge-tasks': runningTasks,
    'nav-badge-sources': stats.sources.total,
    'nav-badge-nodes': stats.nodes.usable,
    'nav-badge-profiles': state.profiles.length,
  };
  for (const [id, value] of Object.entries(badges)) {
    const el = document.getElementById(id);
    if (el) el.textContent = fmtNum(value);
  }
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === App.view));
  const title = VIEW_META[App.view]?.title || '概览';
  const el = $('#page-title');
  if (el) el.textContent = title;
  const refreshBtn = $('#top-refresh');
  if (refreshBtn) {
    const busy = App.refreshingAll || state.sources.some((s) => s.status === 'refreshing');
    refreshBtn.disabled = busy;
    refreshBtn.classList.toggle('is-loading', busy);
  }
}

function currentViewFromHash() {
  const hash = location.hash.replace(/^#\/?/, '').split('?')[0];
  return VIEW_META[hash] ? hash : 'overview';
}

function navigate(view) {
  if (location.hash === `#/${view}`) return;
  location.hash = `#/${view}`;
}

/* ------------------------- modal / drawer ------------------------- */

function openModal({ title, subtitle = '', content, size = 'md' }) {
  closeModal(true);
  App.modalOpen = true;
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-layer">
      <div class="modal-backdrop" data-close-modal></div>
      <div class="modal-panel modal-${esc(size)}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head">
          <div>
            <h2>${esc(title)}</h2>
            ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
          </div>
          <button class="icon-btn" data-close-modal aria-label="关闭">${ico('x')}</button>
        </div>
        <div class="modal-body">${content}</div>
      </div>
    </div>`;
  document.body.classList.add('no-scroll');
  hydrateIcons(root);
  refreshAllRuleBuilders();
  setTimeout(() => root.querySelector('input, select, textarea, button')?.focus(), 80);
  root.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', () => closeModal()));
}

function closeModal(force = false) {
  if (!App.modalOpen && !force) return;
  App.modalOpen = false;
  $('#modal-root').innerHTML = '';
  document.body.classList.remove('no-scroll');
}

function confirmDialog({ title = '请确认', message, confirmText = '确认', cancelText = '取消', danger = false }) {
  return new Promise((resolve) => {
    openModal({
      title,
      subtitle: '此操作会立即生效',
      size: 'sm',
      content: `
        <form id="confirm-form">
          <p style="font-size:12.5px;line-height:1.7;color:var(--text-soft)">${esc(message)}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-confirm-cancel>${esc(cancelText)}</button>
            <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(confirmText)}</button>
          </div>
        </form>`,
    });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      closeModal();
      resolve(value);
    };
    const layer = $('#modal-root .modal-layer');
    layer?.querySelector('[data-confirm-cancel]')?.addEventListener('click', () => finish(false));
    $('#confirm-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      finish(true);
    });
    layer?.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', () => finish(false)));
    layer?.querySelector('.modal-backdrop')?.addEventListener('click', () => finish(false));
  });
}

function openDrawerShell(profile, format) {
  App.drawer = { profileId: profile.id, format, data: null, loading: true, reqId: Date.now() + Math.random() };
  renderDrawer();
}

function closeDrawer() {
  App.drawer = null;
  $('#drawer-root').innerHTML = '';
  document.body.classList.remove('no-scroll');
}

function renderDrawer() {
  const drawer = App.drawer;
  if (!drawer) {
    $('#drawer-root').innerHTML = '';
    return;
  }
  const profile = App.state?.profiles.find((p) => p.id === drawer.profileId);
  if (!profile) {
    closeDrawer();
    return;
  }
  const formats = ['clash', 'singbox', 'base64', 'plain'];
  const body = drawer.loading
    ? '<div class="loading-panel"><div class="spinner"></div><span>正在生成配置…</span></div>'
    : drawer.error
      ? `<div class="empty"><div class="empty-art">${ico('alert')}</div><h3>生成失败</h3><p>${esc(drawer.error)}</p></div>`
      : `<div class="drawer-warnings">${(drawer.data.warnings || []).map((w) => `<div class="alert alert-warn" style="margin-bottom:8px">${ico('alert')}<div>${esc(w)}</div></div>`).join('')}</div>
        <div class="drawer-meta">
          <span>${esc(drawer.data.label || '')}</span>
          <span>输出 <b style="color:var(--text-soft)">${fmtNum(drawer.data.emitted)}</b> 个节点</span>
          <span>${fmtBytes(new Blob([drawer.data.body]).size)}</span>
          ${drawer.data.counts?.duplicates ? `<span>去重 ${drawer.data.counts.duplicates}</span>` : ''}
        </div>
        <div class="code-block"><pre><code>${esc(drawer.data.body || '')}</code></pre></div>`;
  $('#drawer-root').innerHTML = `
    <div class="drawer-layer">
      <div class="drawer-backdrop" data-close-drawer></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="订阅预览">
        <div class="drawer-head">
          <div>
            <h2>${esc(profile.name)}</h2>
            <p>输出订阅预览 · 可直接复制或下载</p>
          </div>
          <button class="icon-btn" data-close-drawer aria-label="关闭">${ico('x')}</button>
        </div>
        <div class="drawer-tabs">
          <div class="segmented">
            ${formats.map((f) => `<button data-preview-format="${f}" class="${f === drawer.format ? 'active' : ''}">${esc(formatMeta(f).label)}</button>`).join('')}
          </div>
          <button class="btn btn-ghost btn-sm" data-refresh-preview>${ico('refresh')}<span>重新生成</span></button>
        </div>
        <div class="drawer-body">${body}</div>
        <div class="drawer-foot">
          <div class="left">
            <button class="btn btn-ghost btn-sm" data-copy-preview ${drawer.loading || drawer.error ? 'disabled' : ''}>${ico('copy')}<span>复制配置</span></button>
            <button class="btn btn-ghost btn-sm" data-download-preview ${drawer.loading || drawer.error ? 'disabled' : ''}>${ico('download')}<span>下载</span></button>
          </div>
          <button class="btn btn-soft btn-sm" data-open-preview>${ico('external')}<span>打开订阅链接</span></button>
        </div>
      </aside>
    </div>`;
  document.body.classList.add('no-scroll');
  hydrateIcons($('#drawer-root'));
  $$('[data-close-drawer]').forEach((el) => el.addEventListener('click', closeDrawer));
  $$('[data-preview-format]').forEach((el) => el.addEventListener('click', () => {
    if (!App.drawer) return;
    App.drawer.format = el.dataset.previewFormat;
    App.drawer.reqId = Date.now() + Math.random();
    loadPreview();
  }));
  $('[data-refresh-preview]')?.addEventListener('click', loadPreview);
  $('[data-copy-preview]')?.addEventListener('click', () => {
    if (App.drawer?.data?.body) copyText(App.drawer.data.body, '配置已复制');
  });
  $('[data-download-preview]')?.addEventListener('click', downloadPreview);
  $('[data-open-preview]')?.addEventListener('click', () => {
    const p = App.state?.profiles.find((x) => x.id === App.drawer?.profileId);
    if (p) window.open(subUrl(p, App.drawer.format), '_blank', 'noopener');
  });
}

async function loadPreview() {
  if (!App.drawer) return;
  const reqId = App.drawer.reqId;
  App.drawer.loading = true;
  App.drawer.error = null;
  renderDrawer();
  try {
    const data = await api(`/api/profiles/${encodeURIComponent(App.drawer.profileId)}/preview?format=${encodeURIComponent(App.drawer.format)}`);
    if (!App.drawer || App.drawer.reqId !== reqId) return;
    App.drawer.data = data;
    App.drawer.loading = false;
  } catch (err) {
    if (!App.drawer || App.drawer.reqId !== reqId) return;
    App.drawer.loading = false;
    App.drawer.error = err.message;
  }
  renderDrawer();
}

function downloadPreview() {
  const drawer = App.drawer;
  if (!drawer?.data) return;
  const profile = App.state?.profiles.find((p) => p.id === drawer.profileId);
  const meta = formatMeta(drawer.format);
  const ext = drawer.format === 'clash' ? 'yaml' : drawer.format === 'singbox' ? 'json' : 'txt';
  const blob = new Blob([drawer.data.body], { type: drawer.data.contentType || 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `subflux-${(profile?.name || 'output').replace(/[\\/:*?"<>|]/g, '-')}-${meta.short.toLowerCase()}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

/* ------------------------- page head ------------------------- */

function pageHead(eyebrow, title, desc, actions = '') {
  return `
    <div class="page-head">
      <div class="page-head-copy">
        <span class="eyebrow">${esc(eyebrow)}</span>
        <h1>${esc(title)}</h1>
        <p>${desc}</p>
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </div>`;
}

function alertBox(type, text) {
  const icon = type === 'warn' ? 'alert' : type === 'danger' ? 'alert' : type === 'success' ? 'check' : 'info';
  const cls = type === 'danger' ? 'alert-danger' : type === 'warn' ? 'alert-warn' : type === 'success' ? 'alert-success' : 'alert-info';
  return `<div class="alert ${cls}">${ico(icon)}<div>${text}</div></div>`;
}

/* ------------------------- overview ------------------------- */

function renderOverview() {
  const state = App.state;
  const stats = state.stats;
  const s = stats.sources;
  const n = stats.nodes;
  const usablePct = n.total ? Math.round((n.usable / n.total) * 100) : 0;
  const qualityPct = n.avgQuality || 0;
  const trafficPct = stats.traffic.percent || 0;
  const hasSources = s.total > 0;

  const statCards = `
    <div class="stat-grid">
      <div class="stat-card" style="--accent:var(--mint)">
        <div class="stat-top"><div class="stat-label">${ico('nodes')} 可用节点</div><span class="stat-delta">去重 ${fmtNum(n.unique)}</span></div>
        <div class="stat-value"><strong>${fmtNum(n.usable)}</strong><span>/ ${fmtNum(n.total)} 个</span></div>
        <div class="stat-sub"><span>${fmtNum(n.home)} 家宽</span><span>·</span><span>${fmtNum(n.dc)} 机房</span><span>·</span><span>${fmtNum(n.cdn)} CDN</span></div>
        <div class="stat-bar"><i style="width:${usablePct}%"></i></div>
      </div>
      <div class="stat-card" style="--accent:var(--blue)">
        <div class="stat-top"><div class="stat-label">${ico('rss')} 订阅源</div><span class="stat-delta">${s.enabled} 启用</span></div>
        <div class="stat-value"><strong>${fmtNum(s.total)}</strong><span>个来源</span></div>
        <div class="stat-sub"><span style="color:var(--mint)">${s.ok} 正常</span><span>·</span><span style="color:${s.error ? 'var(--red)' : 'var(--muted)'}">${s.error} 异常</span><span>·</span><span>${s.depleted} 耗尽</span></div>
        <div class="stat-bar"><i style="width:${s.total ? Math.round((s.ok / s.total) * 100) : 0}%"></i></div>
      </div>
      <div class="stat-card" style="--accent:var(--violet)">
        <div class="stat-top"><div class="stat-label">${ico('sparkles')} 平均质量</div><span class="stat-delta">入口 IP 画像</span></div>
        <div class="stat-value"><strong>${n.avgQuality || '—'}</strong><span>${n.avgQuality ? '分' : '待测'}</span></div>
        <div class="stat-sub"><span>家宽 ${n.home}</span><span>·</span><span>平均 ${n.avgLatency ? `${n.avgLatency} ms` : '—'}</span></div>
        <div class="stat-bar"><i style="width:${qualityPct}%"></i></div>
      </div>
      <div class="stat-card" style="--accent:var(--amber)">
        <div class="stat-top"><div class="stat-label">${ico('traffic')} 流量池</div><span class="stat-delta">${stats.traffic.total > 0 ? `${trafficPct}%` : '未上报'}</span></div>
        <div class="stat-value"><strong>${stats.traffic.total > 0 ? esc(stats.traffic.usedLabel) : '—'}</strong><span>${stats.traffic.total > 0 ? `/ ${esc(stats.traffic.totalLabel)}` : '无流量数据'}</span></div>
        <div class="stat-sub"><span>${s.total} 个订阅汇总</span><span>·</span><span>${n.untested} 个待画像</span></div>
        <div class="stat-bar"><i style="width:${trafficPct}%"></i></div>
      </div>
    </div>`;

  return `
    <section class="view">
      ${pageHead('OVERVIEW', '订阅汇聚', '把分散的机场订阅整理成一份干净、可筛选、可分享的出口。定时刷新、解析、IP 画像，全部在一个轻量面板里完成。', `
        <button class="btn btn-ghost" data-action="export-sources">${ico('download')}<span>导出</span></button>
        <button class="btn btn-ghost" data-action="import-sources">${ico('upload')}<span>导入</span></button>
        <button class="btn btn-ghost" data-action="refresh-all">${ico('refresh')}<span>刷新全部</span></button>
        <button class="btn btn-primary" data-action="add-source">${ico('plus')}<span>添加订阅</span></button>
      `)}
      ${statCards}
      <div class="overview-grid">
        <div class="card">
          <div class="card-head">
            <div>
              <h2>订阅源状态</h2>
              <div class="section-sub">${hasSources ? '刷新、流量与解析状态一览' : '添加第一个订阅链接开始'}</div>
            </div>
            <a class="link" href="#/sources">管理全部 ${ico('arrowRight')}</a>
          </div>
          <div class="source-list">
            ${hasSources ? state.sources.slice(0, 5).map(overviewSourceRow).join('') : overviewEmptySources()}
          </div>
        </div>
        <div class="stack">
          ${renderQualityCard()}
          ${renderRegionCard()}
        </div>
      </div>
      <div class="overview-grid" style="margin-top:18px">
        ${renderTimelineCard()}
        ${hasSources ? renderQuickOutputs() : renderQuickStart()}
      </div>
    </section>`;
}

function overviewSourceRow(source) {
  const traffic = source.traffic || {};
  const manual = source.kind === 'text' || source.autoRefresh === false;
  const meta = [
    `${source.nodeCount || 0} 节点`,
    manual ? '手动刷新' : `${source.intervalMinutes || 0} 分钟`,
    source.lastRefreshAt ? `${relTime(source.lastRefreshAt)}刷新` : '尚未刷新',
  ];
  const pct = traffic.total > 0 ? Math.min(100, traffic.percent || 0) : 0;
  return `
    <div class="source-row">
      ${sourceAvatar(source.name)}
      <div class="source-main">
        <div class="source-name-line">
          <strong>${esc(source.name)}</strong>
          ${statusPill(source)}
          ${source.kind === 'text' ? '<span class="badge badge-violet no-dot">手动</span>' : ''}
          ${source.kind !== 'text' && source.autoRefresh === false ? '<span class="badge badge-amber no-dot">仅手动刷新</span>' : ''}
        </div>
        <div class="source-url">${esc(prettyUrl(source.url))}</div>
        <div class="source-meta-line">${meta.map((m) => `<span>${esc(m)}</span>`).join('<span class="sep"></span>')}</div>
        ${traffic.total > 0 ? `
          <div class="source-traffic">
            <div class="mini-track ${traffic.percent >= 95 ? 'is-danger' : traffic.percent >= 80 ? 'is-warn' : ''}"><i style="width:${pct}%"></i></div>
            <span class="tiny num">${esc(traffic.usedLabel)} / ${esc(traffic.totalLabel)}</span>
          </div>` : ''}
      </div>
      <div class="source-actions">
        <button class="icon-btn" data-action="refresh-source" data-id="${esc(source.id)}" title="立即刷新" ${source.status === 'refreshing' ? 'disabled' : ''}>${ico('refresh')}</button>
        <a class="icon-btn" href="#/sources" title="查看订阅源">${ico('chevronRight')}</a>
      </div>
    </div>`;
}

function overviewEmptySources() {
  return `
    <div class="empty">
      <div class="empty-art">${ico('rss')}</div>
      <h3>还没有订阅源</h3>
      <p>添加机场订阅链接或直接粘贴节点内容。SubFlux 会自动识别 Clash YAML、Base64 与常见节点协议。</p>
      <button class="btn btn-primary btn-sm" data-action="add-source">${ico('plus')}<span>添加第一个订阅</span></button>
    </div>`;
}

function renderQualityCard() {
  const n = App.state.stats.nodes;
  const segments = [
    ['家宽', n.home, 'var(--mint)'],
    ['机房', n.dc, 'var(--orange)'],
    ['CDN', n.cdn, 'var(--cyan)'],
    ['移动', n.mobile, 'var(--blue)'],
    ['企业', n.business, 'var(--violet)'],
    ['未知', n.unknown, 'rgba(150,166,188,.45)'],
  ].filter((seg) => seg[1] > 0);
  const total = segments.reduce((sum, seg) => sum + seg[1], 0);
  const sites = (App.state.stats.sites || []).filter((s) => s.enabled);
  let acc = 0;
  const gradient = total
    ? `conic-gradient(${segments.map(([label, count, color]) => {
      const start = acc;
      acc += (count / total) * 100;
      return `${color} ${start.toFixed(2)}% ${acc.toFixed(2)}%`;
    }).join(', ')})`
    : 'conic-gradient(rgba(255,255,255,.08) 0 100%)';
  return `
    <div class="card card-pad">
      <div class="section-head" style="margin-bottom:14px">
        <div><h2>节点画像</h2><div class="section-sub">入口 IP 的 ASN 类型分布</div></div>
        <a class="link" href="#/nodes">节点池 ${ico('arrowRight')}</a>
      </div>
      <div class="donut-wrap">
        <div class="donut" style="--segments:${gradient}">
          <div class="donut-center"><strong>${fmtNum(n.usable)}</strong><span>USABLE</span></div>
        </div>
        <div class="legend">
          ${segments.length ? segments.map(([label, count, color]) => `
            <div class="legend-row"><i class="legend-dot" style="--c:${color}"></i><span>${label}</span><b>${count}</b></div>
          `).join('') : '<div class="dim tiny">暂无节点画像</div>'}
        </div>
      </div>
      ${sites.length ? `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
        <div class="tiny dim" style="margin-bottom:6px">站点解锁支持（已检测节点）</div>
        <div class="site-tags">${sites.map((s) => `<span class="site-tag ${s.ok ? 'ok' : s.tested ? 'fail' : 'untested'}" title="${esc(s.name)}：${s.tested ? `${s.ok} 个支持` : '尚未检测'}">${esc(s.short)} ${s.ok}</span>`).join('')}</div>
      </div>` : ''}
    </div>`;
}

function renderRegionCard() {
  const regions = App.state.stats.regions.slice(0, 6);
  const max = regions[0]?.count || 1;
  return `
    <div class="card card-pad">
      <div class="section-head" style="margin-bottom:13px">
        <div><h2>地区分布</h2><div class="section-sub">可用节点按国家 / 地区</div></div>
      </div>
      ${regions.length ? `<div class="region-bars">${regions.map((r) => `
        <div class="region-bar">
          <span class="flag">${esc(r.flag || '🌐')}</span>
          <span class="name">${esc(r.region)}</span>
          <span class="bar"><i style="width:${Math.max(8, Math.round((r.count / max) * 100))}%"></i></span>
          <b>${r.count}</b>
        </div>
      `).join('')}</div>` : '<div class="empty" style="padding:18px 8px"><p>节点完成 IP 画像后，这里会出现地区分布。</p></div>'}
    </div>`;
}

function renderTimelineCard() {
  const events = App.state.events.slice(0, 6);
  return `
    <div class="card">
      <div class="card-head">
        <div><h2>最近动态</h2><div class="section-sub">刷新、解析与系统事件</div></div>
        <span class="badge badge-muted no-dot">${events.length} 条</span>
      </div>
      <div class="card-body" style="padding-top:8px">
        ${events.length ? `<div class="timeline">${events.map((e) => `
          <div class="timeline-item">
            <span class="timeline-dot ${esc(e.level)}"></span>
            <div class="timeline-main">
              <div class="timeline-msg">${esc(e.message)}</div>
              <div class="timeline-time">${relTime(e.at)} · ${fmtTime(e.at)}</div>
            </div>
          </div>
        `).join('')}</div>` : '<div class="empty" style="padding:24px 8px"><p>还没有事件记录。</p></div>'}
      </div>
    </div>`;
}

function renderQuickStart() {
  return `
    <div class="card">
      <div class="card-head"><div><h2>三步开始</h2><div class="section-sub">先有源，再筛节点，最后输出</div></div></div>
      <div class="card-body">
        <div class="steps">
          <div class="step"><span class="step-num">01</span><div><h4>添加订阅源</h4><p>支持 Clash / Mihomo YAML、Base64 与节点链接，多个源可以分别定时刷新。</p></div></div>
          <div class="step"><span class="step-num">02</span><div><h4>握手与画像</h4><p>让 Mihomo 真正建立一次代理连接测出延迟，并按 ASN 识别家宽、机房、CDN、移动网络，生成质量分。</p></div></div>
          <div class="step"><span class="step-num">03</span><div><h4>生成输出订阅</h4><p>筛选协议、地区、质量，选择客户端格式，自动生成自动选择 + 手动选择分组。</p></div></div>
        </div>
        <div class="divider"></div>
        <button class="btn btn-primary btn-block" data-action="add-source">${ico('plus')}<span>添加订阅源</span></button>
      </div>
    </div>`;
}

function renderQuickOutputs() {
  const profiles = App.state.profiles;
  const first = profiles[0];
  return `
    <div class="card">
      <div class="card-head">
        <div><h2>输出订阅</h2><div class="section-sub">每个输出都有独立链接和筛选条件</div></div>
        <a class="link" href="#/profiles">全部 ${ico('arrowRight')}</a>
      </div>
      <div class="card-body">
        ${first ? `
          <div style="display:flex;align-items:center;gap:11px;margin-bottom:13px">
            <div class="format-icon ${formatMeta(first.format).cls}">${formatMeta(first.format).short}</div>
            <div class="grow">
              <div style="font-size:12.5px;font-weight:560">${esc(first.name)}</div>
              <div class="tiny dim">${fmtNum(first.summary.emitted)} 个节点 · 自动识别客户端</div>
            </div>
            <button class="btn btn-ghost btn-sm" data-action="copy-profile-link" data-id="${esc(first.id)}">${ico('copy')}<span>复制链接</span></button>
          </div>
          <div class="profile-link-box" style="margin:0">
            <code>${esc(subUrl(first))}</code>
            <button class="icon-btn" data-action="copy-profile-link" data-id="${esc(first.id)}" title="复制">${ico('copy')}</button>
          </div>
          <div class="divider"></div>
          <div class="quick-actions">
            <button class="btn btn-ghost btn-sm" data-action="preview-profile" data-id="${esc(first.id)}">${ico('eye')}<span>预览配置</span></button>
            <a class="btn btn-ghost btn-sm" href="#/profiles">${ico('layers')}<span>管理输出</span></a>
          </div>` : `
          <div class="empty" style="padding:22px 8px">
            <div class="empty-art">${ico('layers')}</div>
            <h3>还没有输出订阅</h3>
            <p>创建一个筛选规则，就能得到专属的订阅链接。</p>
            <a class="btn btn-primary btn-sm" href="#/profiles">${ico('plus')}<span>创建输出订阅</span></a>
          </div>`}
      </div>
    </div>`;
}

/* ------------------------- sources ------------------------- */

function renderSources() {
  const state = App.state;
  const sources = state.sources;
  const s = state.stats.sources;
  const query = App.sourceQuery.trim().toLowerCase();
  const filtered = query
    ? sources.filter((src) => `${src.name} ${src.url}`.toLowerCase().includes(query))
    : sources;
  return `
    <section class="view">
      ${pageHead('SOURCES', '订阅源', '每个订阅独立设置刷新周期、请求身份与启用状态。HTTP 响应会被自动识别为 Clash YAML、Base64 或节点链接列表。', `
        <button class="btn btn-ghost" data-action="export-sources">${ico('download')}<span>导出</span></button>
        <button class="btn btn-ghost" data-action="import-sources">${ico('upload')}<span>导入</span></button>
        <button class="btn btn-ghost" data-action="refresh-all">${ico('refresh')}<span>刷新全部</span></button>
        <button class="btn btn-primary" data-action="add-source">${ico('plus')}<span>添加订阅</span></button>
      `)}
      <div class="toolbar">
        <div class="count-chip">${ico('rss')} 共 <b>${s.total}</b> 个源</div>
        <div class="count-chip">正常 <b style="color:var(--mint)">${s.ok}</b></div>
        <div class="count-chip">异常 <b style="color:${s.error ? 'var(--red)' : 'var(--text-soft)'}">${s.error}</b></div>
        <div class="count-chip">流量耗尽 <b style="color:${s.depleted ? 'var(--amber)' : 'var(--text-soft)'}">${s.depleted}</b></div>
        <div class="search-wrap" style="margin-left:auto;min-width:200px;max-width:300px">
          ${ico('search')}
          <input class="input" id="source-search" placeholder="搜索名称或域名…" value="${esc(App.sourceQuery)}">
        </div>
      </div>
      ${filtered.length ? `<div class="source-grid">${filtered.map(sourceCard).join('')}</div>` : sources.length ? `
        <div class="card"><div class="empty"><div class="empty-art">${ico('search')}</div><h3>没有匹配的订阅源</h3><p>换一个关键词试试。</p><button class="btn btn-ghost btn-sm" data-action="clear-source-search">清空搜索</button></div></div>
      ` : `
        <div class="card"><div class="empty" style="padding:70px 24px">
          <div class="empty-art">${ico('rss')}</div>
          <h3>订阅池还是空的</h3>
          <p>支持订阅链接、Clash 配置文本或 Base64。添加后会自动抓取并解析节点，之后按周期刷新。</p>
          <button class="btn btn-primary" data-action="add-source">${ico('plus')}<span>添加订阅源</span></button>
        </div></div>
      `}
      <div style="margin-top:16px">${alertBox('info', '订阅地址通常包含个人令牌。SubFlux 会隐藏 URL 的查询参数显示，但数据仍保存在本机 <span class="code-inline">data/db.json</span> 中；请勿把面板直接暴露到公网。')}</div>
    </section>`;
}

function sourceCard(source) {
  const traffic = source.traffic || {};
  const pct = traffic.total > 0 ? Math.min(100, traffic.percent || 0) : 0;
  const trackClass = traffic.percent >= 95 ? 'is-danger' : traffic.percent >= 80 ? 'is-warn' : '';
  const statusClass = source.status === 'refreshing' ? 'is-loading' : '';
  const manualOnly = source.autoRefresh === false;
  const next = source.nextRefreshAt
    ? relTime(source.nextRefreshAt)
    : source.kind === 'text'
      ? '静态内容'
      : manualOnly
        ? '仅手动'
        : '未安排';
  return `
    <article class="card source-card">
      <div class="source-card-head">
        ${sourceAvatar(source.name)}
        <div class="source-card-title">
          <strong>${esc(source.name)}</strong>
          <div class="url" title="${esc(prettyUrl(source.url))}">${esc(prettyUrl(source.url))}</div>
          <div class="source-badge-stack">
            ${statusPill(source)}
            <span class="badge badge-muted no-dot">${source.kind === 'text' ? '手动导入' : (source.format ? esc(source.format) : '待解析')}</span>
            ${manualOnly && source.kind !== 'text' ? '<span class="badge badge-amber">仅手动刷新</span>' : ''}
            ${source.proxyMode === 'pool' ? '<span class="badge badge-blue">代理拉取 · 节点池</span>' : (source.proxyMode === 'custom' || source.useProxy) ? '<span class="badge badge-blue">代理拉取 · 外部</span>' : ''}
          </div>
        </div>
        <div class="source-actions">
          <button class="icon-btn" data-action="refresh-source" data-id="${esc(source.id)}" title="立即刷新" ${source.status === 'refreshing' ? 'disabled' : ''}>${ico('refresh')}</button>
          ${source.kind === 'url' ? `<button class="icon-btn" data-action="preview-source" data-id="${esc(source.id)}" title="抓取预览">${ico('eye')}</button>` : ''}
          <button class="icon-btn" data-action="edit-source" data-id="${esc(source.id)}" title="编辑">${ico('edit')}</button>
          <button class="icon-btn is-danger" data-action="delete-source" data-id="${esc(source.id)}" title="删除">${ico('trash')}</button>
        </div>
      </div>
      <div class="source-card-body">
        <div class="source-stat-grid">
          <div class="source-stat"><span>节点</span><b>${fmtNum(source.nodeCount)}</b></div>
          <div class="source-stat"><span>周期</span><b>${source.kind === 'text' || manualOnly ? '手动' : `${source.intervalMinutes} 分`}</b></div>
          <div class="source-stat"><span>下次</span><b>${esc(next)}</b></div>
        </div>
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
            <span class="tiny dim">流量</span>
            <span class="tiny num" style="color:var(--muted)">${traffic.total > 0 ? `${esc(traffic.usedLabel)} / ${esc(traffic.totalLabel)}` : '未提供流量信息'}</span>
          </div>
          <div class="mini-track ${trackClass}" style="${traffic.total > 0 ? '' : 'opacity:.35'}"><i style="width:${traffic.total > 0 ? pct : 0}%"></i></div>
          ${traffic.total > 0 ? `
            <div class="source-meta-line">
              <span>剩余 ${esc(traffic.remainLabel)}</span>
              ${traffic.expireAt ? `<span class="sep"></span><span>${traffic.expired ? '已过期' : `${fmtTime(traffic.expireAt)} 到期`}</span>` : ''}
            </div>` : ''}
        </div>
        ${source.error ? `<div class="source-card-error">${ico('alert')} ${esc(source.error)}</div>` : ''}
        ${source.blockedReason && source.status !== 'error' ? `<div class="source-card-warning">${ico('alert')} ${esc(source.blockedReason)}，该源节点已从输出订阅排除。</div>` : ''}
        ${!source.error && source.warnings?.length ? `<div class="source-card-warning">${ico('info')} ${esc(source.warnings.slice(0, 2).join('；'))}</div>` : ''}
      </div>
      <div class="source-card-foot">
        <span class="time">上次 ${source.lastRefreshAt ? `${relTime(source.lastRefreshAt)} · ${fmtTime(source.lastRefreshAt)}` : '从未刷新'}</span>
        <div style="display:flex;gap:5px">
          <button class="btn btn-ghost btn-sm" data-action="refresh-source" data-id="${esc(source.id)}" ${source.status === 'refreshing' ? 'disabled' : ''}>${ico('refresh')}<span>刷新</span></button>
          <button class="btn btn-ghost btn-sm" data-action="edit-source" data-id="${esc(source.id)}">${ico('edit')}<span>编辑</span></button>
        </div>
      </div>
    </article>`;
}

function openSourceModal(source = null) {
  const isEdit = Boolean(source);
  const kind = source?.kind || 'url';
  const interval = source?.intervalMinutes || App.state.settings.defaultInterval || 360;
  const autoRefresh = source ? source.autoRefresh !== false : true;
  const proxyMode = source?.proxyMode || (source?.useProxy ? 'custom' : 'direct');
  const quick = [30, 60, 180, 360, 720, 1440, 10080, 20160, 43200];
  const content = `
    <form id="source-form" autocomplete="off">
      <div class="field">
        <label for="source-name">订阅名称</label>
        <input class="input" id="source-name" name="name" maxlength="40" required placeholder="例如：机场 A / 主力订阅" value="${esc(source?.name || '')}">
      </div>
      ${isEdit ? `
        <div class="field">
          <span class="field-label">来源类型</span>
          <div><span class="badge ${kind === 'text' ? 'badge-violet' : 'badge-cyan'} no-dot">${kind === 'text' ? '手动粘贴内容' : '远程订阅链接'}</span></div>
        </div>
      ` : `
        <div class="field">
          <span class="field-label">来源类型</span>
          <div class="segmented" id="source-kind-tabs">
            <button type="button" data-source-kind="url" class="${kind === 'url' ? 'active' : ''}">订阅链接</button>
            <button type="button" data-source-kind="text" class="${kind === 'text' ? 'active' : ''}">粘贴内容</button>
          </div>
        </div>
      `}
      <div class="field" id="source-url-field" ${kind === 'text' ? 'style="display:none"' : ''}>
        <label for="source-url">订阅链接</label>
        <input class="input" id="source-url" name="url" type="url" placeholder="https://example.com/api/v1/client/subscribe?token=..." value="${esc(source?.url || '')}">
        <div class="field-hint">会自动跟随跳转，忽略 URL 中的 # 片段；令牌不会显示在界面上。</div>
      </div>
      <div class="field" id="source-text-field" ${kind === 'url' ? 'style="display:none"' : ''}>
        <label for="source-content">节点内容</label>
        <textarea class="textarea" id="source-content" name="content" placeholder="粘贴 Clash YAML、Base64 编码的订阅，或一行一个 ss:// / vmess:// / vless:// / trojan:// 链接…">${esc(source?.content || '')}</textarea>
        <div class="field-hint">手动内容不会被定时刷新，但可以随时保存后重新解析。</div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label for="source-interval">刷新间隔（分钟）</label>
          <input class="input" id="source-interval" name="intervalMinutes" type="number" min="5" max="5256000" step="5" value="${esc(interval)}" ${autoRefresh ? '' : 'disabled'}>
          <div class="quick-values">
            ${quick.map((m) => `<button type="button" data-interval-value="${m}">${m < 60 ? `${m} 分` : m < 1440 ? `${m / 60} 小时` : `${m / 1440} 天`}</button>`).join('')}
          </div>
          <div class="field-hint" id="source-manual-hint" ${autoRefresh ? 'style="display:none"' : ''}>已关闭自动刷新，只在你点「刷新」时抓取；间隔设置暂不生效。</div>
        </div>
        <div class="field">
          <label>启用状态</label>
          <div class="field-row" style="padding-top:4px">
            <div class="field-hint">停用后保留节点，但从输出订阅排除</div>
            <label class="switch"><input type="checkbox" name="enabled" ${source?.enabled === false ? '' : 'checked'}><span class="track"></span></label>
          </div>
        </div>
      </div>
      ${kind === 'text' ? '' : `
      <div class="field-row card card-pad" id="source-auto-row" style="padding:11px 13px">
        <div>
          <div class="field-label">自动刷新</div>
          <div class="field-hint">关闭后不会按周期抓取，只能手动刷新（仍会在添加时抓取一次）</div>
        </div>
        <label class="switch"><input type="checkbox" name="autoRefresh" ${autoRefresh ? 'checked' : ''}><span class="track"></span></label>
      </div>`}
      <div class="field" id="source-proxy-section" ${kind === 'text' ? 'style="display:none"' : ''}>
        <label for="source-proxy-mode">拉取方式</label>
        <select class="input" id="source-proxy-mode" name="proxyMode">
          <option value="direct" ${proxyMode === 'direct' ? 'selected' : ''}>直连（服务器直接请求订阅站）</option>
          <option value="pool" ${proxyMode === 'pool' ? 'selected' : ''}>使用节点池中的节点</option>
          <option value="custom" ${proxyMode === 'custom' ? 'selected' : ''}>外部代理地址</option>
        </select>
        <div class="field-hint">订阅站被墙、限制 IP 或需要固定出口时，可让抓取请求走已有节点或本地代理。</div>
      </div>
      <div class="field" id="source-proxy-pool-row" style="display:none">
        <label for="source-proxy-node">拉取出口节点</label>
        <div class="form-grid">
          <input class="input" id="source-proxy-search" placeholder="搜索节点名 / 地区">
          <select class="input" id="source-proxy-node" name="proxyNodeId"></select>
        </div>
        <div class="field-hint" id="source-proxy-node-hint">按质量排序显示前 200 个节点，输入关键词可搜索全部。</div>
      </div>
      <div class="field" id="source-proxy-custom-row" style="display:none">
        <label for="source-proxy-url">代理地址</label>
        <input class="input" id="source-proxy-url" name="proxyUrl" value="${esc(source?.proxyUrl || '')}" placeholder="${esc(App.state.settings.fetchProxy || 'http://127.0.0.1:7890 或 socks5://127.0.0.1:1080')}">
        <div class="field-hint">支持 http / https / socks5；留空则使用全局「订阅拉取代理」${App.state.settings.fetchProxy ? `：${esc(App.state.settings.fetchProxy)}` : '（尚未配置）'}。</div>
      </div>
      <details class="advanced">
        <summary>高级选项</summary>
        <div class="form-stack">
          <div class="field">
            <label for="source-ua">自定义 User-Agent</label>
            <input class="input" id="source-ua" name="userAgent" maxlength="200" placeholder="留空使用全局默认：${esc(App.state.settings.userAgent)}" value="${esc(source?.userAgent || '')}">
            <div class="field-hint">部分服务商根据 UA 返回 Clash、Sing-box 或 Base64 格式。</div>
          </div>
          <div class="field">
            <div class="field-hint">单源节点上限由「设置 → 单源节点上限」控制，当前为 ${App.state.settings.maxNodesPerSource} 个。</div>
          </div>
        </div>
      </details>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>取消</button>
        <button type="submit" class="btn btn-primary" id="source-submit">${isEdit ? '保存修改' : '添加并抓取'}</button>
      </div>
      ${isEdit && kind === 'url' ? `<div class="modal-footer-note" style="text-align:right">修改链接后会在后台重新抓取；旧节点会保留到新内容解析成功。</div>` : ''}
    </form>`;
  openModal({
    title: isEdit ? '编辑订阅源' : '添加订阅源',
    subtitle: isEdit ? '调整抓取周期或请求身份' : '支持订阅链接、Clash 配置文本与 Base64',
    content,
    size: 'lg',
  });
  const form = $('#source-form');
  const tabs = $('#source-kind-tabs');
  const urlField = $('#source-url-field');
  const textField = $('#source-text-field');
  let selectedKind = kind;
  let syncAutoRefresh = () => {};
  const setKind = (next) => {
    selectedKind = next;
    tabs?.querySelectorAll('[data-source-kind]').forEach((b) => b.classList.toggle('active', b.dataset.sourceKind === next));
    if (urlField) urlField.style.display = next === 'url' ? '' : 'none';
    if (textField) textField.style.display = next === 'text' ? '' : 'none';
    const autoRow = document.getElementById('source-auto-row');
    if (autoRow) autoRow.style.display = next === 'url' ? '' : 'none';
    const proxySection = document.getElementById('source-proxy-section');
    if (proxySection) proxySection.style.display = next === 'url' ? '' : 'none';
    const urlInput = $('#source-url');
    const textInput = $('#source-content');
    if (urlInput) urlInput.required = next === 'url';
    if (textInput) textInput.required = next === 'text';
    syncAutoRefresh();
  };
  setKind(kind);
  tabs?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-source-kind]');
    if (btn) setKind(btn.dataset.sourceKind);
  });
  document.querySelectorAll('[data-interval-value]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = $('#source-interval');
      if (input) input.value = btn.dataset.intervalValue;
    });
  });
  const autoToggle = form.querySelector('input[name="autoRefresh"]');
  syncAutoRefresh = () => {
    const manual = selectedKind === 'text' || !(autoToggle ? autoToggle.checked : true);
    const input = $('#source-interval');
    if (input) input.disabled = manual;
    const hint = $('#source-manual-hint');
    if (hint) hint.style.display = manual ? '' : 'none';
  };
  autoToggle?.addEventListener('change', syncAutoRefresh);
  syncAutoRefresh();
  const proxyModeSel = $('#source-proxy-mode');
  const proxyPoolRow = $('#source-proxy-pool-row');
  const proxyCustomRow = $('#source-proxy-custom-row');
  const proxyNodeSel = $('#source-proxy-node');
  const proxySearch = $('#source-proxy-search');
  let proxyNodes = [];
  const renderProxyNodes = (keyword = '') => {
    if (!proxyNodeSel) return;
    const kw = keyword.trim().toLowerCase();
    const list = kw
      ? proxyNodes.filter((n) => `${n.name} ${n.region || ''} ${n.isp || ''}`.toLowerCase().includes(kw))
      : proxyNodes;
    const current = proxyNodeSel.value || source?.proxyNodeId || '';
    proxyNodeSel.innerHTML = list.length
      ? list.map((n) => `<option value="${esc(n.id)}" ${n.id === current ? 'selected' : ''}>${esc(n.name)}${n.region ? ` · ${esc(n.region)}` : ''}</option>`).join('')
      : '<option value="">没有匹配的节点</option>';
  };
  const loadProxyNodes = async (keyword = '') => {
    if (!proxyNodeSel) return;
    try {
      const params = new URLSearchParams({ pageSize: '200', status: 'all', sort: 'quality' });
      if (keyword.trim()) params.set('q', keyword.trim());
      const data = await api(`/api/nodes?${params.toString()}`);
      proxyNodes = data.items || [];
      renderProxyNodes('');
    } catch {
      proxyNodeSel.innerHTML = '<option value="">节点加载失败</option>';
    }
  };
  const syncProxyMode = () => {
    const mode = proxyModeSel?.value || 'direct';
    if (proxyPoolRow) proxyPoolRow.style.display = mode === 'pool' ? '' : 'none';
    if (proxyCustomRow) proxyCustomRow.style.display = mode === 'custom' ? '' : 'none';
    if (mode === 'pool' && !proxyNodes.length) loadProxyNodes('');
  };
  proxyModeSel?.addEventListener('change', syncProxyMode);
  proxySearch?.addEventListener('input', debounce((event) => {
    const keyword = String(event.target.value || '').trim();
    if (keyword.length >= 2) loadProxyNodes(keyword);
    else renderProxyNodes(keyword);
  }, 320));
  syncProxyMode();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = $('#source-submit');
    const fd = new FormData(form);
    const autoOn = fd.get('autoRefresh') === 'on';
    const intervalValue = Number($('#source-interval')?.value) || interval;
    const payload = {
      name: String(fd.get('name') || '').trim(),
      kind: selectedKind,
      intervalMinutes: intervalValue,
      autoRefresh: selectedKind === 'text' ? true : autoOn,
      userAgent: String(fd.get('userAgent') || ''),
      proxyMode: selectedKind === 'url' ? (proxyModeSel?.value || 'direct') : 'direct',
      proxyNodeId: selectedKind === 'url' && proxyModeSel?.value === 'pool' ? String(fd.get('proxyNodeId') || '') : '',
      proxyUrl: selectedKind === 'url' && proxyModeSel?.value === 'custom' ? String(fd.get('proxyUrl') || '').trim() : '',
      enabled: fd.get('enabled') === 'on',
    };
    if (selectedKind === 'url') payload.url = String(fd.get('url') || '').trim();
    else payload.content = String(fd.get('content') || '').trim();
    if (!payload.name) return toast('请填写订阅名称', 'warn');
    if (selectedKind === 'url' && !/^https?:\/\//i.test(payload.url)) return toast('请输入有效的 http(s) 订阅链接', 'warn');
    if (selectedKind === 'text' && !payload.content) return toast('请粘贴节点内容', 'warn');
    if (payload.proxyMode === 'pool' && !payload.proxyNodeId) return toast('请选择一个节点作为拉取出口', 'warn');
    if (payload.proxyMode === 'custom' && !payload.proxyUrl && !App.state.settings.fetchProxy) return toast('请填写外部代理地址', 'warn');
    setBusy(submit, true);
    try {
      const data = await api(isEdit ? `/api/sources/${encodeURIComponent(source.id)}` : '/api/sources', {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      closeModal();
      await refreshState(false);
      if (data.source?.status === 'error') toast(`订阅已保存，但解析失败：${data.source.error}`, 'warn', 7000);
      else toast(isEdit ? '订阅源已更新' : '订阅源已添加', 'success');
      if (App.view !== 'sources') navigate('sources');
      else render();
    } catch (err) {
      toast(err.message, 'error', 6500);
    } finally {
      setBusy(submit, false);
    }
  });
}

async function openSourcePreview(id) {
  const source = App.state.sources.find((s) => s.id === id);
  if (!source) return;
  openModal({
    title: `抓取预览 · ${source.name}`,
    subtitle: '不会写入节点池，只检查当前订阅响应',
    size: 'lg',
    content: `<div class="loading-panel"><div class="spinner"></div><span>正在请求订阅地址…</span></div>`,
  });
  try {
    const data = await api(`/api/sources/${encodeURIComponent(id)}/preview`);
    const body = $('#modal-root .modal-body');
    if (!body) return;
    body.innerHTML = `
      <div class="form-stack">
        ${data.warnings?.length ? data.warnings.map((w) => alertBox('warn', esc(w))).join('') : ''}
        <div class="grid-3">
          <div class="source-stat"><span>识别格式</span><b>${esc(data.format)}</b></div>
          <div class="source-stat"><span>解析节点</span><b>${fmtNum(data.count)}</b></div>
          <div class="source-stat"><span>订阅流量</span><b>${data.traffic?.total > 0 ? `${esc(data.traffic.usedLabel)} / ${esc(data.traffic.totalLabel)}` : '未上报'}</b></div>
        </div>
        ${data.sample?.length ? `
          <div class="card" style="box-shadow:none;overflow:hidden">
            <div class="table-wrap">
              <table class="table" style="min-width:520px">
                <thead><tr><th>名称</th><th>协议</th><th>地址</th></tr></thead>
                <tbody>${data.sample.map((n) => `<tr><td>${esc(n.name)}</td><td><span class="proto-badge">${esc(n.protocol)}</span></td><td class="addr">${esc(n.server)}:${esc(n.port)}</td></tr>`).join('')}</tbody>
              </table>
            </div>
          </div>` : alertBox('warn', '没有解析到节点。请检查链接是否失效，或服务商是否要求特定 User-Agent。')}
        <div class="modal-actions"><button class="btn btn-ghost" data-close-modal>关闭</button><button class="btn btn-soft" data-close-modal>知道了</button></div>
      </div>`;
    body.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', () => closeModal()));
  } catch (err) {
    const body = $('#modal-root .modal-body');
    if (body) {
      body.innerHTML = `<div class="empty"><div class="empty-art">${ico('alert')}</div><h3>抓取失败</h3><p>${esc(err.message)}</p><button class="btn btn-ghost" data-close-modal>关闭</button></div>`;
      body.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', () => closeModal()));
    }
  }
}

/* ------------------------- nodes ------------------------- */

function renderNodes() {
  const state = App.state;
  if (!App.nodeData) {
    return `
      <section class="view">
        ${pageHead('NODE POOL', '节点池', '所有订阅解析后的节点统一在这里测速、画像与筛选。')}
        <div class="card"><div class="loading-panel"><div class="spinner"></div><span>正在读取节点池…</span></div></div>
      </section>`;
  }
  const data = App.nodeData;
  const filters = App.nodeFilters;
  const totalAll = state.stats.nodes.total;
  const selectedCount = App.selected.size;
  const engineReady = Boolean(state.meta.siteEngine);
  const enginePath = state.meta.engine?.path || state.meta.siteEnginePath || '';
  return `
    <section class="view">
      ${pageHead('NODE POOL', '节点池', '全部节点由 Mihomo 真实建立一次代理连接来判断可达与延迟，HTTP / HTTPS / SOCKS5 与 HY2 / TUIC / WireGuard 等 UDP 协议一视同仁。IP 类型与入口质量分来自入口 IP 的 ASN 画像。', `
        <button class="btn btn-ghost" data-action="test-selected" ${selectedCount ? '' : 'disabled'}>${ico('play')}<span>测试选中${selectedCount ? ` (${selectedCount})` : ''}</span></button>
        <button class="btn btn-ghost" data-action="test-sites" ${(selectedCount || totalAll) ? '' : 'disabled'} title="${engineReady ? `通过节点真实访问网站，引擎：${enginePath}` : `站点检测引擎不可执行：${enginePath || '未配置'}`}">${ico('globe')}<span>站点检测${selectedCount ? ` (${selectedCount})` : ''}</span>${engineReady ? '' : ' · 引擎缺失'}</button>
        <button class="btn btn-ghost" data-action="test-china" ${(selectedCount || totalAll) && state.meta.chinaProbeConfigured ? '' : 'disabled'} title="${state.meta.chinaProbeConfigured ? '通过中国探针实际代理访问（支持 HY2/TUIC 等 UDP）' : '请先在设置中配置中国探针'}">${ico('server')}<span>CN 实际${selectedCount ? ` (${selectedCount})` : ''}</span></button>
        <button class="btn btn-primary" data-action="test-filter" ${totalAll ? '' : 'disabled'}>${ico('zap')}<span>握手测试当前筛选</span></button>
      `)}
      <div id="job-slot">${jobBanner()}</div>
      ${renderNodeFilters()}
      <div class="card" style="overflow:hidden">
        <div class="table-toolbar">
          <div class="left">
            <span class="small" style="color:var(--text-soft);font-weight:550">共 ${fmtNum(data.total)} 个节点</span>
            ${selectedCount ? `<span class="selection-note">已选 ${selectedCount} 个</span>` : ''}
            ${data.total ? `<span class="tiny dim">第 ${data.page} / ${data.pages} 页</span>` : ''}
          </div>
          <div class="right">
            ${selectedCount ? `<button class="link" data-action="clear-selection" style="font-size:10.5px">清空选择</button>` : ''}
            <button class="btn btn-ghost btn-sm" data-action="test-filter" ${data.total ? '' : 'disabled'}>${ico('activity')}<span>测试筛选结果</span></button>
          </div>
        </div>
        ${data.items.length ? nodeTable(data) : nodeEmptyState()}
        ${data.total ? nodePagination(data) : ''}
      </div>
      <div style="margin-top:16px">${alertBox('info', '入口质量分是启发式参考：家宽 / 移动 / 企业 / 机房由 ASN 与 hosting/mobile 标记推断，CDN 节点看到的是 CDN 入口而非落地 IP。站点标记则是通过节点真实代理访问网站后的结果，更接近实际可用性。')}</div>
    </section>`;
}

function jobBanner() {
  const siteJob = App.state?.siteJob;
  const chinaJob = App.state?.chinaJob;
  const testJob = App.state?.job;
  const job = siteJob?.running ? siteJob : chinaJob?.running ? chinaJob : testJob?.running ? testJob : null;
  if (!job) return '';
  const total = Math.max(1, job.total || 0);
  const pct = Math.min(100, Math.round(((job.done || 0) / total) * 100));
  const isSite = job === siteJob;
  const isChina = job === chinaJob;
  const phase = isSite
    ? (job.phase === 'starting' ? '启动检测引擎' : '真实代理访问')
    : isChina ? (job.phase === 'proxy' ? '中国探针实际代理' : '中国探针 TCP 检测')
    : job.phase === 'connect' ? '代理握手测试' : job.phase === 'quality' ? 'IP 情报画像' : '处理中';
  return `
    <div class="job-banner" id="job-banner">
      ${ico(isSite ? 'globe' : isChina ? 'server' : 'refresh')}
      <div class="job-main">
        <strong>${esc(job.label || '节点测试')} · ${esc(phase)}</strong>
        <div class="sub">已处理 ${fmtNum(job.done)} / ${fmtNum(job.total)} 个节点${job.note ? ` · ${esc(job.note)}` : ''}</div>
      </div>
      <div class="job-progress"><i style="width:${pct}%"></i></div>
      <span class="job-pct">${pct}%</span>
    </div>`;
}

function renderNodeFilters() {
  const state = App.state;
  const f = App.nodeFilters;
  const protocols = Object.entries(state.stats.protocols).sort((a, b) => b[1] - a[1]);
  const regions = state.stats.regions.slice(0, 48);
  const types = Object.keys(IP_TYPE_META);
  const selectedProtocol = f.protocol;
  const selectedRegion = f.region;
  return `
    <div class="card filter-card">
      <div class="filters">
        <div class="filter-field filter-search">
          <span>搜索</span>
          <div class="search-wrap">${ico('search')}<input class="input" data-node-filter="q" id="node-search" placeholder="名称、地址、ISP、ASN…" value="${esc(f.q)}"></div>
        </div>
        <div class="filter-field">
          <span>协议</span>
          <select class="select" data-node-filter="protocol">
            <option value="">全部协议</option>
            ${protocols.map(([p, count]) => `<option value="${esc(p)}" ${selectedProtocol === p ? 'selected' : ''}>${esc(p.toUpperCase())} (${count})</option>`).join('')}
            ${selectedProtocol && !protocols.some(([p]) => p === selectedProtocol) ? `<option value="${esc(selectedProtocol)}" selected>${esc(selectedProtocol.toUpperCase())}</option>` : ''}
          </select>
        </div>
        <div class="filter-field">
          <span>地区</span>
          <select class="select" data-node-filter="region">
            <option value="">全部地区</option>
            ${regions.map((r) => `<option value="${esc(r.cc)}" ${selectedRegion === r.cc ? 'selected' : ''}>${esc(r.flag || '🌐')} ${esc(r.region)} (${r.count})</option>`).join('')}
            ${selectedRegion && selectedRegion !== 'unknown' && !regions.some((r) => r.cc === selectedRegion) ? `<option value="${esc(selectedRegion)}" selected>${esc(selectedRegion)}</option>` : ''}
          </select>
        </div>
        <div class="filter-field">
          <span>来源</span>
          <select class="select" data-node-filter="sourceId">
            <option value="">全部来源</option>
            ${state.sources.filter((s) => s.nodeCount > 0).map((s) => `<option value="${esc(s.id)}" ${f.sourceId === s.id ? 'selected' : ''}>${esc(s.name)}${s.traffic?.depleted ? ' · 已剔除' : ''}</option>`).join('')}
          </select>
        </div>
        <div class="filter-field">
          <span>类型</span>
          <select class="select" data-node-filter="ipType">
            <option value="">全部类型</option>
            ${types.map((t) => `<option value="${t}" ${f.ipType === t ? 'selected' : ''}>${esc(typeMeta(t).label)}</option>`).join('')}
          </select>
        </div>
        <div class="filter-field">
          <span>站点支持</span>
          <select class="select" data-node-filter="site">
            <option value="">不限</option>
            ${(state.stats.sites || []).filter((s) => s.enabled).map((s) => `<option value="${esc(s.id)}" ${f.site === s.id ? 'selected' : ''}>${esc(s.short)} · ${esc(s.name)} (${s.ok})</option>`).join('')}
          </select>
        </div>
        <div class="filter-field">
          <span>CN 连通</span>
          <select class="select" data-node-filter="china">
            <option value="">不限</option>
            <option value="reachable" ${f.china === 'reachable' ? 'selected' : ''}>CN 可达</option>
            <option value="blocked" ${f.china === 'blocked' ? 'selected' : ''}>CN 不可达 / 疑似被墙</option>
            <option value="untested" ${f.china === 'untested' ? 'selected' : ''}>未检测</option>
          </select>
        </div>
        <div class="filter-field">
          <span>最低质量</span>
          <select class="select" data-node-filter="qualityMin">
            <option value="">不限</option>
            ${[60, 70, 80, 90].map((v) => `<option value="${v}" ${f.qualityMin === String(v) ? 'selected' : ''}>≥ ${v}</option>`).join('')}
          </select>
        </div>
        <div class="filter-field">
          <span>最大延迟</span>
          <select class="select" data-node-filter="latencyMax">
            <option value="">不限</option>
            ${[100, 200, 300, 500].map((v) => `<option value="${v}" ${f.latencyMax === String(v) ? 'selected' : ''}>≤ ${v} ms</option>`).join('')}
          </select>
        </div>
        <div class="filter-field">
          <span>状态</span>
          <select class="select" data-node-filter="status">
            <option value="all" ${f.status === 'all' ? 'selected' : ''}>全部节点</option>
            <option value="usable" ${f.status === 'usable' ? 'selected' : ''}>可用节点</option>
            <option value="healthy" ${f.status === 'healthy' ? 'selected' : ''}>握手可达</option>
            <option value="untested" ${f.status === 'untested' ? 'selected' : ''}>待画像</option>
            <option value="disabled" ${f.status === 'disabled' ? 'selected' : ''}>已停用</option>
          </select>
        </div>
        <div class="filter-field">
          <span>排序</span>
          <select class="select" data-node-filter="sort">
            <option value="quality" ${f.sort === 'quality' ? 'selected' : ''}>质量优先</option>
            <option value="latency" ${f.sort === 'latency' ? 'selected' : ''}>延迟优先</option>
            <option value="name" ${f.sort === 'name' ? 'selected' : ''}>名称</option>
            <option value="updated" ${f.sort === 'updated' ? 'selected' : ''}>最近更新</option>
          </select>
        </div>
        <div class="filter-actions">
          <button class="btn btn-ghost btn-sm" data-action="reset-node-filters">${ico('rotate')}<span>重置</span></button>
        </div>
      </div>
    </div>`;
}

function nodeTable(data) {
  const allOnPageSelected = data.items.every((n) => App.selected.has(n.id));
  return `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th style="width:34px"><input class="checkbox" type="checkbox" id="select-page" ${allOnPageSelected ? 'checked' : ''} aria-label="选择本页"></th>
            <th>节点</th>
            <th>协议</th>
            <th>地址</th>
            <th>地区 / ISP</th>
            <th>类型</th>
            <th>站点解锁</th>
            <th>入口质量</th>
            <th>延迟</th>
            <th>状态</th>
            <th style="text-align:right">操作</th>
          </tr>
        </thead>
        <tbody>${data.items.map(nodeRow).join('')}</tbody>
      </table>
    </div>`;
}

function nodeRow(node) {
  const type = typeMeta(node.ipType);
  const q = node.qualityScore;
  const qc = qualityClass(q);
  const lat = latencyClass(node.latency);
  const disabled = node.disabled;
  const blocked = node.blockedReason;
  let stateHtml;
  if (disabled) stateHtml = '<span class="badge badge-muted">已停用</span>';
  else if (blocked) stateHtml = `<span class="badge badge-amber">${esc(blocked)}</span>`;
  else if (node.alive === false) stateHtml = '<span class="badge badge-red">不可达</span>';
  else if (node.alive === true) stateHtml = '<span class="badge badge-mint">可达</span>';
  else stateHtml = '<span class="badge badge-muted">待测</span>';
  return `
    <tr class="${disabled ? 'is-disabled' : ''}">
      <td><input class="checkbox" type="checkbox" data-node-select="${esc(node.id)}" ${App.selected.has(node.id) ? 'checked' : ''} aria-label="选择 ${esc(node.name)}"></td>
      <td>
        <div class="node-cell">
          <span class="node-flag">${esc(node.flag || '🌐')}</span>
          <div style="min-width:0">
            <div class="node-name" title="${esc(node.name)}">${esc(node.name)}</div>
            <div class="node-source">${esc(node.sourceName)}</div>
          </div>
        </div>
      </td>
      <td><span class="proto-badge">${esc(node.protocol)}</span></td>
      <td><span class="addr" title="${esc(node.server)}:${esc(node.port)}">${esc(node.server)}:${esc(node.port)}</span></td>
      <td><div class="region-cell"><div class="r">${esc(node.region || '未知')}${node.city ? ` · ${esc(node.city)}` : ''}</div><div class="i">${esc(node.asn || '—')}${node.isp ? ` · ${esc(node.isp)}` : ''}</div></div></td>
      <td>${typeBadge(node.ipType)}</td>
      <td>${nodeSiteBadges(node)}</td>
      <td>
        <div class="quality-line">
          <span class="quality-chip ${qc}"><span class="dot"></span>${q == null ? '—' : q}</span>
          <span class="quality-bar" style="color:${q == null ? 'var(--muted-2)' : q >= 82 ? 'var(--mint)' : q >= 68 ? '#9fe875' : q >= 52 ? 'var(--amber)' : 'var(--red)'}"><i style="width:${q == null ? 0 : q}%"></i></span>
        </div>
        <div class="tiny dim" style="margin-top:2px" title="${esc(node.qualitySignal || '')}">${esc(node.qualityLabel || '待测')}${node.qualityRisk != null && node.qualityRisk >= 25 ? ` · 风险 ${node.qualityRisk}` : ''}</div>
      </td>
      <td>
        <span class="latency ${lat}" title="${esc(node.testNote || '')}">${fmtLatency(node.latency)}</span>
        ${node.connectError ? `<div class="tiny dim" title="${esc(node.testNote || node.connectError)}">${esc(node.connectError)}</div>` : ''}
        ${node.alive && node.certTrusted === false ? `<div class="tiny cert-warn" title="${esc(node.certError || 'TLS 证书校验未通过')}">证书不受信</div>` : ''}
      </td>
      <td><div style="display:flex;flex-wrap:wrap;gap:4px">${stateHtml}${cnBadge(node)}</div></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-action="test-node" data-id="${esc(node.id)}" title="测试此节点">${ico('play')}</button>
          <button class="icon-btn ${disabled ? '' : 'is-danger'}" data-action="toggle-node" data-id="${esc(node.id)}" title="${disabled ? '启用节点' : '停用节点'}">${ico('power')}</button>
        </div>
      </td>
    </tr>`;
}

function nodeEmptyState() {
  const all = App.state.stats.nodes.total;
  if (!all) {
    return `<div class="empty" style="padding:55px 20px"><div class="empty-art">${ico('nodes')}</div><h3>节点池是空的</h3><p>先添加订阅源，SubFlux 会自动抓取并解析节点。</p><a class="btn btn-primary btn-sm" href="#/sources">${ico('rss')}<span>去添加订阅</span></a></div>`;
  }
  return `<div class="empty" style="padding:55px 20px"><div class="empty-art">${ico('filter')}</div><h3>没有匹配的节点</h3><p>当前筛选条件比较严格，试试放宽质量、延迟或地区条件。</p><button class="btn btn-ghost btn-sm" data-action="reset-node-filters">${ico('rotate')}<span>重置筛选</span></button></div>`;
}

function nodePagination(data) {
  const pages = Math.max(1, data.pages || 1);
  const page = Math.min(Math.max(1, data.page || 1), pages);
  return `
    <div class="pagination">
      <span class="page-info">显示 ${fmtNum((page - 1) * data.pageSize + 1)}–${fmtNum(Math.min(page * data.pageSize, data.total))}，共 ${fmtNum(data.total)} 个</span>
      <div class="page-btns">
        <button class="btn btn-ghost btn-sm" data-action="node-page" data-page="1" ${page <= 1 ? 'disabled' : ''} title="第一页" aria-label="第一页">${ico('pageFirst')}</button>
        <button class="btn btn-ghost btn-sm" data-action="node-page" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} title="上一页" aria-label="上一页">${ico('chevronLeft')}</button>
        <span class="page-jump">
          <input class="input page-input" id="page-jump-input" type="number" min="1" max="${pages}" value="${page}" aria-label="跳转到页码">
          <span class="page-info">/ ${pages}</span>
        </span>
        <button class="btn btn-ghost btn-sm" data-action="node-page" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''} title="下一页" aria-label="下一页">${ico('chevronRight')}</button>
        <button class="btn btn-ghost btn-sm" data-action="node-page" data-page="${pages}" ${page >= pages ? 'disabled' : ''} title="最后一页" aria-label="最后一页">${ico('pageLast')}</button>
      </div>
    </div>`;
}

async function loadNodes() {
  const seq = ++App.nodeLoadSeq;
  App.nodeLoading = true;
  try {
    const f = App.nodeFilters;
    const params = new URLSearchParams({
      page: String(App.nodePage),
      pageSize: String(App.nodePageSize),
      sort: f.sort || 'quality',
      status: f.status || 'usable',
    });
    for (const key of ['q', 'protocol', 'region', 'ipType', 'sourceId', 'site', 'china', 'qualityMin', 'latencyMax', 'alive']) {
      if (f[key]) params.set(key, f[key]);
    }
    const data = await api(`/api/nodes?${params.toString()}`);
    if (seq !== App.nodeLoadSeq) return;
    if (data.total > 0 && data.page > data.pages) {
      App.nodePage = data.pages;
      return loadNodes();
    }
    App.nodeData = data;
  } catch (err) {
    if (seq !== App.nodeLoadSeq) return;
    App.nodeData = { items: [], total: 0, page: 1, pages: 1, pageSize: App.nodePageSize, error: err.message };
    toast(err.message, 'error');
  } finally {
    if (seq === App.nodeLoadSeq) App.nodeLoading = false;
  }
}

/** 跳转节点池分页：自动夹在 1..总页数，同页不重复请求。 */
async function goNodePage(target) {
  const pages = Math.max(1, App.nodeData?.pages || 1);
  const page = Math.min(Math.max(1, Math.round(Number(target) || 1)), pages);
  if (page === App.nodePage && App.nodeData?.items?.length) {
    $('#page-jump-input')?.blur();
    return;
  }
  App.nodePage = page;
  await loadNodes();
  render();
  $('.pagination')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function nodeFilterPayload() {
  const f = App.nodeFilters;
  const out = { status: f.status || 'usable', sort: f.sort || 'quality' };
  for (const key of ['q', 'protocol', 'region', 'ipType', 'sourceId', 'site', 'china', 'qualityMin', 'latencyMax', 'alive']) {
    if (f[key]) out[key] = f[key];
  }
  return out;
}

function restoreNodeSearchFocus() {
  if (!App.focusSearch) return;
  App.focusSearch = false;
  requestAnimationFrame(() => {
    const input = $('#node-search');
    if (input) {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  });
}

async function cancelTask(kind) {
  if (!kind) return;
  try {
    await api('/api/tasks/cancel', { method: 'POST', body: JSON.stringify({ kind }) });
    toast('已请求取消任务', 'success');
    await refreshState(false);
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function doLogout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    // 忽略退出请求错误，直接回登录页。
  }
  window.location.replace('/login');
}

async function startNodeTest(options = {}) {
  try {
    const payload = {};
    if (options.ids) payload.ids = options.ids;
    else payload.filter = options.filter || nodeFilterPayload();
    if (options.qualityOnly) payload.qualityOnly = true;
    if (options.connectOnly || options.latencyOnly) payload.connectOnly = true;
    const data = await api('/api/nodes/test', { method: 'POST', body: JSON.stringify(payload) });
    toast(`测试任务已启动：${data.job.total} 个节点`, 'success');
    App.fastPoll = true;
    await refreshState(false);
    if (App.view === 'nodes' || App.view === 'tasks') {
      if (App.view === 'nodes' && !App.state.job?.running) await loadNodes();
      render();
    }
    schedulePoll(1000);
  } catch (err) {
    toast(err.message, 'error', 6000);
    if (err.data?.job) {
      await refreshState(false);
      if (App.view === 'nodes') render();
    }
  }
}

async function startSiteTest(options = {}) {
  const engine = App.state.meta.engine || {};
  if (!engine.available && !App.state.meta.siteEngine) {
    return toast(`站点检测引擎不可执行：${engine.path || '未配置'}，可在设置中指定 Mihomo 路径`, 'error', 7000);
  }
  const enabledSites = (App.state.settings.sites || []).filter((s) => s.enabled !== false);
  if (!enabledSites.length) return toast('请先在设置中启用至少一个检测站点', 'warn');
  try {
    const payload = {};
    if (options.ids) payload.ids = options.ids;
    else payload.filter = nodeFilterPayload();
    const data = await api('/api/nodes/sites', { method: 'POST', body: JSON.stringify(payload) });
    toast(`站点检测已启动：${data.nodes} 个节点 × ${data.sites.length} 个站点`, 'success', 6000);
    App.fastPoll = true;
    await refreshState(false);
    if (App.view === 'nodes') render();
    schedulePoll(1000);
  } catch (err) {
    toast(err.message, 'error', 7000);
    if (err.data?.job) {
      await refreshState(false);
      if (App.view === 'nodes') render();
    }
  }
}

async function checkChinaLink(button) {
  setBusy(button, true);
  try {
    const result = await api('/api/china/check', { method: 'POST', body: '{}' });
    const line = (title, row, extra = '') => {
      if (!row) return `<div class="field-row card card-pad" style="padding:12px 13px"><div><div class="field-label">${title}</div><div class="field-hint">${extra || '未配置'}</div></div><span class="badge badge-muted">未测试</span></div>`;
      const ok = row.ok;
      return `<div class="field-row card card-pad" style="padding:12px 13px"><div><div class="field-label">${title}</div><div class="field-hint">${extra ? esc(extra) : (row.error ? esc(row.error) : `HTTP ${row.status || 0}`)}</div></div><span class="badge ${ok ? 'badge-mint' : 'badge-red'}">${ok ? '正常' : '失败'}${row.latency ? ` · ${row.latency}ms` : ''}</span></div>`;
    };
    openModal({
      title: '双向连通测试',
      subtitle: '国外主服务 ↔ 国内探针；国内 → 国外需要配置反向测试地址',
      size: 'sm',
      content: `<div class="form-stack">
        ${line('国外主服务 → 国内探针', result.outbound)}
        ${line('国内探针 → 国外主服务', result.reverse, result.reverse ? '' : '未配置反向测试地址')}
        <div class="field-hint">测试地址：${esc(App.state.settings.chinaProbeUrl || '未配置')}</div>
        <div class="modal-actions"><button class="btn btn-primary" data-close-modal>完成</button></div>
      </div>`,
    });
  } catch (err) {
    toast(err.message, 'error', 8000);
  } finally {
    setBusy(button, false);
  }
}

async function startChinaTest(options = {}) {
  if (!App.state.meta.chinaProbeConfigured) return toast('请先在设置中配置中国探针地址', 'warn');
  try {
    const payload = {};
    if (options.ids) payload.ids = options.ids;
    else payload.filter = nodeFilterPayload();
    const data = await api('/api/nodes/china', { method: 'POST', body: JSON.stringify({ ...payload, mode: 'proxy' }) });
    toast(`中国实际连通检测已启动：${data.job.total} 个节点`, 'success');
    App.fastPoll = true;
    await refreshState(false);
    if (App.view === 'nodes') render();
    schedulePoll(1000);
  } catch (err) {
    toast(err.message, 'error', 7000);
    if (err.data?.job) {
      await refreshState(false);
      if (App.view === 'nodes') render();
    }
  }
}

/* ------------------------- profiles ------------------------- */

function renderProfiles() {
  const state = App.state;
  return `
    <section class="view">
      ${pageHead('OUTPUTS', '输出订阅', '每个输出订阅都是独立链接：可以分别筛选协议、地区、IP 类型、站点支持、质量分与延迟；默认链接会按客户端 UA 自动返回对应格式。', `
        <button class="btn btn-primary" data-action="add-profile">${ico('plus')}<span>新建输出订阅</span></button>
      `)}
      ${state.profiles.length ? `
        <div class="toolbar">
          <div class="count-chip">${ico('layers')} 共 <b>${state.profiles.length}</b> 个输出</div>
          <div class="count-chip">可用节点 <b>${fmtNum(state.stats.nodes.usable)}</b></div>
          <div class="count-chip">去重后 <b>${fmtNum(state.stats.nodes.unique)}</b></div>
          ${alertBox('info', '自动选择使用全局测试地址；每个输出可单独覆盖。手动选择组默认首选自动选择。').replace('class="alert alert-info"', 'class="alert alert-info" style="margin:0;flex:1;min-width:240px"')}
        </div>
        <div class="profile-grid">${state.profiles.map(profileCard).join('')}</div>
      ` : `
        <div class="card"><div class="empty" style="padding:72px 24px">
          <div class="empty-art">${ico('layers')}</div>
          <h3>创建你的第一份输出订阅</h3>
          <p>把节点池按协议、地区、家宽 / 机房、质量分筛选，再生成适配客户端的订阅链接。</p>
          <button class="btn btn-primary" data-action="add-profile">${ico('plus')}<span>新建输出订阅</span></button>
        </div></div>
      `}
      <div style="margin-top:16px">${alertBox('info', '默认链接 <span class="code-inline">/sub/&lt;token&gt;</span> 会根据客户端 User-Agent 自动返回 Clash / Sing-box / Base64；也可在链接后附加 <span class="code-inline">clash</span>、<span class="code-inline">singbox</span>、<span class="code-inline">base64</span>、<span class="code-inline">plain</span> 强制格式。Clash 与 Sing-box 输出包含手动选择、自动测速、故障转移、地区分组和分流规则。')}</div>
    </section>`;
}

function profileCard(profile) {
  const meta = formatMeta(profile.format);
  const tags = profileFilterTags(profile);
  const groups = profile.groups || {};
  const summary = profile.summary || {};
  const link = subUrl(profile);
  return `
    <article class="card profile-card">
      <div class="profile-head">
        <div class="format-icon ${meta.cls}">${meta.short}</div>
        <div class="profile-title">
          <strong>${esc(profile.name)}</strong>
          <div class="sub">自动识别客户端 · 回退 ${esc(meta.label)} · 更新于 ${relTime(profile.updatedAt)}</div>
          <div class="source-badge-stack">
            ${profile.needsReview ? '<span class="badge badge-amber">需复核</span>' : profile.enabled ? '<span class="badge badge-mint">已启用</span>' : '<span class="badge badge-muted">已停用</span>'}
            <span class="badge badge-muted no-dot">${Number(profile.filters.maxNodes) > 0 ? `上限 ${profile.filters.maxNodes}` : '不限数量'}</span>
            ${Number(profile.filters.maxPerRegion) > 0 ? `<span class="badge badge-muted no-dot">每国 ${profile.filters.maxPerRegion}</span>` : ''}
            ${profile.push?.enabled ? `<span class="badge badge-blue no-dot">推送 · ${pushIntervalLabel(profile.push.intervalMinutes)}</span>` : ''}
            ${profile.push?.enabled && profile.push?.lastStatus === 'error' ? '<span class="badge badge-red no-dot">推送失败</span>' : ''}
          </div>
        </div>
        <div class="profile-actions">
          <button class="icon-btn" data-action="show-qr" data-id="${esc(profile.id)}" title="二维码">${ico('qr')}</button>
          <button class="icon-btn" data-action="copy-profile-link" data-id="${esc(profile.id)}" title="复制订阅链接">${ico('copy')}</button>
          <button class="icon-btn" data-action="push-profile" data-id="${esc(profile.id)}" title="立即推送">${ico('upload')}</button>
          <button class="icon-btn" data-action="copy-profile" data-id="${esc(profile.id)}" title="复制为新的输出订阅">${ico('duplicate')}</button>
          <button class="icon-btn" data-action="edit-profile" data-id="${esc(profile.id)}" title="编辑">${ico('edit')}</button>
          <button class="icon-btn is-danger" data-action="delete-profile" data-id="${esc(profile.id)}" title="删除">${ico('trash')}</button>
        </div>
      </div>
      <div class="profile-link-box">
        <span class="badge badge-mint no-dot" title="按客户端 User-Agent 自动选择格式">AUTO</span>
        <code title="${esc(link)}">${esc(link)}</code>
        <button class="icon-btn" data-action="copy-profile-link" data-id="${esc(profile.id)}" title="复制">${ico('copy')}</button>
      </div>
      <div class="profile-body">
        ${profile.needsReview ? `<div class="alert alert-warn" style="margin:0">${ico('alert')}<div>引用的订阅源已删除，输出已被锁定为空。请点击编辑，确认筛选条件并保存以恢复。</div></div>` : ''}
        <div class="profile-stat-row">
          <div class="profile-stat"><span>输出节点</span><b>${fmtNum(summary.emitted ?? 0)}</b></div>
          <div class="profile-stat"><span>去重后</span><b>${fmtNum(summary.deduped ?? 0)}</b></div>
          <div class="profile-stat"><span>Sing-box 兼容</span><b>${fmtNum(summary.supported ?? 0)}</b></div>
        </div>
        <div>
          <div class="tiny dim" style="margin-bottom:6px">筛选条件</div>
          <div class="filter-tags">${tags.length ? tags.map((t) => `<span class="filter-tag">${t}</span>`).join('') : '<span class="filter-tag">全部可用节点</span>'}</div>
        </div>
        <div>
          <div class="tiny dim" style="margin-bottom:6px">分组策略</div>
          <div class="group-tags">
            <span class="group-tag">手动选择</span>
            ${groups.auto !== false ? '<span class="group-tag">自动测速</span>' : ''}
            ${groups.fallback !== false ? '<span class="group-tag">故障转移</span>' : ''}
            ${groups.regions !== false ? '<span class="group-tag">地区分组</span>' : ''}
            <span class="group-tag">分流规则</span>
          </div>
        </div>
      </div>
      <div class="profile-foot">
        <span class="time">${profile.testUrl ? '自定义测试地址' : '全局测试地址'} · ${profile.filters.onlyAlive ? '仅握手可达' : '包含不可达'}</span>
        <div class="profile-actions">
          <button class="btn btn-ghost btn-sm" data-action="preview-profile" data-id="${esc(profile.id)}">${ico('eye')}<span>预览</span></button>
          <button class="btn btn-ghost btn-sm" data-action="rotate-profile" data-id="${esc(profile.id)}" title="轮换订阅令牌">${ico('rotate')}</button>
        </div>
      </div>
    </article>`;
}

function profileFilterTags(profile) {
  const f = profile.filters || {};
  const tags = [];
  if (f.protocols?.length) tags.push(`协议 <em>${f.protocols.map((p) => esc(p.toUpperCase())).join(' / ')}</em>`);
  if (f.ipTypes?.length) tags.push(`类型 <em>${f.ipTypes.map((t) => esc(typeMeta(t).label)).join(' / ')}</em>`);
  if (f.regions?.length) {
    const regionMap = new Map(App.state.stats.regions.map((r) => [r.cc, r.region]));
    tags.push(`地区 <em>${f.regions.map((cc) => esc(regionMap.get(cc) || cc)).join(' / ')}</em>`);
  }
  if (Number(f.minQuality) > 0) tags.push(`质量 <em>≥ ${f.minQuality}</em>`);
  if (Number(f.maxLatency) > 0) tags.push(`延迟 <em>≤ ${f.maxLatency} ms</em>`);
  if (f.onlyAlive) tags.push('<em>仅握手可达</em>');
  if (f.sourceIds?.length) tags.push(`来源 <em>${f.sourceIds.length} 个</em>`);
  if (f.sites?.length) {
    const siteMap = new Map((App.state.settings.sites || []).map((s) => [s.id, s.short]));
    tags.push(`站点 <em>${f.sites.map((id) => esc(siteMap.get(id) || id)).join(' / ')}</em>`);
  }
  if (f.china === 'reachable') tags.push('CN 可达');
  if (f.china === 'blocked') tags.push('排除 CN 不可达');
  const routing = profile.summary?.routing;
  if (routing?.domesticDirect) tags.push(`国内直连 · ${routing.directDomainCount || 0} 域名`);
  if (routing?.smartProxy) tags.push('AI / 流媒体代理');
  if (routing?.blockAds) tags.push('广告拦截');
  if (routing?.customCount) tags.push(`分流 <em>${routing.customCount} 条</em>`);
  if (f.include) tags.push(`包含 <em>${esc(f.include)}</em>`);
  if (f.exclude) tags.push(`排除 <em>${esc(f.exclude)}</em>`);
  return tags;
}

const PUSH_TYPE_META = {
  file: { label: '本地文件' },
  http: { label: 'HTTP 上传' },
  oss: { label: '对象存储' },
};

function pushIntervalLabel(minutes) {
  const m = Number(minutes) || 1440;
  if (m % 1440 === 0) return `${m / 1440} 天`;
  if (m % 60 === 0) return `${m / 60} 小时`;
  return `${m} 分钟`;
}

function pushTargetFields(target) {
  const v = (key) => esc(target?.[key] || '');
  if (target.type === 'file') {
    return `<div class="field span-2">
      <label>保存路径</label>
      <input class="input" data-push-field="path" value="${v('path')}" placeholder="/data/sub/subflux.yaml">
      <div class="field-hint">写服务器本地文件，目录不存在会自动创建；先写临时文件再替换，避免读到半截内容。</div>
    </div>`;
  }
  if (target.type === 'http') {
    return `<div class="field span-2">
      <label>推送地址</label>
      <input class="input" data-push-field="url" value="${v('url')}" placeholder="https://example.com/upload/subflux.yaml">
    </div>
    <div class="field">
      <label>请求方法</label>
      <select class="select" data-push-field="method">
        <option value="PUT" ${(target.method || 'PUT') === 'PUT' ? 'selected' : ''}>PUT</option>
        <option value="POST" ${target.method === 'POST' ? 'selected' : ''}>POST</option>
      </select>
    </div>
    <div class="field span-2">
      <label>额外请求头</label>
      <textarea class="textarea" data-push-field="headers" rows="2" placeholder="Authorization: Bearer xxx">${esc(target.headers || '')}</textarea>
      <div class="field-hint">每行一个 Header，例如 Authorization: Bearer xxx。</div>
    </div>`;
  }
  return `<div class="field">
      <label>存储类型</label>
      <select class="select" data-push-field="provider">
        <option value="aliyun" ${(target.provider || 'aliyun') === 'aliyun' ? 'selected' : ''}>阿里云 OSS</option>
        <option value="s3" ${target.provider === 's3' ? 'selected' : ''}>S3 兼容（R2 / MinIO / AWS）</option>
      </select>
    </div>
    <div class="field">
      <label>Endpoint</label>
      <input class="input" data-push-field="endpoint" value="${v('endpoint')}" placeholder="https://oss-cn-hangzhou.aliyuncs.com">
    </div>
    <div class="field">
      <label>Bucket</label>
      <input class="input" data-push-field="bucket" value="${v('bucket')}" placeholder="my-bucket">
    </div>
    <div class="field">
      <label>Region <span class="tiny dim">（S3 用）</span></label>
      <input class="input" data-push-field="region" value="${v('region')}" placeholder="auto / us-east-1">
    </div>
    <div class="field">
      <label>AccessKey ID</label>
      <input class="input" data-push-field="accessKeyId" value="${v('accessKeyId')}" autocomplete="off">
    </div>
    <div class="field">
      <label>AccessKey Secret</label>
      <input class="input" data-push-field="accessKeySecret" type="password" value="${v('accessKeySecret')}" autocomplete="new-password">
    </div>
    <div class="field span-2">
      <label>对象路径</label>
      <input class="input" data-push-field="objectKey" value="${v('objectKey')}" placeholder="subflux/my-sub.yaml">
      <div class="field-hint">阿里云 OSS 走虚拟主机风格；S3 兼容走 path-style（endpoint/bucket/key）。</div>
    </div>`;
}

function renderPushTarget(target, index) {
  const type = PUSH_TYPE_META[target.type] ? target.type : 'file';
  return `<div class="card card-pad push-target" data-push-index="${index}" data-push-type="${type}" style="margin-bottom:8px">
    <div class="field-row" style="align-items:center;gap:8px">
      <select class="select" data-push-type style="max-width:170px">
        ${Object.entries(PUSH_TYPE_META).map(([id, meta]) => `<option value="${id}" ${type === id ? 'selected' : ''}>${meta.label}</option>`).join('')}
      </select>
      <button type="button" class="icon-btn is-danger" data-push-remove title="删除目标">${ico('trash')}</button>
    </div>
    <div class="form-grid" style="margin-top:8px">${pushTargetFields({ ...target, type })}</div>
  </div>`;
}

function readPushTargets() {
  return [...document.querySelectorAll('#push-targets .push-target')].map((el) => {
    const type = el.dataset.pushType;
    const get = (field) => String(el.querySelector(`[data-push-field="${field}"]`)?.value || '').trim();
    if (type === 'file') return { type, path: get('path') };
    if (type === 'http') return { type, url: get('url'), method: get('method') || 'PUT', headers: get('headers') };
    return {
      type: 'oss',
      provider: get('provider') || 'aliyun',
      endpoint: get('endpoint'),
      bucket: get('bucket'),
      region: get('region'),
      accessKeyId: get('accessKeyId'),
      accessKeySecret: get('accessKeySecret'),
      objectKey: get('objectKey'),
    };
  });
}

function copyProfile(profile) {
  if (!profile) return;
  const copy = {
    ...profile,
    id: undefined,
    token: undefined,
    name: `${profile.name} 副本`.slice(0, 40),
    filters: { ...(profile.filters || {}) },
    groups: { ...(profile.groups || {}) },
    customRuleList: (profile.customRuleList || []).map((rule) => ({ ...rule })),
    push: { ...(profile.push || {}), enabled: false, targets: (profile.push?.targets || []).map((target) => ({ ...target })) },
  };
  openProfileModal(copy);
}

function openProfileModal(profile = null) {
  const isEdit = Boolean(profile?.id);
  const f = profile?.filters || {
    protocols: [], regions: [], ipTypes: [], sourceIds: [], sites: [], china: '',
    minQuality: 0, maxLatency: 0, onlyAlive: false, include: '', exclude: '', maxNodes: 500, maxPerRegion: 0,
  };
  const groups = profile?.groups || { auto: true, fallback: true, regions: true };
  const push = profile?.push || { enabled: false, intervalMinutes: 1440, targets: [] };
  const allProtocols = new Set(Object.keys(App.state.stats.protocols));
  for (const p of f.protocols || []) allProtocols.add(p);
  if (!allProtocols.size) ['ss', 'vmess', 'vless', 'trojan', 'hysteria2', 'tuic'].forEach((p) => allProtocols.add(p));
  const selectedRegions = new Set(f.regions || []);
  const regions = App.state.stats.regions;
  for (const cc of selectedRegions) if (!regions.some((r) => r.cc === cc)) regions.push({ cc, region: cc, flag: '🌐', count: 0 });
  if (selectedRegions.has('unknown') && !regions.some((r) => r.cc === 'unknown')) regions.push({ cc: 'unknown', region: '未知', flag: '🌐', count: 0 });
  const selectedTypes = new Set(f.ipTypes || []);
  const selectedSources = new Set(f.sourceIds || []);
  const siteDefs = (App.state.settings.sites || []).filter((site) => site.enabled !== false);
  const selectedSites = new Set(f.sites || []);
  const formats = App.state.meta.formats;
  const content = `
    <form id="profile-form" autocomplete="off">
      ${profile?.needsReview ? `<div class="alert alert-warn">${ico('alert')}<div>这个输出引用的来源已被删除。保存本表单后会解除复核锁定，请确认下面的筛选条件。</div></div>` : ''}
      <div class="form-grid">
        <div class="field">
          <label for="profile-name">输出名称</label>
          <input class="input" id="profile-name" name="name" maxlength="40" required value="${esc(profile?.name || '')}" placeholder="例如：家宽优选 / 日本 Clash">
        </div>
        <div class="field">
          <label for="profile-format">回退客户端格式 <span class="tiny dim">（UA 无法识别时）</span></label>
          <select class="select" id="profile-format" name="format">
            ${formats.map((fmt) => `<option value="${esc(fmt.id)}" ${profile?.format === fmt.id ? 'selected' : ''}>${esc(fmt.label)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-row">
        <div>
          <div class="field-label">启用输出</div>
          <div class="field-hint">停用后订阅链接返回 404，配置与筛选条件保留。</div>
        </div>
        <label class="switch"><input type="checkbox" name="enabled" ${profile?.enabled === false ? '' : 'checked'}><span class="track"></span></label>
      </div>

      <div class="modal-section-title">节点筛选</div>
      <div class="field">
        <span class="field-label">协议 <span class="tiny dim">（不选 = 全部）</span></span>
        <div class="check-grid">
          ${[...allProtocols].sort().map((p) => `<label class="check-chip"><input type="checkbox" name="protocols" value="${esc(p)}" ${f.protocols?.includes(p) ? 'checked' : ''}><span>${esc(p.toUpperCase())}</span></label>`).join('')}
        </div>
      </div>
      <div class="field">
        <span class="field-label">IP 类型 <span class="tiny dim">（不选 = 全部）</span></span>
        <div class="check-grid">
          ${Object.entries(IP_TYPE_META).map(([key, meta]) => `<label class="check-chip"><input type="checkbox" name="ipTypes" value="${key}" ${selectedTypes.has(key) ? 'checked' : ''}><span>${esc(meta.label)}</span></label>`).join('')}
        </div>
      </div>
      <div class="field">
        <span class="field-label">站点支持 <span class="tiny dim">（全部满足；需先做站点检测）</span></span>
        <div class="check-grid">
          ${siteDefs.length ? siteDefs.map((site) => `<label class="check-chip"><input type="checkbox" name="sites" value="${esc(site.id)}" ${selectedSites.has(site.id) ? 'checked' : ''}><span>${esc(site.short)} · ${esc(site.name)}</span></label>`).join('') : '<span class="tiny dim">尚未配置站点检测项。</span>'}
        </div>
      </div>
      <div class="field">
        <label for="profile-china">CN 连通过滤</label>
        <select class="select" id="profile-china" name="china">
          <option value="" ${!f.china ? 'selected' : ''}>不限</option>
          <option value="reachable" ${f.china === 'reachable' ? 'selected' : ''}>仅 CN 可达</option>
          <option value="blocked" ${f.china === 'blocked' ? 'selected' : ''}>仅 CN 不可达 / 疑似被墙</option>
          <option value="untested" ${f.china === 'untested' ? 'selected' : ''}>仅未检测</option>
        </select>
        <div class="field-hint">需要先在节点池配置并运行中国探针检测。</div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>最低质量分</label>
          <div class="range-row">
            <input type="range" name="minQuality" min="0" max="95" step="5" value="${Number(f.minQuality) || 0}" id="quality-range">
            <span class="range-value" id="quality-range-value">${Number(f.minQuality) || 0}</span>
          </div>
          <div class="field-hint">0 表示不限；80+ 通常为家宽 / 优质移动网络。</div>
        </div>
        <div class="field">
          <label for="profile-latency">最大握手延迟（ms）</label>
          <input class="input" id="profile-latency" name="maxLatency" type="number" min="0" max="600000" step="10" value="${Number(f.maxLatency) || 0}" placeholder="0 = 不限">
          <div class="field-hint">握手失败（不可达）的节点会被排除；0 表示不限制。</div>
        </div>
      </div>
      <div class="field" style="max-height:190px;overflow:auto;padding-right:4px">
        <span class="field-label">地区 <span class="tiny dim">（不选 = 全部；当前列出可用地区）</span></span>
        <div class="check-grid">
          ${regions.length ? regions.map((r) => `<label class="check-chip"><input type="checkbox" name="regions" value="${esc(r.cc)}" ${selectedRegions.has(r.cc) ? 'checked' : ''}><span>${esc(r.flag || '🌐')} ${esc(r.region)}${r.count ? ` <em style="font-style:normal;opacity:.55">${r.count}</em>` : ''}</span></label>`).join('') : '<span class="tiny dim">暂无地区数据，留空将包含全部节点。</span>'}
        </div>
      </div>
      ${App.state.sources.length ? `
        <div class="field" style="max-height:150px;overflow:auto;padding-right:4px">
          <span class="field-label">来源 <span class="tiny dim">（不选 = 全部）</span></span>
          <div class="check-grid">
            ${App.state.sources.map((s) => `<label class="check-chip"><input type="checkbox" name="sourceIds" value="${esc(s.id)}" ${selectedSources.has(s.id) ? 'checked' : ''}><span>${esc(s.name)}</span></label>`).join('')}
          </div>
        </div>` : ''}
      <div class="form-grid">
        <div class="field">
          <label for="profile-include">包含关键词 / 正则</label>
          <input class="input" id="profile-include" name="include" value="${esc(f.include || '')}" placeholder="例如：日本|东京">
        </div>
        <div class="field">
          <label for="profile-exclude">排除关键词 / 正则</label>
          <input class="input" id="profile-exclude" name="exclude" value="${esc(f.exclude || '')}" placeholder="例如：过期|测试">
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label for="profile-max">最多输出节点</label>
          <input class="input" id="profile-max" name="maxNodes" type="number" min="0" max="20000" value="${Number.isFinite(Number(f.maxNodes)) ? Number(f.maxNodes) : 500}">
          <div class="field-hint">按排序保留前 N 个；填 0 表示不限制。也可以在订阅链接后加 ?limit=100 临时覆盖。</div>
        </div>
        <div class="field">
          <label for="profile-max-region">每个国家/地区最多</label>
          <input class="input" id="profile-max-region" name="maxPerRegion" type="number" min="0" max="500" value="${Number.isFinite(Number(f.maxPerRegion)) ? Number(f.maxPerRegion) : 0}">
          <div class="field-hint">按国家/地区分别计数，超出部分丢弃；填 0 表示不限制。比如填 3，同一国家最多只输出 3 个。</div>
        </div>
        <div class="field">
          <label>只保留握手可达节点</label>
          <div class="field-row" style="padding-top:4px">
            <span class="field-hint">需要先完成测速</span>
            <label class="switch"><input type="checkbox" name="onlyAlive" ${f.onlyAlive ? 'checked' : ''}><span class="track"></span></label>
          </div>
        </div>
        <div class="field">
          <label>节点名追加站点简写</label>
          <div class="field-row" style="padding-top:4px">
            <span class="field-hint">例如 [YT·GPT]，也可在模板使用 {sites}</span>
            <label class="switch"><input type="checkbox" name="appendSites" ${profile?.appendSites !== false ? 'checked' : ''}><span class="track"></span></label>
          </div>
        </div>
      </div>

      <div class="modal-section-title">分组策略</div>
      <div class="form-grid">
        <div class="field-row card card-pad" style="padding:11px 13px">
          <div><div class="field-label">自动选择</div><div class="field-hint">url-test，按测试地址自动选优</div></div>
          <label class="switch"><input type="checkbox" name="groupAuto" ${groups.auto !== false ? 'checked' : ''}><span class="track"></span></label>
        </div>
        <div class="field-row card card-pad" style="padding:11px 13px">
          <div><div class="field-label">故障转移</div><div class="field-hint">fallback，首选不可用时切换</div></div>
          <label class="switch"><input type="checkbox" name="groupFallback" ${groups.fallback !== false ? 'checked' : ''}><span class="track"></span></label>
        </div>
        <div class="field-row card card-pad" style="padding:11px 13px">
          <div><div class="field-label">地区分组</div><div class="field-hint">按国家 / 地区生成子分组</div></div>
          <label class="switch"><input type="checkbox" name="groupRegions" ${groups.regions !== false ? 'checked' : ''}><span class="track"></span></label>
        </div>
        <div class="field-row card card-pad" style="padding:11px 13px;opacity:.8">
          <div><div class="field-label">手动选择</div><div class="field-hint">主分组始终保留，无法关闭</div></div>
          <span class="badge badge-mint">固定启用</span>
        </div>
      </div>

      <div class="modal-section-title">定时推送</div>
      <div class="field-row card card-pad" style="padding:11px 13px">
        <div>
          <div class="field-label">启用定时推送</div>
          <div class="field-hint">到点生成当前订阅并推送到下面的目标；推送失败不会影响订阅本身。</div>
        </div>
        <label class="switch"><input type="checkbox" name="pushEnabled" ${push.enabled ? 'checked' : ''}><span class="track"></span></label>
      </div>
      <div class="form-grid">
        <div class="field">
          <label for="profile-push-interval">推送间隔（分钟）</label>
          <input class="input" id="profile-push-interval" name="pushInterval" type="number" min="5" max="5256000" value="${Number(push.intervalMinutes) || 1440}">
          <div class="quick-values">
            ${[[360, '6 小时'], [720, '12 小时'], [1440, '1 天'], [4320, '3 天'], [10080, '7 天']].map(([m, label]) => `<button type="button" data-push-interval="${m}">${label}</button>`).join('')}
          </div>
          <div class="field-hint">上次推送：${push.lastPushAt ? relTime(push.lastPushAt) : '尚未推送'}${push.lastStatus === 'error' ? ' · 上次失败' : ''}</div>
        </div>
      </div>
      <div class="field">
        <span class="field-label">推送目标 <span class="tiny dim">（最多 5 个）</span></span>
        <div id="push-targets"></div>
        <div class="quick-actions" style="margin-top:8px">
          <button type="button" class="btn btn-ghost btn-sm" data-push-add="file">${ico('download')}<span>本地文件</span></button>
          <button type="button" class="btn btn-ghost btn-sm" data-push-add="http">${ico('link')}<span>HTTP 地址</span></button>
          <button type="button" class="btn btn-ghost btn-sm" data-push-add="oss">${ico('cloud')}<span>OSS</span></button>
        </div>
      </div>

      <details class="advanced" ${isEdit ? '' : 'open'}>
        <summary>测试地址与高级命名</summary>
        <div class="form-stack">
          <div class="form-grid">
            <div class="field span-2">
              <label for="profile-test-url">自动选择的测试地址</label>
              <input class="input" id="profile-test-url" name="testUrl" value="${esc(profile?.testUrl || '')}" placeholder="留空使用全局：${esc(App.state.settings.testUrl)}">
            </div>
            <div class="field">
              <label for="profile-test-interval">测速间隔（秒）</label>
              <input class="input" id="profile-test-interval" name="testInterval" type="number" min="30" max="86400" value="${profile?.testInterval || 300}">
            </div>
            <div class="field">
              <label for="profile-sort">节点排序</label>
              <select class="select" id="profile-sort" name="sort">
                <option value="quality" ${(!profile?.sort || profile.sort === 'quality') ? 'selected' : ''}>质量优先</option>
                <option value="latency" ${profile?.sort === 'latency' ? 'selected' : ''}>延迟优先</option>
                <option value="region" ${profile?.sort === 'region' ? 'selected' : ''}>地区聚类</option>
                <option value="source" ${profile?.sort === 'source' ? 'selected' : ''}>来源顺序</option>
              </select>
            </div>
            <div class="field span-2">
              <label for="profile-rename">重命名模板</label>
              <input class="input" id="profile-rename" name="renameTemplate" value="${esc(profile?.renameTemplate || '')}" placeholder="留空使用全局：${esc(App.state.settings.renameTemplate)}">
              <div class="field-hint">可用：{flag} {region} {type} {quality} {score} {seq:02} {isp} {asn} {protocol} {source} {sites} {name}</div>
            </div>
            <div class="field span-2">
              <span class="field-label">追加分流规则</span>
              <div class="field-hint">在全局规则基础上追加；用下拉和输入框添加，不需要手写语法。</div>
              ${renderRuleBuilder(profile?.customRuleList || [], 'profile-rule-builder')}
            </div>
          </div>
        </div>
      </details>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>取消</button>
        <button type="submit" class="btn btn-primary" id="profile-submit">${isEdit ? '保存修改' : '创建输出订阅'}</button>
      </div>
    </form>`;
  openModal({
    title: isEdit ? '编辑输出订阅' : '新建输出订阅',
    subtitle: isEdit ? '调整筛选、分组与客户端格式' : '筛选越精确，最终订阅越干净',
    content,
    size: 'lg',
  });
  let pushTargets = Array.isArray(push.targets) ? push.targets.map((t) => ({ ...t })) : [];
  const pushBox = $('#push-targets');
  const drawPushTargets = () => {
    pushBox.innerHTML = pushTargets.length
      ? pushTargets.map((target, index) => renderPushTarget(target, index)).join('')
      : '<div class="tiny dim" style="padding:2px 0 4px">还没有推送目标，点下面的按钮添加。</div>';
  };
  drawPushTargets();
  pushBox?.addEventListener('change', (event) => {
    if (!event.target.matches('[data-push-type]')) return;
    pushTargets = readPushTargets();
    const index = Number(event.target.closest('.push-target').dataset.pushIndex);
    pushTargets[index] = { type: event.target.value };
    drawPushTargets();
  });
  pushBox?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-push-remove]');
    if (!btn) return;
    pushTargets = readPushTargets();
    pushTargets.splice(Number(btn.closest('.push-target').dataset.pushIndex), 1);
    drawPushTargets();
  });
  document.querySelectorAll('[data-push-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (pushTargets.length >= 5) return toast('最多添加 5 个推送目标', 'warn');
      pushTargets = readPushTargets();
      pushTargets.push({ type: btn.dataset.pushAdd });
      drawPushTargets();
    });
  });
  document.querySelectorAll('[data-push-interval]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = $('#profile-push-interval');
      if (input) input.value = btn.dataset.pushInterval;
    });
  });
  const form = $('#profile-form');
  const range = $('#quality-range');
  const rangeValue = $('#quality-range-value');
  range?.addEventListener('input', () => {
    rangeValue.textContent = range.value;
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (App.saving) return;
    const submit = $('#profile-submit');
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get('name') || '').trim(),
      format: String(fd.get('format') || 'clash'),
      enabled: fd.get('enabled') === 'on',
      filters: {
        protocols: fd.getAll('protocols').map(String),
        regions: fd.getAll('regions').map(String),
        ipTypes: fd.getAll('ipTypes').map(String),
        sourceIds: fd.getAll('sourceIds').map(String),
        sites: fd.getAll('sites').map(String),
        china: String(fd.get('china') || ''),
        minQuality: Number(fd.get('minQuality')) || 0,
        maxLatency: Number(fd.get('maxLatency')) || 0,
        onlyAlive: fd.get('onlyAlive') === 'on',
        include: String(fd.get('include') || ''),
        exclude: String(fd.get('exclude') || ''),
        maxNodes: (() => {
          const raw = String(fd.get('maxNodes') ?? '').trim();
          if (raw === '') return 0;
          return Math.max(0, Math.min(20000, Math.round(Number(raw) || 0)));
        })(),
        maxPerRegion: (() => {
          const raw = String(fd.get('maxPerRegion') ?? '').trim();
          if (raw === '') return 0;
          return Math.max(0, Math.min(500, Math.round(Number(raw) || 0)));
        })(),
      },
      groups: {
        auto: fd.get('groupAuto') === 'on',
        fallback: fd.get('groupFallback') === 'on',
        regions: fd.get('groupRegions') === 'on',
      },
      testUrl: String(fd.get('testUrl') || ''),
      testInterval: Number(fd.get('testInterval')) || 300,
      sort: String(fd.get('sort') || 'quality'),
      renameTemplate: String(fd.get('renameTemplate') || ''),
      appendSites: fd.get('appendSites') === 'on',
      customRuleList: collectRules($('#profile-rule-builder')),
      customRules: '',
      push: {
        enabled: fd.get('pushEnabled') === 'on',
        intervalMinutes: Number(fd.get('pushInterval')) || 1440,
        targets: readPushTargets(),
      },
    };
    if (!payload.name) return toast('请填写输出名称', 'warn');
    if (payload.push.enabled && !payload.push.targets.length) {
      return toast('启用定时推送前，请先添加至少一个推送目标', 'warn');
    }
    const brokenTarget = payload.push.targets.find((target) => {
      if (target.type === 'file') return !target.path;
      if (target.type === 'http') return !target.url;
      return !target.endpoint || !target.bucket || !target.objectKey || !target.accessKeyId || !target.accessKeySecret;
    });
    if (brokenTarget) return toast('有推送目标缺少必填项，请检查地址 / Bucket / 对象路径', 'warn');
    App.saving = true;
    setBusy(submit, true);
    try {
      const data = await api(isEdit ? `/api/profiles/${encodeURIComponent(profile.id)}` : '/api/profiles', {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      closeModal();
      await refreshState(false);
      if (App.view !== 'profiles') navigate('profiles');
      else render();
      toast(isEdit ? '输出订阅已更新' : `输出订阅已创建，匹配 ${data.profile.summary.emitted} 个节点`, 'success');
    } catch (err) {
      toast(err.message, 'error', 6000);
    } finally {
      App.saving = false;
      setBusy(submit, false);
    }
  });
}

function showQRCode(id) {
  const profile = App.state.profiles.find((p) => p.id === id);
  if (!profile) return;
  const formats = [
    ['auto', '自动识别'],
    ['clash', 'Clash'],
    ['singbox', 'Sing-box'],
    ['base64', 'Base64'],
  ];
  const qrSrc = (format) => `/api/profiles/${encodeURIComponent(profile.id)}/qr?format=${format}`;
  const linkFor = (format) => subUrl(profile, format === 'auto' ? null : format);
  openModal({
    title: '扫码添加订阅',
    subtitle: '用手机相机或客户端扫码；自动链接会按客户端 UA 返回对应格式',
    size: 'sm',
    content: `
      <div class="qr-modal">
        <div class="segmented" id="qr-formats">
          ${formats.map(([value, label], index) => `<button type="button" data-qr-format="${value}" class="${index === 0 ? 'active' : ''}">${label}</button>`).join('')}
        </div>
        <div class="qr-frame"><img id="qr-image" src="${qrSrc('auto')}" alt="订阅二维码" width="260" height="260"></div>
        <code class="qr-link" id="qr-link">${esc(linkFor('auto'))}</code>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="qr-copy">${ico('copy')}<span>复制链接</span></button>
          <a class="btn btn-ghost" id="qr-download" href="${qrSrc('auto')}" download="subflux-qr.svg">${ico('download')}<span>下载 SVG</span></a>
          <button type="button" class="btn btn-primary" data-close-modal>完成</button>
        </div>
      </div>`,
  });
  const image = $('#qr-image');
  const link = $('#qr-link');
  const download = $('#qr-download');
  const copy = $('#qr-copy');
  let current = 'auto';
  for (const button of $$('[data-qr-format]')) {
    button.addEventListener('click', () => {
      current = button.dataset.qrFormat;
      $$('[data-qr-format]').forEach((b) => b.classList.toggle('active', b === button));
      image.src = `${qrSrc(current)}&t=${Date.now()}`;
      link.textContent = linkFor(current);
      download.href = qrSrc(current);
      download.download = `subflux-qr-${current}.svg`;
    });
  }
  copy?.addEventListener('click', () => copyText(linkFor(current), '订阅链接已复制'));
}

async function openProfilePreview(id) {
  const profile = App.state.profiles.find((p) => p.id === id);
  if (!profile) return;
  openDrawerShell(profile, profile.format);
  await loadPreview();
}

/* ------------------------- settings ------------------------- */

function sampleName(template) {
  const values = {
    flag: '🇯🇵', region: '日本', country: 'Japan', cc: 'JP', type: '家宽',
    quality: '优质', score: '91', isp: 'NTT Communications', asn: 'AS2914',
    protocol: 'VLESS', source: '主机场', name: 'Tokyo-Home-01', seq: 1, sites: 'YT·GPT·GRK',
  };
  let name = String(template || '');
  name = name.replace(/\{seq:(\d+)\}/g, (_, width) => String(values.seq).padStart(Number(width) || 2, '0'));
  name = name.replace(/\{(\w+)\}/g, (_, key) => (key in values ? String(values[key]) : ''));
  return name.replace(/\s+/g, ' ').trim() || '节点 01';
}

const RULE_TYPE_META = {
  'DOMAIN-SUFFIX': { label: '域名后缀', placeholder: 'example.com', value: true },
  DOMAIN: { label: '完整域名', placeholder: 'www.example.com', value: true },
  'DOMAIN-KEYWORD': { label: '域名关键词', placeholder: 'example', value: true },
  'IP-CIDR': { label: 'IP / 网段', placeholder: '203.0.113.0/24', value: true },
  'PROCESS-NAME': { label: '进程名', placeholder: 'Telegram.exe', value: true },
  GEOSITE: { label: '国内域名（GEOSITE CN）', placeholder: 'CN', value: false },
  GEOIP: { label: '国内 IP（GEOIP CN）', placeholder: 'CN', value: false },
  MATCH: { label: '最终匹配（MATCH）', placeholder: '无需填写', value: false },
};

const RULE_TARGETS = [
  ['🚀 节点选择', '代理 · 手动选择'],
  ['♻️ 自动选择', '代理 · 自动测速'],
  ['🌍 地区选择', '代理 · 地区分组'],
  ['DIRECT', '直连'],
  ['REJECT', '拒绝'],
];

function ruleText(rule) {
  const type = String(rule.type || 'DOMAIN-SUFFIX').toUpperCase();
  if (type === 'MATCH') return `MATCH,${rule.target || '🚀 节点选择'}`;
  if (type === 'GEOSITE') return `GEOSITE,cn,${rule.target || 'DIRECT'}`;
  if (type === 'GEOIP') return `GEOIP,CN,${rule.target || 'DIRECT'}`;
  const extra = type === 'IP-CIDR' ? ',no-resolve' : '';
  return `${type},${rule.value || ''},${rule.target || 'DIRECT'}${extra}`;
}

function ruleRowHtml(rule = {}) {
  const type = RULE_TYPE_META[rule.type] ? rule.type : 'DOMAIN-SUFFIX';
  const target = rule.target || '🚀 节点选择';
  const targets = RULE_TARGETS.some(([value]) => value === target)
    ? RULE_TARGETS
    : [...RULE_TARGETS, [target, target]];
  const meta = RULE_TYPE_META[type];
  const value = meta.value ? (rule.value || '') : (type === 'GEOSITE' ? 'cn' : type === 'GEOIP' ? 'CN' : '');
  return `
    <div class="rule-row" data-rule-row>
      <select class="select rule-type" aria-label="规则类型">
        ${Object.entries(RULE_TYPE_META).map(([key, info]) => `<option value="${key}" ${key === type ? 'selected' : ''}>${esc(info.label)}</option>`).join('')}
      </select>
      <input class="input rule-value" value="${esc(value)}" placeholder="${esc(meta.placeholder)}" ${meta.value ? '' : 'disabled'} aria-label="规则内容">
      <select class="select rule-target" aria-label="规则动作">
        ${targets.map(([valueKey, label]) => `<option value="${esc(valueKey)}" ${valueKey === target ? 'selected' : ''}>${esc(label)}</option>`).join('')}
      </select>
      <button type="button" class="icon-btn is-danger" data-remove-rule title="删除规则">${ico('trash')}</button>
    </div>`;
}

function renderRuleBuilder(rules = [], id = 'rule-builder') {
  return `
    <div class="rule-builder" id="${esc(id)}">
      <div class="rule-head"><span>匹配类型</span><span>匹配内容</span><span>动作</span><span></span></div>
      <div class="rule-rows">
        ${(rules || []).length ? rules.map(ruleRowHtml).join('') : '<div class="rule-empty">还没有自定义规则。默认规则已经包含国内直连、AI / 流媒体代理和私网直连。</div>'}
      </div>
      <div class="rule-builder-foot">
        <button type="button" class="btn btn-ghost btn-sm" data-add-rule>${ico('plus')}<span>添加规则</span></button>
        <span class="field-hint">规则按从上到下匹配；自定义规则优先于默认规则。</span>
      </div>
      <div class="rule-preview" data-rule-preview></div>
    </div>`;
}

function collectRules(builder) {
  if (!builder) return [];
  const rules = [];
  for (const row of builder.querySelectorAll('[data-rule-row]')) {
    const type = row.querySelector('.rule-type')?.value || 'DOMAIN-SUFFIX';
    const meta = RULE_TYPE_META[type] || RULE_TYPE_META['DOMAIN-SUFFIX'];
    let value = meta.value ? String(row.querySelector('.rule-value')?.value || '').trim() : '';
    if (type === 'GEOSITE') value = 'cn';
    if (type === 'GEOIP') value = 'CN';
    if (!meta.value || value || type === 'GEOSITE' || type === 'GEOIP') {
      rules.push({ type, value, target: row.querySelector('.rule-target')?.value || 'DIRECT' });
    }
  }
  return rules;
}

function refreshRuleBuilder(builder) {
  if (!builder) return;
  const rows = [...builder.querySelectorAll('[data-rule-row]')];
  for (const row of rows) {
    const type = row.querySelector('.rule-type')?.value || 'DOMAIN-SUFFIX';
    const meta = RULE_TYPE_META[type] || RULE_TYPE_META['DOMAIN-SUFFIX'];
    const input = row.querySelector('.rule-value');
    if (!input) continue;
    input.disabled = !meta.value;
    input.placeholder = meta.placeholder;
    if (type === 'GEOSITE') input.value = 'cn';
    else if (type === 'GEOIP') input.value = 'CN';
    else if (type === 'MATCH') input.value = '';
  }
  const preview = builder.querySelector('[data-rule-preview]');
  if (!preview) return;
  const rules = collectRules(builder);
  preview.innerHTML = rules.length
    ? `<div class="tiny dim" style="margin-bottom:5px">生成规则预览</div>${rules.map((rule) => `<code>${esc(ruleText(rule))}</code>`).join('')}`
    : '<span class="tiny dim">保存后会叠加到默认分流规则之前。</span>';
  const empty = builder.querySelector('.rule-empty');
  if (empty) empty.hidden = rows.length > 0;
}

function refreshAllRuleBuilders() {
  $$('.rule-builder').forEach(refreshRuleBuilder);
}

function addRuleToBuilder(builder, rule = {}) {
  if (!builder) return;
  const rows = builder.querySelector('.rule-rows');
  if (!rows) return;
  const empty = rows.querySelector('.rule-empty');
  if (empty) empty.remove();
  rows.insertAdjacentHTML('beforeend', ruleRowHtml(rule));
  hydrateIcons(builder);
  refreshRuleBuilder(builder);
}

function siteSettingRow(site) {
  return `
    <div class="site-row" data-site-id="${esc(site.id)}">
      <label class="switch" title="启用检测"><input type="checkbox" class="site-enabled" ${site.enabled !== false ? 'checked' : ''}><span class="track"></span></label>
      <input class="input site-name" value="${esc(site.name)}" maxlength="30" placeholder="站点名称">
      <input class="input site-short" value="${esc(site.short)}" maxlength="6" placeholder="简写">
      <input class="input site-url" value="${esc(site.url)}" placeholder="https://example.com/">
      ${site.preset ? '<span class="badge badge-muted no-dot site-preset">内置</span>' : '<span class="site-preset"></span>'}
      <button type="button" class="icon-btn is-danger" data-remove-site title="移除">${ico('trash')}</button>
    </div>`;
}

/* ------------------------- tasks ------------------------- */

function taskProgress(job) {
  const total = Math.max(1, Number(job.total) || 0);
  const pct = Math.min(100, Math.round(((Number(job.done) || 0) / total) * 100));
  return `
    <div class="job-progress" style="width:100%"><i style="width:${pct}%"></i></div>
    <div class="task-sub">${fmtNum(job.done)} / ${fmtNum(job.total)} · ${pct}%${job.skipped ? ` · 跳过 ${fmtNum(job.skipped)}` : ''}</div>`;
}

function taskCard(title, icon, job, queue, kind) {
  const running = Boolean(job && job.running);
  const last = job && !job.running ? job : null;
  let body = '<div class="task-sub">还没有运行记录</div>';
  if (running) {
    body = `
      <div class="task-sub">${esc(job.note || '运行中')}</div>
      ${taskProgress(job)}
      <div class="task-sub">并发 ${job.concurrency || '—'} · 超时 ${job.timeoutMs ? `${job.timeoutMs} ms` : '—'} · 开始 ${fmtTime(job.startedAt)}</div>`;
  } else if (last) {
    body = `<div class="task-sub">上次 ${fmtTime(last.finishedAt)} · ${fmtNum(last.total)} 个节点 · 成功 ${fmtNum(last.ok)} · 失败 ${fmtNum(last.fail)}${last.skipped ? ` · 跳过 ${fmtNum(last.skipped)}` : ''}</div>`;
  }
  return `
    <div class="card task-card">
      <div class="task-head">
        <span class="task-icon">${ico(icon)}</span>
        <strong>${esc(title)}</strong>
        ${running ? '<span class="badge badge-blue">运行中</span>' : '<span class="badge badge-muted">空闲</span>'}
        ${running && kind ? `<button class="btn btn-sm task-cancel" data-action="cancel-task" data-kind="${kind}">取消</button>` : ''}
      </div>
      ${body}
      ${queue ? `<div class="task-sub">队列中还有 ${fmtNum(queue)} 个节点</div>` : ''}
    </div>`;
}

function renderTasks() {
  const state = App.state;
  if (!state) return '';
  const queues = state.meta.queues || {};
  const jobs = [
    { title: '握手测速', icon: 'activity', job: state.job, queue: queues.latency, kind: 'latency' },
    { title: '站点检测', icon: 'globe', job: state.siteJob, queue: queues.site, kind: 'site' },
    { title: 'CN 实际检测', icon: 'server', job: state.chinaJob, queue: 0, kind: 'china' },
  ];
  const running = jobs.filter((item) => item.job?.running);
  const refreshing = state.sources.filter((source) => source.status === 'refreshing');
  const s = state.settings || {};
  const latencyOff = s.latencyAuto === false;
  const pushes = (state.profiles || []).filter((profile) => profile.push?.enabled);
  const scheduledSources = state.sources.filter((source) => source.kind !== 'text' && source.autoRefresh !== false);
  const events = (state.events || []).slice(0, 8);
  return `
    <section class="view">
      ${pageHead('TASKS', '任务中心', `当前 ${running.length + refreshing.length} 个任务在跑。测速、站点检测、CN 检测各自同时只跑一个，后来的任务排队等待；不同订阅源的刷新可以并行，刷新和检测也可以同时进行。`, `<button class="btn btn-primary" data-action="test-all">${ico('activity')}<span>立即握手测试全部</span></button>`)}
      <div class="task-grid">
        ${jobs.map((item) => taskCard(item.title, item.icon, item.job, item.queue, item.kind)).join('')}
        <div class="card task-card">
          <div class="task-head">
            <span class="task-icon">${ico('rss')}</span>
            <strong>订阅刷新</strong>
            ${refreshing.length ? '<span class="badge badge-blue">运行中</span>' : '<span class="badge badge-muted">空闲</span>'}
          </div>
          ${refreshing.length
            ? refreshing.map((source) => `<div class="task-sub">${esc(source.name)} · 正在拉取订阅</div>`).join('')
            : '<div class="task-sub">没有正在刷新的订阅源</div>'}
          <div class="task-sub">同一订阅源不会重复刷新，不同订阅源之间并行。</div>
        </div>
      </div>

      <div class="card settings-section">
        <h2>定时计划</h2>
        <div class="desc">所有定时任务由同一个 30 秒调度器驱动，按各自的下次执行时间判断；到点只触发一次，执行前会检查是否已有同类任务在跑。</div>
        <div class="table-wrap">
          <table class="table" style="min-width:660px">
            <thead><tr><th>任务</th><th>间隔</th><th>下次</th><th>上次</th><th>状态</th></tr></thead>
            <tbody>
              <tr>
                <td>握手测速</td>
                <td>${latencyOff ? '—' : `${fmtNum(s.latencyIntervalMinutes || 60)} 分钟`}</td>
                <td>${latencyOff ? '已关闭' : `${fmtTime(s.latencyNextAt)}（${relTime(s.latencyNextAt)}）`}</td>
                <td>${fmtTime(s.latencyLastAt)}</td>
                <td>${latencyOff ? '<span class="badge badge-muted">已关闭</span>' : '<span class="badge badge-mint">已开启</span>'} · 并发 ${fmtNum(s.connectConcurrency ?? 40)} · 超时 ${fmtNum(s.connectTimeoutMs ?? 5000)} ms</td>
              </tr>
              ${scheduledSources.map((source) => `
                <tr>
                  <td>刷新 · ${esc(source.name)}</td>
                  <td>${fmtNum(source.intervalMinutes)} 分钟</td>
                  <td>${fmtTime(source.nextRefreshAt)}</td>
                  <td>${fmtTime(source.lastRefreshAt)}</td>
                  <td>${source.enabled ? '<span class="badge badge-mint">已启用</span>' : '<span class="badge badge-muted">已停用</span>'}</td>
                </tr>`).join('')}
              ${pushes.map((profile) => `
                <tr>
                  <td>推送 · ${esc(profile.name)}</td>
                  <td>${fmtNum(profile.push.intervalMinutes)} 分钟</td>
                  <td>${fmtTime(profile.push.nextPushAt)}</td>
                  <td>${fmtTime(profile.push.lastPushAt)}</td>
                  <td>${profile.push.lastStatus === 'error' ? '<span class="badge badge-red">上次失败</span>' : profile.push.lastStatus === 'partial' ? '<span class="badge badge-amber">部分失败</span>' : '<span class="badge badge-mint">正常</span>'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        ${latencyOff && !scheduledSources.length && !pushes.length ? '<div class="task-sub" style="padding:12px 2px 0">还没有定时任务：到订阅源或输出订阅里开启自动刷新 / 定时推送后会出现在这里。</div>' : ''}
      </div>

      <div class="card settings-section">
        <h2>最近事件</h2>
        <div class="desc">刷新、测速、站点检测和推送的执行记录。</div>
        ${events.length ? `<div class="timeline">${events.map((e) => `
          <div class="timeline-item">
            <span class="timeline-dot ${esc(e.level)}"></span>
            <div class="timeline-main">
              <div class="timeline-msg">${esc(e.message)}</div>
              <div class="timeline-time">${relTime(e.at)} · ${fmtTime(e.at)}</div>
            </div>
          </div>`).join('')}</div>` : '<div class="empty" style="padding:24px 8px"><p>还没有事件记录。</p></div>'}
      </div>
    </section>`;
}

function renderSettings() {
  const s = App.state.settings;
  const meta = App.state.meta;
  const engineMeta = meta.engine || { available: Boolean(meta.siteEngine), path: meta.siteEnginePath || '', from: '', defaultPath: '/opt/mihomo/mihomo', candidates: [] };
  const engineReady = Boolean(engineMeta.available);
  const tokens = ['{flag}', '{region}', '{type}', '{quality}', '{score}', '{seq:02}', '{isp}', '{asn}', '{protocol}', '{source}', '{sites}', '{name}'];
  return `
    <section class="view">
      ${pageHead('SYSTEM', '设置与说明', '调整刷新、测速、命名与数据策略。面板已启用登录认证，账号由容器环境变量配置。', `
        <button class="btn btn-primary" type="submit" form="settings-form">${ico('check')}<span>保存设置</span></button>
      `)}
      <div class="settings-grid">
        <form id="settings-form" class="stack" autocomplete="off">
          <div class="card settings-section">
            <h2>登录认证</h2>
            <div class="desc">面板页面和 /api 接口需要登录；订阅链接 /sub/&lt;token&gt; 仍使用令牌认证，客户端不受影响。</div>
            <div class="field-hint">当前账号：<b>${esc(meta.auth?.username || 'admin')}</b>。修改容器环境变量 SUBFLUX_USERNAME / SUBFLUX_PASSWORD 后重启生效。</div>
            ${meta.auth?.defaultCreds ? '<div class="field-hint" style="color:#f5b75a">正在使用默认账号密码，请尽快在 .env 中修改。</div>' : ''}
            <div class="field-hint">db.json 中的订阅令牌、节点凭据、OSS AccessKey、探针 Token 等字段使用 AES-256-GCM 加密，密钥保存在 data/.secret-key（权限 0600）。</div>
          </div>
          <div class="card settings-section">
            <h2>订阅访问地址</h2>
            <div class="desc">生成订阅链接和二维码时使用的地址前缀，可以填别的域名或公网 IP，不必是面板当前的访问地址。</div>
            <div class="field">
              <label for="setting-sub-base">地址前缀</label>
              <input class="input" id="setting-sub-base" name="subBaseUrl" value="${esc(s.subBaseUrl || '')}" placeholder="https://sub.example.com">
              <div class="field-hint">留空则使用当前页面地址。可以带路径前缀，例如 https://example.com/subflux；结尾的 / 会自动去掉。</div>
            </div>
          </div>
          <div class="card settings-section">
            <h2>刷新与检测</h2>
            <div class="desc">控制订阅抓取节奏、IP 情报缓存与网络超时。默认值偏向低资源占用。</div>
            <div class="form-stack">
              <div class="field">
                <label for="setting-test-url">自动选择测试地址</label>
                <input class="input" id="setting-test-url" name="testUrl" value="${esc(s.testUrl)}" placeholder="https://www.gstatic.com/generate_204">
                <div class="field-hint">生成 Clash url-test / fallback 与 Sing-box urltest 时使用；输出订阅可单独覆盖。</div>
              </div>
              <div class="form-grid">
                <div class="field">
                  <label for="setting-default-interval">默认刷新间隔（分钟）</label>
                  <input class="input" id="setting-default-interval" name="defaultInterval" type="number" min="5" max="5256000" value="${s.defaultInterval}">
                </div>
                <div class="field">
                  <label for="setting-ttl">IP 情报缓存（小时）</label>
                  <input class="input" id="setting-ttl" name="qualityTTLHours" type="number" min="1" max="720" value="${s.qualityTTLHours}">
                </div>
                <div class="field">
                  <label for="setting-proxycheck-key">ProxyCheck API Key（可选）</label>
                  <input class="input" id="setting-proxycheck-key" name="proxycheckKey" type="password" value="${esc(s.proxycheckKey || '')}" placeholder="留空则使用免费额度" autocomplete="off">
                  <div class="field-hint">用于补充代理 / VPN / 滥用风险数据。免费无 Key 每天 100 个 IP，注册免费 Key 后 1,000 个/天。</div>
                </div>
                <div class="field">
                  <label for="setting-proxycheck-limit">每日风险检测 IP 数</label>
                  <input class="input" id="setting-proxycheck-limit" name="proxycheckPerDay" type="number" min="0" max="2000" value="${s.proxycheckPerDay ?? 90}">
                  <div class="field-hint">0 = 关闭；超出额度的 IP 会留到下次检测，不会报错。</div>
                </div>
                <div class="field">
                  <label for="setting-request-timeout">订阅请求超时（毫秒）</label>
                  <input class="input" id="setting-request-timeout" name="requestTimeoutMs" type="number" min="5000" max="90000" step="1000" value="${s.requestTimeoutMs}">
                </div>
                <div class="field">
                  <label for="setting-connect-timeout">握手测试超时（毫秒）</label>
                  <input class="input" id="setting-connect-timeout" name="connectTimeoutMs" type="number" min="1000" max="20000" step="500" value="${s.connectTimeoutMs ?? 5000}">
                  <div class="field-hint">每个节点建立一次真实代理连接的最长等待，超时即判不可达。</div>
                </div>
                <div class="field">
                  <label for="setting-max-nodes">单源节点上限</label>
                  <input class="input" id="setting-max-nodes" name="maxNodesPerSource" type="number" min="100" max="10000" step="100" value="${s.maxNodesPerSource}">
                </div>
                <div class="field">
                  <label for="setting-ua">默认 User-Agent</label>
                  <input class="input" id="setting-ua" name="userAgent" value="${esc(s.userAgent)}">
                </div>
              </div>
              <div class="form-grid">
                <div class="field-row card card-pad" style="padding:11px 13px">
                  <div><div class="field-label">启用定时刷新</div><div class="field-hint">关闭后只接受手动刷新</div></div>
                  <label class="switch"><input type="checkbox" name="autoRefresh" ${s.autoRefresh !== false ? 'checked' : ''}><span class="track"></span></label>
                </div>
                <div class="field-row card card-pad" style="padding:11px 13px">
                  <div><div class="field-label">自动 IP 画像</div><div class="field-hint">刷新后异步补全新节点</div></div>
                  <label class="switch"><input type="checkbox" name="autoQuality" ${s.autoQuality !== false ? 'checked' : ''}><span class="track"></span></label>
                </div>
                <div class="field-row card card-pad" style="padding:11px 13px">
                  <div><div class="field-label">刷新后自动握手测速</div><div class="field-hint">刷新后对该源全部节点重新做代理握手，TCP 与 UDP 协议都测</div></div>
                  <label class="switch"><input type="checkbox" name="autoConnect" ${(s.autoConnect ?? s.autoTcp) !== false ? 'checked' : ''}><span class="track"></span></label>
                </div>
                <div class="field-row card card-pad" style="padding:11px 13px">
                  <div><div class="field-label">刷新后自动站点检测</div><div class="field-hint">只检测还没有站点结果的新节点，不设数量上限</div></div>
                  <label class="switch"><input type="checkbox" name="autoSite" ${s.autoSite !== false ? 'checked' : ''}><span class="track"></span></label>
                </div>
                <div class="field span-2">
                  <label for="setting-fetch-proxy">默认订阅拉取代理</label>
                  <div style="display:flex;gap:8px">
                    <input class="input" id="setting-fetch-proxy" name="fetchProxy" value="${esc(s.fetchProxy || '')}" placeholder="http://127.0.0.1:7890 或 socks5://127.0.0.1:1080">
                    <button type="button" class="btn btn-ghost" data-action="test-proxy" style="white-space:nowrap">${ico('activity')}<span>测试</span></button>
                  </div>
                  <div class="field-hint">支持 HTTP / HTTPS / SOCKS5；订阅源选择「外部代理地址」且地址留空时使用这里。也可以在订阅源里直接用节点池节点拉取。</div>
                </div>
                <div class="field-row card card-pad span-2" style="padding:11px 13px">
                  <div><div class="field-label">流量耗尽 / 过期时剔除节点</div><div class="field-hint">根据订阅响应的 Subscription-Userinfo 判断；关闭后即使耗尽也继续输出</div></div>
                  <label class="switch"><input type="checkbox" name="excludeDepleted" ${s.excludeDepleted !== false ? 'checked' : ''}><span class="track"></span></label>
                </div>
              </div>
            </div>
          </div>

          <div class="card settings-section">
            <h2>定时测速</h2>
            <div class="desc">按固定间隔让 Mihomo 对每个节点真实发起一次代理连接，HTTP / HTTPS / SOCKS5 与 HY2 / TUIC / WireGuard 等 UDP 协议统一判定可达。</div>
            <div class="form-grid">
              <div class="field-row card card-pad span-2" style="padding:11px 13px">
                <div><div class="field-label">启用定时测速</div><div class="field-hint">到点时如果已有测速任务在跑，会等它结束后再开始；站点检测可以同时进行</div></div>
                <label class="switch"><input type="checkbox" name="latencyAuto" ${s.latencyAuto !== false ? 'checked' : ''}><span class="track"></span></label>
              </div>
              <div class="field">
                <label for="setting-latency-interval">测速间隔（分钟）</label>
                <input class="input" id="setting-latency-interval" name="latencyIntervalMinutes" type="number" min="5" max="5256000" value="${s.latencyIntervalMinutes || 60}">
                <div class="quick-values" style="margin-top:8px">
              <button type="button" data-latency-quick="15">15 分</button>
              <button type="button" data-latency-quick="30">30 分</button>
              <button type="button" data-latency-quick="60">1 小时</button>
              <button type="button" data-latency-quick="180">3 小时</button>
              <button type="button" data-latency-quick="360">6 小时</button>
              <button type="button" data-latency-quick="720">12 小时</button>
              <button type="button" data-latency-quick="1440">24 小时</button>
                </div>
                <div class="field-hint">下次 ${s.latencyAuto === false ? '—' : esc(fmtTime(s.latencyNextAt))} · 上次 ${esc(fmtTime(s.latencyLastAt))}</div>
              </div>
              <div class="field">
                <label for="setting-connect-concurrency">握手并发</label>
                <input class="input" id="setting-connect-concurrency" name="connectConcurrency" type="number" min="1" max="80" step="1" value="${s.connectConcurrency ?? 40}">
                <div class="field-hint">同时交给内核测试的节点数，超时用上面的「握手测试超时」。留足 40 以上能明显缩短大批量测试时间。</div>
              </div>
            </div>
          </div>

          <div class="card settings-section">
            <h2>节点命名</h2>
            <div class="desc">输出订阅中的节点名称会按此模板重写；地区、类型、质量、站点简写与序号可组合。</div>
            <div class="field">
              <label for="setting-template">重命名模板</label>
              <input class="input mono" id="setting-template" name="renameTemplate" value="${esc(s.renameTemplate)}">
              <div class="token-pills">
                ${tokens.map((t) => `<button type="button" class="token-pill" data-template-token="${esc(t)}">${esc(t)}</button>`).join('')}
              </div>
              <div class="field-hint">示例预览：</div>
              <div class="template-preview" id="template-preview">${esc(sampleName(s.renameTemplate))}</div>
            </div>
          </div>

          <div class="card settings-section">
            <h2>站点解锁检测</h2>
            <div class="desc">通过本地 Mihomo 引擎让节点真实访问网站，判断 YouTube、ChatGPT、Claude、Grok、Gemini 等站点是否可用；结果会写入节点名简写。</div>
            <div class="form-grid">
              <div class="field span-2">
                <div class="field-hint">不设数量上限：手动检测会测当前筛选（或勾选）的全部节点；自动检测只补还没有站点结果的节点。检测逐节点串行，所有站点并行访问，节点多时会跑得比较久。</div>
              </div>
              <div class="field">
                <label>引擎状态</label>
                <div class="field-row" style="padding-top:4px">
                  <span class="tiny" style="${engineReady ? 'color:var(--muted-2)' : 'color:var(--red)'}">${engineReady ? `已就绪 · ${esc(engineMeta.from || '')}` : '未找到可执行引擎'}</span>
                  <span class="badge ${engineReady ? 'badge-mint' : 'badge-red'}">${engineReady ? 'READY' : 'MISSING'}</span>
                </div>
              </div>
            </div>
            <div class="field" style="margin-top:12px">
              <label for="setting-mihomo-path">Mihomo 引擎路径</label>
              <input class="input mono" id="setting-mihomo-path" name="mihomoPath" value="${esc(s.mihomoPath || '')}" placeholder="${esc(engineMeta.defaultPath || '/opt/mihomo/mihomo')}">
              <div class="field-hint">留空时依次尝试：环境变量 <span class="code-inline">MIHOMO_BIN</span> → <span class="code-inline">${esc(engineMeta.defaultPath || '/opt/mihomo/mihomo')}</span>（docker compose 默认下载位置）→ 项目内置 <span class="code-inline">bin/mihomo</span>。当前解析结果：<span class="code-inline">${esc(engineMeta.path || '无')}</span></div>
            </div>
            <div class="site-list-head">
              <span>启用</span><span>站点名称</span><span>简写</span><span>检测地址</span><span></span><span></span>
            </div>
            <div class="site-rows" id="site-rows">
              ${(s.sites || []).map(siteSettingRow).join('')}
            </div>
            <button type="button" class="btn btn-ghost btn-sm" data-add-site>${ico('plus')}<span>添加自定义站点</span></button>
            <div class="field-hint" style="margin-top:9px">检测会消耗少量节点流量；未检测或结果不确定的站点不会写入节点名。自定义站点默认以 HTTP 2xx/3xx 且非 Cloudflare 挑战页面判定为支持。</div>
          </div>

          <div class="card settings-section">
            <h2>中国连通检测（被墙）</h2>
            <div class="desc">主服务在国外时，无法直接判断节点在国内是否可达。需要在中国大陆的机器上运行 <span class="code-inline">probe.js</span>。探针支持 TCP 入口检测和 Mihomo 实际代理检测（可覆盖 HY2 / TUIC / WireGuard 等 UDP），主服务只负责下发节点和汇总结果。</div>
            ${alertBox('warn', '没有中国探针时不要用国外服务器做“被墙”判断。TCP 模式只测入口端口，UDP 协议无法判断；请使用节点池的「CN 实际」按钮，由国内探针启动 Mihomo 真实代理访问。即使实际连接失败，也可能是 GFW、运营商路由或节点故障，结果不宣称 100% 被墙。')}
            <div class="form-stack" style="margin-top:14px">
              <div class="field">
                <label for="setting-china-url">中国探针地址</label>
                <input class="input" id="setting-china-url" name="chinaProbeUrl" value="${esc(s.chinaProbeUrl || '')}" placeholder="http://100.x.y.z:8899/api/probe/tcp">
                <div class="field-hint">在国内机器运行：<span class="code-inline">PROBE_TOKEN=至少16位随机串 node probe.js</span></div>
              </div>
              <div class="form-grid">
                <div class="field">
                  <label for="setting-china-token">探针 Token</label>
                  <input class="input mono" id="setting-china-token" name="chinaProbeToken" value="${esc(s.chinaProbeToken || '')}" placeholder="与 PROBE_TOKEN 相同">
                </div>
                <div class="field">
                  <label for="setting-china-timeout">超时（毫秒）</label>
                  <input class="input" id="setting-china-timeout" name="chinaProbeTimeoutMs" type="number" min="1000" max="15000" step="500" value="${s.chinaProbeTimeoutMs || 5000}">
                </div>
              </div>
              <div class="field">
                <label for="setting-china-test-url">CN 实际检测地址</label>
                <input class="input" id="setting-china-test-url" name="chinaProbeTestUrl" value="${esc(s.chinaProbeTestUrl || 'https://www.qq.com/')}" placeholder="https://www.qq.com/">
                <div class="field-hint">国内可访问的地址；探针会启动 Mihomo 真实代理请求它。不要用 gstatic 等国内不可达地址。</div>
              </div>
              <div class="field">
                <label for="setting-china-reverse">反向测试地址（国内 → 国外）</label>
                <input class="input" id="setting-china-reverse" name="chinaProbeReverseUrl" value="${esc(s.chinaProbeReverseUrl || '')}" placeholder="http://100.y.y.y:8888/api/health">
                <div class="field-hint">填主服务的 Tailscale 地址；中国探针会反向请求它，验证国内 → 国外方向。测试前请先保存设置。</div>
              </div>
              <button type="button" class="btn btn-ghost" data-action="test-china-link" style="align-self:flex-start">${ico('activity')}<span>双向连通测试</span></button>
            </div>
          </div>

          <div class="card settings-section">
            <h2>分流规则</h2>
            <div class="desc">生成 Clash / Sing-box 时默认写入国内直连、AI / 流媒体代理和私网直连；国内直连包含内置 ${App.state.meta?.directDomainCount || 0} 条常见域名 + GEOSITE/GEOIP CN，自定义规则会叠加在默认规则之前。</div>
            <div class="form-grid">
              <div class="field-row card card-pad" style="padding:11px 13px">
                <div><div class="field-label">国内直连</div><div class="field-hint">内置 ${App.state.meta?.directDomainCount || 0} 条域名 + GEOSITE/GEOIP CN 走 DIRECT</div></div>
                <label class="switch"><input type="checkbox" name="domesticDirect" ${s.routing?.domesticDirect !== false ? 'checked' : ''}><span class="track"></span></label>
              </div>
              <div class="field-row card card-pad" style="padding:11px 13px">
                <div><div class="field-label">AI / 流媒体代理</div><div class="field-hint">OpenAI / Claude / Gemini / Grok / YouTube</div></div>
                <label class="switch"><input type="checkbox" name="smartProxy" ${s.routing?.smartProxy !== false ? 'checked' : ''}><span class="track"></span></label>
              </div>
              <div class="field-row card card-pad" style="padding:11px 13px">
                <div><div class="field-label">拦截常见广告</div><div class="field-hint">域名匹配 REJECT / block</div></div>
                <label class="switch"><input type="checkbox" name="blockAds" ${s.routing?.blockAds ? 'checked' : ''}><span class="track"></span></label>
              </div>
              <div class="field-row card card-pad" style="padding:11px 13px;opacity:.75">
                <div><div class="field-label">私网直连</div><div class="field-hint">LAN / 回环地址固定直连</div></div>
                <span class="badge badge-mint no-dot">固定</span>
              </div>
            </div>
            <div class="field" style="margin-top:14px">
              <span class="field-label">自定义分流规则</span>
              <div class="field-hint">用下面的下拉和输入框添加规则，不需要手写语法。规则按从上到下的顺序匹配，并优先于默认规则。</div>
              ${renderRuleBuilder(s.routing?.customRuleList || [], 'settings-rule-builder')}
            </div>
          </div>

          <div class="card settings-section">
            <h2>数据管理</h2>
            <div class="desc">所有数据保存在本地 JSON 文件，包含订阅地址、节点与输出令牌。建议定期备份。</div>
            <div class="form-grid">
              <a class="btn btn-ghost" href="/api/export" download>${ico('download')}<span>导出完整备份</span></a>
              <button type="button" class="btn btn-ghost" data-action="import-backup">${ico('upload')}<span>导入备份</span></button>
            </div>
            <input type="file" id="import-file" accept="application/json,.json" hidden>
            <div class="field-hint" style="margin-top:10px">导入会覆盖当前订阅源、节点、输出订阅与设置。导入前请先导出备份。</div>
          </div>

          <div class="settings-actions">
            <span class="tiny dim" style="margin-right:auto">修改后立即生效，无需重启服务</span>
            <button type="submit" class="btn btn-primary">${ico('check')}<span>保存设置</span></button>
          </div>
        </form>

        <div class="stack">
          <div class="card settings-section">
            <h2>运行信息</h2>
            <div class="desc">轻量单进程 Node 服务，数据与静态页面同源。</div>
            <div class="info-list">
              <div class="info-row"><span>服务版本</span><b>SubFlux v1.0.0</b></div>
              <div class="info-row"><span>运行时长</span><b>${esc(uptime(meta.uptimeSec))}</b></div>
              <div class="info-row"><span>内存占用</span><b>${meta.memoryMB} MB RSS</b></div>
              <div class="info-row"><span>Node.js</span><b>${esc(meta.nodeVersion)}</b></div>
              <div class="info-row"><span>订阅 / 节点 / 输出</span><b>${App.state.stats.sources.total} / ${fmtNum(App.state.stats.nodes.total)} / ${App.state.profiles.length}</b></div>
            </div>
          </div>
          <div class="card settings-section">
            <h2>入口质量分（启发式）</h2>
            <div class="desc" style="margin-bottom:12px">入口质量分来自入口 IP 的公共 ASN 情报，是 SubFlux 自算的启发式分数，不是官方评分，也不是代理实际落地 IP。</div>
            <div class="info-list">
              <div class="info-row"><span>家宽</span><b>hosting=false 且 ISP 含 broadband / telecom / cable 等</b></div>
              <div class="info-row"><span>机房</span><b>hosting=true 或 ASN 属于云厂商 / IDC</b></div>
              <div class="info-row"><span>CDN</span><b>入口为 Cloudflare / Akamai 等，落地未知</b></div>
              <div class="info-row"><span>分数</span><b>类型基础分 + 延迟修正 - 代理/风险标记</b></div>
            </div>
            <div style="margin-top:12px">${alertBox('warn', '域名节点会解析到入口 IP；若服务商使用 CDN 中转，无法仅凭订阅判断真实落地质量。')}</div>
          </div>
          <div class="card settings-section">
            <h2>客户端导入</h2>
            <div class="steps" style="padding-top:2px">
              <div class="step"><span class="step-num">C</span><div><h4>Clash / Mihomo</h4><p>复制 <span class="code-inline">/sub/&lt;token&gt;</span> 即可自动识别；也可用 <span class="code-inline">/clash</span> 强制格式。</p></div></div>
              <div class="step"><span class="step-num">S</span><div><h4>Sing-box</h4><p>使用自动链接或 <span class="code-inline">/singbox</span> 链接，客户端 UA 会被自动识别。</p></div></div>
              <div class="step"><span class="step-num">V</span><div><h4>V2Ray / Shadowrocket</h4><p>使用自动链接或 <span class="code-inline">/base64</span> 链接，Base64 节点列表可直接导入。</p></div></div>
            </div>
          </div>
          <div class="card settings-section danger-zone">
            <h2>安全提示</h2>
            <div class="desc">面板已启用登录认证，订阅链接 <span class="code-inline">/sub/&lt;token&gt;</span> 仍使用令牌。不要把服务端口直接暴露到公网；如需远程访问，建议用反向代理加上 HTTPS 与访问控制。</div>
          </div>
        </div>
      </div>
    </section>`;
}

function bindSettings() {
  const form = $('#settings-form');
  const templateInput = $('#setting-template');
  const preview = $('#template-preview');
  templateInput?.addEventListener('input', () => {
    if (preview) preview.textContent = sampleName(templateInput.value);
  });
  $$('[data-template-token]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!templateInput) return;
      const token = btn.dataset.templateToken;
      const start = templateInput.selectionStart ?? templateInput.value.length;
      const end = templateInput.selectionEnd ?? templateInput.value.length;
      templateInput.value = templateInput.value.slice(0, start) + token + templateInput.value.slice(end);
      templateInput.focus();
      templateInput.setSelectionRange(start + token.length, start + token.length);
      if (preview) preview.textContent = sampleName(templateInput.value);
    });
  });
  $$('[data-latency-quick]').forEach((btn) => btn.addEventListener('click', () => {
    const input = $('#setting-latency-interval');
    if (input) input.value = btn.dataset.latencyQuick;
  }));
  const siteRows = $('#site-rows');
  $('[data-add-site]')?.addEventListener('click', () => {
    if (!siteRows) return;
    const id = `custom_${Math.random().toString(36).slice(2, 8)}`;
    siteRows.insertAdjacentHTML('beforeend', siteSettingRow({ id, name: '', short: '', url: 'https://', enabled: true }));
    hydrateIcons(siteRows);
  });
  siteRows?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-remove-site]');
    if (!btn) return;
    btn.closest('.site-row')?.remove();
  });
  const importInput = $('#import-file');
  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    if (file.size > 24 * 1024 * 1024) {
      toast('备份文件超过 24MB', 'error');
      importInput.value = '';
      return;
    }
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const ok = await confirmDialog({
        title: '导入完整备份？',
        message: '这会覆盖当前订阅源、节点、输出订阅和设置。建议先导出当前备份。',
        confirmText: '覆盖并导入',
        danger: true,
      });
      if (!ok) return;
      await api('/api/import', { method: 'POST', body: JSON.stringify({ data }) });
      await refreshState(false);
      render();
      toast('备份已导入', 'success');
    } catch (err) {
      toast(`导入失败：${err.message}`, 'error', 7000);
    } finally {
      importInput.value = '';
    }
  });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const sites = $$('.site-row').map((row) => ({
      id: row.dataset.siteId,
      enabled: row.querySelector('.site-enabled')?.checked !== false,
      name: String(row.querySelector('.site-name')?.value || '').trim(),
      short: String(row.querySelector('.site-short')?.value || '').trim(),
      url: String(row.querySelector('.site-url')?.value || '').trim(),
    })).filter((site) => site.name && site.url);
    const payload = {
      testUrl: String(fd.get('testUrl') || ''),
      defaultInterval: Number(fd.get('defaultInterval')) || 360,
      qualityTTLHours: Number(fd.get('qualityTTLHours')) || 168,
      proxycheckKey: String(fd.get('proxycheckKey') || '').trim(),
      proxycheckPerDay: Number(fd.get('proxycheckPerDay')) || 0,
      requestTimeoutMs: Number(fd.get('requestTimeoutMs')) || 25000,
      connectTimeoutMs: Number(fd.get('connectTimeoutMs')) || 5000,
      maxNodesPerSource: Number(fd.get('maxNodesPerSource')) || 3000,
      userAgent: String(fd.get('userAgent') || ''),
      renameTemplate: String(fd.get('renameTemplate') || ''),
      autoRefresh: fd.get('autoRefresh') === 'on',
      autoQuality: fd.get('autoQuality') === 'on',
      autoConnect: fd.get('autoConnect') === 'on',
      autoSite: fd.get('autoSite') === 'on',
      latencyAuto: fd.get('latencyAuto') === 'on',
      latencyIntervalMinutes: Number(fd.get('latencyIntervalMinutes')) || 60,
      connectConcurrency: Number(fd.get('connectConcurrency')) || 40,
      fetchProxy: String(fd.get('fetchProxy') || '').trim(),
      chinaProbeUrl: String(fd.get('chinaProbeUrl') || '').trim(),
      chinaProbeToken: String(fd.get('chinaProbeToken') || '').trim(),
      chinaProbeTimeoutMs: Number(fd.get('chinaProbeTimeoutMs')) || 5000,
      chinaProbeTestUrl: String(fd.get('chinaProbeTestUrl') || '').trim(),
      chinaProbeReverseUrl: String(fd.get('chinaProbeReverseUrl') || '').trim(),
      excludeDepleted: fd.get('excludeDepleted') === 'on',
      mihomoPath: String(fd.get('mihomoPath') || '').trim(),
      subBaseUrl: String(fd.get('subBaseUrl') || '').trim(),
      sites,
      routing: {
        domesticDirect: fd.get('domesticDirect') === 'on',
        smartProxy: fd.get('smartProxy') === 'on',
        blockAds: fd.get('blockAds') === 'on',
        customRuleList: collectRules($('#settings-rule-builder')),
        customRules: '',
      },
    };
    const submit = form.querySelector('button[type="submit"]');
    setBusy(submit, true);
    try {
      await api('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
      await refreshState(false);
      render();
      toast('设置已保存', 'success');
    } catch (err) {
      toast(err.message, 'error', 6500);
    } finally {
      setBusy(submit, false);
    }
  });
}

/* ------------------------- routing / refresh ------------------------- */

function render(options = {}) {
  if (!App.state) return;
  const app = $('#app');
  if (!app) return;
  app.classList.toggle('quiet', Boolean(options.quiet));
  let html = '';
  if (App.view === 'sources') html = renderSources();
  else if (App.view === 'nodes') html = renderNodes();
  else if (App.view === 'tasks') html = renderTasks();
  else if (App.view === 'profiles') html = renderProfiles();
  else if (App.view === 'settings') html = renderSettings();
  else html = renderOverview();
  app.innerHTML = html;
  hydrateIcons(app);
  updateChrome();
  if (App.view === 'settings') bindSettings();
  refreshAllRuleBuilders();
  restoreNodeSearchFocus();
  restoreSourceSearchFocus();
}

function checkAssetsStale(data) {
  if (!data?.meta?.assetsStale || App.staleWarned) return;
  App.staleWarned = true;
  toast('前端文件比服务进程新：代码已更新但服务没重启，新接口会报 404。请执行 docker compose restart app（裸机则重启 node 进程）', 'error', 15000);
}

async function refreshState(shouldRender = true) {
  const data = await api('/api/state');
  App.state = data;
  checkAssetsStale(data);
  updateChrome();
  if (shouldRender && !App.modalOpen && !App.drawer) render();
  return data;
}

async function onRoute(options = {}) {
  App.view = currentViewFromHash();
  closeMobile();
  if (!options.keepScroll) window.scrollTo({ top: 0, behavior: 'auto' });
  if (App.view === 'nodes') {
    if (!options.keepNodeData) {
      App.nodeData = null;
      App.selected.clear();
    }
    await loadNodes();
  }
  render();
}

function schedulePoll(delay = 12000) {
  clearTimeout(App.pollTimer);
  App.pollTimer = setTimeout(poll, delay);
}

async function poll() {
  if (document.hidden) {
    schedulePoll(15000);
    return;
  }
  const prevJob = App.state?.job;
  const prevSiteJob = App.state?.siteJob;
  const prevChinaJob = App.state?.chinaJob;
  const prevView = App.view;
  try {
    const data = await api('/api/state');
    App.state = data;
    checkAssetsStale(data);
    updateChrome();
    const anyRefreshing = data.sources.some((s) => s.status === 'refreshing');
    const running = Boolean(data.job?.running) || Boolean(data.siteJob?.running) || Boolean(data.chinaJob?.running) || anyRefreshing || App.refreshingAll;
    const refreshJustFinished = App.wasRefreshing && !anyRefreshing;
    App.wasRefreshing = anyRefreshing;
    if (App.refreshingAll && !anyRefreshing && Date.now() - (App.refreshAllAt || 0) > 2800) {
      App.refreshingAll = false;
    }
    if (App.modalOpen || App.drawer) {
      schedulePoll(running ? 2200 : 12000);
      return;
    }
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (typing) {
      schedulePoll(running ? 2200 : 12000);
      return;
    }
    if (App.view === 'nodes') {
      if (data.job?.running || data.siteJob?.running || data.chinaJob?.running) updateJobSlot();
      if ((prevJob?.running && !data.job?.running) || (prevSiteJob?.running && !data.siteJob?.running) || (prevChinaJob?.running && !data.chinaJob?.running) || refreshJustFinished) {
        await loadNodes();
        render({ quiet: true });
      } else if (prevView !== 'nodes') {
        render({ quiet: true });
      }
    } else if (App.view !== 'settings') {
      render({ quiet: true });
    }
    schedulePoll(running ? 2400 : 12000);
  } catch (err) {
    console.warn('轮询失败', err);
    updateChromeOffline();
    schedulePoll(8000);
  }
}

function updateJobSlot() {
  const slot = $('#job-slot');
  if (!slot) return;
  slot.innerHTML = jobBanner();
  hydrateIcons(slot);
}

function updateChromeOffline() {
  const top = $('#top-status');
  if (top) top.innerHTML = `<span class="status-dot is-error"></span><span>连接中断</span>`;
  const side = $('#side-status-text');
  if (side) side.textContent = '连接中断';
}

function restoreSourceSearchFocus() {
  if (!App.focusSourceSearch) return;
  App.focusSourceSearch = false;
  requestAnimationFrame(() => {
    const input = $('#source-search');
    if (input) {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  });
}

function renderFatal(error) {
  const app = $('#app');
  if (!app) return;
  app.innerHTML = `
    <section class="view">
      ${pageHead('CONNECTION', '无法载入面板', '前端无法连接 SubFlux 服务，请检查服务是否仍在运行。')}
      <div class="card"><div class="empty" style="padding:60px 24px">
        <div class="empty-art">${ico('alert')}</div>
        <h3>连接失败</h3>
        <p>${esc(error?.message || '请求失败')}</p>
        <button class="btn btn-primary" data-action="retry-boot">${ico('refresh')}<span>重新连接</span></button>
      </div></div>
    </section>`;
  hydrateIcons(app);
}

/* ------------------------- global actions ------------------------- */

function currentSource(id) {
  return App.state?.sources.find((s) => s.id === id);
}

function currentProfile(id) {
  return App.state?.profiles.find((p) => p.id === id);
}

async function refreshOneSource(id, button = null) {
  const source = currentSource(id);
  if (!source) return;
  setBusy(button, true);
  try {
    const data = await api(`/api/sources/${encodeURIComponent(id)}/refresh`, { method: 'POST' });
    await refreshState(false);
    if (App.view === 'sources' || App.view === 'overview') render();
    if (data.result?.ok) toast(`${source.name} 已刷新：${data.result.nodeCount} 个节点`, 'success');
    else toast(`${source.name} 刷新失败：${data.result?.error || '未知错误'}`, 'error', 7000);
  } catch (err) {
    await refreshState(false).catch(() => {});
    if (App.view === 'sources' || App.view === 'overview') render();
    toast(`${source.name} 刷新失败：${err.message}`, 'error', 7000);
  } finally {
    setBusy(button, false);
  }
}

async function deleteSource(id) {
  const source = currentSource(id);
  if (!source) return;
  const ok = await confirmDialog({
    title: '删除订阅源？',
    message: `「${source.name}」及其 ${source.nodeCount || 0} 个节点会被移除，输出订阅中引用该来源的筛选也会同步清理。`,
    confirmText: '删除订阅源',
    danger: true,
  });
  if (!ok) return;
  try {
    await api(`/api/sources/${encodeURIComponent(id)}`, { method: 'DELETE' });
    App.selected.clear();
    await refreshState(false);
    if (App.view === 'sources' || App.view === 'overview') render();
    toast('订阅源已删除', 'success');
  } catch (err) {
    toast(err.message, 'error', 6000);
  }
}

async function deleteProfile(id) {
  const profile = currentProfile(id);
  if (!profile) return;
  const ok = await confirmDialog({
    title: '删除输出订阅？',
    message: `「${profile.name}」的订阅链接会立即失效，节点池与订阅源不会受影响。`,
    confirmText: '删除输出',
    danger: true,
  });
  if (!ok) return;
  try {
    await api(`/api/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await refreshState(false);
    if (App.view === 'profiles') render();
    toast('输出订阅已删除', 'success');
  } catch (err) {
    toast(err.message, 'error', 6000);
  }
}

async function pushProfileNow(id) {
  const profile = currentProfile(id);
  if (!profile) return;
  if (!profile.push?.targets?.length) return toast('这个订阅还没有配置推送目标，请先编辑添加', 'warn');
  try {
    const data = await api(`/api/profiles/${encodeURIComponent(id)}/push`, { method: 'POST' });
    await refreshState(false);
    const okCount = (data.results || []).filter((item) => item.ok).length;
    const total = (data.results || []).length;
    if (data.ok) return toast(`推送完成：${okCount}/${total} 个目标成功`, 'success');
    const failed = (data.results || []).filter((item) => !item.ok).map((item) => `${item.label}：${item.error}`).join('；');
    toast(`部分推送失败：${failed || '未知错误'}`, 'error', 8000);
  } catch (err) {
    toast(err.message, 'error', 7000);
  }
}

async function rotateProfile(id) {
  const profile = currentProfile(id);
  if (!profile) return;
  const ok = await confirmDialog({
    title: '轮换订阅令牌？',
    message: '旧链接会立即失效。已经导入旧链接的客户端需要重新添加新链接。',
    confirmText: '生成新令牌',
    danger: true,
  });
  if (!ok) return;
  try {
    const data = await api(`/api/profiles/${encodeURIComponent(id)}/rotate`, { method: 'POST' });
    await refreshState(false);
    if (App.view === 'profiles') render();
    toast('订阅令牌已轮换', 'success');
    if (App.drawer?.profileId === id) closeDrawer();
  } catch (err) {
    toast(err.message, 'error', 6000);
  }
}

async function toggleNode(id) {
  const node = App.nodeData?.items.find((n) => n.id === id);
  if (!node) return;
  try {
    await api(`/api/nodes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ disabled: !node.disabled }),
    });
    await refreshState(false);
    await loadNodes();
    if (App.view === 'nodes') render();
    toast(node.disabled ? '节点已启用' : '节点已停用', 'success');
  } catch (err) {
    toast(err.message, 'error', 6000);
  }
}

async function exportSources() {
  try {
    const res = await fetch('/api/sources/export', { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`导出失败（${res.status}）`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subflux-sources-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`已导出 ${App.state.stats.sources.total} 个订阅源`, 'success');
  } catch (err) {
    toast(err.message, 'error', 6000);
  }
}

function openImportSourcesModal() {
  openModal({
    title: '导入订阅源',
    subtitle: '合并导入，不会覆盖现有订阅源',
    size: 'md',
    content: `
      <form id="sources-import-form" autocomplete="off">
        <div class="field">
          <label>选择导出文件</label>
          <input class="input" type="file" id="sources-import-file" accept="application/json,.json">
        </div>
        <div class="field">
          <label for="sources-import-text">或者直接粘贴 JSON</label>
          <textarea class="textarea" id="sources-import-text" rows="8" placeholder='{"sources":[{"name":"…","kind":"url","url":"https://…"}]}'></textarea>
          <div class="field-hint">支持本页「导出」生成的文件，也接受纯数组 JSON。相同订阅链接或相同粘贴内容会自动跳过；导入的 URL 源会在后台自动抓取。</div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>取消</button>
          <button type="submit" class="btn btn-primary">${ico('upload')}<span>开始导入</span></button>
        </div>
      </form>`,
  });
  const fileInput = $('#sources-import-file');
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const area = $('#sources-import-text');
      if (area) area.value = text;
      toast(`已读取 ${file.name}`, 'info');
    } catch (err) {
      toast(`读取文件失败：${err.message}`, 'error', 6000);
    }
  });
  $('#sources-import-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const raw = String($('#sources-import-text')?.value || '').trim();
    if (!raw) return toast('请选择文件或粘贴 JSON', 'warn');
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return toast(`JSON 解析失败：${err.message}`, 'error', 6000);
    }
    const list = Array.isArray(data) ? data : Array.isArray(data?.sources) ? data.sources : null;
    if (!list) return toast('JSON 里没有 sources 数组', 'error', 6000);
    const btn = event.submitter;
    if (btn) btn.disabled = true;
    try {
      const result = await api('/api/sources/import', { method: 'POST', body: JSON.stringify({ sources: list }) });
      closeModal();
      await refreshState(false);
      render();
      const parts = [`新增 ${result.imported} 个`];
      if (result.skipped) parts.push(`跳过 ${result.skipped} 个重复`);
      if (result.failed) parts.push(`失败 ${result.failed} 个`);
      toast(`导入完成：${parts.join('，')}`, result.failed ? 'warn' : 'success', 7000);
      if (result.errors?.length) console.warn('导入失败明细', result.errors);
    } catch (err) {
      toast(`导入失败：${err.message}`, 'error', 7000);
      if (btn) btn.disabled = false;
    }
  });
}

async function refreshAllSources() {
  if (App.refreshingAll) return;
  const enabled = App.state.sources.filter((s) => s.enabled).length;
  if (!enabled) return toast('没有已启用的订阅源', 'warn');
  try {
    const data = await api('/api/refresh-all', { method: 'POST' });
    App.refreshingAll = true;
    App.refreshAllAt = Date.now();
    toast(`已开始刷新 ${data.count} 个订阅源`, 'info');
    schedulePoll(1200);
    await refreshState(false);
    if (App.view === 'sources' || App.view === 'overview') render();
  } catch (err) {
    App.refreshingAll = false;
    toast(err.message, 'error', 6000);
  }
}

function resetNodeFilters() {
  App.nodeFilters = {
    q: '', protocol: '', region: '', ipType: '', sourceId: '', site: '', china: '', status: 'usable',
    qualityMin: '', latencyMax: '', alive: '', sort: 'quality',
  };
  App.nodePage = 1;
  App.selected.clear();
  loadNodes().then(render);
}

let nodeSearchTimer = null;
let sourceSearchTimer = null;

function bindGlobalEvents() {
  document.addEventListener('click', (event) => {
    const addRule = event.target.closest('[data-add-rule]');
    if (addRule) {
      addRuleToBuilder(addRule.closest('.rule-builder'));
      return;
    }
    const removeRule = event.target.closest('[data-remove-rule]');
    if (removeRule) {
      const builder = removeRule.closest('.rule-builder');
      removeRule.closest('[data-rule-row]')?.remove();
      refreshRuleBuilder(builder);
    }
  });
  document.addEventListener('click', async (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id;
    const kind = actionEl.dataset.kind;
    if (action === 'toggle-sidebar') {
      event.preventDefault();
      document.body.classList.toggle('sidebar-open');
      return;
    }
    if (action === 'retry-boot') {
      try {
        await refreshState(false);
        await onRoute();
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }
    if (action === 'refresh-all') return refreshAllSources();
    if (action === 'test-china-link') return checkChinaLink(actionEl);
    if (action === 'test-proxy') {
      const url = String($('#setting-fetch-proxy')?.value || '').trim();
      if (!url) return toast('请先填写代理地址', 'warn');
      setBusy(actionEl, true);
      try {
        const result = await api('/api/proxy/test', { method: 'POST', body: JSON.stringify({ url }) });
        toast(`代理连接正常 · ${result.status} · ${result.latency}ms`, 'success');
      } catch (err) {
        toast(err.message, 'error', 7000);
      } finally {
        setBusy(actionEl, false);
      }
      return;
    }
    if (action === 'add-source') return openSourceModal();
    if (action === 'export-sources') return exportSources();
    if (action === 'import-sources') return openImportSourcesModal();
    if (action === 'clear-source-search') {
      App.sourceQuery = '';
      render();
      return;
    }
    if (action === 'refresh-source') return refreshOneSource(id, actionEl);
    if (action === 'edit-source') return openSourceModal(currentSource(id));
    if (action === 'delete-source') return deleteSource(id);
    if (action === 'preview-source') return openSourcePreview(id);
    if (action === 'add-profile') return openProfileModal();
    if (action === 'copy-profile') return copyProfile(currentProfile(id));
    if (action === 'edit-profile') return openProfileModal(currentProfile(id));
    if (action === 'delete-profile') return deleteProfile(id);
    if (action === 'preview-profile') return openProfilePreview(id);
    if (action === 'show-qr') return showQRCode(id);
    if (action === 'rotate-profile') return rotateProfile(id);
    if (action === 'push-profile') return pushProfileNow(id);
    if (action === 'copy-profile-link') {
      const profile = currentProfile(id);
      if (!profile) return;
      return copyText(subUrl(profile), '订阅链接已复制');
    }
    if (action === 'test-filter') return startNodeTest();
    if (action === 'test-all') return startNodeTest({ filter: { status: 'all' }, connectOnly: true });
    if (action === 'cancel-task') return cancelTask(kind);
    if (action === 'logout') return doLogout();
    if (action === 'test-china') {
      if (!App.selected.size && !App.state.stats.nodes.total) return toast('没有可检测的节点', 'warn');
      return startChinaTest(App.selected.size ? { ids: [...App.selected] } : {});
    }
    if (action === 'test-sites') {
      if (!App.selected.size && !App.state.stats.nodes.total) return toast('没有可检测的节点', 'warn');
      return startSiteTest(App.selected.size ? { ids: [...App.selected] } : {});
    }
    if (action === 'test-selected') {
      if (!App.selected.size) return toast('还没有选择节点', 'warn');
      return startNodeTest({ ids: [...App.selected] });
    }
    if (action === 'test-node') return startNodeTest({ ids: [id] });
    if (action === 'toggle-node') return toggleNode(id);
    if (action === 'clear-selection') {
      App.selected.clear();
      render();
      return;
    }
    if (action === 'node-page') {
      const page = Number(actionEl.dataset.page);
      if (!Number.isFinite(page)) return;
      await goNodePage(page);
      return;
    }
    if (action === 'reset-node-filters') return resetNodeFilters();
    if (action === 'import-backup') {
      $('#import-file')?.click();
      return;
    }
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (target.matches('.rule-value')) {
      refreshRuleBuilder(target.closest('.rule-builder'));
      return;
    }
    if (target.id === 'source-search') {
      App.sourceQuery = target.value;
      App.focusSourceSearch = true;
      clearTimeout(sourceSearchTimer);
      sourceSearchTimer = setTimeout(render, 220);
      return;
    }
    if (target.matches('[data-node-filter="q"]')) {
      App.nodeFilters.q = target.value;
      App.selected.clear();
      App.focusSearch = true;
      clearTimeout(nodeSearchTimer);
      nodeSearchTimer = setTimeout(async () => {
        App.nodePage = 1;
        await loadNodes();
        render();
      }, 320);
      return;
    }
  });

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (target.matches('.rule-type')) {
      const row = target.closest('[data-rule-row]');
      const type = target.value;
      const meta = RULE_TYPE_META[type];
      const input = row?.querySelector('.rule-value');
      const targetSelect = row?.querySelector('.rule-target');
      if (targetSelect && (type === 'GEOSITE' || type === 'GEOIP') && targetSelect.value === '🚀 节点选择') targetSelect.value = 'DIRECT';
      if (input) {
        if (!meta?.value) input.value = type === 'GEOSITE' ? 'cn' : type === 'GEOIP' ? 'CN' : '';
        else if (['cn', 'CN'].includes(input.value)) input.value = '';
      }
      refreshRuleBuilder(target.closest('.rule-builder'));
      return;
    }
    if (target.matches('.rule-target')) {
      refreshRuleBuilder(target.closest('.rule-builder'));
      return;
    }
    if (target.id === 'select-page') {
      const items = App.nodeData?.items || [];
      for (const item of items) {
        if (target.checked) App.selected.add(item.id);
        else App.selected.delete(item.id);
      }
      render();
      return;
    }
    if (target.matches('[data-node-select]')) {
      if (target.checked) App.selected.add(target.dataset.nodeSelect);
      else App.selected.delete(target.dataset.nodeSelect);
      render();
      return;
    }
    if (target.matches('select[data-node-filter]')) {
      const key = target.dataset.nodeFilter;
      App.nodeFilters[key] = target.value;
      App.nodePage = 1;
      App.selected.clear();
      loadNodes().then(render);
    }
  });

  // 点进页码输入框时全选，直接输入即可覆盖，不用手动删旧数字。
  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.id === 'page-jump-input') target.select();
  });

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.id === 'page-jump-input' && event.key === 'Enter') {
      event.preventDefault();
      const page = Number(target.value);
      if (Number.isFinite(page)) goNodePage(page);
      return;
    }
    if (event.key === 'Escape') {
      if (App.drawer) closeDrawer();
      else if (App.modalOpen) closeModal();
      else closeMobile();
    }
    if ((event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key === 'k')) && !App.modalOpen && !App.drawer) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (App.view === 'nodes') {
        event.preventDefault();
        $('#node-search')?.focus();
      } else if (App.view === 'sources') {
        event.preventDefault();
        $('#source-search')?.focus();
      }
    }
  });

  window.addEventListener('hashchange', () => onRoute().catch((err) => toast(err.message, 'error')));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      schedulePoll(500);
    }
  });
}

async function boot() {
  hydrateIcons();
  bindGlobalEvents();
  try {
    const meRes = await fetch('/api/auth/me', { headers: { accept: 'application/json' } });
    if (meRes.status === 401) {
      window.location.replace('/login');
      return;
    }
    const me = await meRes.json().catch(() => ({}));
    App.csrf = me.csrfToken || '';
    await refreshState(false);
    App.view = currentViewFromHash();
    if (App.view === 'nodes') await loadNodes();
    render();
    schedulePoll(4000);
  } catch (err) {
    renderFatal(err);
    schedulePoll(8000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
