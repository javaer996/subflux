import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const COOKIE_NAME = 'subflux_session';
const SESSION_TTL = 7 * 24 * 60 * 60;
const MAX_FAILS = 5;
const FAIL_WINDOW = 10 * 60 * 1000;
const BLOCK_TIME = 15 * 60 * 1000;

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(text) {
  return Buffer.from(String(text).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    out[name] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

function isSecure(req) {
  if (req.socket?.encrypted) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return proto === 'https';
}

export class Auth {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.username = 'admin';
    this.pass = 'subflux';
    this.defaultCreds = true;
    this.secret = null;
    this.salt = crypto.randomBytes(16);
    this.hash = null;
    this.fails = new Map();
  }

  async init() {
    this.username = String(process.env.SUBFLUX_USERNAME || 'admin').trim() || 'admin';
    this.pass = String(process.env.SUBFLUX_PASSWORD || 'subflux');
    this.defaultCreds = this.pass === 'subflux' && this.username === 'admin';
    if (this.pass.length < 4) {
      throw new Error('SUBFLUX_PASSWORD 至少需要 4 个字符');
    }
    this.hash = crypto.scryptSync(this.pass, this.salt, 64);
    const envSecret = String(process.env.SUBFLUX_SESSION_SECRET || '').trim();
    if (envSecret) {
      if (envSecret.length < 16) throw new Error('SUBFLUX_SESSION_SECRET 至少需要 16 个字符');
      this.secret = crypto.createHash('sha256').update(envSecret).digest();
    } else {
      const file = path.join(this.dataDir, '.session-secret');
      try {
        const raw = await fs.readFile(file, 'utf8');
        this.secret = Buffer.from(raw.trim(), 'base64');
        if (this.secret.length !== 32) throw new Error('会话密钥文件格式不正确');
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        this.secret = crypto.randomBytes(32);
        await fs.mkdir(this.dataDir, { recursive: true });
        await fs.writeFile(file, `${this.secret.toString('base64')}\n`, { mode: 0o600 });
        await fs.chmod(file, 0o600).catch(() => {});
      }
    }
    return this;
  }

  verify(username, pass) {
    const userOk = crypto.timingSafeEqual(
      crypto.createHash('sha256').update(String(username || '')).digest(),
      crypto.createHash('sha256').update(this.username).digest(),
    );
    const passHash = crypto.scryptSync(String(pass || ''), this.salt, 64);
    const passOk = crypto.timingSafeEqual(passHash, this.hash);
    return userOk && passOk;
  }

  sign(payload) {
    return b64url(crypto.createHmac('sha256', this.secret).update(payload).digest());
  }

  issue(username = this.username) {
    const csrf = b64url(crypto.randomBytes(24));
    const payload = b64url(JSON.stringify({
      u: username,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL,
      c: csrf,
    }));
    return { token: `${payload}.${this.sign(payload)}`, csrf, maxAge: SESSION_TTL };
  }

  read(req) {
    const cookies = parseCookies(req.headers.cookie);
    const raw = cookies[COOKIE_NAME];
    if (!raw || !raw.includes('.')) return null;
    const index = raw.lastIndexOf('.');
    const payload = raw.slice(0, index);
    const signature = raw.slice(index + 1);
    const expected = this.sign(payload);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    let data;
    try {
      data = JSON.parse(fromB64url(payload).toString('utf8'));
    } catch {
      return null;
    }
    if (!data || data.exp * 1000 < Date.now()) return null;
    if (data.u !== this.username) return null;
    return data;
  }

  csrfOk(req, session) {
    if (!session) return false;
    const token = String(req.headers['x-csrf-token'] || '');
    const a = Buffer.from(token);
    const b = Buffer.from(String(session.c || ''));
    return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
  }

  cookie(req, token, maxAge) {
    const parts = [
      `${COOKIE_NAME}=${encodeURIComponent(token)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${maxAge}`,
    ];
    if (isSecure(req)) parts.push('Secure');
    return parts.join('; ');
  }

  setSession(res, req, token) {
    res.setHeader('set-cookie', this.cookie(req, token, SESSION_TTL));
  }

  clearSession(res, req) {
    res.setHeader('set-cookie', this.cookie(req, '', 0));
  }

  /** 返回剩余封禁秒数；0 表示可以尝试。 */
  blockedFor(ip) {
    const entry = this.fails.get(ip);
    if (!entry) return 0;
    if (entry.blockedUntil && entry.blockedUntil > Date.now()) {
      return Math.ceil((entry.blockedUntil - Date.now()) / 1000);
    }
    if (entry.firstAt && Date.now() - entry.firstAt > FAIL_WINDOW) {
      this.fails.delete(ip);
      return 0;
    }
    return 0;
  }

  recordFail(ip) {
    const now = Date.now();
    const entry = this.fails.get(ip) || { count: 0, firstAt: now, blockedUntil: 0 };
    if (entry.blockedUntil && entry.blockedUntil <= now) {
      entry.count = 0;
      entry.firstAt = now;
      entry.blockedUntil = 0;
    }
    if (!entry.firstAt || now - entry.firstAt > FAIL_WINDOW) {
      entry.count = 0;
      entry.firstAt = now;
      entry.blockedUntil = 0;
    }
    entry.count += 1;
    if (entry.count >= MAX_FAILS) entry.blockedUntil = now + BLOCK_TIME;
    this.fails.set(ip, entry);
  }

  clearFails(ip) {
    this.fails.delete(ip);
  }
}
