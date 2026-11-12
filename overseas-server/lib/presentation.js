import { aggregateSources, profileSummary } from './generator.js';
import { GROUP_NAMES } from './constants.js';
import { summarizeSites } from './sites.js';
import { sourceBlockedReason, trafficInfo } from './traffic.js';
import { certFilterPass } from './tls.js';
import { formatBytes, IP_TYPE_LABELS, safeInt } from './util.js';

export function serializeSource(source, settings, nodes = []) {
  const traffic = trafficInfo(source);
  const blocked = sourceBlockedReason(source, settings);
  return {
    id: source.id,
    name: source.name,
    kind: source.kind,
    url: source.url || '',
    enabled: source.enabled,
    intervalMinutes: source.intervalMinutes,
    autoRefresh: source.autoRefresh !== false,
    userAgent: source.userAgent || '',
    useProxy: Boolean(source.useProxy),
    proxyMode: source.proxyMode || (source.useProxy ? 'custom' : 'direct'),
    proxyNodeId: source.proxyNodeId || '',
    proxyNodeName: (nodes.find((n) => n.id === source.proxyNodeId) || {}).name || '',
    proxyFallback: source.proxyFallback !== false,
    proxyUrl: source.proxyUrl || '',
    lastFetchProxy: source.lastFetchProxy || '',
    lastFetchAttempts: source.lastFetchAttempts || 0,
    status: source.status,
    error: source.error || '',
    warnings: source.warnings || [],
    format: source.format || '',
    nodeCount: source.nodeCount || 0,
    lastRefreshAt: source.lastRefreshAt || null,
    lastSuccessAt: source.lastSuccessAt || null,
    nextRefreshAt: source.nextRefreshAt || null,
    lastDurationMs: source.lastDurationMs || null,
    traffic: {
      ...traffic,
      updatedAt: source.trafficUpdatedAt || null,
    },
    blockedReason: blocked,
    depleted: traffic.depleted,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

export function serializeNode(node, source, settings) {
  return {
    id: node.id,
    name: node.name,
    protocol: node.protocol,
    server: node.server,
    port: node.port,
    sourceId: node.sourceId,
    sourceName: source?.name || node.sourceName || '未知来源',
    countryCode: node.countryCode || '',
    country: node.country || '',
    region: node.region || '',
    flag: node.flag || '🌐',
    city: node.city || '',
    isp: node.isp || '',
    org: node.org || '',
    asn: node.asn || '',
    ip: node.ip || '',
    ipType: node.ipType || 'unknown',
    qualityScore: Number.isFinite(node.qualityScore) ? node.qualityScore : null,
    qualityLabel: node.qualityLabel || '待测',
    qualityNote: node.qualityNote || '',
    qualityRisk: Number.isFinite(node.qualityRisk) ? node.qualityRisk : null,
    qualitySignal: node.qualitySignal || '',
    latency: Number.isFinite(node.latency) ? node.latency : null,
    alive: node.alive ?? null,
    testedAt: node.testedAt || null,
    testNote: node.testNote || '',
    proxyLatency: Number.isFinite(node.proxyLatency) ? node.proxyLatency : null,
    connectError: node.connectError || '',
    certTrusted: node.certTrusted === true ? true : node.certTrusted === false ? false : null,
    certError: node.certError || '',
    qualityAt: node.qualityAt || null,
    sites: node.sites || {},
    siteLatency: node.siteLatency || {},
    siteCheckedAt: node.siteCheckedAt || null,
    siteError: node.siteError || '',
    cnReachable: node.cnReachable === true ? true : node.cnReachable === false ? false : null,
    cnLatency: Number.isFinite(node.cnLatency) ? node.cnLatency : null,
    cnCheckedAt: node.cnCheckedAt || null,
    cnMethod: node.cnMethod || '',
    cnProxyStatus: Number(node.cnProxyStatus) || 0,
    cnError: node.cnError || '',
    disabled: Boolean(node.disabled),
    blockedReason: sourceBlockedReason(source, settings),
    updatedAt: node.updatedAt || null,
  };
}

export function buildStats(state) {
  const sourceMap = new Map(state.sources.map((s) => [s.id, s]));
  const usable = [];
  let disabled = 0;
  let untested = 0;
  let home = 0;
  let dc = 0;
  let cdn = 0;
  let mobile = 0;
  let business = 0;
  let totalLatency = 0;
  let latencyCount = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  const protocols = {};
  const regions = new Map();
  const unique = new Set();
  for (const node of state.nodes) {
    const source = sourceMap.get(node.sourceId);
    const blocked = sourceBlockedReason(source, state.settings);
    if (node.disabled) disabled += 1;
    if (node.qualityScore == null) untested += 1;
    if (blocked || node.disabled) continue;
    usable.push(node);
    unique.add(node.fingerprint || `${node.protocol}|${node.server}|${node.port}`);
    if (node.ipType === 'home') home += 1;
    else if (node.ipType === 'dc') dc += 1;
    else if (node.ipType === 'cdn') cdn += 1;
    else if (node.ipType === 'mobile') mobile += 1;
    else if (node.ipType === 'business') business += 1;
    protocols[node.protocol] = (protocols[node.protocol] || 0) + 1;
    const cc = node.countryCode || 'unknown';
    if (!regions.has(cc)) {
      regions.set(cc, { cc, region: node.region || '未知', flag: node.flag || '🌐', count: 0, home: 0, dc: 0 });
    }
    const r = regions.get(cc);
    r.count += 1;
    if (node.ipType === 'home') r.home += 1;
    if (node.ipType === 'dc' || node.ipType === 'cdn') r.dc += 1;
    if (Number.isFinite(node.latency)) {
      totalLatency += node.latency;
      latencyCount += 1;
    }
    if (Number.isFinite(node.qualityScore)) {
      scoreSum += node.qualityScore;
      scoreCount += 1;
    }
  }
  const traffic = aggregateSources(state);
  const sourceStats = {
    total: state.sources.length,
    enabled: state.sources.filter((s) => s.enabled).length,
    ok: state.sources.filter((s) => s.status === 'ok').length,
    error: state.sources.filter((s) => s.status === 'error').length,
    refreshing: state.sources.filter((s) => s.status === 'refreshing').length,
    depleted: state.sources.filter((s) => trafficInfo(s).depleted).length,
  };
  const nextRefresh = state.sources
    .filter((s) => s.enabled && s.nextRefreshAt)
    .map((s) => new Date(s.nextRefreshAt).getTime())
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)[0];
  const lastRefresh = state.sources
    .map((s) => (s.lastRefreshAt ? new Date(s.lastRefreshAt).getTime() : 0))
    .sort((a, b) => b - a)[0];
  return {
    sources: sourceStats,
    nodes: {
      total: state.nodes.length,
      usable: usable.length,
      unique: unique.size,
      disabled,
      untested,
      home,
      dc,
      cdn,
      mobile,
      business,
      unknown: usable.length - home - dc - cdn - mobile - business,
      avgQuality: scoreCount ? Math.round(scoreSum / scoreCount) : 0,
      avgLatency: latencyCount ? Math.round(totalLatency / latencyCount) : 0,
      tested: latencyCount,
      cnReachable: usable.filter((n) => n.cnReachable === true).length,
      cnBlocked: usable.filter((n) => n.cnReachable === false).length,
      cnUntested: usable.filter((n) => n.cnReachable !== true && n.cnReachable !== false).length,
    },
    traffic: {
      ...traffic,
      usedLabel: formatBytes(traffic.used),
      totalLabel: traffic.total > 0 ? formatBytes(traffic.total) : '未知',
      percent: traffic.total > 0 ? Math.min(100, Math.round((traffic.used / traffic.total) * 1000) / 10) : 0,
    },
    protocols,
    regions: [...regions.values()].sort((a, b) => b.count - a.count),
    sites: summarizeSites(usable, state.settings.sites || []),
    lastRefreshAt: lastRefresh ? new Date(lastRefresh).toISOString() : null,
    nextRefreshAt: nextRefresh ? new Date(nextRefresh).toISOString() : null,
  };
}

export function nodeQueryFilter(state, params = {}) {
  const sourceMap = new Map(state.sources.map((s) => [s.id, s]));
  const q = String(params.q || '').trim().toLowerCase();
  const protocol = String(params.protocol || '').trim();
  const ipType = String(params.ipType || '').trim();
  const region = String(params.region || '').trim().toUpperCase();
  const sourceId = String(params.sourceId || '').trim();
  const site = String(params.site || '').trim();
  const china = String(params.china || '').trim();
  const qualityMin = safeInt(params.qualityMin, 0, 0, 100);
  const latencyMax = safeInt(params.latencyMax, 0, 0, 600000);
  const status = String(params.status || 'all');
  const alive = String(params.alive || '') === 'true';
  return state.nodes.filter((node) => {
    const source = sourceMap.get(node.sourceId);
    const blocked = sourceBlockedReason(source, state.settings);
    if (sourceId && node.sourceId !== sourceId) return false;
    if (protocol && node.protocol !== protocol) return false;
    if (ipType && (node.ipType || 'unknown') !== ipType) return false;
    if (region && (node.countryCode || 'unknown').toUpperCase() !== region) return false;
    if (site && node.sites?.[site] !== true) return false;
    if (china === 'reachable' && node.cnReachable !== true) return false;
    if (china === 'blocked' && node.cnReachable !== false) return false;
    if (china === 'untested' && (node.cnReachable === true || node.cnReachable === false)) return false;
    if (qualityMin > 0 && (!Number.isFinite(node.qualityScore) || node.qualityScore < qualityMin)) return false;
    if (latencyMax > 0 && (!Number.isFinite(node.latency) || node.latency > latencyMax)) return false;
    if (alive && node.alive !== true) return false;
    if (status === 'usable' && (blocked || node.disabled)) return false;
    if (status === 'disabled' && !node.disabled) return false;
    if (status === 'untested' && node.qualityScore != null) return false;
    if (status === 'healthy' && node.alive !== true) return false;
    if (!certFilterPass(node, String(params.cert || ''))) return false;
    if (q) {
      const haystack = [
        node.name, node.server, node.isp, node.org, node.region, node.country,
        node.protocol, node.asn, node.ip, source?.name,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function sortNodeList(nodes, sort = 'quality') {
  const list = [...nodes];
  if (sort === 'latency') {
    list.sort((a, b) => (a.latency ?? Infinity) - (b.latency ?? Infinity));
  } else if (sort === 'name') {
    list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'));
  } else if (sort === 'updated') {
    list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  } else {
    list.sort((a, b) => {
      const qa = Number.isFinite(a.qualityScore) ? a.qualityScore : -1;
      const qb = Number.isFinite(b.qualityScore) ? b.qualityScore : -1;
      if (qb !== qa) return qb - qa;
      return (a.latency ?? Infinity) - (b.latency ?? Infinity);
    });
  }
  return list;
}

export function buildState(store, tester, siteTester, chinaTester, startedAt, siteEngine = false) {
  const state = store.state;
  const sourceMap = new Map(state.sources.map((s) => [s.id, s]));
  const stats = buildStats(state);
  const profiles = state.profiles.map((profile) => ({
    ...profile,
    summary: profileSummary(profile, state),
  }));
  return {
    ok: true,
    now: new Date().toISOString(),
    stats,
    sources: state.sources
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((s) => serializeSource(s, state.settings, state.nodes)),
    profiles,
    events: state.events.slice(-36).reverse(),
    settings: state.settings,
    job: tester.status(),
    siteJob: siteTester?.status() || null,
    chinaJob: chinaTester?.status() || null,
    meta: {
      groupNames: GROUP_NAMES,
      ipTypeLabels: IP_TYPE_LABELS,
      formats: [
        { id: 'clash', label: 'Clash / Mihomo' },
        { id: 'singbox', label: 'Sing-box' },
        { id: 'base64', label: 'Base64 / V2Ray' },
        { id: 'plain', label: '节点链接' },
      ],
      siteEngine,
      queues: {
        latency: tester.pendingAuto?.size || 0,
        site: siteTester?.pendingAuto?.size || 0,
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      startedAt,
      uptimeSec: Math.round(process.uptime()),
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      nodeVersion: process.version,
    },
  };
}
