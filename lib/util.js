import crypto from 'node:crypto';

export function uid(bytes = 12) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha1(input) {
  return crypto.createHash('sha1').update(String(input)).digest('hex');
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function safeInt(value, fallback = 0, min = -Infinity, max = Infinity) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, min, max);
}

export function asBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

export function isHttpUrl(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function cleanText(value, max = 200) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function tryBase64(value) {
  let s = String(value ?? '').replace(/\s+/g, '');
  if (s.length < 4 || s.length > 32 * 1024 * 1024) return null;
  if (!/^[A-Za-z0-9+/_=-]+$/.test(s)) return null;
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad === 1) return null;
  if (pad) s += '='.repeat(4 - pad);
  try {
    const buf = Buffer.from(s, 'base64');
    if (!buf.length) return null;
    const text = buf.toString('utf8');
    if (text.includes('\uFFFD')) return null;
    return text;
  } catch {
    return null;
  }
}

export function b64encode(value) {
  return Buffer.from(String(value ?? ''), 'utf8').toString('base64');
}

export function decodeComponent(value) {
  try {
    return decodeURIComponent(String(value ?? ''));
  } catch {
    return String(value ?? '');
  }
}

export function parseQuery(queryString) {
  const out = Object.create(null);
  try {
    const params = new URLSearchParams(queryString || '');
    for (const [k, v] of params) out[k] = v;
  } catch {
    // Ignore malformed query strings.
  }
  return out;
}

export function splitHostPort(value) {
  let s = String(value ?? '').trim();
  if (!s) return null;
  if (s.startsWith('[')) {
    const end = s.indexOf(']');
    if (end < 0) return null;
    const host = s.slice(1, end);
    let port = 0;
    if (s[end + 1] === ':') port = safeInt(s.slice(end + 2), 0, 0, 65535);
    return host ? { host, port } : null;
  }
  const idx = s.lastIndexOf(':');
  if (idx < 0) return { host: s, port: 0 };
  const host = s.slice(0, idx);
  const port = safeInt(s.slice(idx + 1), 0, 0, 65535);
  return host ? { host, port } : null;
}

export function parseTrafficHeader(raw) {
  if (!raw) return null;
  let text = String(raw).trim();
  if (!text) return null;
  try {
    if (/%[0-9a-f]{2}/i.test(text)) text = decodeURIComponent(text);
  } catch {
    // Keep the original header when decoding fails.
  }
  const out = {};
  for (const part of text.split(/[;&]/)) {
    const m = part.trim().match(/^([a-zA-Z][\w-]*)\s*=\s*([^;&\s]*)/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (['upload', 'download', 'total', 'expire'].includes(key)) {
      out[key] = safeInt(m[2], 0, 0, Number.MAX_SAFE_INTEGER);
    }
  }
  if (!('upload' in out) && !('download' in out) && !('total' in out) && !('expire' in out)) {
    return null;
  }
  return {
    upload: out.upload || 0,
    download: out.download || 0,
    total: out.total || 0,
    expire: out.expire || 0,
  };
}

const REGION_NAMES = {
  AD: '安道尔', AE: '阿联酋', AF: '阿富汗', AL: '阿尔巴尼亚', AM: '亚美尼亚', AO: '安哥拉',
  AR: '阿根廷', AT: '奥地利', AU: '澳大利亚', AZ: '阿塞拜疆', BA: '波黑', BD: '孟加拉国',
  BE: '比利时', BG: '保加利亚', BH: '巴林', BO: '玻利维亚', BR: '巴西', BY: '白俄罗斯',
  CA: '加拿大', CH: '瑞士', CL: '智利', CN: '中国大陆', CO: '哥伦比亚', CR: '哥斯达黎加',
  CU: '古巴', CY: '塞浦路斯', CZ: '捷克', DE: '德国', DK: '丹麦', DO: '多米尼加',
  DZ: '阿尔及利亚', EC: '厄瓜多尔', EE: '爱沙尼亚', EG: '埃及', ES: '西班牙', ET: '埃塞俄比亚',
  FI: '芬兰', FR: '法国', GB: '英国', GE: '格鲁吉亚', GH: '加纳', GR: '希腊',
  GT: '危地马拉', HK: '中国香港', HN: '洪都拉斯', HR: '克罗地亚', HU: '匈牙利', ID: '印度尼西亚',
  IE: '爱尔兰', IL: '以色列', IN: '印度', IQ: '伊拉克', IR: '伊朗', IS: '冰岛',
  IT: '意大利', JM: '牙买加', JO: '约旦', JP: '日本', KE: '肯尼亚', KG: '吉尔吉斯斯坦',
  KH: '柬埔寨', KR: '韩国', KW: '科威特', KZ: '哈萨克斯坦', LA: '老挝', LB: '黎巴嫩',
  LK: '斯里兰卡', LT: '立陶宛', LU: '卢森堡', LV: '拉脱维亚', LY: '利比亚', MA: '摩洛哥',
  MD: '摩尔多瓦', ME: '黑山', MG: '马达加斯加', MK: '北马其顿', MM: '缅甸', MN: '蒙古',
  MO: '中国澳门', MT: '马耳他', MU: '毛里求斯', MV: '马尔代夫', MX: '墨西哥', MY: '马来西亚',
  MZ: '莫桑比克', NG: '尼日利亚', NL: '荷兰', NO: '挪威', NP: '尼泊尔', NZ: '新西兰',
  OM: '阿曼', PA: '巴拿马', PE: '秘鲁', PH: '菲律宾', PK: '巴基斯坦', PL: '波兰',
  PR: '波多黎各', PT: '葡萄牙', PY: '巴拉圭', QA: '卡塔尔', RO: '罗马尼亚', RS: '塞尔维亚',
  RU: '俄罗斯', SA: '沙特阿拉伯', SC: '塞舌尔', SD: '苏丹', SE: '瑞典', SG: '新加坡',
  SI: '斯洛文尼亚', SK: '斯洛伐克', SN: '塞内加尔', SO: '索马里', SY: '叙利亚', TH: '泰国',
  TJ: '塔吉克斯坦', TM: '土库曼斯坦', TN: '突尼斯', TR: '土耳其', TT: '特立尼达和多巴哥',
  TW: '中国台湾', TZ: '坦桑尼亚', UA: '乌克兰', UG: '乌干达', US: '美国', UY: '乌拉圭',
  UZ: '乌兹别克斯坦', VE: '委内瑞拉', VN: '越南', YE: '也门', ZA: '南非', ZM: '赞比亚',
  ZW: '津巴布韦', XK: '科索沃', AQ: '南极洲', BZ: '伯利兹', GM: '冈比亚', GI: '直布罗陀',
};

export function regionName(cc, fallback = '') {
  const code = String(cc || '').toUpperCase();
  return REGION_NAMES[code] || cleanText(fallback, 40) || (code ? code : '未知');
}

export function flagEmoji(cc) {
  const code = String(cc || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '🌐';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export const IP_TYPE_LABELS = {
  home: '家宽',
  dc: '机房',
  mobile: '移动',
  business: '企业',
  cdn: 'CDN',
  unknown: '未知',
};

export function qualityLabel(score) {
  if (!Number.isFinite(score) || score <= 0) return '待测';
  if (score >= 82) return '优质';
  if (score >= 68) return '良好';
  if (score >= 52) return '一般';
  return '较差';
}

export function formatBytes(n) {
  const num = Number(n) || 0;
  if (num <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(num) / Math.log(1024)));
  return `${(num / 1024 ** i).toFixed(i >= 3 ? 2 : i >= 2 ? 1 : 0)} ${units[i]}`;
}

export function errMessage(err) {
  if (!err) return '未知错误';
  if (typeof err === 'string') return err;
  return err.cause?.message || err.message || String(err);
}

export function normalizeSourceUrl(value) {
  const u = new URL(String(value).trim());
  u.hash = '';
  return u.toString();
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function truncate(value, max) {
  const s = String(value ?? '');
  return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)) + '…';
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
