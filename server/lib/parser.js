import YAML from 'yaml';
import { parseUri, nodeFingerprint } from './uri.js';
import { cleanText, safeInt, tryBase64, uniqueBy } from './util.js';

const CLASH_TYPES = new Set([
  'ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria', 'hysteria2', 'tuic',
  'http', 'socks5', 'anytls', 'snell', 'wireguard', 'ssh',
]);

const TYPE_ALIASES = {
  socks: 'socks5',
  hy2: 'hysteria2',
};

function normalizeClashProxy(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  let raw;
  try {
    raw = structuredClone(input);
  } catch {
    return null;
  }
  raw.type = String(raw.type || '').toLowerCase();
  raw.type = TYPE_ALIASES[raw.type] || raw.type;
  if (!CLASH_TYPES.has(raw.type)) return null;
  const server = cleanText(raw.server, 253);
  const port = safeInt(raw.port, 0, 1, 65535);
  if (!server || !port) return null;
  raw.server = server;
  raw.port = port;
  raw.name = cleanText(raw.name, 100) || `${raw.type.toUpperCase()} ${server}`;
  if ('alterId' in raw) raw.alterId = safeInt(raw.alterId, 0, 0, 65535);
  if ('alter-id' in raw && !('alterId' in raw)) raw.alterId = safeInt(raw['alter-id'], 0, 0, 65535);
  for (const key of ['uuid', 'password', 'cipher', 'username', 'protocol', 'obfs']) {
    if (raw[key] !== undefined && raw[key] !== null) raw[key] = String(raw[key]);
  }
  if (raw.type === 'ss' && (!raw.cipher || !raw.password)) return null;
  if ((raw.type === 'vmess' || raw.type === 'vless' || raw.type === 'tuic') && !raw.uuid) return null;
  if (['trojan', 'hysteria', 'hysteria2', 'anytls'].includes(raw.type) && !raw.password && !raw['auth-str']) return null;
  if (raw.type === 'ssr' && (!raw.cipher || !raw.protocol || !raw.obfs || !raw.password)) return null;
  return {
    name: raw.name,
    protocol: raw.type,
    server,
    port,
    raw,
    uri: null,
  };
}

function parseClashYaml(text) {
  let doc;
  try {
    doc = YAML.parse(text, { maxAliasCount: 100, uniqueKeys: false, prettyErrors: false });
  } catch (err) {
    return { format: 'yaml-error', nodes: [], warnings: [`YAML 解析失败：${err.message}`] };
  }
  if (!doc || typeof doc !== 'object') {
    return { format: 'unknown', nodes: [], warnings: [] };
  }
  if (!Array.isArray(doc.proxies)) {
    if (doc['proxy-providers'] && typeof doc['proxy-providers'] === 'object') {
      return {
        format: 'clash-provider',
        nodes: [],
        warnings: ['该订阅只包含 proxy-providers 远程集合，而非直接节点列表；请使用服务商提供的 Clash 订阅链接'],
      };
    }
    return { format: 'clash', nodes: [], warnings: [] };
  }
  const warnings = [];
  let skipped = 0;
  const nodes = [];
  for (const item of doc.proxies) {
    const node = normalizeClashProxy(item);
    if (node) nodes.push(node);
    else skipped += 1;
  }
  if (skipped) warnings.push(`已跳过 ${skipped} 个字段缺失或暂不支持的 Clash 节点`);
  return { format: 'clash', nodes, warnings };
}

function parseUriLines(text) {
  const nodes = [];
  let skipped = 0;
  let unsupported = 0;
  const warnings = [];
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim().replace(/^['"]|['"]$/g, '');
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    if (!line.includes('://')) {
      const decoded = tryBase64(line);
      if (decoded && decoded.includes('://')) line = decoded.trim();
      else {
        skipped += 1;
        continue;
      }
    }
    const parsed = parseUri(line);
    if (parsed) nodes.push(parsed);
    else {
      unsupported += 1;
    }
  }
  if (unsupported) warnings.push(`已跳过 ${unsupported} 条无法识别的节点链接`);
  if (skipped) warnings.push(`已忽略 ${skipped} 行非订阅内容`);
  return { format: 'uri-list', nodes, warnings };
}

function parsePluginOptions(value) {
  const opts = {};
  for (const part of String(value || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) {
      if (part.trim()) opts[part.trim()] = true;
    } else {
      opts[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    }
  }
  return opts;
}

function singboxTransport(out) {
  const t = out.transport;
  if (!t || typeof t !== 'object') return {};
  const type = String(t.type || '').toLowerCase();
  if (type === 'ws') {
    return {
      network: 'ws',
      'ws-opts': {
        path: t.path || '/',
        ...(t.headers && Object.keys(t.headers).length ? { headers: { ...t.headers } } : {}),
      },
    };
  }
  if (type === 'grpc') {
    return { network: 'grpc', 'grpc-opts': { 'grpc-service-name': t.service_name || '' } };
  }
  if (type === 'http') {
    return {
      network: 'h2',
      'h2-opts': {
        ...(Array.isArray(t.host) && t.host.length ? { host: t.host } : {}),
        path: t.path || '/',
      },
    };
  }
  return {};
}

function singboxTls(out, force = false) {
  const t = out.tls;
  if (!t || t.enabled === false) return force ? { tls: true } : {};
  const result = { tls: true };
  if (t.server_name) result.servername = t.server_name;
  if (t.insecure) result['skip-cert-verify'] = true;
  if (Array.isArray(t.alpn) && t.alpn.length) result.alpn = t.alpn;
  if (t.utls?.fingerprint) result['client-fingerprint'] = t.utls.fingerprint;
  if (t.reality?.enabled) {
    result['reality-opts'] = {
      ...(t.reality.public_key ? { 'public-key': t.reality.public_key } : {}),
      ...(t.reality.short_id ? { 'short-id': t.reality.short_id } : {}),
    };
  }
  return result;
}

function convertSingboxOutbound(out, warnings) {
  if (!out || typeof out !== 'object') return null;
  const type = String(out.type || '').toLowerCase();
  if (['selector', 'urltest', 'direct', 'block', 'dns'].includes(type)) return null;
  const server = cleanText(out.server, 253);
  const port = safeInt(out.server_port, 0, 1, 65535);
  if (!server || !port) return null;
  const name = cleanText(out.tag, 100) || `${type.toUpperCase()} ${server}`;
  const base = { name, server, port, udp: true };
  if (type === 'shadowsocks') {
    const raw = { ...base, type: 'ss', cipher: String(out.method || ''), password: String(out.password || '') };
    if (!raw.cipher || !raw.password) return null;
    if (out.plugin) {
      const o = parsePluginOptions(out.plugin_opts);
      if (out.plugin === 'obfs-local' || out.plugin === 'simple-obfs') {
        raw.plugin = 'obfs';
        raw['plugin-opts'] = { mode: o.obfs || 'http', ...(o['obfs-host'] ? { host: o['obfs-host'] } : {}) };
      } else if (out.plugin === 'v2ray-plugin') {
        raw.plugin = 'v2ray-plugin';
        raw['plugin-opts'] = {
          mode: o.mode || 'websocket',
          ...(o.host ? { host: o.host } : {}),
          ...(o.path ? { path: o.path } : {}),
          ...(o.tls ? { tls: true } : {}),
        };
      } else {
        warnings.push(`节点「${name}」使用了暂不支持的 Shadowsocks 插件 ${out.plugin}`);
        return null;
      }
    }
    return { ...raw, protocol: 'ss', raw, uri: null };
  }
  if (type === 'vmess') {
    const raw = {
      ...base,
      type: 'vmess',
      uuid: String(out.uuid || ''),
      alterId: safeInt(out.alter_id, 0, 0, 65535),
      cipher: String(out.security || 'auto'),
      ...singboxTransport(out),
      ...singboxTls(out),
    };
    if (!raw.uuid) return null;
    return { name, protocol: 'vmess', server, port, raw, uri: null };
  }
  if (type === 'vless') {
    const raw = {
      ...base,
      type: 'vless',
      uuid: String(out.uuid || ''),
      ...(out.flow ? { flow: String(out.flow) } : {}),
      ...singboxTransport(out),
      ...singboxTls(out),
    };
    if (!raw.uuid) return null;
    return { name, protocol: 'vless', server, port, raw, uri: null };
  }
  if (type === 'trojan') {
    const raw = {
      ...base,
      type: 'trojan',
      password: String(out.password || ''),
      ...singboxTransport(out),
      ...singboxTls(out, true),
    };
    if (!raw.password) return null;
    return { name, protocol: 'trojan', server, port, raw, uri: null };
  }
  if (type === 'hysteria2') {
    const raw = {
      ...base,
      type: 'hysteria2',
      password: String(out.password || ''),
      ...(out.obfs?.type ? { obfs: String(out.obfs.type), 'obfs-password': String(out.obfs.password || '') } : {}),
      ...(out.up_mbps ? { up: String(out.up_mbps) } : {}),
      ...(out.down_mbps ? { down: String(out.down_mbps) } : {}),
      ...singboxTls(out, true),
    };
    if (!raw.password) return null;
    return { name, protocol: 'hysteria2', server, port, raw, uri: null };
  }
  if (type === 'tuic') {
    const raw = {
      ...base,
      type: 'tuic',
      uuid: String(out.uuid || ''),
      ...(out.password ? { password: String(out.password) } : {}),
      ...(out.congestion_control ? { 'congestion-controller': String(out.congestion_control) } : {}),
      ...(out.udp_relay_mode ? { 'udp-relay-mode': String(out.udp_relay_mode) } : {}),
      ...singboxTls(out, true),
    };
    if (!raw.uuid) return null;
    return { name, protocol: 'tuic', server, port, raw, uri: null };
  }
  if (type === 'http') {
    const raw = {
      ...base,
      type: 'http',
      ...(out.username ? { username: String(out.username) } : {}),
      ...(out.password ? { password: String(out.password) } : {}),
      ...(out.tls?.enabled ? singboxTls(out, true) : {}),
    };
    return { name, protocol: 'http', server, port, raw, uri: null };
  }
  if (type === 'socks') {
    const raw = {
      ...base,
      type: 'socks5',
      ...(out.username ? { username: String(out.username) } : {}),
      ...(out.password ? { password: String(out.password) } : {}),
    };
    return { name, protocol: 'socks5', server, port, raw, uri: null };
  }
  if (type === 'anytls') {
    const raw = {
      ...base,
      type: 'anytls',
      password: String(out.password || ''),
      ...singboxTls(out, true),
    };
    if (!raw.password) return null;
    return { name, protocol: 'anytls', server, port, raw, uri: null };
  }
  return null;
}

function parseSingboxJson(obj) {
  const warnings = [];
  const nodes = [];
  let skipped = 0;
  for (const out of obj.outbounds) {
    const node = convertSingboxOutbound(out, warnings);
    if (node) nodes.push(node);
    else if (!['selector', 'urltest', 'direct', 'block', 'dns'].includes(String(out?.type || '').toLowerCase())) skipped += 1;
  }
  if (skipped) warnings.push(`已跳过 ${skipped} 个无法识别的 Sing-box 出站`);
  return { format: 'singbox', nodes, warnings };
}

function parseJsonSource(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj.proxies)) return parseClashYaml(text);
  if (obj.proxies && typeof obj.proxies === 'object') return parseClashYaml(text);
  if (Array.isArray(obj.outbounds)) return parseSingboxJson(obj);
  if (Array.isArray(obj)) {
    return {
      format: 'json',
      nodes: [],
      warnings: ['检测到 JSON 数组订阅，但无法识别节点结构（支持 Clash YAML / Sing-box / Base64 / 节点链接）'],
    };
  }
  return null;
}


export function parseSubscription(content, options = {}) {
  let text = String(content || '').replace(/^\uFEFF/, '').trim();
  if (!text) return { format: 'empty', nodes: [], warnings: ['订阅内容为空'] };
  if (text.length > 32 * 1024 * 1024) return { format: 'too-large', nodes: [], warnings: ['订阅内容超过 32MB 限制'] };

  // HTML error pages are a very common failure mode for expired links.
  if (/^<!doctype html/i.test(text) || /^<html[\s>]/i.test(text)) {
    return {
      format: 'html',
      nodes: [],
      warnings: ['订阅地址返回了 HTML 网页，通常表示链接失效、需要登录，或服务商要求更换订阅地址'],
    };
  }

  if (text.startsWith('{') || text.startsWith('[')) {
    const jsonResult = parseJsonSource(text);
    if (jsonResult) return finalize(jsonResult, options);
  }

  const looksYaml = /^\s*(proxies|proxy-groups|proxy-providers)\s*:/m.test(text);
  if (looksYaml) return finalize(parseClashYaml(text), options);

  const hasUri = text.includes('://');
  if (!hasUri) {
    const decoded = tryBase64(text);
    if (decoded && decoded.trim() && decoded !== text) {
      let nested = decoded.trim();
      if (/^<!doctype html/i.test(nested) || /^<html[\s>]/i.test(nested)) {
        return { format: 'html', nodes: [], warnings: ['Base64 解码后是 HTML 网页，订阅链接可能已失效'] };
      }
      if (nested.startsWith('{') || nested.startsWith('[')) {
        const jsonResult = parseJsonSource(nested);
        if (jsonResult) return finalize(jsonResult, options);
      }
      if (/^\s*(proxies|proxy-groups)\s*:/m.test(nested)) return finalize(parseClashYaml(nested), options);
      if (nested.includes('://')) return finalize(parseUriLines(nested), options);
      const nestedDecoded = tryBase64(nested);
      if (nestedDecoded && nestedDecoded.includes('://')) return finalize(parseUriLines(nestedDecoded), options);
      return { format: 'base64-unknown', nodes: [], warnings: ['Base64 解码成功，但内容不是可识别的订阅格式'] };
    }
    return { format: 'unknown', nodes: [], warnings: ['无法识别订阅格式（支持 Clash YAML、Base64、ss/vmess/vless/trojan/hysteria2/tuic 等链接）'] };
  }

  return finalize(parseUriLines(text), options);
}

function finalize(result, options) {
  let nodes = result.nodes || [];
  // Remove exact duplicates inside one subscription source.
  nodes = uniqueBy(nodes, (n) => nodeFingerprint(n));
  const max = safeInt(options.maxNodes, 3000, 1, 20000);
  if (nodes.length > max) {
    result.warnings = [...(result.warnings || []), `节点数超过单源上限 ${max}，已截断`];
    nodes = nodes.slice(0, max);
  }
  return { ...result, nodes, warnings: result.warnings || [] };
}
