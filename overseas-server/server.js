import http from 'node:http';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { Store } from './lib/store.js';
import { QualityService } from './lib/quality.js';
import { Tester } from './lib/tester.js';
import { ProxyProbe } from './lib/proxy-probe.js';
import { Scheduler } from './lib/scheduler.js';
import { SiteTester } from './lib/site-tester.js';
import { ChinaTester } from './lib/china-tester.js';
import { detectClientFormat } from './lib/clients.js';
import { normalizeSites } from './lib/sites.js';
import { normalizeClock, inQuietHours, afterQuietHours } from './lib/quiet-hours.js';
import { normalizeRouting, normalizeRuleList, parseCustomRules } from './lib/routing.js';
import { CN_DIRECT_COUNT } from './lib/cn-direct.js';
import { describeEngine } from './lib/engine.js';
import { Auth } from './lib/auth.js';
import { initLogger } from './lib/logger.js';
import { initTimezone, serverTimezone, zoneParts } from './lib/timezone.js';
import { refreshSource, isRefreshing, testFetchProxy, nextRunAt } from './lib/refresher.js';
import { pushProfile } from './lib/pusher.js';
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
const STARTED_MS = Date.now();
const BODY_LIMIT = 12 * 1024 * 1024;
// 时区必须在日志与任何时间格式化之前定下来：默认服务器时区，配了 SUBFLUX_TZ/TZ 就切过去。
initTimezone();
initLogger(DATA_DIR);

async function assetsUpdatedAfterStart() {
  for (const name of ['index.html', 'app.js', 'styles.css']) {
    try {
      const stat = await fs.stat(path.join(PUBLIC_DIR, name));
      if (stat.mtimeMs > STARTED_MS + 1500) return true;
    } catch {}
  }
  return false;
}

const store = await new Store(DATA_DIR).init();
const auth = await new Auth(DATA_DIR).init();
if (auth.defaultCreds) console.warn('[auth] 正在使用默认账号 admin/subflux，请通过 SUBFLUX_USERNAME / SUBFLUX_PASSWORD 修改');
const quality = new QualityService(store);
const probe = new ProxyProbe(store);
const tester = new Tester(store, quality, probe);
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
  const clock = zoneParts(Date.now());
  console.log(`${clock.hour}:${clock.minute}:${clock.second} ${req.socket.remoteAddress || '-'} ${req.method} ${pathname} ${status} ${ms}ms`);
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

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
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
    cert: f.cert === 'exclude' || f.cert === 'only' ? f.cert : '',
    include: String(f.include || '').slice(0, 240),
    exclude: String(f.exclude || '').slice(0, 240),
    maxNodes: safeInt(f.maxNodes, 500, 0, 20000),
    maxPerRegion: safeInt(f.maxPerRegion, 0, 0, 500),
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
    push: sanitizePush(p.push, existing?.push),
    updatedAt: new Date().toISOString(),
  };
}

const PUSH_MAX_TARGETS = 5;

function cleanPushTarget(input) {
  const t = input && typeof input === 'object' ? input : {};
  const type = ['file', 'http', 'oss'].includes(t.type) ? t.type : '';
  if (!type) return null;
  if (type === 'file') return { type, path: String(t.path || '').trim().slice(0, 500) };
  if (type === 'http') {
    return {
      type,
      url: String(t.url || '').trim().slice(0, 500),
      method: String(t.method || 'PUT').toUpperCase() === 'POST' ? 'POST' : 'PUT',
      headers: String(t.headers || '').slice(0, 2000),
    };
  }
  return {
    type,
    provider: t.provider === 's3' ? 's3' : 'aliyun',
    endpoint: String(t.endpoint || '').trim().slice(0, 300),
    bucket: String(t.bucket || '').trim().slice(0, 120),
    region: String(t.region || '').trim().slice(0, 60),
    accessKeyId: String(t.accessKeyId || '').trim().slice(0, 200),
    accessKeySecret: String(t.accessKeySecret || '').trim().slice(0, 500),
    objectKey: String(t.objectKey || '').trim().slice(0, 500),
  };
}

function sanitizePush(input, existing) {
  const p = input && typeof input === 'object' ? input : {};
  const prev = existing && typeof existing === 'object' ? existing : {};
  const enabled = p.enabled === undefined ? Boolean(prev.enabled) : Boolean(p.enabled);
  const intervalMinutes = safeInt(p.intervalMinutes ?? prev.intervalMinutes, 1440, 5, 5256000);
  const rawTargets = Array.isArray(p.targets) ? p.targets : Array.isArray(prev.targets) ? prev.targets : [];
  const targets = rawTargets.slice(0, PUSH_MAX_TARGETS).map(cleanPushTarget).filter(Boolean);
  const keepSchedule = prev.enabled && enabled && Number(prev.intervalMinutes) === intervalMinutes && prev.nextPushAt;
  return {
    enabled,
    intervalMinutes,
    targets,
    lastPushAt: prev.lastPushAt || null,
    lastStatus: prev.lastStatus || '',
    lastResults: Array.isArray(prev.lastResults) ? prev.lastResults.slice(0, 10) : [],
    nextPushAt: enabled ? (keepSchedule ? prev.nextPushAt : new Date(Date.now() + intervalMinutes * 60000).toISOString()) : null,
  };
}

function badRequest(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function makeSource(body = {}) {
  const kind = body.kind === 'text' ? 'text' : 'url';
  let urlValue = '';
  let content = '';
  if (kind === 'url') {
    if (!isHttpUrl(body.url)) throw badRequest(400, '请输入有效的 http(s) 订阅链接');
    urlValue = normalizeSourceUrl(body.url);
  } else {
    content = String(body.content || '').trim();
    if (!content) throw badRequest(400, '粘贴的订阅内容不能为空');
    if (content.length > 10 * 1024 * 1024) throw badRequest(413, '粘贴内容超过 10MB');
  }
  const name = String(body.name || '').trim().slice(0, 40) || (kind === 'url' ? new URL(urlValue).hostname : '手动导入');
  const now = new Date().toISOString();
  const autoRefresh = body.autoRefresh === undefined ? true : Boolean(body.autoRefresh);
  const proxyFields = readProxyFields(body);
  return {
    id: uid(8),
    name,
    kind,
    url: urlValue,
    content,
    enabled: body.enabled === undefined ? true : Boolean(body.enabled),
    intervalMinutes: safeInt(body.intervalMinutes, store.state.settings.defaultInterval, 5, 5256000),
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

  if (pathname === '/api/auth/me' && method === 'GET') {
    const session = auth.read(req);
    if (!session) return apiError(res, 401, '未登录或会话已过期', { authenticated: false });
    return sendJson(res, 200, {
      ok: true,
      authenticated: true,
      username: session.u,
      csrfToken: session.c,
      defaultCreds: auth.defaultCreds,
    });
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const ip = clientIp(req);
    const wait = auth.blockedFor(ip);
    if (wait > 0) {
      res.setHeader('retry-after', String(wait));
      return apiError(res, 429, `尝试次数过多，请 ${Math.max(1, Math.ceil(wait / 60))} 分钟后再试`);
    }
    const body = await readBody(req, 64 * 1024);
    if (!auth.verify(body.username, body.pass)) {
      auth.recordFail(ip);
      return apiError(res, 401, '用户名或密码错误');
    }
    auth.clearFails(ip);
    const session = auth.issue();
    auth.setSession(res, req, session.token);
    store.addEvent('info', `管理员 ${auth.username} 已登录`);
    return sendJson(res, 200, { ok: true, username: auth.username, csrfToken: session.csrf });
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    auth.clearSession(res, req);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/state' && method === 'GET') {
    const engine = describeEngine(store.state.settings.mihomoPath || '');
    const state = buildState(store, tester, siteTester, chinaTester, STARTED_AT, engine.available);
    state.meta.siteEnginePath = engine.available ? engine.path : '';
    state.meta.engine = engine;
    state.meta.assetsStale = await assetsUpdatedAfterStart();
    state.meta.chinaProbeConfigured = Boolean(store.state.settings.chinaProbeUrl);
    state.meta.chinaProbeReverseConfigured = Boolean(store.state.settings.chinaProbeReverseUrl);
    state.meta.directDomainCount = CN_DIRECT_COUNT;
    state.meta.auth = { username: auth.username, defaultCreds: auth.defaultCreds };
    return sendJson(res, 200, state);
  }

  if (pathname === '/api/sources' && method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      sources: store.state.sources
        .map((s) => serializeSource(s, store.state.settings, store.state.nodes))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    });
  }

  if (pathname === '/api/sources' && method === 'POST') {
    if (store.state.sources.length >= 200) return apiError(res, 400, '最多添加 200 个订阅源');
    const body = await readBody(req);
    let source;
    try {
      source = makeSource(body);
    } catch (err) {
      return apiError(res, err.status || 400, err.message);
    }
    store.state.sources.push(source);
    store.addEvent('info', `已添加订阅源「${source.name}」`, { sourceId: source.id });
    if (source.kind === 'text') {
      await refreshSource(store, source, { tester, siteTester });
    } else if (source.enabled) {
      setTimeout(() => {
        refreshSource(store, source, { tester, siteTester }).catch(() => {});
      }, 150).unref?.();
    }
    await store.flush();
    return sendJson(res, 201, {
      ok: true,
      source: serializeSource(source, store.state.settings, store.state.nodes),
    });
  }

  if (pathname === '/api/sources/export' && method === 'GET') {
    const sources = store.state.sources.map((s) => ({
      name: s.name,
      kind: s.kind,
      url: s.kind === 'url' ? s.url : '',
      content: s.kind === 'text' ? s.content : '',
      enabled: s.enabled,
      intervalMinutes: s.intervalMinutes,
      autoRefresh: s.autoRefresh !== false,
      userAgent: s.userAgent || '',
      proxyMode: s.proxyMode || (s.useProxy ? 'custom' : 'direct'),
      proxyNodeId: s.proxyNodeId || '',
      proxyNodeName: store.state.nodes.find((n) => n.id === s.proxyNodeId)?.name || '',
      proxyUrl: s.proxyUrl || '',
      proxyFallback: s.proxyFallback !== false,
    }));
    const payload = {
      app: 'subflux',
      kind: 'sources',
      version: 1,
      exportedAt: new Date().toISOString(),
      count: sources.length,
      sources,
    };
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="subflux-sources-${new Date().toISOString().slice(0, 10)}.json"`,
      'cache-control': 'no-store',
    });
    return res.end(JSON.stringify(payload, null, 2));
  }

  if (pathname === '/api/sources/import' && method === 'POST') {
    const body = await readBody(req, 24 * 1024 * 1024);
    const list = Array.isArray(body) ? body : Array.isArray(body?.sources) ? body.sources : null;
    if (!list) return apiError(res, 400, '导入内容需要包含 sources 数组');
    if (!list.length) return apiError(res, 400, '导入内容里没有订阅源');
    if (list.length > 500) return apiError(res, 400, '一次最多导入 500 个订阅源');
    const urlSet = new Set(store.state.sources.filter((s) => s.kind === 'url').map((s) => s.url));
    const textSet = new Set(store.state.sources.filter((s) => s.kind === 'text').map((s) => crypto.createHash('sha1').update(s.content || '').digest('hex')));
    let imported = 0;
    let skipped = 0;
    const errors = [];
    const textSources = [];
    for (const item of list) {
      if (store.state.sources.length >= 200) {
        errors.push('已达 200 个订阅源上限，剩余未导入');
        break;
      }
      try {
        const source = makeSource(item || {});
        const textHash = source.kind === 'text' ? crypto.createHash('sha1').update(source.content).digest('hex') : '';
        if (source.kind === 'url' && urlSet.has(source.url)) {
          skipped += 1;
          continue;
        }
        if (source.kind === 'text' && textSet.has(textHash)) {
          skipped += 1;
          continue;
        }
        if (source.proxyMode === 'pool' || source.proxyMode === 'auto') {
          const wantedId = String(item.proxyNodeId || '');
          const wantedName = String(item.proxyNodeName || '');
          const node = store.state.nodes.find((n) => n.id === wantedId) || (wantedName && store.state.nodes.find((n) => n.name === wantedName));
          if (node) {
            source.proxyNodeId = node.id;
          } else if (source.proxyMode === 'auto') {
            // 自动选择出口的源不需要钉死某个节点,保留 auto 模式即可。
            source.proxyNodeId = '';
          } else {
            source.proxyMode = 'direct';
            source.proxyNodeId = '';
            source.useProxy = false;
          }
        }
        store.state.sources.push(source);
        if (source.kind === 'url') urlSet.add(source.url);
        else textSet.add(textHash);
        imported += 1;
        if (source.kind === 'text') textSources.push(source);
      } catch (err) {
        errors.push(`${String(item?.name || '未命名')}：${err.message}`);
      }
    }
    for (const source of textSources) {
      try {
        await refreshSource(store, source, { tester, siteTester });
      } catch (err) {
        errors.push(`${source.name}：${errMessage(err)}`);
      }
    }
    store.addEvent(imported ? 'info' : 'warn', `导入订阅源：新增 ${imported} 个，跳过 ${skipped} 个${errors.length ? `，失败 ${errors.length} 个` : ''}`);
    await store.flush();
    return sendJson(res, 200, { ok: true, imported, skipped, failed: errors.length, errors: errors.slice(0, 20) });
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
      const prevInterval = source.intervalMinutes;
      const prevAutoRefresh = source.autoRefresh !== false;
      const prevEnabled = source.enabled !== false;
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
      if (body.intervalMinutes !== undefined) source.intervalMinutes = safeInt(body.intervalMinutes, source.intervalMinutes, 5, 5256000);
      if (body.userAgent !== undefined) source.userAgent = String(body.userAgent || '').slice(0, 200);
      let changedProxy = false;
      if (body.proxyMode !== undefined || body.proxyNodeId !== undefined || body.proxyUrl !== undefined || body.proxyFallback !== undefined || body.useProxy !== undefined) {
        let proxyFields;
        try {
          proxyFields = readProxyFields(body, source);
        } catch (err) {
          return apiError(res, 400, err.message);
        }
        changedProxy = proxyFields.proxyMode !== (source.proxyMode || 'direct')
          || proxyFields.proxyNodeId !== (source.proxyNodeId || '')
          || proxyFields.proxyUrl !== (source.proxyUrl || '')
          || proxyFields.proxyFallback !== (source.proxyFallback !== false);
        Object.assign(source, proxyFields);
        source.useProxy = proxyFields.proxyMode !== 'direct';
      }
      if (body.autoRefresh !== undefined) source.autoRefresh = Boolean(body.autoRefresh);
      source.updatedAt = new Date().toISOString();
      const refreshNow = source.enabled && (changedUrl || changedContent || changedProxy || source.kind === 'text');
      const intervalChanged = source.intervalMinutes !== prevInterval;
      const autoChanged = (source.autoRefresh !== false) !== prevAutoRefresh;
      const enabledChanged = (source.enabled !== false) !== prevEnabled;
      if (source.kind === 'text' || source.autoRefresh === false) {
        // 手动内容与关闭自动刷新的源不排期；改了链接仍然立刻抓取一次
        source.nextRefreshAt = null;
      } else if (refreshNow) {
        source.nextRefreshAt = new Date().toISOString();
      } else if (intervalChanged || autoChanged || enabledChanged || !source.nextRefreshAt) {
        // 改了间隔 / 重新开启自动刷新或启用源时，按新间隔从现在重新排期
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
        source: serializeSource(source, store.state.settings, store.state.nodes),
      });
    }

    if (action === 'refresh' && method === 'POST') {
      if (isRefreshing(source.id)) return apiError(res, 409, '该订阅正在刷新，请稍候');
      const result = await refreshSource(store, source, { tester, siteTester });
      return sendJson(res, result.ok ? 200 : 502, {
        ok: result.ok,
        result,
        source: serializeSource(source, store.state.settings, store.state.nodes),
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
          proxyLabel: fetched.proxyLabel || '',
          proxyAttempts: fetched.proxyAttempts || 0,
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

  if (pathname === '/api/tasks/cancel' && method === 'POST') {
    const body = await readBody(req, 64 * 1024);
    const kind = String(body.kind || '').trim();
    const map = { latency: tester, site: siteTester, china: chinaTester };
    const target = map[kind];
    if (!target) return apiError(res, 400, '未知的任务类型');
    if (!target.cancel()) return apiError(res, 409, '任务没有在运行');
    store.addEvent('warn', `已请求取消${kind === 'latency' ? '测速' : kind === 'site' ? '站点检测' : 'CN 检测'}任务`);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/nodes/test' && method === 'POST') {
    const body = await readBody(req);
    if (tester.status()?.running) return apiError(res, 409, '已有测速任务正在运行', { job: tester.status() });
    let nodes;
    if (Array.isArray(body.ids) && body.ids.length) {
      const ids = new Set(body.ids);
      nodes = store.state.nodes.filter((n) => ids.has(n.id));
    } else {
      nodes = sortNodeList(nodeQueryFilter(store.state, body.filter || {}), 'quality');
    }
    if (!nodes.length) return apiError(res, 400, '没有匹配的节点可测试');
    const qualityOnly = Boolean(body.qualityOnly);
    const connectOnly = Boolean(body.connectOnly ?? body.latencyOnly);
    const job = tester.start(nodes, {
      connect: qualityOnly ? false : true,
      quality: qualityOnly ? true : connectOnly ? false : true,
      label: qualityOnly ? '手动 IP 画像' : connectOnly ? '手动连通性测试' : '手动连通性测试 + IP 画像',
    });
    if (!job) return apiError(res, 409, '测试任务启动失败', { job: tester.status() });
    store.addEvent('info', `开始测试 ${nodes.length} 个节点（${qualityOnly ? '仅 IP 画像' : connectOnly ? '仅代理握手' : '代理握手 + IP 画像'}）`);
    return sendJson(res, 202, { ok: true, job });
  }

  if (pathname === '/api/nodes/sites' && method === 'POST') {
    if (siteTester.status()?.running) {
      return apiError(res, 409, '已有站点检测任务正在运行', { job: siteTester.status() });
    }
    if (!(await siteTester.engineAvailable())) {
      const info = siteTester.engineInfo();
      return apiError(res, 503, `站点检测引擎不可执行：${info.path || '未配置'}（可在设置里指定 Mihomo 路径）`);
    }
    const sites = (store.state.settings.sites || []).filter((site) => site.enabled !== false);
    if (!sites.length) return apiError(res, 400, '没有启用站点检测项，请先在设置中添加');
    const body = await readBody(req);
    let nodes;
    if (Array.isArray(body.ids) && body.ids.length) {
      const ids = new Set(body.ids);
      nodes = store.state.nodes.filter((n) => ids.has(n.id));
    } else {
      nodes = sortNodeList(nodeQueryFilter(store.state, body.filter || {}), 'quality');
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
    const configuredBase = String(store.state.settings.subBaseUrl || '').trim().replace(/\/+$/, '');
    const base = configuredBase || `${proto}://${host}`;
    const link = `${base}/sub/${profile.token}${format ? `/${format}` : ''}`;
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

  const profileMatch = pathname.match(/^\/api\/profiles\/([A-Za-z0-9_-]+)(?:\/(preview|rotate|push))?$/);
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

    if (action === 'push' && method === 'POST') {
      try {
        const result = await pushProfile(store, profile, { manual: true });
        return sendJson(res, 200, {
          ...result,
          profile: { ...profile, summary: profileSummary(profile, store.state) },
        });
      } catch (err) {
        return apiError(res, 502, `推送失败：${errMessage(err)}`);
      }
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
    if (body.defaultInterval !== undefined) s.defaultInterval = safeInt(body.defaultInterval, s.defaultInterval, 5, 5256000);
    if (body.renameTemplate !== undefined) {
      const value = String(body.renameTemplate || '').trim();
      if (!value) return apiError(res, 400, '重命名模板不能为空');
      s.renameTemplate = value.slice(0, 240);
    }
    if (body.autoQuality !== undefined) s.autoQuality = Boolean(body.autoQuality);
    if (body.autoConnect !== undefined) s.autoConnect = Boolean(body.autoConnect);
    else if (body.autoTcp !== undefined) s.autoConnect = Boolean(body.autoTcp);
    if (body.autoTcp !== undefined) s.autoTcp = Boolean(body.autoTcp);
    if (body.autoSite !== undefined) s.autoSite = Boolean(body.autoSite);
    let latencyChanged = false;
    if (body.latencyAuto !== undefined) { s.latencyAuto = Boolean(body.latencyAuto); latencyChanged = true; }
    if (body.latencyIntervalMinutes !== undefined) {
      const next = safeInt(body.latencyIntervalMinutes, s.latencyIntervalMinutes, 5, 5256000);
      if (next !== s.latencyIntervalMinutes) latencyChanged = true;
      s.latencyIntervalMinutes = next;
    }
    // 夜间模式：先全部校验，通过后再落值，避免中途 400 把设置改脏。
    let quietChanged = false;
    let quietEnabledNext = s.quietHoursEnabled === true;
    if (body.quietHoursEnabled !== undefined) {
      const next = Boolean(body.quietHoursEnabled);
      if (next !== quietEnabledNext) { quietEnabledNext = next; quietChanged = true; }
    }
    let quietStartNext = s.quietHoursStart;
    if (body.quietHoursStart !== undefined) {
      const next = normalizeClock(body.quietHoursStart);
      if (!next) return apiError(res, 400, '夜间模式开始时间格式应为 HH:MM，例如 23:00');
      if (next !== quietStartNext) { quietStartNext = next; quietChanged = true; }
    }
    let quietEndNext = s.quietHoursEnd;
    if (body.quietHoursEnd !== undefined) {
      const next = normalizeClock(body.quietHoursEnd);
      if (!next) return apiError(res, 400, '夜间模式结束时间格式应为 HH:MM，例如 07:00');
      if (next !== quietEndNext) { quietEndNext = next; quietChanged = true; }
    }
    if (quietStartNext === quietEndNext) return apiError(res, 400, '夜间模式的开始与结束时间不能相同');
    s.quietHoursStart = quietStartNext;
    s.quietHoursEnd = quietEndNext;
    s.quietHoursEnabled = quietEnabledNext;
    if (body.connectConcurrency !== undefined) s.connectConcurrency = safeInt(body.connectConcurrency, s.connectConcurrency, 1, 80);
    if (body.connectTimeoutMs !== undefined) s.connectTimeoutMs = safeInt(body.connectTimeoutMs, s.connectTimeoutMs, 1000, 20000);
    if (body.tcpConcurrency !== undefined) s.tcpConcurrency = safeInt(body.tcpConcurrency, s.tcpConcurrency, 1, 64);
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
    if (body.proxycheckKey !== undefined) s.proxycheckKey = String(body.proxycheckKey || '').trim().slice(0, 200);
    if (body.proxycheckPerDay !== undefined) s.proxycheckPerDay = safeInt(body.proxycheckPerDay, s.proxycheckPerDay, 0, 2000);
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
    if (body.subBaseUrl !== undefined) {
      const value = String(body.subBaseUrl || '').trim().replace(/\/+$/, '');
      if (value) {
        let parsed;
        try { parsed = new URL(value); } catch { return apiError(res, 400, '订阅访问前缀需要是完整 URL，例如 https://sub.example.com'); }
        if (!/^https?:$/.test(parsed.protocol)) return apiError(res, 400, '订阅访问前缀需要以 http:// 或 https:// 开头');
        if (parsed.search || parsed.hash) return apiError(res, 400, '订阅访问前缀不能带查询参数或 # 片段');
      }
      s.subBaseUrl = value.slice(0, 500);
    }
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
    if (s.latencyAuto === false) {
      s.latencyNextAt = null;
    } else if (latencyChanged || !s.latencyNextAt) {
      s.latencyNextAt = new Date(Date.now() + Math.max(5, Number(s.latencyIntervalMinutes) || 60) * 60_000).toISOString();
    }
    // 若此刻正处于夜间模式（或刚把夜间区间改到现在），把测速顺延到夜间结束之后。
    if (s.latencyAuto !== false && quietChanged && inQuietHours(s)) {
      s.latencyNextAt = new Date(afterQuietHours(s)).toISOString();
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


const PROXY_MODES = new Set(['direct', 'auto', 'pool', 'custom']);
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
  // 指定了节点但该节点失效时,是否自动改用其它可用节点兜底。
  // 不传时跟随已有配置,新订阅默认开启。
  const fallbackEnabled = body.proxyFallback !== undefined
    ? body.proxyFallback === true || body.proxyFallback === 'on'
    : (fallback.proxyFallback === false ? false : true);
  if (url && !PROXY_URL_RE.test(url)) {
    throw new Error('代理地址需要以 http://、https:// 或 socks5:// 开头');
  }
  return {
    proxyMode: mode,
    proxyNodeId: nodeId,
    proxyUrl: url,
    proxyFallback: fallbackEnabled,
  };
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
      const publicApi = url.pathname === '/api/health'
        || url.pathname === '/api/auth/login'
        || url.pathname === '/api/auth/me'
        || url.pathname === '/api/auth/logout';
      if (!publicApi) {
        const session = auth.read(req);
        if (!session) return apiError(res, 401, '未登录或会话已过期');
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method || 'GET') && !auth.csrfOk(req, session)) {
          return apiError(res, 403, 'CSRF 校验失败，请刷新页面后重试');
        }
      }
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
    if (url.pathname === '/login' || url.pathname === '/login.html') {
      status = 200;
      await serveStatic(req, res, new URL('/login.html', url));
      logRequest(req, status, started);
      return;
    }
    if ((url.pathname === '/' || url.pathname === '/index.html') && !auth.read(req)) {
      status = 302;
      res.writeHead(302, { location: '/login' });
      res.end();
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
  console.log(`  时区 ${serverTimezone()}${process.env.SUBFLUX_TZ ? "（来自 SUBFLUX_TZ）" : process.env.TZ ? "（来自 TZ）" : "（服务器默认）"}`);
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
