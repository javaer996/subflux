import {
  b64encode,
  decodeComponent,
  parseQuery,
  safeInt,
  splitHostPort,
  stableStringify,
  tryBase64,
  cleanText,
  sha1,
} from './util.js';

function splitFragment(line) {
  const idx = line.indexOf('#');
  if (idx < 0) return { base: line, fragment: '' };
  return { base: line.slice(0, idx), fragment: line.slice(idx + 1) };
}

function hostForUri(host) {
  return String(host).includes(':') && !String(host).startsWith('[') ? `[${host}]` : String(host);
}

function nameOr(fragment, fallback) {
  const name = cleanText(decodeComponent(fragment), 100);
  return name || fallback;
}

function queryOf(base) {
  const idx = base.indexOf('?');
  if (idx < 0) return { main: base, query: '' };
  return { main: base.slice(0, idx), query: base.slice(idx + 1) };
}

function toNumber(value, fallback = 0) {
  return safeInt(value, fallback, 0, 65535);
}

function parseBoolish(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase());
}

function mapSsPlugin(pluginValue) {
  if (!pluginValue) return {};
  const bits = String(pluginValue).split(';').map((x) => x.trim());
  const name = bits.shift()?.toLowerCase();
  const opts = {};
  for (const bit of bits) {
    const i = bit.indexOf('=');
    if (i < 0) {
      opts[bit] = true;
    } else {
      opts[bit.slice(0, i)] = bit.slice(i + 1);
    }
  }
  if (name === 'obfs-local' || name === 'simple-obfs' || name === 'obfs') {
    return {
      plugin: 'obfs',
      'plugin-opts': {
        mode: opts.obfs || 'http',
        ...(opts['obfs-host'] ? { host: opts['obfs-host'] } : {}),
      },
    };
  }
  if (name === 'v2ray-plugin') {
    return {
      plugin: 'v2ray-plugin',
      'plugin-opts': {
        mode: opts.mode || 'websocket',
        ...(opts.host ? { host: opts.host } : {}),
        ...(opts.path ? { path: opts.path } : {}),
        ...(opts.tls ? { tls: true } : {}),
        ...(opts.mux ? { mux: true } : {}),
      },
    };
  }
  if (name === 'shadow-tls') {
    return {
      plugin: 'shadow-tls',
      'plugin-opts': {
        ...(opts.host ? { host: opts.host } : {}),
        ...(opts.password ? { password: opts.password } : {}),
        ...(opts.version ? { version: safeInt(opts.version, 3, 1, 3) } : {}),
      },
    };
  }
  return {};
}

function pluginStringFromClash(raw) {
  if (!raw.plugin) return '';
  const o = raw['plugin-opts'] || {};
  if (raw.plugin === 'obfs') {
    const parts = ['obfs-local', `obfs=${o.mode || 'http'}`];
    if (o.host) parts.push(`obfs-host=${o.host}`);
    return parts.join(';');
  }
  if (raw.plugin === 'v2ray-plugin') {
    const parts = ['v2ray-plugin', `mode=${o.mode || 'websocket'}`];
    if (o.host) parts.push(`host=${o.host}`);
    if (o.path) parts.push(`path=${o.path}`);
    if (o.tls) parts.push('tls');
    return parts.join(';');
  }
  if (raw.plugin === 'shadow-tls') {
    const parts = ['shadow-tls', `host=${o.host || ''}`, `password=${o.password || ''}`];
    if (o.version) parts.push(`version=${o.version}`);
    return parts.join(';');
  }
  return '';
}

function rawNetwork(raw) {
  return String(raw.network || 'tcp').toLowerCase();
}

function wsHeaders(raw) {
  const opts = raw['ws-opts'] || {};
  const headers = opts.headers || {};
  return {
    path: Array.isArray(opts.path) ? opts.path[0] : (opts.path || '/'),
    host: headers.Host || headers.host || '',
  };
}

function grpcService(raw) {
  return raw['grpc-opts']?.['grpc-service-name'] || '';
}

function tlsServerName(raw) {
  return raw.servername || raw.sni || raw['server-name'] || '';
}

function alpnArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return String(value).split(',').map((x) => x.trim()).filter(Boolean);
}

function transportClash(raw, hostHeader) {
  const net = rawNetwork(raw);
  if (net === 'ws' || net === 'websocket') {
    const ws = wsHeaders(raw);
    return {
      network: 'ws',
      'ws-opts': {
        path: ws.path || '/',
        ...(ws.host || hostHeader ? { headers: { Host: ws.host || hostHeader } } : {}),
      },
    };
  }
  if (net === 'grpc') {
    return { network: 'grpc', 'grpc-opts': { ...(grpcService(raw) ? { 'grpc-service-name': grpcService(raw) } : {}) } };
  }
  if (net === 'h2' || net === 'http') {
    return { network: 'h2' };
  }
  return { network: 'tcp' };
}

function parseSs(line) {
  const { base, fragment } = splitFragment(line);
  const { main, query } = queryOf(base.slice(5));
  let userinfo;
  let hostport;
  const at = main.lastIndexOf('@');
  if (at >= 0) {
    userinfo = main.slice(0, at);
    hostport = main.slice(at + 1);
    if (!userinfo.includes(':')) {
      const decoded = tryBase64(userinfo);
      if (decoded) userinfo = decoded;
    }
  } else {
    const decoded = tryBase64(main);
    if (!decoded) return null;
    const dat = decoded.lastIndexOf('@');
    if (dat < 0) return null;
    userinfo = decoded.slice(0, dat);
    hostport = decoded.slice(dat + 1);
  }
  const colon = userinfo.indexOf(':');
  if (colon < 0) return null;
  const cipher = decodeComponent(userinfo.slice(0, colon));
  const password = decodeComponent(userinfo.slice(colon + 1));
  const hp = splitHostPort(hostport);
  if (!hp?.host || !hp.port || !cipher || !password) return null;
  const q = parseQuery(query);
  const plugin = mapSsPlugin(q.plugin);
  const raw = {
    name: nameOr(fragment, `SS ${hp.host}`),
    type: 'ss',
    server: hp.host,
    port: hp.port,
    cipher,
    password,
    udp: true,
    ...plugin,
  };
  return { raw, uri: line, protocol: 'ss', name: raw.name, server: hp.host, port: hp.port };
}

function parseSsr(line) {
  const body = line.slice(6);
  const decoded = tryBase64(splitFragment(body).base);
  if (!decoded) return null;
  const qIdx = decoded.indexOf('?');
  const main = qIdx >= 0 ? decoded.slice(0, qIdx) : decoded;
  const qs = qIdx >= 0 ? decoded.slice(qIdx + 1) : '';
  const parts = main.split('/')[0].split(':');
  if (parts.length < 6) return null;
  const [host, portRaw, protocol, cipher, obfs, passB64] = parts;
  const port = toNumber(portRaw);
  if (!host || !port) return null;
  const password = tryBase64(passB64) ?? passB64;
  const q = parseQuery(qs);
  const obfsParam = q.obfsparam ? (tryBase64(q.obfsparam) ?? q.obfsparam) : '';
  const protocolParam = q.protoparam ? (tryBase64(q.protoparam) ?? q.protoparam) : '';
  const remarks = q.remarks ? (tryBase64(q.remarks) ?? q.remarks) : '';
  const raw = {
    name: cleanText(remarks, 100) || `SSR ${host}`,
    type: 'ssr',
    server: host,
    port,
    protocol,
    cipher,
    password,
    obfs,
    ...(obfsParam ? { 'obfs-param': obfsParam } : {}),
    ...(protocolParam ? { 'protocol-param': protocolParam } : {}),
    udp: true,
  };
  return { raw, uri: line, protocol: 'ssr', name: raw.name, server: host, port };
}

function parseVmess(line) {
  const body = splitFragment(line.slice(8)).base;
  const decoded = tryBase64(body);
  if (!decoded) return null;
  let j;
  try {
    j = JSON.parse(decoded);
  } catch {
    return null;
  }
  const server = cleanText(j.add || j.host, 253);
  const port = toNumber(j.port);
  const uuid = cleanText(j.id, 80);
  if (!server || !port || !uuid) return null;
  const net = String(j.net || 'tcp').toLowerCase();
  const headerType = String(j.type || 'none').toLowerCase();
  const tlsMode = String(j.tls || '').toLowerCase();
  const host = cleanText(j.host || j.sni, 253);
  const path = String(j.path || '');
  const raw = {
    name: cleanText(j.ps || j.remarks, 100) || `VMess ${server}`,
    type: 'vmess',
    server,
    port,
    uuid,
    alterId: safeInt(j.aid ?? j.alterId, 0, 0, 65535),
    cipher: j.scy || j.security || 'auto',
    udp: true,
  };
  if (tlsMode === 'tls' || tlsMode === 'reality') {
    raw.tls = true;
    if (j.sni || host) raw.servername = cleanText(j.sni || host, 253);
    if (parseBoolish(j.allowInsecure) || parseBoolish(j.insecure) || parseBoolish(j.skipCertVerify)) {
      raw['skip-cert-verify'] = true;
    }
    if (j.fp) raw['client-fingerprint'] = cleanText(j.fp, 30);
    if (j.alpn) raw.alpn = alpnArray(j.alpn);
  }
  if (net === 'ws') {
    raw.network = 'ws';
    raw['ws-opts'] = {
      path: path || '/',
      ...(host ? { headers: { Host: host } } : {}),
    };
  } else if (net === 'grpc') {
    raw.network = 'grpc';
    raw['grpc-opts'] = { 'grpc-service-name': path || 'grpc' };
  } else if (net === 'h2') {
    raw.network = 'h2';
    raw['h2-opts'] = { host: host ? [host] : [], path: path || '/' };
  } else if (net === 'http' && headerType === 'http') {
    raw.network = 'http';
    raw['http-opts'] = { path: [path || '/'], ...(host ? { headers: { Host: [host] } } : {}) };
  } else {
    raw.network = 'tcp';
    if (headerType === 'http') raw['http-opts'] = { path: [path || '/'], ...(host ? { headers: { Host: [host] } } : {}) };
  }
  return { raw, uri: line, protocol: 'vmess', name: raw.name, server, port };
}

function parseUrlStyle(line, scheme) {
  let u;
  try {
    u = new URL(line);
  } catch {
    return null;
  }
  const server = u.hostname.replace(/^\[|\]$/g, '');
  const port = toNumber(u.port, scheme === 'http' ? 80 : scheme === 'https' ? 443 : 0);
  if (!server || !port) return null;
  const q = Object.fromEntries(u.searchParams.entries());
  const name = nameOr(u.hash.slice(1), `${scheme.toUpperCase()} ${server}`);
  return { u, server, port, q, name };
}

function parseVless(line) {
  const p = parseUrlStyle(line, 'vless');
  if (!p) return null;
  const { u, server, port, q, name } = p;
  const uuid = decodeComponent(u.username);
  if (!uuid) return null;
  const security = String(q.security || 'none').toLowerCase();
  const type = String(q.type || 'tcp').toLowerCase();
  const host = q.host || '';
  const path = q.path || '/';
  const sni = q.sni || q.peer || host;
  const fp = q.fp || q.fingerprint || '';
  const alpn = q.alpn ? alpnArray(q.alpn) : [];
  const raw = {
    name,
    type: 'vless',
    server,
    port,
    uuid,
    udp: true,
    ...(q.flow ? { flow: q.flow } : {}),
  };
  if (security !== 'none') {
    raw.tls = true;
    if (sni) raw.servername = sni;
    if (fp) raw['client-fingerprint'] = fp;
    if (alpn.length) raw.alpn = alpn;
    if (parseBoolish(q.allowInsecure) || parseBoolish(q.insecure)) raw['skip-cert-verify'] = true;
    if (security === 'reality') {
      raw['reality-opts'] = {
        ...(q.pbk ? { 'public-key': q.pbk } : {}),
        ...(q.sid ? { 'short-id': q.sid } : {}),
      };
    }
  }
  if (type === 'ws') {
    raw.network = 'ws';
    raw['ws-opts'] = {
      path: path || '/',
      ...(host ? { headers: { Host: host } } : {}),
    };
  } else if (type === 'grpc') {
    raw.network = 'grpc';
    raw['grpc-opts'] = { 'grpc-service-name': q.serviceName || path || 'grpc' };
  } else if (type === 'h2' || type === 'http') {
    raw.network = 'h2';
    if (host || path) raw['h2-opts'] = { ...(host ? { host: [host] } : {}), path: path || '/' };
  } else if (type === 'httpupgrade') {
    raw.network = 'ws';
    raw['ws-opts'] = { path: path || '/', ...(host ? { headers: { Host: host } } : {}), 'v2ray-http-upgrade': true };
  } else {
    raw.network = 'tcp';
  }
  return { raw, uri: line, protocol: 'vless', name, server, port };
}

function parseTrojan(line) {
  const p = parseUrlStyle(line, 'trojan');
  if (!p) return null;
  const { u, server, port, q, name } = p;
  const password = decodeComponent(u.username);
  if (!password) return null;
  const type = String(q.type || 'tcp').toLowerCase();
  const host = q.host || '';
  const path = q.path || '/';
  const sni = q.sni || q.peer || host;
  const raw = {
    name,
    type: 'trojan',
    server,
    port,
    password,
    udp: true,
    ...(q.security === 'none' ? {} : { tls: true }),
  };
  if (sni) raw.sni = sni;
  if (parseBoolish(q.allowInsecure) || parseBoolish(q.insecure)) raw['skip-cert-verify'] = true;
  if (q.fp) raw['client-fingerprint'] = q.fp;
  if (q.alpn) raw.alpn = alpnArray(q.alpn);
  if (type === 'ws') {
    raw.network = 'ws';
    raw['ws-opts'] = { path: path || '/', ...(host ? { headers: { Host: host } } : {}) };
  } else if (type === 'grpc') {
    raw.network = 'grpc';
    raw['grpc-opts'] = { 'grpc-service-name': q.serviceName || path || 'grpc' };
  } else {
    raw.network = 'tcp';
  }
  return { raw, uri: line, protocol: 'trojan', name, server, port };
}

function parseHysteria2(line) {
  const p = parseUrlStyle(line, 'hysteria2');
  if (!p) return null;
  const { u, server, port, q, name } = p;
  const password = decodeComponent(u.username) || q.auth || q.password || '';
  if (!password) return null;
  const raw = {
    name,
    type: 'hysteria2',
    server,
    port,
    password,
    ...(q.sni ? { sni: q.sni } : {}),
    ...(parseBoolish(q.insecure) || parseBoolish(q.allowInsecure) ? { 'skip-cert-verify': true } : {}),
    ...(q.obfs ? { obfs: q.obfs } : {}),
    ...(q['obfs-password'] ? { 'obfs-password': q['obfs-password'] } : {}),
    ...(q.up ? { up: q.up } : {}),
    ...(q.down ? { down: q.down } : {}),
    ...(q.alpn ? { alpn: alpnArray(q.alpn) } : {}),
  };
  return { raw, uri: line, protocol: 'hysteria2', name, server, port };
}

function parseHysteria(line) {
  const p = parseUrlStyle(line, 'hysteria');
  if (!p) return null;
  const { u, server, port, q, name } = p;
  const auth = decodeComponent(u.username) || q.auth || '';
  const raw = {
    name,
    type: 'hysteria',
    server,
    port,
    ...(auth ? { 'auth-str': auth } : {}),
    ...(q.protocol ? { protocol: q.protocol } : {}),
    ...(q.peer || q.sni ? { sni: q.peer || q.sni } : {}),
    ...(parseBoolish(q.insecure) || parseBoolish(q.allowInsecure) ? { 'skip-cert-verify': true } : {}),
    ...(q.upmbps ? { up: q.upmbps } : {}),
    ...(q.downmbps ? { down: q.downmbps } : {}),
    ...(q.obfs ? { obfs: q.obfs } : {}),
    ...(q.alpn ? { alpn: alpnArray(q.alpn) } : {}),
  };
  if (!auth && !q.obfs) return null;
  return { raw, uri: line, protocol: 'hysteria', name, server, port };
}

function parseTuic(line) {
  const p = parseUrlStyle(line, 'tuic');
  if (!p) return null;
  const { u, server, port, q, name } = p;
  const uuid = decodeComponent(u.username);
  const password = decodeComponent(u.password);
  if (!uuid) return null;
  const raw = {
    name,
    type: 'tuic',
    server,
    port,
    uuid,
    ...(password ? { password } : {}),
    ...(q.sni ? { sni: q.sni } : {}),
    ...(q.alpn ? { alpn: alpnArray(q.alpn) } : { alpn: ['h3'] }),
    ...(q.congestion_control || q['congestion-controller']
      ? { 'congestion-controller': q.congestion_control || q['congestion-controller'] }
      : { 'congestion-controller': 'bbr' }),
    ...(q.udp_relay_mode || q['udp-relay-mode'] ? { 'udp-relay-mode': q.udp_relay_mode || q['udp-relay-mode'] } : {}),
    ...(parseBoolish(q.allow_insecure) || parseBoolish(q.insecure) ? { 'skip-cert-verify': true } : {}),
    ...(parseBoolish(q.disable_sni) ? { 'disable-sni': true } : {}),
    'reduce-rtt': true,
  };
  return { raw, uri: line, protocol: 'tuic', name, server, port };
}

function parseSocks(line, scheme) {
  const p = parseUrlStyle(line, scheme);
  if (!p) return null;
  const { u, server, port, name } = p;
  const raw = {
    name,
    type: scheme === 'http' || scheme === 'https' ? 'http' : 'socks5',
    server,
    port,
    ...(u.username ? { username: decodeComponent(u.username) } : {}),
    ...(u.password ? { password: decodeComponent(u.password) } : {}),
    ...(scheme === 'https' ? { tls: true } : {}),
    udp: scheme !== 'http' && scheme !== 'https',
  };
  return { raw, uri: line, protocol: raw.type, name, server, port };
}

function parseAnyTls(line) {
  const p = parseUrlStyle(line, 'anytls');
  if (!p) return null;
  const { u, server, port, q, name } = p;
  const password = decodeComponent(u.username);
  if (!password) return null;
  const raw = {
    name,
    type: 'anytls',
    server,
    port,
    password,
    ...(q.sni ? { sni: q.sni } : {}),
    ...(parseBoolish(q.insecure) || parseBoolish(q.allowInsecure) ? { 'skip-cert-verify': true } : {}),
    ...(q.fp ? { 'client-fingerprint': q.fp } : {}),
  };
  return { raw, uri: line, protocol: 'anytls', name, server, port };
}

export function parseUri(line) {
  const text = String(line || '').trim();
  if (!text) return null;
  const scheme = text.slice(0, text.indexOf('://')).toLowerCase();
  try {
    if (scheme === 'ss') return parseSs(text);
    if (scheme === 'ssr') return parseSsr(text);
    if (scheme === 'vmess') return parseVmess(text);
    if (scheme === 'vless') return parseVless(text);
    if (scheme === 'trojan') return parseTrojan(text);
    if (scheme === 'hysteria2' || scheme === 'hy2') return parseHysteria2(text);
    if (scheme === 'hysteria') return parseHysteria(text);
    if (scheme === 'tuic') return parseTuic(text);
    if (scheme === 'socks5' || scheme === 'socks') return parseSocks(text, scheme);
    if (scheme === 'http' || scheme === 'https') return parseSocks(text, scheme);
    if (scheme === 'anytls') return parseAnyTls(text);
  } catch {
    return null;
  }
  return null;
}

/*********************************
 * Fingerprints & URI generation *
 *********************************/

export function nodeFingerprint(node) {
  const raw = node.raw || {};
  const identity = [
    raw.uuid,
    raw.password,
    raw.cipher,
    raw.username,
    raw['auth-str'],
    raw.psk,
    raw['private-key'],
    String(raw.network || 'tcp').toLowerCase(),
    raw['ws-opts']?.path || '',
    raw['grpc-opts']?.['grpc-service-name'] || '',
  ].filter((v) => v !== undefined && v !== null && v !== '').join('|');
  const fallback = node.uri ? node.uri.split('#')[0] : stableStringify(raw);
  return sha1([node.protocol || raw.type, String(node.server || raw.server).toLowerCase(), node.port || raw.port, identity || fallback].join('|'));
}

function encodeName(name) {
  return encodeURIComponent(cleanText(name, 120));
}

function buildSsUri(raw, name) {
  const user = Buffer.from(`${raw.cipher}:${raw.password}`, 'utf8').toString('base64url');
  const plugin = pluginStringFromClash(raw);
  return `ss://${user}@${hostForUri(raw.server)}:${raw.port}${plugin ? `?plugin=${encodeURIComponent(plugin)}` : ''}#${encodeName(name)}`;
}

function buildSsrUri(raw, name) {
  const pass = Buffer.from(String(raw.password || ''), 'utf8').toString('base64url');
  const main = `${raw.server}:${raw.port}:${raw.protocol}:${raw.cipher}:${raw.obfs}:${pass}`;
  const params = new URLSearchParams();
  if (raw['obfs-param']) params.set('obfsparam', Buffer.from(String(raw['obfs-param']), 'utf8').toString('base64url'));
  if (raw['protocol-param']) params.set('protoparam', Buffer.from(String(raw['protocol-param']), 'utf8').toString('base64url'));
  params.set('remarks', Buffer.from(String(name || raw.name || ''), 'utf8').toString('base64url'));
  const body = Buffer.from(`${main}/?${params.toString()}`, 'utf8').toString('base64url');
  return `ssr://${body}`;
}

function buildVmessUri(raw, name) {
  const ws = wsHeaders(raw);
  const net = raw.network || 'tcp';
  let host = ws.host || raw.servername || '';
  let path = ws.path || '';
  let type = 'none';
  if (net === 'grpc') {
    path = grpcService(raw);
    host = raw.servername || '';
  } else if (net === 'h2') {
    host = raw['h2-opts']?.host?.[0] || host;
    path = raw['h2-opts']?.path || path;
  } else if (net === 'http') {
    host = raw['http-opts']?.headers?.Host?.[0] || host;
    path = raw['http-opts']?.path?.[0] || path;
    type = 'http';
  }
  const obj = {
    v: '2',
    ps: name || raw.name || '',
    add: raw.server,
    port: String(raw.port),
    id: raw.uuid,
    aid: String(raw.alterId || 0),
    scy: raw.cipher || 'auto',
    net: net === 'tcp' ? 'tcp' : net,
    type,
    host: host || '',
    path: path || '',
    tls: raw.tls ? 'tls' : '',
    sni: raw.servername || raw.sni || '',
    alpn: alpnArray(raw.alpn).join(','),
    fp: raw['client-fingerprint'] || '',
  };
  if (!obj.host && raw.tls) obj.host = obj.sni;
  return `vmess://${b64encode(JSON.stringify(obj))}`;
}

function buildVlessUri(raw, name) {
  const p = new URLSearchParams();
  p.set('encryption', 'none');
  const security = raw['reality-opts'] ? 'reality' : raw.tls ? 'tls' : 'none';
  if (security !== 'none') p.set('security', security);
  if (raw.servername || raw.sni) p.set('sni', raw.servername || raw.sni);
  if (raw['client-fingerprint']) p.set('fp', raw['client-fingerprint']);
  if (raw.flow) p.set('flow', raw.flow);
  if (raw.alpn) p.set('alpn', alpnArray(raw.alpn).join(','));
  if (raw['skip-cert-verify']) p.set('allowInsecure', '1');
  if (raw['reality-opts']) {
    if (raw['reality-opts']['public-key']) p.set('pbk', raw['reality-opts']['public-key']);
    if (raw['reality-opts']['short-id']) p.set('sid', raw['reality-opts']['short-id']);
  }
  const net = raw.network || 'tcp';
  p.set('type', net);
  if (net === 'ws') {
    const ws = wsHeaders(raw);
    if (ws.path) p.set('path', ws.path);
    if (ws.host) p.set('host', ws.host);
  } else if (net === 'grpc') {
    p.set('serviceName', grpcService(raw));
  } else if (net === 'h2' || net === 'http') {
    const host = raw['h2-opts']?.host?.[0] || raw['http-opts']?.headers?.Host?.[0] || '';
    const path = raw['h2-opts']?.path || raw['http-opts']?.path?.[0] || '';
    if (host) p.set('host', host);
    if (path) p.set('path', path);
  }
  return `vless://${encodeURIComponent(raw.uuid)}@${hostForUri(raw.server)}:${raw.port}?${p.toString()}#${encodeName(name)}`;
}

function buildTrojanUri(raw, name) {
  const p = new URLSearchParams();
  if (raw.sni) p.set('sni', raw.sni);
  if (raw['skip-cert-verify']) p.set('allowInsecure', '1');
  if (raw['client-fingerprint']) p.set('fp', raw['client-fingerprint']);
  if (raw.alpn) p.set('alpn', alpnArray(raw.alpn).join(','));
  const net = raw.network || 'tcp';
  if (net !== 'tcp') p.set('type', net);
  if (net === 'ws') {
    const ws = wsHeaders(raw);
    if (ws.path) p.set('path', ws.path);
    if (ws.host) p.set('host', ws.host);
  } else if (net === 'grpc') {
    p.set('serviceName', grpcService(raw));
  }
  return `trojan://${encodeURIComponent(raw.password)}@${hostForUri(raw.server)}:${raw.port}${p.size ? `?${p.toString()}` : ''}#${encodeName(name)}`;
}

function buildHysteria2Uri(raw, name) {
  const p = new URLSearchParams();
  if (raw.sni) p.set('sni', raw.sni);
  if (raw['skip-cert-verify']) p.set('insecure', '1');
  if (raw.obfs) p.set('obfs', raw.obfs);
  if (raw['obfs-password']) p.set('obfs-password', raw['obfs-password']);
  if (raw.up) p.set('up', raw.up);
  if (raw.down) p.set('down', raw.down);
  if (raw.alpn) p.set('alpn', alpnArray(raw.alpn).join(','));
  return `hysteria2://${encodeURIComponent(raw.password)}@${hostForUri(raw.server)}:${raw.port}?${p.toString()}#${encodeName(name)}`;
}

function buildHysteriaUri(raw, name) {
  const p = new URLSearchParams();
  if (raw['auth-str']) p.set('auth', raw['auth-str']);
  if (raw.sni) p.set('peer', raw.sni);
  if (raw['skip-cert-verify']) p.set('insecure', '1');
  if (raw.protocol) p.set('protocol', raw.protocol);
  if (raw.up) p.set('upmbps', raw.up);
  if (raw.down) p.set('downmbps', raw.down);
  if (raw.obfs) p.set('obfs', raw.obfs);
  if (raw.alpn) p.set('alpn', alpnArray(raw.alpn).join(','));
  return `hysteria://${hostForUri(raw.server)}:${raw.port}?${p.toString()}#${encodeName(name)}`;
}

function buildTuicUri(raw, name) {
  const p = new URLSearchParams();
  if (raw.sni) p.set('sni', raw.sni);
  if (raw.alpn) p.set('alpn', alpnArray(raw.alpn).join(','));
  if (raw['congestion-controller']) p.set('congestion_control', raw['congestion-controller']);
  if (raw['udp-relay-mode']) p.set('udp_relay_mode', raw['udp-relay-mode']);
  if (raw['skip-cert-verify']) p.set('allow_insecure', '1');
  if (raw['disable-sni']) p.set('disable_sni', '1');
  const user = `${encodeURIComponent(raw.uuid)}${raw.password ? `:${encodeURIComponent(raw.password)}` : ''}`;
  return `tuic://${user}@${hostForUri(raw.server)}:${raw.port}?${p.toString()}#${encodeName(name)}`;
}

function buildSocksUri(raw, name) {
  const scheme = raw.tls ? 'https' : raw.type === 'http' ? 'http' : 'socks5';
  const auth = raw.username ? `${encodeURIComponent(raw.username)}${raw.password ? `:${encodeURIComponent(raw.password)}` : ''}@` : '';
  return `${scheme}://${auth}${hostForUri(raw.server)}:${raw.port}#${encodeName(name)}`;
}

function buildAnyTlsUri(raw, name) {
  const p = new URLSearchParams();
  if (raw.sni) p.set('sni', raw.sni);
  if (raw['skip-cert-verify']) p.set('insecure', '1');
  if (raw['client-fingerprint']) p.set('fp', raw['client-fingerprint']);
  return `anytls://${encodeURIComponent(raw.password)}@${hostForUri(raw.server)}:${raw.port}${p.size ? `?${p.toString()}` : ''}#${encodeName(name)}`;
}

export function buildUri(node, name) {
  const raw = node.raw;
  const n = name || node.name;
  if (node.uri) {
    const renamed = renameUri(node.uri, n);
    if (renamed) return renamed;
  }
  if (!raw) return null;
  try {
    if (raw.type === 'ss') return buildSsUri(raw, n);
    if (raw.type === 'ssr') return buildSsrUri(raw, n);
    if (raw.type === 'vmess') return buildVmessUri(raw, n);
    if (raw.type === 'vless') return buildVlessUri(raw, n);
    if (raw.type === 'trojan') return buildTrojanUri(raw, n);
    if (raw.type === 'hysteria2') return buildHysteria2Uri(raw, n);
    if (raw.type === 'hysteria') return buildHysteriaUri(raw, n);
    if (raw.type === 'tuic') return buildTuicUri(raw, n);
    if (raw.type === 'socks5' || raw.type === 'http') return buildSocksUri(raw, n);
    if (raw.type === 'anytls') return buildAnyTlsUri(raw, n);
  } catch {
    return null;
  }
  return null;
}

export function renameUri(uri, name) {
  const text = String(uri || '').trim();
  if (!text) return null;
  if (text.toLowerCase().startsWith('vmess://')) {
    const decoded = tryBase64(splitFragment(text.slice(8)).base);
    if (!decoded) return null;
    try {
      const j = JSON.parse(decoded);
      j.ps = cleanText(name, 120);
      return `vmess://${b64encode(JSON.stringify(j))}`;
    } catch {
      return null;
    }
  }
  if (text.toLowerCase().startsWith('ssr://')) {
    const parsed = parseSsr(text);
    return parsed ? buildSsrUri(parsed.raw, name) : null;
  }
  const hash = text.indexOf('#');
  const base = hash >= 0 ? text.slice(0, hash) : text;
  return `${base}#${encodeName(name)}`;
}

export function protocolSupportedForSingbox(protocol) {
  return ['ss', 'vmess', 'vless', 'trojan', 'hysteria2', 'tuic', 'http', 'socks5', 'anytls'].includes(protocol);
}
