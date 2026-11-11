import dns from 'node:dns/promises';
import net from 'node:net';
import { sleep, clamp, cleanText, flagEmoji, regionName, qualityLabel } from './util.js';

const PROXYCHECK_URL_BUDGET = 180;

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

  proxycheckDaily() {
    const today = new Date().toISOString().slice(0, 10);
    let api = this.store.state.qualityApi;
    if (!api || api.date !== today) {
      api = { date: today, count: 0 };
      this.store.state.qualityApi = api;
    }
    return api;
  }

  async lookupProxycheck(ips, onProgress) {
    const list = [...new Set(ips)].filter((ip) => net.isIP(ip) === 4);
    if (!list.length) return 0;
    const ttl = Number(this.store.state.settings.qualityTTLHours || 168) * 3600 * 1000;
    const missing = list.filter((ip) => {
      const entry = this.store.state.qualityCache[ip];
      return !entry?.pcAt || Date.now() - entry.pcAt > ttl;
    });
    if (!missing.length) return 0;
    const api = this.proxycheckDaily();
    const key = cleanText(this.store.state.settings.proxycheckKey || process.env.PROXYCHECK_KEY || '', 120);
    const dailyLimit = Number(this.store.state.settings.proxycheckPerDay ?? 90);
    if (!Number.isFinite(dailyLimit) || dailyLimit <= 0) return 0;
    const batches = [];
    let current = [];
    let length = 0;
    for (const ip of missing) {
      if (current.length && length + ip.length + 1 > PROXYCHECK_URL_BUDGET) {
        batches.push(current);
        current = [];
        length = 0;
      }
      current.push(ip);
      length += ip.length + 1;
    }
    if (current.length) batches.push(current);
    let done = 0;
    let processed = 0;
    for (let b = 0; b < batches.length; b += 1) {
      const batch = batches[b];
      if (api.count + batch.length > dailyLimit) {
        console.warn(`[quality] proxycheck 今日额度已用完（${api.count}/${dailyLimit}），剩余 IP 下次补全`);
        break;
      }
      const url = `https://proxycheck.io/v2/${batch.join(',')}?vpn=1&risk=1${key ? `&key=${encodeURIComponent(key)}` : ''}`;
      try {
        const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
        api.count += batch.length;
        this.store.touch();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.status !== 'ok') throw new Error(data.message || data.status || '返回异常');
        for (const ip of batch) {
          const entry = this.store.state.qualityCache[ip];
          if (!entry) continue;
          const row = data[ip];
          entry.pc = row ? {
            proxy: row.proxy === 'yes',
            type: cleanText(row.type, 24),
            risk: Number.isFinite(Number(row.risk)) ? Math.round(Number(row.risk)) : null,
            provider: cleanText(row.provider, 80),
          } : null;
          entry.pcAt = Date.now();
          done += 1;
        }
      } catch (err) {
        console.warn('[quality] proxycheck 查询失败:', err.message);
        break;
      }
      processed += batch.length;
      onProgress?.(Math.min(missing.length, processed), missing.length);
      if (b + 1 < batches.length) await sleep(1200);
    }
    return done;
  }

  classify(node, entry) {
    const orgText = `${entry.isp || ''} ${entry.org || ''} ${entry.asname || ''} ${entry.as || ''}`.toLowerCase();
    const isCdn = includesAny(orgText, CDN_WORDS);
    const pc = entry.pc || null;
    const pcType = String(pc?.type || '').toLowerCase();
    const pcProxy = pc?.proxy === true || ['vpn', 'tor', 'socks', 'socks5', 'https', 'http', 'proxy', 'compromised server'].includes(pcType);
    const risk = Number.isFinite(pc?.risk) ? pc.risk : null;
    let ipType = 'unknown';
    if (entry.status !== 'success') ipType = 'unknown';
    else if (isCdn) ipType = 'cdn';
    else if (entry.mobile) ipType = 'mobile';
    else if (entry.hosting || pcType === 'vpn' || pcType === 'tor') ipType = 'dc';
    else if (includesAny(orgText, DC_WORDS)) ipType = 'dc';
    else if (pcType === 'residential') ipType = 'home';
    else if (includesAny(orgText, HOME_WORDS)) ipType = 'home';
    else if (orgText.trim()) ipType = 'business';
    const base = { home: 80, mobile: 72, business: 64, cdn: 52, dc: 58, unknown: 45 }[ipType];
    let score = base;
    if (pcType === 'tor') {
      score = 6;
    } else {
      if (pcType === 'vpn') score -= 12;
      else if (pcProxy) score -= 10;
      if (entry.proxy) score -= 6;
      if (risk != null) {
        if (risk >= 75) score -= 12;
        else if (risk >= 50) score -= 8;
        else if (risk >= 25) score -= 4;
      }
      if (entry.hosting && ipType !== 'mobile') score -= 3;
      if (node.latency != null) {
        if (node.latency <= 60) score += 5;
        else if (node.latency <= 120) score += 2;
        else if (node.latency > 400) score -= 6;
        else if (node.latency > 250) score -= 3;
      }
      if (!pc) score = Math.min(score, 60);
      if (pcProxy || entry.proxy) score = Math.min(score, 50);
      if (ipType === 'dc' || ipType === 'cdn') score = Math.min(score, 72);
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
      qualityRisk: risk,
      qualitySignal: pc ? `${pcType || '未知'}${pcProxy ? ' · 代理' : ''}` : '未查风险',
      risk: {
        proxy: Boolean(entry.proxy),
        hosting: Boolean(entry.hosting),
        mobile: Boolean(entry.mobile),
        vpn: pcType === 'vpn',
        tor: pcType === 'tor',
        risk,
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
    await this.lookupProxycheck([...rows.keys()], options.onProgress);
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
