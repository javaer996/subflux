#!/usr/bin/env node
/**
 * SubFlux China probe.
 * Run on a host inside mainland China. It has no access to subscription URLs:
 * the main instance sends only host:port for TCP checks, or Clash proxy objects
 * for an actual Mihomo proxy test (needed for HY2/TUIC/WireGuard/UDP).
 */
import http from 'node:http';
import net from 'node:net';
import tls from 'node:tls';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const PORT = Number.parseInt(process.env.PROBE_PORT || '8899', 10);
const HOST = process.env.PROBE_HOST || '0.0.0.0';
const TOKEN = process.env.PROBE_TOKEN || '';
const MIHOMO_BIN = process.env.MIHOMO_BIN || 'mihomo';
const DATA_ROOT = process.env.PROBE_DATA_DIR || os.tmpdir();
try {
  fs.mkdirSync(DATA_ROOT, { recursive: true });
} catch {}
const MAX_BODY = 2 * 1024 * 1024;
const MAX_PROXY_NODES = 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!TOKEN || TOKEN.length < 16) {
  console.error('请设置至少 16 位的 PROBE_TOKEN 环境变量');
  process.exit(1);
}

function tcpPing(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const started = performance.now();
    let done = false;
    const socket = net.connect({ host, port });
    const finish = (ok, error = '') => {
      if (done) return;
      done = true;
      const latency = Math.round(performance.now() - started);
      socket.destroy();
      resolve({ ok, latency: ok ? latency : null, error });
    };
    socket.setTimeout(timeoutMs, () => finish(false, 'timeout'));
    socket.once('connect', () => finish(true));
    socket.once('error', (err) => finish(false, err.code || err.message));
  });
}

function readJson(req, maxBytes = MAX_BODY) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (err) {
        reject(new Error('invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function authorized(req, body) {
  const header = req.headers.authorization || '';
  return header === `Bearer ${TOKEN}` || req.headers['x-probe-token'] === TOKEN || body?.token === TOKEN;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function controlRequest(port, secret, method, pathname, body = null, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? '' : JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1',
      port,
      method,
      path: pathname,
      timeout: timeoutMs,
      headers: {
        authorization: `Bearer ${secret}`,
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('controller timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitEngine(apiPort, secret, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await controlRequest(apiPort, secret, 'GET', '/version', null, 1500);
      if (res.status === 200) return;
    } catch {
      // engine still starting
    }
    await sleep(180);
  }
  throw new Error('Mihomo 启动超时');
}

function proxyFetch(proxyPort, rawUrl, timeoutMs) {
  return new Promise((resolve) => {
    const target = new URL(rawUrl);
    const started = performance.now();
    let settled = false;
    let req;
    let tlsSocket;
    const finish = (ok, status, error = '') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { tlsSocket?.destroy(); } catch {}
      try { req?.destroy(); } catch {}
      resolve({ ok, status: status || 0, latency: Math.round(performance.now() - started), error });
    };
    const timer = setTimeout(() => finish(false, 0, 'timeout'), timeoutMs);

    const onResponse = (res, socket) => {
      const status = res.statusCode || 0;
      let bodySeen = false;
      res.on('data', () => { bodySeen = true; });
      res.on('end', () => finish(status > 0, status, status > 0 ? '' : 'empty response'));
      res.on('error', (err) => finish(false, status, err.code || err.message));
      // Some proxies keep the connection open; a complete header is enough.
      res.on('close', () => finish(status > 0, status, status > 0 ? '' : 'connection closed'));
      socket?.on('error', (err) => finish(false, status, err.code || err.message));
    };

    try {
      if (target.protocol === 'https:') {
        const port = target.port || 443;
        req = http.request({
          host: '127.0.0.1',
          port: proxyPort,
          method: 'CONNECT',
          path: `${target.hostname}:${port}`,
          timeout: timeoutMs,
          headers: { host: `${target.hostname}:${port}` },
        });
        req.on('timeout', () => finish(false, 0, 'CONNECT timeout'));
        req.on('error', (err) => finish(false, 0, err.code || err.message));
        req.on('connect', (res, socket, head) => {
          if (res.statusCode !== 200) return finish(false, res.statusCode, `CONNECT ${res.statusCode}`);
          tlsSocket = tls.connect({ socket, servername: target.hostname, rejectUnauthorized: false });
          tlsSocket.setTimeout(timeoutMs, () => finish(false, 0, 'TLS timeout'));
          tlsSocket.once('error', (err) => finish(false, 0, err.code || err.message));
          tlsSocket.once('secureConnect', () => {
            const requestPath = `${target.pathname || '/'}${target.search || ''}`;
            tlsSocket.write(
              `GET ${requestPath} HTTP/1.1\r\nHost: ${target.host}\r\nUser-Agent: subflux-probe/1.0\r\nAccept: */*\r\nConnection: close\r\n\r\n`
            );
            if (head?.length) {
              // The proxy may have sent the beginning of the TLS stream already.
            }
          });
          tlsSocket.once('data', (chunk) => {
            const text = chunk.toString('latin1');
            const match = text.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/);
            if (match) finish(Number(match[1]) > 0, Number(match[1]));
            else finish(false, 0, 'unexpected HTTP response');
          });
        });
        req.end();
      } else {
        req = http.request({
          host: '127.0.0.1',
          port: proxyPort,
          method: 'GET',
          path: target.href,
          timeout: timeoutMs,
          headers: { host: target.host, 'user-agent': 'subflux-probe/1.0', connection: 'close' },
        }, (res) => onResponse(res));
        req.on('timeout', () => finish(false, 0, 'HTTP timeout'));
        req.on('error', (err) => finish(false, 0, err.code || err.message));
        req.end();
      }
    } catch (err) {
      finish(false, 0, err.message);
    }
  });
}

async function runProxyTest(nodes, testUrl, timeoutMs, requestId) {
  const usable = nodes
    .filter((node) => node && node.proxy && typeof node.proxy === 'object')
    .slice(0, MAX_PROXY_NODES);
  if (!usable.length) throw new Error('没有可用的代理配置');
  const proxies = usable.map((node, index) => ({ ...node.proxy, name: `PROBE_NODE_${index}` }));
  const names = proxies.map((proxy) => proxy.name);
  const mixedPort = await freePort();
  let apiPort = await freePort();
  while (apiPort === mixedPort) apiPort = await freePort();
  const secret = randomBytes(16).toString('hex');
  const dir = fs.mkdtempSync(path.join(DATA_ROOT, 'subflux-probe-'));
  const configPath = path.join(dir, 'config.json');
  const config = {
    'mixed-port': mixedPort,
    'allow-lan': false,
    mode: 'rule',
    'log-level': 'silent',
    'external-controller': `127.0.0.1:${apiPort}`,
    secret,
    proxies,
    'proxy-groups': [{ name: 'PROBE', type: 'select', proxies: names }],
    rules: ['MATCH,PROBE'],
  };
  fs.writeFileSync(configPath, JSON.stringify(config));
  let stderr = '';
  const engine = spawn(MIHOMO_BIN, ['-f', configPath, '-d', dir], { stdio: ['ignore', 'ignore', 'pipe'] });
  engine.stderr?.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-3000); });
  let engineError = '';
  engine.once('error', (err) => { engineError = err.code === 'ENOENT' ? `找不到 Mihomo 可执行文件：${MIHOMO_BIN}` : err.message; });
  const results = [];
  try {
    await waitEngine(apiPort, secret);
    for (let index = 0; index < usable.length; index += 1) {
      const node = usable[index];
      try {
        const selected = await controlRequest(apiPort, secret, 'PUT', '/proxies/PROBE', { name: `PROBE_NODE_${index}` });
        if (selected.status !== 204) throw new Error(`切换节点失败 ${selected.status}`);
        await sleep(100);
        const result = await proxyFetch(mixedPort, testUrl, timeoutMs);
        results.push({ id: node.id, ...result });
      } catch (err) {
        results.push({ id: node.id, ok: false, status: 0, latency: null, error: err.message });
      }
    }
    return results;
  } catch (err) {
    throw new Error(engineError || `${err.message}${stderr ? ` · ${stderr.slice(-600)}` : ''}`);
  } finally {
    try { engine.kill('SIGTERM'); } catch {}
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

let activeProxy = false;
const server = http.createServer(async (req, res) => {
  const send = (status, payload) => {
    if (res.writableEnded) return;
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(payload));
  };
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, probe: 'china', mihomo: MIHOMO_BIN });
  let body;
  try {
    if (req.method === 'POST') body = await readJson(req);
    else body = {};
  } catch (err) {
    return send(400, { ok: false, error: err.message });
  }
  if (!authorized(req, body)) return send(401, { ok: false, error: 'unauthorized' });

  if (req.method === 'POST' && req.url === '/api/probe/tcp') {
    const nodes = Array.isArray(body.nodes) ? body.nodes.slice(0, 200) : [];
    if (!nodes.length) return send(400, { ok: false, error: 'nodes is empty' });
    const timeoutMs = Math.max(1000, Math.min(15000, Number(body.timeoutMs) || 5000));
    const results = [];
    let cursor = 0;
    const workers = Array.from({ length: Math.min(8, nodes.length) }, async () => {
      while (cursor < nodes.length) {
        const node = nodes[cursor++];
        const host = String(node?.host || '').trim();
        const port = Number(node?.port);
        if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
          results.push({ id: node?.id, ok: false, latency: null, error: 'invalid target' });
          continue;
        }
        results.push({ id: node.id, ...(await tcpPing(host, port, timeoutMs)) });
      }
    });
    await Promise.all(workers);
    return send(200, { ok: true, results, testedAt: new Date().toISOString() });
  }

  if (req.method === 'POST' && req.url === '/api/probe/http') {
    const target = String(body.url || '').trim();
    if (!/^https?:\/\//i.test(target)) return send(400, { ok: false, error: 'invalid url' });
    const started = performance.now();
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(10000), redirect: 'follow' });
      await response.arrayBuffer().catch(() => null);
      return send(200, { ok: true, status: response.status, latency: Math.round(performance.now() - started) });
    } catch (err) {
      return send(200, { ok: false, status: 0, latency: Math.round(performance.now() - started), error: err.message });
    }
  }

  if (req.method === 'POST' && req.url === '/api/probe/proxy') {
    if (activeProxy) return send(409, { ok: false, error: '已有中国代理检测任务' });
    const nodes = Array.isArray(body.nodes) ? body.nodes.slice(0, MAX_PROXY_NODES) : [];
    if (!nodes.length) return send(400, { ok: false, error: 'nodes is empty' });
    const testUrl = String(body.testUrl || 'https://www.qq.com/');
    if (!/^https?:\/\//i.test(testUrl)) return send(400, { ok: false, error: 'invalid testUrl' });
    const timeoutMs = Math.max(2000, Math.min(20000, Number(body.timeoutMs) || 8000));
    activeProxy = true;
    try {
      const results = await runProxyTest(nodes, testUrl, timeoutMs);
      return send(200, { ok: true, results, testedAt: new Date().toISOString() });
    } catch (err) {
      return send(500, { ok: false, error: err.message });
    } finally {
      activeProxy = false;
    }
  }

  send(404, { ok: false, error: 'not found' });
});

server.requestTimeout = 900000;
server.headersTimeout = 30000;
server.listen(PORT, HOST, () => {
  console.log(`SubFlux China probe listening on ${HOST}:${PORT}`);
});
