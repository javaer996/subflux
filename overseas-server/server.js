import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { Store } from './lib/store.js';
import { QualityService } from './lib/quality.js';
import { Tester } from './lib/tester.js';
import { Scheduler } from './lib/scheduler.js';
import { SiteTester } from './lib/site-tester.js';
import { ChinaTester } from './lib/china-tester.js';
import { detectClientFormat } from './lib/clients.js';
import { normalizeSites } from './lib/sites.js';
import { normalizeRouting, normalizeRuleList, parseCustomRules } from './lib/routing.js';
import { CN_DIRECT_COUNT } from './lib/cn-direct.js';
import { describeEngine } from './lib/engine.js';
import { refreshSource, isRefreshing, testFetchProxy, nextRunAt } from './lib/refresher.js';
import { buildOutput, normalizeFormat, profileSummary } from './lib/generator.js';
import { buildState, nodeQueryFilter, serializeNode, serializeSource, sortNodeList } from './lib/presentation.js';
import { trafficInfo } from './lib/traffic.js';
import { errMessage, isHttpUrl, normalizeSourceUrl, safeInt, uid, uniqueBy } from './lib/util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = safeInt(process.env.PORT, 8888, 1, 65535);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const STARTED_AT = new Date().toISOString();
const BODY_LIMIT = 12 * 1024 * 1024;
const MAX_TEST_NODES = 2000;

const store = await new Store(DATA_DIR).init();
const quality = new QualityService(store);
const tester = new Tester(store, quality);
const siteTester = new SiteTester(store);
const chinaTester = new ChinaTester(store);
const scheduler = new Scheduler(store, tester, siteTester);
let refreshingAll = false;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function logRequest(req, status, started) {
  const pathname = (req.url || '/').split('?')[0].replace(/^\/sub\/[^/]+/, '/sub/***');
  const ms = Date.now() - started;
  console.log(`${new Date().toLocaleTimeString('zh-CN', { hour12: false })} ${req.socket.remoteAddress || '-'} ${req.method} ${pathname} ${status} ${ms}ms`);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

function sendText(res, status, text, headers = {}) {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(text);
}

function apiError(res, status, message, extra = {}) {
  sendJson(res, status, { ok: false, error: message, ...extra });
}

async function readBody(req, limit = BODY_LIMIT) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('请求体过大'), { status: 413 });
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('JSON 格式错误'), { status: 400 });
  }
}

function findSource(id) {
  return store.state.sources.find((s) => s.id === id);
}

function findProfile(id) {
  return store.state.profiles.find((p) => p.id === id || p.token === id);
}

function sanitizeStringList(value, max = 80) {
  if (!Array.isArray(value)) return [];
  return uniqueBy(value.map((v) => String(v).trim().slice(0, max)).filter(Boolean), (v) => v).slice(0, 100);
}

function sanitizeFilters(input, state) {
  const f = input && typeof input === 'object' ? input : {};
  const protocols = sanitizeStringList(f.protocols, 30).map((x) => x.toLowerCase());
  const regions = sanitizeStringList(f.regions, 8).map((x) => (x === 'unknown' ? 'unknown' : x.toUpperCase()));
  const ipTypes = sanitizeStringList(f.ipTypes, 20).filter((x) => ['home', 'dc', 'mobile', 'business', 'cdn', 'unknown'].includes(x));
  const sourceIds = sanitizeStringList(f.sourceIds, 40).filter((id) => state.sources.some((s) => s.id === id));
  const sites = sanitizeStringList(f.sites, 40);
  const china = ['reachable', 'blocked', 'untested'].includes(f.china) ? f.china : '';
  return {
    protocols,
    regions,
    ipTypes,
    sourceIds,
    sites,
    china,
    minQuality: safeInt(f.minQuality, 0, 0, 100),
    maxLatency: safeInt(f.maxLatency, 0, 0, 600000),
    onlyAlive: Boolean(f.onlyAlive),
    include: String(f.include || '').slice(0, 240),
    exclude: String(f.exclude || '').slice(0, 240),
    maxNodes: safeInt(f.maxNodes, 500, 0, 20000),
  };
}

function sanitizeProfile(input, existing, state) {
  const p = input && typeof input === 'object' ? input : {};
  const format = normalizeFormat(p.format || existing?.format || 'clash');
  const groups = p.groups && typeof p.groups === 'object' ? p.groups : (existing?.groups || {});
  const sort = ['quality', 'latency', 'region', 'source'].includes(p.sort) ? p.sort : (existing?.sort || 'quality');
  const testUrl = String(p.testUrl ?? existing?.testUrl ?? '').trim().slice(0, 500);
  if (testUrl && !isHttpUrl(testUrl)) throw Object.assign(new Error('测试地址必须是 http(s) URL'), { status: 400 });
  const name = String(p.name ?? existing?.name ?? '未命名订阅').trim().slice(0, 40) || '未命名订阅';
  return {
    ...(existing || {}),
    needsReview: false,
    name,
    format,
    enabled: p.enabled === undefined ? (existing?.enabled ?? true) : Boolean(p.enabled),
    filters: sanitizeFilters(p.filters ?? existing?.filters, state),
    groups: {
      manual: true,
      auto: groups.auto === undefined ? true : Boolean(groups.auto),
      fallback: groups.fallback === undefined ? true : Boolean(groups.fallback),
      regions: groups.regions === undefined ? true : Boolean(groups.regions),
    },
    testUrl,
    testInterval: safeInt(p.testInterval ?? existing?.testInterval, 300, 30, 86400),
    renameTemplate: String(p.renameTemplate ?? existing?.renameTemplate ?? '').slice(0, 240),
    appendSites: p.appendSites === undefined ? (existing?.appendSites ?? true) : Boolean(p.appendSites),
    customRuleList: normalizeRuleList([
      ...(p.customRuleList ?? existing?.customRuleList ?? []),
      ...parseCustomRules(p.customRules ?? existing?.customRules ?? '').rules,
    ]),
    customRules: '',
    sort,
    updatedAt: new Date().toISOString(),
  };
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;
  const method = req.method || 'GET';

  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      service: 'subflux',
      version: '1.0.0',
      uptime: Math.round(process.uptime()),
      now: new Date().toISOString(),
    });
  }

  if (pathname === '/api/state' && method === 'GET') {
    const engine = describeEngine(store.state.settings.mihomoPath || '');
    const state = buildState(store, tester, siteTester, chinaTester, STARTED_AT, engine.available);
    state.meta.siteEnginePath = engine.available ? engine.path : '';
    state.meta.engine = engine;
    state.meta.chinaProbeConfigured = Boolean(store.state.settings.chinaProbeUrl);
    state.meta.chinaProbeReverseConfigured = Boolean(store.state.settings.chinaProbeReverseUrl);
    state.meta.directDomainCount = CN_DIRECT_COUNT;
    return sendJson(res, 200, state);
  }

  if (pathname === '/api/sources' && method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      sources: store.state.sources
        .map((s) => serializeSource(s, store.state.settings))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    });
  }

  if (pathname === '/api/sources' && method === 'POST') {
    if (store.state.sources.length >= 200) return apiError(res, 400, '最多添加 200 个订阅源');
    const body = await readBody(req);
    const kind = body.kind === 'text' ? 'text' : 'url';
    let urlValue = '';
    let content = '';
    if (kind === 'url') {
      if (!isHttpUrl(body.url)) return apiError(res, 400, '请输入有效的 http(s) 订阅链接');
      urlValue = normalizeSourceUrl(body.url);
    } else {
      content = String(body.content || '').trim();
      if (!content) return apiError(res, 400, '粘贴的订阅内容不能为空');
      if (content.length > 10 * 1024 * 1024) return apiError(res, 413, '粘贴内容超过 10MB');
    }
    const name = String(body.name || '').trim().slice(0, 40) || (kind === 'url' ? new URL(urlValue).hostname : '手动导入');
    const now = new Date().toISOString();
    const autoRefresh = body.autoRefresh === undefined ? true : Boolean(body.autoRefresh);
    let proxyFields;
    try {
      proxyFields = readProxyFields(body);
    } catch (err) {
      return apiError(res, 400, err.message);
    }
    const source = {
      id: uid(8),
      name,
      kind,
      url: urlValue,
      content,
      enabled: body.enabled === undefined ? true : Boolean(body.enabled),
      intervalMinutes: safeInt(body.intervalMinutes, store.state.settings.defaultInterval, 5, 10080),
      userAgent: String(body.userAgent || '').slice(0, 200),
      ...proxyFields,
      useProxy: proxyFields.proxyMode !== 'direct',
      autoRefresh,
      status: 'idle',
      error: null,
      warnings: [],
      traffic: null,
      trafficUpdatedAt: null,
      nodeCount: 0,
      createdAt: now,
      updatedAt: now,
      lastRefreshAt: null,
      lastSuccessAt: null,
      nextRefreshAt: kind === 'text' || autoRefresh === false ? null : now,
    };
    store.state.sources.push(source);
    store.addEvent('info', `已添加订阅源「${source.name}」`, { sourceId: source.id });
    if (kind === 'text') {
      await refreshSource(store, source, { tester, siteTester });
    } else if (source.enabled) {
      setTimeout(() => {
        refreshSource(store, source, { tester, siteTester }).catch(() => {});
      }, 150).unref?.();
    }
    await store.flush();
    return sendJson(res, 201, {
      ok: true,
      source: serializeSource(source, store.state.settings),
    });
  }

  const sourceMatch = pathname.match(/^\/api\/sources\/([A-Za-z0-9_-]+)(?:\/(refresh|preview))?$/);
  if (sourceMatch) {
    const source = findSource(sourceMatch[1]);
    if (!source) return apiError(res, 404, '订阅源不存在');
    const action = sourceMatch[2];

    if (!action && (method === 'PATCH' || method === 'PUT')) {
      const body = await readBody(req);
      const changedUrl = body.url !== undefined && body.url !== source.url;
      const changedContent = body.content !== undefined && body.content !== source.content;
      if (body.name !== undefined) {
        const oldName = source.name;
        source.name = String(body.name).trim().slice(0, 40) || source.name;
        if (source.name !== oldName) {
          for (const node of store.state.nodes) {
            if (node.sourceId === source.id) node.sourceName = source.name;
          }
        }
      }
      if (body.kind === 'url' || source.kind === 'url') {
        if (body.url !== undefined) {
          if (!isHttpUrl(body.url)) return apiError(res, 400, '请输入有效的 http(s) 订阅链接');
          source.url = normalizeSourceUrl(body.url);
        }
      }
      if (source.kind === 'text' && body.content !== undefined) {
        const content = String(body.content).trim();
        if (!content) return apiError(res, 400, '粘贴的订阅内容不能为空');
        if (content.length > 10 * 1024 * 1024) return apiError(res, 413, '粘贴内容超过 10MB');
        source.content = content;
      }
      if (body.enabled !== undefined) source.enabled = Boolean(body.enabled);
      if (body.intervalMinutes !== undefined) source.intervalMinutes = safeInt(body.intervalMinutes, source.intervalMinutes, 5, 10080);
      if (body.userAgent !== undefined) source.userAgent = String(body.userAgent || '').slice(0, 200);
      let changedProxy = false;
      if (body.proxyMode !== undefined || body.proxyNodeId !== undefined || body.proxyUrl !== undefined || body.useProxy !== undefined) {
        let proxyFields;
        try {
          proxyFields = readProxyFields(body, source);
        } catch (err) {
          return apiError(res, 400, err.message);
        }
        changedProxy = proxyFields.proxyMode !== (source.proxyMode || 'direct')
          || proxyFields.proxyNodeId !== (source.proxyNodeId || '')
          || proxyFields.proxyUrl !== (source.proxyUrl || '');
        Object.assign(source, proxyFields);
        source.useProxy = proxyFields.proxyMode !== 'direct';
      }
      if (body.autoRefresh !== undefined) source.autoRefresh = Boolean(body.autoRefresh);
      source.updatedAt = new Date().toISOString();
      const refreshNow = source.enabled && (changedUrl || changedContent || changedProxy || source.kind === 'text');
      if (source.kind === 'text' || source.autoRefresh === false) {
        // 手动内容与关闭自动刷新的源不排期；改了链接仍然立刻抓取一次
        source.nextRefreshAt = null;
      } else if (refreshNow) {
        source.nextRefreshAt = new Date().toISOString();
      } else if (!source.nextRefreshAt) {
        source.nextRefreshAt = nextRunAt(source, store.state.settings);
      }
      store.addEvent('info', `已更新订阅源「${source.name}」`, { sourceId: source.id });
      await store.flush();
      if (refreshNow) {
        setTimeout(() => {
          refreshSource(store, source, { tester, siteTester }).catch(() => {});
        }, 150).unref?.();
      }
      return sendJson(res, 200, {
        ok: true,
        source: serializeSource(source, store.state.settings),
      });
    }

    if (action === 'refresh' && method === 'POST') {
      if (isRefreshing(source.id)) return apiError(res, 409, '该订阅正在刷新，请稍候');
      const result = await refreshSource(store, source, { tester, siteTester });
      return sendJson(res, result.ok ? 200 : 502, {
        ok: result.ok,
        result,
        source: serializeSource(source, store.state.settings),
        ...(result.ok ? {} : { error: result.error }),
      });
    }

    if (action === 'preview' && method === 'GET') {
      if (source.kind !== 'url') return apiError(res, 400, '仅 URL 订阅支持预览');
      try {
        const { fetchSubscription } = await import('./lib/refresher.js');
        const fetched = await fetchSubscription(source, store.state.settings, { nodes: store.state.nodes });
        const { parseSubscription } = await import('./lib/parser.js');
        const parsed = parseSubscription(fetched.text, { maxNodes: store.state.settings.maxNodesPerSource });
        return sendJson(res, 200, {
          ok: true,
          format: parsed.format,
          count: parsed.nodes.length,
          warnings: parsed.warnings,
          sample: parsed.nodes.slice(0, 12).map((n) => ({ name: n.name, protocol: n.protocol, server: n.server, port: n.port })),
          traffic: trafficInfo({ traffic: (await import('./lib/util.js')).parseTrafficHeader(fetched.headers['subscription-userinfo']) }),
        });
      } catch (err) {
        return apiError(res, 502, errMessage(err));
      }
    }

    if (!action && method === 'DELETE') {
      store.state.sources = store.state.sources.filter((s) => s.id !== source.id);
      store.state.nodes = store.state.nodes.filter((n) => n.sourceId !== source.id);
      for (const profile of store.state.profiles) {
        const ids = profile.filters.sourceIds || [];
        if (!ids.includes(source.id)) continue;
        const onlyThisSource = ids.length === 1;
        profile.filters.sourceIds = ids.filter((id) => id !== source.id);
        if (onlyThisSource) {
          profile.enabled = false;
          profile.needsReview = true;
          profile.updatedAt = new Date().toISOString();
        }
      }
      store.addEvent('warn', `已删除订阅源「${source.name}」及其节点；仅引用该源的输出订阅已自动停用`, { sourceId: source.id });
      await store.flush();
      return sendJson(res, 200, { ok: true });
    }
  }

  if (pathname === '/api/refresh-all' && method === 'POST') {
    if (refreshingAll) return apiError(res, 409, '正在刷新全部订阅');
    const count = store.state.sources.filter((s) => s.enabled && !isRefreshing(s.id)).length;
    if (!count) return apiError(res, 400, '没有可刷新的订阅源');
    refreshingAll = true;
    store.addEvent('info', `开始刷新全部订阅（${count} 个）`);
    scheduler.refreshAll()
      .catch((err) => store.addEvent('error', `批量刷新失败：${errMessage(err)}`))
      .finally(() => {
        refreshingAll = false;
        store.addEvent('success', '批量刷新任务结束');
      });
    return sendJson(res, 202, { ok: true, started: true, count });
  }

  if (pathname === '/api/nodes' && method === 'GET') {
    const params = Object.fromEntries(url.searchParams.entries());
    const page = safeInt(params.page, 1, 1, 100000);
    const pageSize = safeInt(params.pageSize, 50, 1, 200);
    const filtered = nodeQueryFilter(store.state, params);
    const sorted = sortNodeList(filtered, params.sort || 'quality');
    const total = sorted.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const items = sorted.slice((page - 1) * pageSize, page * pageSize)
      .map((n) => serializeNode(n, store.state.sources.find((s) => s.id === n.sourceId), store.state.settings));
    return sendJson(res, 200, { ok: true, items, total, page, pages, pageSize });
  }

  const nodeMatch = pathname.match(/^\/api\/nodes\/([A-Za-z0-9_-]+)$/);
  if (nodeMatch && (method === 'PATCH' || method === 'PUT')) {
    const node = store.state.nodes.find((n) => n.id === nodeMatch[1]);
    if (!node) return apiError(res, 404, '节点不存在');
    const body = await readBody(req);
    if (body.disabled !== undefined) node.disabled = Boolean(body.disabled);
    if (body.name !== undefined) node.name = String(body.name).slice(0, 100) || node.name;
    node.updatedAt = new Date().toISOString();
    store.touch();
    return sendJson(res, 200, {
      ok: true,
      node: serializeNode(node, store.state.sources.find((s) => s.id === node.sourceId), store.state.settings),
    });
  }

  if (pathname === '/api/nodes/test' && method === 'POST') {
    const body = await readBody(req);
    if (tester.status()?.running || siteTester.status()?.running) return apiError(res, 409, '已有测试任务正在运行', { job: tester.status() || siteTester.status() });
    let nodes;
    if (Array.isArray(body.ids) && body.ids.length) {
      const ids = new Set(body.ids.slice(0, MAX_TEST_NODES));
      nodes = store.state.nodes.filter((n) => ids.has(n.id));
    } else {
      nodes = sortNodeList(nodeQueryFilter(store.state, body.filter || {}), 'quality').slice(0, MAX_TEST_NODES);
    }
    if (!nodes.length) return apiError(res, 400, '没有匹配的节点可测试');
    const job = tester.start(nodes, {
      tcp: body.qualityOnly ? false : true,
      quality: true,
      label: body.qualityOnly ? '手动 IP 画像' : '手动测速',
    });
    if (!job) return apiError(res, 409, '测试任务启动失败', { job: tester.status() });
    store.addEvent('info', `开始测试 ${nodes.length} 个节点（${body.qualityOnly ? '仅 IP 画像' : 'TCP 延迟 + IP 画像'}）`);
    return sendJson(res, 202, { ok: true, job });
  }

  if (pathname === '/api/nodes/sites' && method === 'POST') {
    if (tester.status()?.running || siteTester.status()?.running) {
      return apiError(res, 409, '已有测试任务正在运行', { job: tester.status() || siteTester.status() });
    }
    if (!(await siteTester.engineAvailable())) {
      const info = siteTester.engineInfo();
      return apiError(res, 503, `站点检测引擎不可执行：${info.path || '未配置'}（可在设置里指定 Mihomo 路径）`);
    }
    const sites = (store.state.settings.sites || []).filter((site) => site.enabled !== false);
    if (!sites.length) return apiError(res, 400, '没有启用站点检测项，请先在设置中添加');
    const body = await readBody(req);
    const limit = safeInt(store.state.settings.siteCheckLimit, 30, 5, 200);
    let nodes;
    if (Array.isArray(body.ids) && body.ids.length) {
      const ids = new Set(body.ids.slice(0, limit));
      nodes = store.state.nodes.filter((n) => ids.has(n.id));
    } else {
      nodes = sortNodeList(nodeQueryFilter(store.state, body.filter || {}), 'quality').slice(0, limit);
    }
    if (!nodes.length) return apiError(res, 400, '没有匹配的节点可检测');
    const job = siteTester.start(nodes, sites, { label: '站点解锁检测' });
    if (!job) return apiError(res, 409, '站点检测任务启动失败', { job: siteTester.status() });
    store.addEvent('info', `开始站点检测：${nodes.length} 个节点 × ${sites.length} 个站点`);
    return sendJson(res, 202, { ok: true, job, nodes: nodes.length, sites: sites.map((s) => s.short) });
  }

  if (pathname === '/api/china/check' && method === 'POST') {
    try {
      const result = await chinaTester.check();
      return sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      return apiError(res, 502, `双向连通测试失败：${errMessage(err)}`);
    }
  }

  if (pathname === '/api/nodes/china' && method === 'POST') {
    if (tester.status()?.running || siteTester.status()?.running || chinaTester.status()?.running) {
      return apiError(res, 409, '已有测试任务正在运行');
    }
    if (!store.state.settings.chinaProbeUrl) return apiError(res, 400, '请先在设置中配置中国探针地址');
    const body = await readBody(req);
    let nodes;
    if (Array.isArray(body.ids) && body.ids.length) {
      const ids = new Set(body.ids.slice(0, 200));
      nodes = store.state.nodes.filter((n) => ids.has(n.id));
    } else {
      nodes = sortNodeList(nodeQueryFilter(store.state, body.filter || {}), 'quality').slice(0, 200);
    }
    if (!nodes.length) return apiError(res, 400, '没有匹配的节点可检测');
    const mode = body.mode === 'proxy' ? 'proxy' : 'tcp';
    const job = chinaTester.start(nodes, { mode, label: mode === 'proxy' ? '中国实际连通检测' : '中国 TCP 连通检测' });
    if (!job) return apiError(res, 409, '中国连通任务启动失败');
    store.addEvent('info', `开始中国连通检测：${nodes.length} 个节点`);
    return sendJson(res, 202, { ok: true, job });
  }

  if (pathname === '/api/profiles' && method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      profiles: store.state.profiles.map((p) => ({ ...p, summary: profileSummary(p, store.state) })),
    });
  }

  if (pathname === '/api/profiles' && method === 'POST') {
    if (store.state.profiles.length >= 30) return apiError(res, 400, '最多创建 30 个输出订阅');
    const body = await readBody(req);
    const profile = sanitizeProfile(body, null, store.state);
    profile.id = uid(8);
    profile.token = uid(16);
    profile.createdAt = new Date().toISOString();
    profile.updatedAt = profile.createdAt;
    store.state.profiles.push(profile);
    store.addEvent('success', `已创建输出订阅「${profile.name}」`);
    await store.flush();
    return sendJson(res, 201, {
      ok: true,
      profile: { ...profile, summary: profileSummary(profile, store.state) },
    });
  }

  const qrMatch = pathname.match(/^\/api\/profiles\/([A-Za-z0-9_-]+)\/qr$/);
  if (qrMatch && method === 'GET') {
    const profile = findProfile(qrMatch[1]);
    if (!profile) return apiError(res, 404, '输出订阅不存在');
    const requested = url.searchParams.get('format') || 'auto';
    const format = requested === 'auto' ? '' : normalizeFormat(requested);
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || `127.0.0.1:${PORT}`).split(',')[0].trim();
    const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
    const link = `${proto}://${host}/sub/${profile.token}${format ? `/${format}` : ''}`;
    try {
      const svg = await QRCode.toString(link, {
        type: 'svg',
        width: 300,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#0b1017', light: '#ffffff' },
      });
      res.writeHead(200, {
        'content-type': 'image/svg+xml; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      });
      return res.end(svg);
    } catch (err) {
      return apiError(res, 500, `二维码生成失败：${errMessage(err)}`);
    }
  }

  const profileMatch = pathname.match(/^\/api\/profiles\/([A-Za-z0-9_-]+)(?:\/(preview|rotate))?$/);
  if (profileMatch) {
    const profile = findProfile(profileMatch[1]);
    if (!profile) return apiError(res, 404, '输出订阅不存在');
    const action = profileMatch[2];

    if (!action && (method === 'PATCH' || method === 'PUT')) {
      const body = await readBody(req);
      const updated = sanitizeProfile(body, profile, store.state);
      Object.assign(profile, updated);
      store.addEvent('info', `已更新输出订阅「${profile.name}」`);
      await store.flush();
      return sendJson(res, 200, {
        ok: true,
        profile: { ...profile, summary: profileSummary(profile, store.state) },
      });
    }

    if (!action && method === 'DELETE') {
      store.state.profiles = store.state.profiles.filter((p) => p.id !== profile.id);
      store.addEvent('warn', `已删除输出订阅「${profile.name}」`);
      await store.flush();
      return sendJson(res, 200, { ok: true });
    }

    if (action === 'rotate' && method === 'POST') {
      profile.token = uid(16);
      profile.updatedAt = new Date().toISOString();
      store.addEvent('info', `已重置输出订阅「${profile.name}」的链接`);
      await store.flush();
      return sendJson(res, 200, { ok: true, profile });
    }

    if (action === 'preview' && method === 'GET') {
      const format = normalizeFormat(url.searchParams.get('format') || profile.format);
      const result = buildOutput(profile, format, store.state);
      return sendJson(res, 200, {
        ok: true,
        format,
        label: result.label,
        contentType: result.contentType,
        body: result.body,
        warnings: result.warnings,
        counts: result.counts,
        emitted: result.emitted,
        summary: profileSummary(profile, store.state),
      });
    }
  }

  if (pathname === '/api/proxy/test' && method === 'POST') {
    const body = await readBody(req);
    const proxyUrl = String(body.url || store.state.settings.fetchProxy || '').trim();
    if (!PROXY_URL_RE.test(proxyUrl)) return apiError(res, 400, '请输入 http(s) 或 socks5 代理地址');
    try {
      const result = await testFetchProxy(proxyUrl, store.state.settings);
      return sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      return apiError(res, 502, `代理连接失败：${errMessage(err)}`);
    }
  }

  if (pathname === '/api/settings' && method === 'GET') {
    return sendJson(res, 200, { ok: true, settings: store.state.settings });
  }

  if (pathname === '/api/settings' && method === 'PUT') {
    const body = await readBody(req);
    const s = store.state.settings;
    if (body.testUrl !== undefined) {
      const value = String(body.testUrl).trim();
      if (!isHttpUrl(value)) return apiError(res, 400, '测试地址必须是 http(s) URL');
      s.testUrl = value.slice(0, 500);
    }
    if (body.defaultInterval !== undefined) s.defaultInterval = safeInt(body.defaultInterval, s.defaultInterval, 5, 10080);
    if (body.renameTemplate !== undefined) {
      const value = String(body.renameTemplate || '').trim();
      if (!value) return apiError(res, 400, '重命名模板不能为空');
      s.renameTemplate = value.slice(0, 240);
    }
    if (body.autoQuality !== undefined) s.autoQuality = Boolean(body.autoQuality);
    if (body.autoTcp !== undefined) s.autoTcp = Boolean(body.autoTcp);
    if (body.autoSite !== undefined) s.autoSite = Boolean(body.autoSite);
    if (body.fetchProxy !== undefined) {
      const value = String(body.fetchProxy || '').trim();
      if (value && !/^https?:\/\//i.test(value)) return apiError(res, 400, '拉取代理必须是 http(s) 代理地址');
      s.fetchProxy = value.slice(0, 500);
    }
    if (body.excludeDepleted !== undefined) s.excludeDepleted = Boolean(body.excludeDepleted);
    if (body.autoRefresh !== undefined) s.autoRefresh = Boolean(body.autoRefresh);
    if (body.userAgent !== undefined) s.userAgent = String(body.userAgent || '').slice(0, 200) || s.userAgent;
    if (body.maxNodesPerSource !== undefined) s.maxNodesPerSource = safeInt(body.maxNodesPerSource, s.maxNodesPerSource, 100, 10000);
    if (body.qualityTTLHours !== undefined) s.qualityTTLHours = safeInt(body.qualityTTLHours, s.qualityTTLHours, 1, 720);
    if (body.tcpTimeoutMs !== undefined) s.tcpTimeoutMs = safeInt(body.tcpTimeoutMs, s.tcpTimeoutMs, 500, 10000);
    if (body.requestTimeoutMs !== undefined) s.requestTimeoutMs = safeInt(body.requestTimeoutMs, s.requestTimeoutMs, 5000, 90000);
    if (body.chinaProbeUrl !== undefined) {
      const value = String(body.chinaProbeUrl || '').trim();
      if (value && !/^https?:\/\//i.test(value)) return apiError(res, 400, '中国探针地址必须是 http(s) URL');
      s.chinaProbeUrl = value.slice(0, 500);
    }
    if (body.chinaProbeToken !== undefined) s.chinaProbeToken = String(body.chinaProbeToken || '').slice(0, 300);
    if (body.chinaProbeReverseUrl !== undefined) {
      const value = String(body.chinaProbeReverseUrl || '').trim();
      if (value && !/^https?:\/\//i.test(value)) return apiError(res, 400, '反向测试地址必须是 http(s) URL');
      s.chinaProbeReverseUrl = value.slice(0, 500);
    }
    if (body.chinaProbeTestUrl !== undefined) {
      const value = String(body.chinaProbeTestUrl || '').trim();
      if (value && !/^https?:\/\//i.test(value)) return apiError(res, 400, '实际检测地址必须是 http(s) URL');
      s.chinaProbeTestUrl = value.slice(0, 500);
    }
    if (body.chinaProbeTimeoutMs !== undefined) s.chinaProbeTimeoutMs = safeInt(body.chinaProbeTimeoutMs, s.chinaProbeTimeoutMs, 1000, 15000);
    if (body.siteCheckLimit !== undefined) s.siteCheckLimit = safeInt(body.siteCheckLimit, s.siteCheckLimit, 5, 200);
    if (body.mihomoPath !== undefined) {
      const value = String(body.mihomoPath || '').trim();
      if (value && !value.startsWith('/')) return apiError(res, 400, 'Mihomo 路径需要是绝对路径，例如 /opt/mihomo/mihomo');
      s.mihomoPath = value.slice(0, 500);
    }
    if (body.sites !== undefined) {
      const sites = normalizeSites(body.sites);
      s.sites = sites;
    }
    if (body.routing !== undefined) {
      const routing = normalizeRouting({ ...s.routing, ...(body.routing || {}) });
      routing.customRuleList = normalizeRuleList([
        ...routing.customRuleList,
        ...parseCustomRules(routing.customRules).rules,
      ]);
      routing.customRules = '';
      s.routing = routing;
    }
    store.addEvent('info', '系统设置已更新');
    await store.flush();
    if (s.autoQuality) {
      const unknown = store.state.nodes.filter((n) => n.qualityScore == null).slice(0, 1000);
      if (unknown.length) tester.enqueueAuto(unknown);
    }
    return sendJson(res, 200, { ok: true, settings: s, engine: describeEngine(s.mihomoPath || '') });
  }

  if (pathname === '/api/events' && method === 'GET') {
    const limit = safeInt(url.searchParams.get('limit'), 50, 1, 240);
    return sendJson(res, 200, { ok: true, events: store.state.events.slice(-limit).reverse() });
  }

  if (pathname === '/api/export' && method === 'GET') {
    const body = JSON.stringify(store.state, null, 2);
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="subflux-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      'cache-control': 'no-store',
    });
    return res.end(body);
  }

  if (pathname === '/api/import' && method === 'POST') {
    if (tester.status()?.running || siteTester.status()?.running) return apiError(res, 409, '测试任务运行中，请稍后再导入备份');
    const body = await readBody(req, 24 * 1024 * 1024);
    const data = body.data || body;
    if (!data || typeof data !== 'object' || !Array.isArray(data.sources) || !Array.isArray(data.nodes) || !Array.isArray(data.profiles)) {
      return apiError(res, 400, '备份文件格式不正确');
    }
    if (data.nodes.length > 12000 || data.sources.length > 200 || data.profiles.length > 30) {
      return apiError(res, 400, '备份数据超过容量限制');
    }
    store.state = store.migrate(data);
    for (const source of store.state.sources) {
      if (source.status === 'refreshing') source.status = 'idle';
    }
    store.addEvent('success', '已从备份恢复数据');
    await store.flush();
    return sendJson(res, 200, { ok: true });
  }

  return apiError(res, 404, '接口不存在');
}

async function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendText(res, 405, 'Method Not Allowed');
  }
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const safeName = pathname.replace(/^\/+/, '');
  if (safeName.includes('..') || safeName.includes('\0')) return sendText(res, 400, 'Bad Request');
  const filePath = path.resolve(PUBLIC_DIR, safeName);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) return sendText(res, 403, 'Forbidden');
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error('not a file');
    const body = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    return res.end(body);
  } catch {
    return sendText(res, 404, 'Not Found');
  }
}

async function serveSubscription(req, res, url, token, formatPart) {
  const profile = store.state.profiles.find((p) => p.token === token);
  if (!profile || !profile.enabled) return sendText(res, 404, '订阅不存在或已停用');
  const explicit = formatPart || url.searchParams.get('format') || url.searchParams.get('target') || '';
  const detected = detectClientFormat(req.headers['user-agent'], explicit, profile.format);
  const format = detected.format;
  const limitOverride = safeInt(url.searchParams.get('limit'), 0, 0, 20000);
  const effective = limitOverride > 0
    ? { ...profile, filters: { ...(profile.filters || {}), maxNodes: limitOverride } }
    : profile;
  const result = buildOutput(effective, format, store.state);
  const sources = [...new Set(result.nodes?.map?.((n) => n.sourceId) || [])];
  let upload = 0;
  let download = 0;
  let total = 0;
  let expire = 0;
  if (sources.length) {
    for (const source of store.state.sources) {
      if (!sources.includes(source.id)) continue;
      const t = trafficInfo(source);
      upload += t.upload;
      download += t.download;
      total += t.total;
      if (t.expire > 0) expire = expire ? Math.min(expire, t.expire) : t.expire;
    }
  }
  const headers = {
    'content-type': result.contentType,
    'cache-control': 'no-store',
    'profile-update-interval': '6',
    'content-disposition': `attachment; filename="subflux-${format}.${result.ext}"`,
    'x-content-type-options': 'nosniff',
    'x-subflux-client': detected.client,
    'x-subflux-format': format,
    'vary': 'User-Agent',
    'access-control-allow-origin': '*',
  };
  if (total > 0) {
    headers['subscription-userinfo'] = `upload=${upload}; download=${download}; total=${total}; expire=${expire}`;
  }
  if (result.warnings?.length) {
    headers['x-subflux-warning'] = encodeURIComponent(result.warnings.join(' | ')).slice(0, 1000);
  }
  res.writeHead(200, headers);
  res.end(result.body);
}


const PROXY_MODES = new Set(['direct', 'pool', 'custom']);
const PROXY_URL_RE = /^(https?|socks5h?|socks):\/\//i;

/** 归一化订阅源拉取代理设置，兼容旧的 useProxy 布尔字段。 */
function readProxyFields(body, fallback = {}) {
  const rawMode = body.proxyMode;
  const mode = PROXY_MODES.has(rawMode)
    ? rawMode
    : (fallback.proxyMode || (body.useProxy === true ? 'custom' : 'direct'));
  const nodeId = body.proxyNodeId !== undefined
    ? String(body.proxyNodeId || '').trim().slice(0, 60)
    : (fallback.proxyNodeId || '');
  const url = body.proxyUrl !== undefined
    ? String(body.proxyUrl || '').trim().slice(0, 500)
    : (fallback.proxyUrl || '');
  if (url && !PROXY_URL_RE.test(url)) {
    throw new Error('代理地址需要以 http://、https:// 或 socks5:// 开头');
  }
  return { proxyMode: mode, proxyNodeId: nodeId, proxyUrl: url };
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  let status = 500;
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' });
      return res.end();
    }
    res.writeHead = ((original) => function (code, ...args) {
      status = code;
      return original.call(this, code, ...args);
    })(res.writeHead);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      logRequest(req, status, started);
      return;
    }
    const subMatch = url.pathname.match(/^\/sub\/([A-Za-z0-9_-]{8,64})(?:\/([A-Za-z0-9_-]+))?\/?$/);
    if (subMatch) {
      await serveSubscription(req, res, url, subMatch[1], subMatch[2]);
      logRequest(req, status, started);
      return;
    }
    status = 200;
    await serveStatic(req, res, url);
    logRequest(req, status, started);
  } catch (err) {
    const code = err.status || 500;
    console.error('[server]', err);
    if (!res.headersSent) sendJson(res, code, { ok: false, error: errMessage(err) });
    else res.end();
    logRequest(req, code, started);
  }
});
server.requestTimeout = 120_000;
server.headersTimeout = 65_000;
server.keepAliveTimeout = 15_000;

scheduler.start();

setTimeout(() => {
  const unknown = store.state.nodes.filter((n) => n.qualityScore == null).slice(0, 800);
  if (unknown.length) tester.enqueueAuto(unknown);
}, 6000).unref?.();

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  SubFlux · 订阅汇聚');
  console.log(`  http://${HOST}:${PORT}`);
  console.log(`  数据目录 ${DATA_DIR}`);
  console.log(`  订阅源 ${store.state.sources.length} · 节点 ${store.state.nodes.length} · 输出订阅 ${store.state.profiles.length}`);
  console.log('');
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[server] ${signal} 正在关闭...`);
  scheduler.stop();
  server.close();
  await store.close();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
