import dns from 'node:dns/promises';
import net from 'node:net';
import { sleep, clamp, cleanText, flagEmoji, regionName, qualityLabel } from './util.js';

const IP_API_FIELDS = 'status,message,country,countryCode,regionName,city,isp,org,as,asname,mobile,proxy,hosting,query';
const DC_WORDS = [
  'amazon', 'aws', 'google', 'microsoft', 'azure', 'oracle', 'digitalocean', 'vultr', 'linode',
  'hetzner', 'ovh', 'contabo', 'leaseweb', 'm247', 'psychz', 'colocrossing', 'quadranet', 'choopa',
  'gcore', 'alibaba', 'aliyun', 'tencent', 'huawei', 'ucloud', 'kingsoft', 'baidu', 'cloudflare',
  'fastly', 'cloudfront', 'akamai', 'cdn', 'data center', 'datacenter', 'data centre', 'hosting',
  'server', 'vps', 'idc', 'colocation', 'equinix', 'digital realty', 'iron mountain', 'serverhub',
  'hostwinds', 'hostinger', 'ionos', 'rackspace', 'upcloud', 'scaleway', 'kamatera', 'layerstack',
  'cloudsigma', 'cherry servers', 'mullvad', 'vpn', 'proxy', 'northflank', 'fly.io', 'railway',
];
const CDN_WORDS = ['cloudflare', 'akamai', 'fastly', 'cloudfront', 'edgecast', 'stackpath', 'bunny', 'cdn77', 'imperva', 'sucuri'];
const HOME_WORDS = [
  'broadband', 'cable', 'fiber', 'fibre', 'residential', 'telecom', 'unicom', 'mobile', 'cellular',
  'wireless', 'comcast', 'charter', 'spectrum', 'verizon', 'at&t', 'cox', 'centurylink', 'frontier',
  'bt ', 'sky broadband', 'virgin media', 'vodafone', 'orange', 'sfr', 'telefonica', 'movistar',
  'kddi', 'ntt', 'softbank', 'hinet', 'chinanet', 'cnc', 'cmi', 't-mobile', 'deutsche telekom',
  'telstra', 'optus', 'rogers', 'bell canada', 'telus', 'shaw', 'swisscom', 'proximus', 'kpn',
  'ziggo', 'telenor', 'telia', 'elisa', 'mail.ru', 'beeline', 'megafon', 'mts', 'rostelecom',
];

function includesAny(haystack, words) {
  return words.some((w) => haystack.includes(w));
}

function extractAsn(entry) {
  const as = String(entry.as || '');
  const m = as.match(/^AS(\d+)/i);
  if (m) return `AS${m[1]}`;
  if (entry.asn) return `AS${entry.asn}`;
  return '';
}

export class QualityService {
  constructor(store) {
    this.store = store;
    this.dnsCache = new Map();
    this.lookups = 0;
  }

  async resolveHost(host) {
    const value = String(host || '').replace(/^\[|\]$/g, '');
    if (!value) return null;
    if (net.isIP(value)) return value;
    const cached = this.dnsCache.get(value);
    if (cached && Date.now() - cached.at < 30 * 60 * 1000) return cached.ip;
    let ip = null;
    try {
      const list = await dns.resolve4(value);
      ip = list[0] || null;
    } catch {
      try {
        const looked = await dns.lookup(value, { family: 0 });
        ip = looked?.address || null;
      } catch {
        ip = null;
      }
    }
    this.dnsCache.set(value, { ip, at: Date.now() });
    if (this.dnsCache.size > 5000) this.dnsCache.clear();
    return ip;
  }

  cacheFresh(entry) {
    if (!entry?.fetchedAt) return false;
    const ttl = entry.status === 'success'
      ? Number(this.store.state.settings.qualityTTLHours || 168) * 3600 * 1000
      : 60 * 60 * 1000;
    return Date.now() - entry.fetchedAt < ttl;
  }

  async fetchBatch(ips) {
    const endpoint = `http://ip-api.com/batch?fields=${IP_API_FIELDS}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(ips),
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) throw new Error(`ip-api HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('ip-api 返回格式异常');
    return data;
  }

  async fetchWhois(ip) {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`ipwho HTTP ${res.status}`);
    const j = await res.json();
    if (!j?.success) throw new Error(j?.message || 'ipwho 查询失败');
    return {
      status: 'success',
      country: j.country || '',
      countryCode: j.country_code || '',
      regionName: j.region || '',
      city: j.city || '',
      isp: j.connection?.isp || '',
      org: j.connection?.org || '',
      as: j.connection?.asn ? `AS${j.connection.asn}` : '',
      asname: j.connection?.org || '',
      mobile: false,
      proxy: Boolean(j.security?.proxy || j.security?.vpn || j.security?.tor),
      hosting: false,
      query: ip,
    };
  }

  async lookupIps(ips, onProgress) {
    const result = new Map();
    const missing = [];
    for (const ip of ips) {
      const entry = this.store.state.qualityCache[ip];
      if (entry && this.cacheFresh(entry)) result.set(ip, entry);
      else missing.push(ip);
    }
    if (!missing.length) return result;

    const max = Math.min(missing.length, 600);
    const limited = missing.slice(0, max);
    let apiOk = true;

    for (let i = 0; i < limited.length; i += 100) {
      const batch = limited.slice(i, i + 100);
      try {
        const rows = await this.fetchBatch(batch);
        for (const row of rows) {
          const ip = row.query;
          if (!ip) continue;
          const safe = row.status === 'success'
            ? { ...row, fetchedAt: Date.now() }
            : { status: 'fail', message: row.message || '查询失败', query: ip, fetchedAt: Date.now() };
          this.store.state.qualityCache[ip] = safe;
          result.set(ip, safe);
        }
      } catch (err) {
        apiOk = false;
        console.warn('[quality] ip-api 失败，尝试 ipwho.is:', err.message);
        break;
      }
      onProgress?.(Math.min(limited.length, i + batch.length), limited.length);
      if (i + 100 < limited.length) await sleep(1400);
    }

    if (!apiOk) {
      const fallback = limited.slice(0, 24);
      for (const ip of fallback) {
        try {
          const row = await this.fetchWhois(ip);
          const safe = { ...row, fetchedAt: Date.now() };
          this.store.state.qualityCache[ip] = safe;
          result.set(ip, safe);
        } catch {
          this.store.state.qualityCache[ip] = { status: 'fail', message: 'IP 情报查询失败', query: ip, fetchedAt: Date.now() };
        }
        onProgress?.(fallback.indexOf(ip) + 1, fallback.length);
        await sleep(180);
      }
    }

    if (missing.length > max) {
      console.warn(`[quality] 单次最多查询 ${max} 个新 IP，剩余 ${missing.length - max} 个将在下次补全`);
    }
    this.store.pruneQualityCache();
    this.store.touch();
    return result;
  }

  classify(node, entry) {
    const orgText = `${entry.isp || ''} ${entry.org || ''} ${entry.asname || ''} ${entry.as || ''}`.toLowerCase();
    const isCdn = includesAny(orgText, CDN_WORDS);
    let ipType = 'unknown';
    if (entry.status !== 'success') ipType = 'unknown';
    else if (isCdn) ipType = 'cdn';
    else if (entry.mobile) ipType = 'mobile';
    else if (entry.hosting) ipType = 'dc';
    else if (includesAny(orgText, DC_WORDS)) ipType = 'dc';
    else if (includesAny(orgText, HOME_WORDS)) ipType = 'home';
    else if (orgText.trim()) ipType = 'business';

    const base = { home: 86, mobile: 77, business: 63, cdn: 56, dc: 40, unknown: 50 }[ipType];
    let score = base;
    if (entry.proxy) score -= 24;
    if (/vpn|proxy|tor exit|tor-exit/.test(orgText)) score -= 10;
    if (ipType === 'cdn') score -= 3;
    if (node.latency != null) {
      if (node.latency <= 60) score += 12;
      else if (node.latency <= 100) score += 8;
      else if (node.latency <= 180) score += 4;
      else if (node.latency <= 300) score -= 2;
      else if (node.latency <= 500) score -= 7;
      else score -= 14;
    }
    const cc = cleanText(entry.countryCode, 2).toUpperCase();
    return {
      ip: cleanText(entry.query || node.ip, 64),
      countryCode: cc,
      country: cleanText(entry.country, 60),
      region: regionName(cc, entry.country),
      flag: flagEmoji(cc),
      city: cleanText(entry.city || entry.regionName, 60),
      isp: cleanText(entry.isp || entry.org, 80),
      org: cleanText(entry.org, 80),
      asn: extractAsn(entry),
      asname: cleanText(entry.asname, 80),
      ipType,
      qualityScore: clamp(Math.round(score), 1, 99),
      qualityLabel: qualityLabel(clamp(Math.round(score), 1, 99)),
      risk: {
        proxy: Boolean(entry.proxy),
        hosting: Boolean(entry.hosting),
        mobile: Boolean(entry.mobile),
      },
      qualityAt: new Date().toISOString(),
    };
  }

  async enrich(nodes, options = {}) {
    const list = nodes.filter(Boolean);
    if (!list.length) return { updated: 0, lookedUp: 0, resolved: 0 };
    const hostToIp = new Map();
    const concurrency = 8;
    let cursor = 0;
    const worker = async () => {
      while (cursor < list.length) {
        const node = list[cursor++];
        const ip = await this.resolveHost(node.server);
        if (ip) hostToIp.set(node.id, ip);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));

    for (const node of list) {
      if (hostToIp.get(node.id)) node.ip = hostToIp.get(node.id);
    }
    const uniqueIps = [...new Set([...hostToIp.values()])];
    const rows = await this.lookupIps(uniqueIps, options.onProgress);
    let updated = 0;
    for (const node of list) {
      const ip = hostToIp.get(node.id);
      const entry = ip ? rows.get(ip) : null;
      if (!entry || entry.status !== 'success') {
        const dnsFailed = !ip;
        node.ipType = 'unknown';
        node.qualityScore = null;
        node.qualityLabel = '待测';
        node.qualityNote = dnsFailed ? 'DNS 解析失败' : (entry?.message || 'IP 情报不可用');
        node.qualityAt = new Date().toISOString();
        continue;
      }
      Object.assign(node, this.classify(node, entry));
      node.qualityNote = '';
      updated += 1;
    }
    this.store.touch();
    return { updated, lookedUp: uniqueIps.length, resolved: hostToIp.size };
  }
}
