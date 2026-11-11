import YAML from 'yaml';
import { buildUri, nodeFingerprint, protocolSupportedForSingbox } from './uri.js';
import { sourceBlockedReason, trafficInfo } from './traffic.js';
import { certFilterPass } from './tls.js';
import {
  IP_TYPE_LABELS,
  cleanText,
  clamp,
  flagEmoji,
  qualityLabel,
  safeInt,
  truncate,
} from './util.js';

import { GROUP_NAMES } from './constants.js';
import { siteTags, nodeSiteState } from './sites.js';
import { buildClashRules, buildSingboxRoute, routingSummary } from './routing.js';

const RESERVED_NAMES = new Set([
  ...Object.values(GROUP_NAMES), 'DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'GLOBAL', 'COMPATIBLE',
]);

export function normalizeFormat(format) {
  const f = String(format || 'clash').toLowerCase();
  if (['sing-box', 'singbox', 'sing_box'].includes(f)) return 'singbox';
  if (['base64', 'v2ray', 'v2rayn', 'b64'].includes(f)) return 'base64';
  if (['plain', 'uri', 'list'].includes(f)) return 'plain';
  return 'clash';
}

export function contentMeta(format) {
  const f = normalizeFormat(format);
  if (f === 'singbox') return { contentType: 'application/json; charset=utf-8', ext: 'json', label: 'Sing-box' };
  if (f === 'base64') return { contentType: 'text/plain; charset=utf-8', ext: 'txt', label: 'Base64 / V2Ray' };
  if (f === 'plain') return { contentType: 'text/plain; charset=utf-8', ext: 'txt', label: '节点链接' };
  return { contentType: 'text/yaml; charset=utf-8', ext: 'yaml', label: 'Clash / Mihomo' };
}

function compileRegex(pattern) {
  if (!pattern) return null;
  try {
    return new RegExp(pattern, 'i');
  } catch {
    return null;
  }
}

function scoreOf(node) {
  return Number.isFinite(node.qualityScore) ? node.qualityScore : -1;
}

function dedupeNodes(nodes) {
  const best = new Map();
  for (const node of nodes) {
    const fp = node.fingerprint || nodeFingerprint(node);
    const prev = best.get(fp);
    if (!prev) {
      best.set(fp, node);
      continue;
    }
    const prevScore = scoreOf(prev);
    const nextScore = scoreOf(node);
    if (nextScore > prevScore) best.set(fp, node);
    else if (nextScore === prevScore) {
      const prevLat = prev.latency ?? Infinity;
      const nextLat = node.latency ?? Infinity;
      if (nextLat < prevLat) best.set(fp, node);
    }
  }
  return [...best.values()];
}

function sortNodes(nodes, sort) {
  const list = [...nodes];
  if (sort === 'latency') {
    list.sort((a, b) => {
      const al = a.latency ?? Infinity;
      const bl = b.latency ?? Infinity;
      if (al !== bl) return al - bl;
      return scoreOf(b) - scoreOf(a);
    });
  } else if (sort === 'region') {
    list.sort((a, b) => {
      const r = String(a.countryCode || 'ZZ').localeCompare(String(b.countryCode || 'ZZ'));
      if (r) return r;
      return scoreOf(b) - scoreOf(a);
    });
  } else if (sort === 'source') {
    list.sort((a, b) => String(a.sourceName || '').localeCompare(String(b.sourceName || ''), 'zh-CN'));
  } else {
    list.sort((a, b) => {
      const s = scoreOf(b) - scoreOf(a);
      if (s) return s;
      return (a.latency ?? Infinity) - (b.latency ?? Infinity);
    });
  }
  return list;
}

function matchesFilter(node, profile, includeRe, excludeRe, warnings) {
  const f = profile.filters || {};
  const source = node._source;
  const blocked = sourceBlockedReason(source, node._settings);
  if (blocked) return false;
  if (node.disabled) return false;
  if (Array.isArray(f.sourceIds) && f.sourceIds.length && !f.sourceIds.includes(node.sourceId)) return false;
  if (Array.isArray(f.protocols) && f.protocols.length && !f.protocols.includes(node.protocol)) return false;
  if (Array.isArray(f.ipTypes) && f.ipTypes.length && !f.ipTypes.includes(node.ipType || 'unknown')) return false;
  if (Array.isArray(f.regions) && f.regions.length) {
    const key = node.countryCode || 'unknown';
    if (!f.regions.includes(key)) return false;
  }
  if (Array.isArray(f.sites) && f.sites.length) {
    for (const siteId of f.sites) {
      if (nodeSiteState(node, siteId) !== 'ok') return false;
    }
  }
  if (f.china === 'reachable' && node.cnReachable !== true) return false;
  if (f.china === 'blocked' && node.cnReachable !== false) return false;
  if (f.china === 'untested' && (node.cnReachable === true || node.cnReachable === false)) return false;
  if (Number(f.minQuality) > 0 && scoreOf(node) < Number(f.minQuality)) return false;
  if (Number(f.maxLatency) > 0) {
    if (!Number.isFinite(node.latency) || node.latency > Number(f.maxLatency)) return false;
  }
  if (f.onlyAlive && node.alive !== true) return false;
  // 证书不受信的节点在 Mihomo / Clash 里能用，但小火箭等严格校验的客户端
  // 需要手动「允许不安全」，输出订阅可以整体排除或只保留证书可信的。
  if (!certFilterPass(node, f.cert)) return false;
  const haystack = [
    node.name, node.sourceName, node.server, node.isp, node.org, node.region, node.country,
    node.protocol, node.asn, node.ipType, node.ip,
  ].filter(Boolean).join(' ').toLowerCase();
  if (includeRe && !includeRe.test(haystack)) return false;
  if (excludeRe && excludeRe.test(haystack)) return false;
  return true;
}

export function matchNodes(profile, state) {
  const warnings = [];
  if (profile.needsReview) {
    return {
      nodes: [],
      warnings: ['该输出订阅引用的来源已被删除，请编辑并重新保存筛选条件'],
      counts: { matched: 0, deduped: 0, duplicates: 0, emitted: 0 },
    };
  }
  const f = profile.filters || {};
  const includeRe = compileRegex(f.include);
  const excludeRe = compileRegex(f.exclude);
  if (f.include && !includeRe) warnings.push('包含关键词不是合法正则，已忽略');
  if (f.exclude && !excludeRe) warnings.push('排除关键词不是合法正则，已忽略');
  const sourceMap = new Map(state.sources.map((s) => [s.id, s]));
  const context = state.nodes.map((n) => ({
    ...n,
    _source: sourceMap.get(n.sourceId),
    _settings: state.settings,
  }));
  const filtered = context.filter((n) => matchesFilter(n, profile, includeRe, excludeRe, warnings));
  const beforeDedupe = filtered.length;
  const deduped = dedupeNodes(filtered);
  const sorted = sortNodes(deduped, profile.sort || 'quality');
  const perRegion = safeInt(f.maxPerRegion, 0, 0, 500);
  let capped = sorted;
  if (perRegion > 0) {
    const counter = new Map();
    const kept = [];
    for (const node of sorted) {
      const key = node.countryCode || 'unknown';
      const used = counter.get(key) || 0;
      if (used >= perRegion) continue;
      counter.set(key, used + 1);
      kept.push(node);
    }
    if (kept.length < sorted.length) {
      warnings.push(`每个国家/地区最多保留 ${perRegion} 个节点，已去掉 ${sorted.length - kept.length} 个`);
    }
    capped = kept;
  }
  const max = safeInt(f.maxNodes, 500, 0, 20000);
  const limited = max > 0 ? capped.slice(0, max) : capped;
  if (max > 0 && capped.length > max) warnings.push(`匹配 ${capped.length} 个节点，按配置上限保留前 ${max} 个`);
  const nodes = nameNodes(
    limited,
    profile.renameTemplate || state.settings.renameTemplate,
    state.settings.sites || [],
    profile.appendSites !== false,
  );
  return {
    nodes,
    warnings,
    counts: {
      matched: sorted.length,
      deduped: deduped.length,
      duplicates: beforeDedupe - deduped.length,
      emitted: nodes.length,
    },
  };
}

export function nameNodes(nodes, template, siteDefs = [], appendSites = true) {
  const used = new Set();
  return nodes.map((node, index) => {
    const region = node.region || '未知';
    const ipType = IP_TYPE_LABELS[node.ipType] || '未知';
    const score = Number.isFinite(node.qualityScore) ? node.qualityScore : '';
    const qlabel = node.qualityLabel || qualityLabel(node.qualityScore);
    const tags = siteTags(node, siteDefs);
    const values = {
      flag: node.flag || flagEmoji(node.countryCode) || '🌐',
      region,
      country: node.country || '未知',
      cc: node.countryCode || '--',
      type: ipType,
      quality: qlabel,
      score,
      isp: truncate(node.isp || node.org || '未知', 24),
      asn: node.asn || '—',
      protocol: String(node.protocol || '').toUpperCase(),
      source: truncate(node.sourceName || '未知来源', 20),
      name: node.name || '节点',
      sites: tags,
      seq: index + 1,
    };
    let name = cleanText(template || '{name}', 160);
    name = name.replace(/\{seq:(\d+)\}/g, (_, width) => String(values.seq).padStart(clamp(Number(width) || 2, 1, 6), '0'));
    name = name.replace(/\{(\w+)\}/g, (_, key) => (key in values ? String(values[key]) : ''));
    name = name.replace(/\s+/g, ' ').replace(/^[\s|·\-]+|[\s|·\-]+$/g, '').trim();
    if (!name) name = `节点 ${String(values.seq).padStart(2, '0')}`;
    if (appendSites && tags && !String(template || '').includes('{sites}')) name = `${name} [${tags}]`;
    if (RESERVED_NAMES.has(name)) name = `${name} · 节点`;
    name = truncate(name, 80);
    let unique = name;
    let suffix = 2;
    while (used.has(unique)) {
      unique = `${truncate(name, 74)} ·${suffix}`;
      suffix += 1;
    }
    used.add(unique);
    return { ...node, outputName: unique };
  });
}

function groupOptions(profile, settings) {
  const groups = profile.groups || {};
  const url = String(profile.testUrl || settings.testUrl || 'https://www.gstatic.com/generate_204').trim();
  return {
    url: /^https?:\/\//i.test(url) ? url : 'https://www.gstatic.com/generate_204',
    interval: clamp(safeInt(profile.testInterval, 300, 30, 86400), 30, 86400),
    showAuto: groups.auto !== false,
    showFallback: groups.fallback !== false,
    showRegions: groups.regions !== false,
  };
}

export function buildClash(profile, matched, state) {
  const nodes = matched.nodes;
  const opts = groupOptions(profile, state.settings);
  const proxies = nodes.map((node) => {
    const raw = node.raw && typeof node.raw === 'object' ? structuredClone(node.raw) : null;
    if (!raw) return null;
    raw.name = node.outputName;
    return raw;
  }).filter(Boolean);
  const names = proxies.map((p) => p.name);
  const groups = [];

  if (names.length) {
    if (opts.showAuto) {
      groups.push({
        name: GROUP_NAMES.auto,
        type: 'url-test',
        url: opts.url,
        interval: opts.interval,
        tolerance: 50,
        lazy: true,
        proxies: [...names],
      });
    }
    if (opts.showFallback) {
      groups.push({
        name: GROUP_NAMES.fallback,
        type: 'fallback',
        url: opts.url,
        interval: opts.interval,
        lazy: true,
        proxies: [...names],
      });
    }

    let regionSelect = null;
    if (opts.showRegions) {
      const buckets = new Map();
      for (const node of nodes) {
        const key = node.countryCode || 'ZZ';
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(node);
      }
      const regionGroups = [];
      for (const [cc, list] of [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)) {
        if (list.length < 2 || list.length === names.length) continue;
        const label = `${list[0].flag || '🌐'} ${list[0].region || cc}`;
        if (groups.some((g) => g.name === label)) continue;
        groups.push({
          name: label,
          type: 'url-test',
          url: opts.url,
          interval: opts.interval,
          tolerance: 50,
          lazy: true,
          proxies: list.map((n) => n.outputName),
        });
        regionGroups.push(label);
      }
      if (regionGroups.length) {
        groups.push({ name: GROUP_NAMES.regions, type: 'select', proxies: [...regionGroups, 'DIRECT'] });
        regionSelect = GROUP_NAMES.regions;
      }
    }
    // The manual selector is the primary entry. It references the utility groups first.
    const manual = [];
    if (opts.showAuto) manual.push(GROUP_NAMES.auto);
    if (opts.showFallback) manual.push(GROUP_NAMES.fallback);
    if (regionSelect) manual.push(regionSelect);
    manual.push(...names, 'DIRECT');
    groups.push({ name: GROUP_NAMES.manual, type: 'select', proxies: manual });
  } else {
    groups.push({ name: GROUP_NAMES.manual, type: 'select', proxies: ['DIRECT'] });
  }

  const route = buildClashRules(state.settings, profile);
  const config = {
    'mixed-port': 7890,
    'allow-lan': false,
    mode: 'rule',
    'log-level': 'warning',
    ipv6: true,
    'unified-delay': true,
    'tcp-concurrent': true,
    proxies,
    'proxy-groups': groups,
    rules: route.rules,
  };
  const header = [
    '# SubFlux 订阅配置',
    `# 节点 ${nodes.length} 个 · ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`,
    `# 测试地址 ${opts.url}`,
    `# 分流规则 ${route.rules.length} 条 · 自定义 ${route.customCount} 条`,
    '',
  ].join('\n');
  return {
    body: header + YAML.stringify(config, { lineWidth: 0, indent: 2 }),
    warnings: route.warnings,
    emitted: proxies.length,
  };
}

function toMb(value) {
  if (value == null || value === '') return undefined;
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function tlsConfig(raw, force = false) {
  const enabled = force || raw.tls === true || raw.tls === 'tls' || Boolean(raw['reality-opts']);
  if (!enabled) return undefined;
  const tls = { enabled: true };
  const serverName = raw.servername || raw.sni || raw.peer;
  if (serverName) tls.server_name = serverName;
  if (raw['skip-cert-verify']) tls.insecure = true;
  if (Array.isArray(raw.alpn) && raw.alpn.length) tls.alpn = raw.alpn.map(String);
  if (raw['client-fingerprint']) {
    tls.utls = { enabled: true, fingerprint: String(raw['client-fingerprint']) };
  }
  if (raw['reality-opts']) {
    tls.reality = {
      enabled: true,
      ...(raw['reality-opts']['public-key'] ? { public_key: String(raw['reality-opts']['public-key']) } : {}),
      ...(raw['reality-opts']['short-id'] ? { short_id: String(raw['reality-opts']['short-id']) } : {}),
    };
  }
  return tls;
}

function transportConfig(raw) {
  const net = String(raw.network || 'tcp').toLowerCase();
  if (net === 'ws' || net === 'websocket') {
    const opts = raw['ws-opts'] || {};
    const path = Array.isArray(opts.path) ? opts.path[0] : (opts.path || '/');
    const host = opts.headers?.Host || opts.headers?.host || '';
    return {
      type: 'ws',
      path: path || '/',
      ...(host ? { headers: { Host: host } } : {}),
    };
  }
  if (net === 'grpc') {
    return { type: 'grpc', service_name: raw['grpc-opts']?.['grpc-service-name'] || '' };
  }
  if (net === 'h2' || net === 'http') {
    const h2 = raw['h2-opts'] || raw['http-opts'] || {};
    const host = h2.host || h2.headers?.Host;
    const path = h2.path || '/';
    return {
      type: 'http',
      ...(Array.isArray(host) && host.length ? { host } : typeof host === 'string' && host ? { host: [host] } : {}),
      path: Array.isArray(path) ? path[0] : path,
    };
  }
  return null;
}

function ssPlugin(raw) {
  if (!raw.plugin) return {};
  const o = raw['plugin-opts'] || {};
  if (raw.plugin === 'obfs') {
    const parts = [`obfs=${o.mode || 'http'}`];
    if (o.host) parts.push(`obfs-host=${o.host}`);
    return { plugin: 'obfs-local', plugin_opts: parts.join(';') };
  }
  if (raw.plugin === 'v2ray-plugin') {
    const parts = [`mode=${o.mode || 'websocket'}`];
    if (o.host) parts.push(`host=${o.host}`);
    if (o.path) parts.push(`path=${o.path}`);
    if (o.tls) parts.push('tls');
    return { plugin: 'v2ray-plugin', plugin_opts: parts.join(';') };
  }
  if (raw.plugin === 'shadow-tls') {
    const parts = [`host=${o.host || ''}`, `password=${o.password || ''}`];
    if (o.version) parts.push(`version=${o.version}`);
    return { plugin: 'shadow-tls', plugin_opts: parts.join(';') };
  }
  return {};
}

function outboundFor(node) {
  const raw = node.raw;
  if (!raw || !protocolSupportedForSingbox(node.protocol)) return null;
  const tag = node.outputName;
  const base = { tag, server: raw.server, server_port: raw.port };
  if (node.protocol === 'ss') {
    return {
      type: 'shadowsocks',
      ...base,
      method: raw.cipher,
      password: String(raw.password || ''),
      ...ssPlugin(raw),
    };
  }
  if (node.protocol === 'vmess') {
    const transport = transportConfig(raw);
    const tls = tlsConfig(raw);
    return {
      type: 'vmess',
      ...base,
      uuid: raw.uuid,
      security: raw.cipher || 'auto',
      alter_id: safeInt(raw.alterId, 0, 0, 65535),
      ...(transport ? { transport } : {}),
      ...(tls ? { tls } : {}),
    };
  }
  if (node.protocol === 'vless') {
    const transport = transportConfig(raw);
    const tls = tlsConfig(raw);
    return {
      type: 'vless',
      ...base,
      uuid: raw.uuid,
      ...(raw.flow ? { flow: String(raw.flow) } : {}),
      ...(transport ? { transport } : {}),
      ...(tls ? { tls } : {}),
    };
  }
  if (node.protocol === 'trojan') {
    const transport = transportConfig(raw);
    const tls = tlsConfig(raw, true);
    return {
      type: 'trojan',
      ...base,
      password: String(raw.password || ''),
      ...(transport ? { transport } : {}),
      ...(tls ? { tls } : {}),
    };
  }
  if (node.protocol === 'hysteria2') {
    const tls = tlsConfig(raw, true);
    const up = toMb(raw.up);
    const down = toMb(raw.down);
    return {
      type: 'hysteria2',
      ...base,
      password: String(raw.password || ''),
      ...(raw.obfs ? { obfs: { type: String(raw.obfs), password: String(raw['obfs-password'] || '') } } : {}),
      ...(up ? { up_mbps: up } : {}),
      ...(down ? { down_mbps: down } : {}),
      ...(tls ? { tls } : {}),
    };
  }
  if (node.protocol === 'tuic') {
    const tls = tlsConfig(raw, true);
    if (tls && !tls.alpn) tls.alpn = ['h3'];
    return {
      type: 'tuic',
      ...base,
      uuid: raw.uuid,
      ...(raw.password ? { password: String(raw.password) } : {}),
      ...(raw['congestion-controller'] ? { congestion_control: String(raw['congestion-controller']) } : {}),
      ...(raw['udp-relay-mode'] ? { udp_relay_mode: String(raw['udp-relay-mode']) } : {}),
      ...(tls ? { tls } : {}),
    };
  }
  if (node.protocol === 'http') {
    return {
      type: 'http',
      ...base,
      ...(raw.username ? { username: String(raw.username) } : {}),
      ...(raw.password ? { password: String(raw.password) } : {}),
      ...(raw.tls ? { tls: tlsConfig(raw, true) } : {}),
    };
  }
  if (node.protocol === 'anytls') {
    const tls = tlsConfig(raw, true);
    return {
      type: 'anytls',
      ...base,
      password: String(raw.password || ''),
      ...(tls ? { tls } : {}),
    };
  }
  if (node.protocol === 'socks5') {
    return {
      type: 'socks',
      ...base,
      version: '5',
      ...(raw.username ? { username: String(raw.username) } : {}),
      ...(raw.password ? { password: String(raw.password) } : {}),
    };
  }
  return null;
}

export function buildSingbox(profile, matched, state) {
  const opts = groupOptions(profile, state.settings);
  const warnings = [];
  const outbounds = [];
  const supported = [];
  let skipped = 0;
  for (const node of matched.nodes) {
    const out = outboundFor(node);
    if (out) {
      outbounds.push(out);
      supported.push({ node, tag: out.tag });
    } else {
      skipped += 1;
    }
  }
  if (skipped) warnings.push(`${skipped} 个节点协议（SSR / WireGuard / Snell 等）暂不支持 Sing-box 输出，已跳过`);

  const groups = [];
  const direct = { type: 'direct', tag: 'direct' };
  if (supported.length) {
    if (opts.showAuto) {
      groups.push({
        type: 'urltest',
        tag: GROUP_NAMES.auto,
        outbounds: supported.map((s) => s.tag),
        url: opts.url,
        interval: `${Math.max(1, Math.round(opts.interval / 60))}m`,
        tolerance: 50,
        idle_timeout: '30m',
      });
    }
    let regionSelect = null;
    if (opts.showRegions) {
      const buckets = new Map();
      for (const item of supported) {
        const key = item.node.countryCode || 'ZZ';
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(item);
      }
      const regionTags = [];
      for (const [cc, list] of [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)) {
        if (list.length < 2 || list.length === supported.length) continue;
        const tag = `${list[0].node.flag || '🌐'} ${list[0].node.region || cc}`;
        groups.push({ type: 'selector', tag, outbounds: list.map((s) => s.tag), interrupt_exist_connections: false });
        regionTags.push(tag);
      }
      if (regionTags.length) {
        const tag = GROUP_NAMES.regions;
        groups.push({ type: 'selector', tag, outbounds: [...regionTags, 'direct'], interrupt_exist_connections: false });
        regionSelect = tag;
      }
    }
    const manualOutbounds = [];
    if (opts.showAuto) manualOutbounds.push(GROUP_NAMES.auto);
    if (regionSelect) manualOutbounds.push(regionSelect);
    manualOutbounds.push(...supported.map((s) => s.tag), 'direct');
    groups.push({
      type: 'selector',
      tag: GROUP_NAMES.manual,
      outbounds: manualOutbounds,
      default: opts.showAuto ? GROUP_NAMES.auto : supported[0].tag,
      interrupt_exist_connections: false,
    });
  } else {
    groups.push({ type: 'selector', tag: GROUP_NAMES.manual, outbounds: ['direct'], default: 'direct' });
  }

  const route = buildSingboxRoute(state.settings, profile);
  warnings.push(...route.warnings);
  const block = route.needsBlock || route.final === 'block' ? [{ type: 'block', tag: 'block' }] : [];
  const config = {
    log: { level: 'warn', timestamp: true },
    inbounds: [
      { type: 'mixed', tag: 'mixed-in', listen: '127.0.0.1', listen_port: 7890 },
    ],
    outbounds: [...groups, ...outbounds, ...block, direct],
    route: {
      auto_detect_interface: true,
      ...(route.rule_set.length ? { rule_set: route.rule_set } : {}),
      rules: route.rules,
      final: route.final,
    },
  };
  return {
    body: JSON.stringify(config, null, 2),
    warnings,
    emitted: supported.length,
  };
}

export function buildBase64(profile, matched, state, plain = false) {
  const warnings = [];
  const lines = [];
  let skipped = 0;
  for (const node of matched.nodes) {
    const uri = buildUri(node, node.outputName);
    if (uri) lines.push(uri);
    else skipped += 1;
  }
  if (skipped) warnings.push(`${skipped} 个节点无法转换为通用链接（常见于 Clash 专有协议），已跳过`);
  const text = lines.join('\n');
  return {
    body: plain ? text : Buffer.from(text, 'utf8').toString('base64'),
    warnings,
    emitted: lines.length,
  };
}

export function buildOutput(profile, format, state) {
  const normalized = normalizeFormat(format);
  const matched = matchNodes(profile, state);
  let result;
  if (normalized === 'singbox') result = buildSingbox(profile, matched, state);
  else if (normalized === 'base64') result = buildBase64(profile, matched, state, false);
  else if (normalized === 'plain') result = buildBase64(profile, matched, state, true);
  else result = buildClash(profile, matched, state);
  const meta = contentMeta(normalized);
  return {
    format: normalized,
    ...meta,
    body: result.body,
    warnings: [...matched.warnings, ...(result.warnings || [])],
    counts: matched.counts,
    nodes: matched.nodes,
    emitted: result.emitted ?? matched.nodes.length,
  };
}

export function profileSummary(profile, state) {
  const matched = matchNodes(profile, state);
  const byProtocol = {};
  const byType = {};
  const byRegion = {};
  const bySite = {};
  for (const node of matched.nodes) {
    byProtocol[node.protocol] = (byProtocol[node.protocol] || 0) + 1;
    byType[node.ipType || 'unknown'] = (byType[node.ipType || 'unknown'] || 0) + 1;
    const key = node.countryCode || 'unknown';
    byRegion[key] = (byRegion[key] || 0) + 1;
    for (const [siteId, value] of Object.entries(node.sites || {})) {
      if (value === true) bySite[siteId] = (bySite[siteId] || 0) + 1;
    }
  }
  const supported = matched.nodes.filter((n) => protocolSupportedForSingbox(n.protocol)).length;
  return {
    total: matched.counts.matched,
    deduped: matched.counts.deduped,
    emitted: matched.counts.emitted,
    duplicates: matched.counts.duplicates,
    supported,
    byProtocol,
    byType,
    byRegion,
    bySite,
    routing: routingSummary(state.settings, profile),
    warnings: matched.warnings,
  };
}

export function aggregateSources(state) {
  let upload = 0;
  let download = 0;
  let total = 0;
  for (const source of state.sources) {
    const t = trafficInfo(source);
    upload += t.upload;
    download += t.download;
    total += t.total;
  }
  return { upload, download, total, used: upload + download };
}
