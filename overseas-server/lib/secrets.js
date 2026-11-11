import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * 敏感字段加密（AES-256-GCM）。
 *
 * 内存中的 state 始终是明文，落盘前把指定字段加密成 `enc:v1:<base64>`，
 * 启动读取时再解密。密钥优先取环境变量 SUBFLUX_SECRET_KEY，
 * 否则使用 DATA_DIR/.secret-key（首次启动自动生成，权限 0600）。
 *
 * 注意：.secret-key 与 db.json 必须一起备份，单独拷走 db.json 无法解密。
 */

const PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_FILE = '.secret-key';

let key = null;
let keySource = '';

function deriveKey(raw) {
  const text = String(raw || '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(text)) return Buffer.from(text, 'hex');
  const b64 = Buffer.from(text, 'base64');
  if (b64.length === 32 && b64.toString('base64').replace(/=+$/, '') === text.replace(/=+$/, '')) return b64;
  return crypto.scryptSync(text, 'subflux-secret-v1', 32);
}

export async function initSecrets(dataDir) {
  if (key) return { source: keySource };
  const envKey = String(process.env.SUBFLUX_SECRET_KEY || '').trim();
  if (envKey) {
    if (envKey.length < 16) throw new Error('SUBFLUX_SECRET_KEY 至少需要 16 个字符');
    key = deriveKey(envKey);
    keySource = '环境变量 SUBFLUX_SECRET_KEY';
    return { source: keySource };
  }
  const file = path.join(dataDir, KEY_FILE);
  try {
    const raw = await fs.readFile(file, 'utf8');
    const buf = Buffer.from(raw.trim(), 'base64');
    if (buf.length !== 32) throw new Error(`${file} 内容不是 32 字节密钥`);
    key = buf;
    keySource = file;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    key = crypto.randomBytes(32);
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(file, `${key.toString('base64')}\n`, { mode: 0o600 });
    await fs.chmod(file, 0o600).catch(() => {});
    keySource = file;
  }
  return { source: keySource };
}

export function secretsKeySource() {
  return keySource;
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptValue(value) {
  if (!key) throw new Error('加密密钥尚未初始化');
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const body = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, tag, body]).toString('base64')}`;
}

export function decryptValue(value) {
  if (!isEncrypted(value)) return value;
  if (!key) throw new Error('加密密钥尚未初始化');
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  if (raw.length <= IV_LEN + TAG_LEN) throw new Error('加密字段格式不正确');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const body = raw.subarray(IV_LEN + TAG_LEN);
  try {
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('敏感字段解密失败：密钥与数据不匹配，请检查 SUBFLUX_SECRET_KEY 或 DATA_DIR/.secret-key');
  }
}

const SETTINGS_SECRETS = ['chinaProbeToken', 'fetchProxy', 'proxycheckKey'];
const SOURCE_SECRETS = ['url', 'content', 'proxyUrl'];
const NODE_SECRETS = ['raw', 'uri'];
const TARGET_SECRETS = ['url', 'accessKeyId', 'accessKeySecret', 'headers'];

function cloneForWrite(state) {
  return {
    ...state,
    settings: { ...(state.settings || {}) },
    sources: (state.sources || []).map((s) => ({ ...s })),
    nodes: (state.nodes || []).map((n) => ({ ...n })),
    profiles: (state.profiles || []).map((p) => ({
      ...p,
      push: p.push
        ? { ...p.push, targets: (p.push.targets || []).map((t) => ({ ...t })) }
        : p.push,
    })),
  };
}

function encryptField(obj, field, json = false) {
  if (!obj) return;
  const value = obj[field];
  if (value == null || value === '' || isEncrypted(value)) return;
  const text = json && typeof value === 'object' ? JSON.stringify(value) : String(value);
  obj[field] = encryptValue(text);
}

function decryptField(obj, field, json = false) {
  if (!obj) return;
  const value = obj[field];
  if (!isEncrypted(value)) return;
  const text = decryptValue(value);
  if (!json) {
    obj[field] = text;
    return;
  }
  try {
    obj[field] = JSON.parse(text);
  } catch {
    obj[field] = text;
  }
}

/** 生成用于落盘的加密副本，不修改内存中的 state。 */
export function encryptState(state) {
  const copy = cloneForWrite(state);
  for (const field of SETTINGS_SECRETS) encryptField(copy.settings, field);
  for (const source of copy.sources) for (const field of SOURCE_SECRETS) encryptField(source, field);
  for (const node of copy.nodes) for (const field of NODE_SECRETS) encryptField(node, field, true);
  for (const profile of copy.profiles) {
    for (const target of profile.push?.targets || []) {
      for (const field of TARGET_SECRETS) encryptField(target, field);
    }
  }
  return copy;
}

/** 就地把 db.json 读出的加密字段还原为明文。 */
export function decryptState(data) {
  if (!data || typeof data !== 'object') return data;
  for (const field of SETTINGS_SECRETS) decryptField(data.settings, field);
  for (const source of data.sources || []) for (const field of SOURCE_SECRETS) decryptField(source, field);
  for (const node of data.nodes || []) for (const field of NODE_SECRETS) decryptField(node, field, true);
  for (const profile of data.profiles || []) {
    for (const target of profile.push?.targets || []) {
      for (const field of TARGET_SECRETS) decryptField(target, field);
    }
  }
  return data;
}

/** 检查 state 中是否还有未加密的敏感字段（用于启动时立即迁移）。 */
export function hasPlaintextSecrets(state) {
  const check = (obj, fields, json = false) => fields.some((f) => {
    const value = obj?.[f];
    if (value == null || value === '' || isEncrypted(value)) return false;
    return json ? typeof value === 'string' || typeof value === 'object' : typeof value === 'string';
  });
  if (check(state.settings, SETTINGS_SECRETS)) return true;
  if ((state.sources || []).some((s) => check(s, SOURCE_SECRETS))) return true;
  if ((state.nodes || []).some((n) => check(n, NODE_SECRETS, true))) return true;
  for (const p of state.profiles || []) {
    for (const t of p.push?.targets || []) if (check(t, TARGET_SECRETS)) return true;
  }
  return false;
}
