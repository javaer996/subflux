import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildOutput } from './generator.js';
import { errMessage } from './util.js';

const PUSH_TIMEOUT = 20000;
const MAX_TARGETS = 5;

export const PUSH_TYPES = ['file', 'http', 'oss'];

export function pushIntervalMinutes(push = {}) {
  return Math.max(5, Number(push.intervalMinutes) || 1440);
}

export function nextPushAt(push, nowMs = Date.now()) {
  if (!push || !push.enabled) return null;
  return new Date(nowMs + pushIntervalMinutes(push) * 60000).toISOString();
}

export function targetLabel(target = {}) {
  if (target.type === 'file') return target.path || '本地文件';
  if (target.type === 'http') return target.url || 'HTTP 地址';
  if (target.type === 'oss') return `${target.bucket || 'bucket'}/${target.objectKey || ''}`;
  return '未知目标';
}

function parseHeaders(raw) {
  const out = {};
  for (const line of String(raw || '').split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (!key || /^(host|content-length)$/i.test(key)) continue;
    out[key] = line.slice(idx + 1).trim();
  }
  return out;
}

async function pushFile(target, body) {
  const raw = String(target.path || '').trim();
  if (!raw) throw new Error('未填写本地文件路径');
  const filePath = path.resolve(raw);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, body, 'utf8');
  await fs.rename(tmp, filePath);
  return { bytes: Buffer.byteLength(body), detail: filePath };
}

async function pushHttp(target, body, contentType) {
  const url = String(target.url || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('推送地址需要以 http:// 或 https:// 开头');
  const method = String(target.method || 'PUT').toUpperCase() === 'POST' ? 'POST' : 'PUT';
  const headers = { 'content-type': contentType, ...parseHeaders(target.headers) };
  const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(PUSH_TIMEOUT) });
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(`目标返回 ${res.status}${text ? `：${text.slice(0, 120)}` : ''}`);
  return { bytes: Buffer.byteLength(body), detail: `${method} ${url} → ${res.status}` };
}

function encodeKey(key) {
  return key.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function ossTargetParts(target) {
  const endpoint = String(target.endpoint || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(endpoint)) throw new Error('Endpoint 需要以 http:// 或 https:// 开头');
  const url = new URL(endpoint);
  const bucket = String(target.bucket || '').trim();
  if (!bucket) throw new Error('未填写 Bucket');
  const objectKey = String(target.objectKey || '').trim().replace(/^\/+/, '');
  if (!objectKey) throw new Error('未填写对象路径');
  return { url, bucket, objectKey };
}

function signAliyun({ accessKeyId, accessKeySecret, method, contentType, date, resource }) {
  const stringToSign = `${method}\n\n${contentType}\n${date}\n${resource}`;
  const signature = crypto.createHmac('sha1', accessKeySecret).update(stringToSign).digest('base64');
  return `OSS ${accessKeyId}:${signature}`;
}

async function pushAliyunOss(target, body, contentType) {
  const { url, bucket, objectKey } = ossTargetParts(target);
  const accessKeyId = String(target.accessKeyId || '').trim();
  const accessKeySecret = String(target.accessKeySecret || '').trim();
  if (!accessKeyId || !accessKeySecret) throw new Error('未填写 AccessKey ID / Secret');
  const host = url.host.startsWith(`${bucket}.`) ? url.host : `${bucket}.${url.host}`;
  const link = `${url.protocol}//${host}/${encodeKey(objectKey)}`;
  const date = new Date().toUTCString();
  const authorization = signAliyun({
    accessKeyId,
    accessKeySecret,
    method: 'PUT',
    contentType,
    date,
    resource: `/${bucket}/${objectKey}`,
  });
  const res = await fetch(link, {
    method: 'PUT',
    headers: { date, 'content-type': contentType, authorization },
    body,
    signal: AbortSignal.timeout(PUSH_TIMEOUT),
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(`OSS 返回 ${res.status}${text ? `：${text.slice(0, 160)}` : ''}`);
  return { bytes: Buffer.byteLength(body), detail: `${link} → ${res.status}` };
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

async function pushS3(target, body, contentType) {
  const { url, bucket, objectKey } = ossTargetParts(target);
  const accessKeyId = String(target.accessKeyId || '').trim();
  const accessKeySecret = String(target.accessKeySecret || '').trim();
  if (!accessKeyId || !accessKeySecret) throw new Error('未填写 AccessKey ID / Secret');
  const region = String(target.region || 'us-east-1').trim();
  const host = url.host;
  const canonicalUri = `/${bucket}/${encodeKey(objectKey)}`;
  const link = `${url.protocol}//${host}${canonicalUri}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256Hex(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${accessKeySecret}`, dateStamp), region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const res = await fetch(link, {
    method: 'PUT',
    headers: {
      'content-type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      authorization,
    },
    body,
    signal: AbortSignal.timeout(PUSH_TIMEOUT),
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(`S3 返回 ${res.status}${text ? `：${text.slice(0, 160)}` : ''}`);
  return { bytes: Buffer.byteLength(body), detail: `${link} → ${res.status}` };
}

export async function deliverTarget(target, body, contentType) {
  const type = String(target?.type || '');
  if (type === 'file') return pushFile(target, body);
  if (type === 'http') return pushHttp(target, body, contentType);
  if (type === 'oss') {
    const provider = String(target.provider || 'aliyun');
    return provider === 's3' ? pushS3(target, body, contentType) : pushAliyunOss(target, body, contentType);
  }
  throw new Error(`不支持的推送类型：${type || '空'}`);
}

export async function pushProfile(store, profile, options = {}) {
  const push = profile.push || {};
  const targets = Array.isArray(push.targets) ? push.targets.slice(0, MAX_TARGETS) : [];
  if (!targets.length) throw new Error('没有配置推送目标');
  const format = profile.format || 'clash';
  const result = buildOutput(profile, format, store.state);
  const body = result.body;
  const results = [];
  for (const target of targets) {
    const started = Date.now();
    try {
      const info = await deliverTarget(target, body, result.contentType);
      results.push({
        type: target.type,
        label: targetLabel(target),
        ok: true,
        bytes: info.bytes,
        detail: info.detail,
        latency: Date.now() - started,
        at: new Date().toISOString(),
      });
    } catch (err) {
      results.push({
        type: target.type,
        label: targetLabel(target),
        ok: false,
        error: errMessage(err),
        latency: Date.now() - started,
        at: new Date().toISOString(),
      });
    }
  }
  const okCount = results.filter((item) => item.ok).length;
  profile.push = {
    ...push,
    lastPushAt: new Date().toISOString(),
    lastStatus: okCount === results.length ? 'ok' : okCount ? 'partial' : 'error',
    lastResults: results,
    nextPushAt: push.enabled ? nextPushAt(push) : null,
  };
  store.touch();
  await store.flush();
  store.addEvent(
    okCount === results.length ? 'success' : 'warn',
    `推送「${profile.name}」：${okCount}/${results.length} 个目标成功${options.manual ? '（手动）' : ''}`,
  );
  return { ok: okCount === results.length, emitted: result.emitted, results };
}
