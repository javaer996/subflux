import { formatBytes, safeInt } from './util.js';

export function trafficInfo(source) {
  const t = source?.traffic || null;
  const upload = safeInt(t?.upload, 0, 0, Number.MAX_SAFE_INTEGER);
  const download = safeInt(t?.download, 0, 0, Number.MAX_SAFE_INTEGER);
  const total = safeInt(t?.total, 0, 0, Number.MAX_SAFE_INTEGER);
  let expire = safeInt(t?.expire, 0, 0, Number.MAX_SAFE_INTEGER);
  if (expire > 10_000_000_000) expire = Math.floor(expire / 1000);
  const used = upload + download;
  const remain = total > 0 ? Math.max(0, total - used) : 0;
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 1000) / 10) : 0;
  const now = Date.now();
  const expired = expire > 0 && expire * 1000 <= now;
  const exhausted = total > 0 && used >= total * 0.999;
  const depleted = expired || exhausted;
  return {
    upload,
    download,
    used,
    total,
    remain,
    percent,
    expire,
    expireAt: expire > 0 ? new Date(expire * 1000).toISOString() : null,
    expired,
    exhausted,
    depleted,
    usedLabel: formatBytes(used),
    totalLabel: total > 0 ? formatBytes(total) : '不限/未知',
    remainLabel: total > 0 ? formatBytes(remain) : '—',
    reason: exhausted ? '流量已用尽' : expired ? '订阅已过期' : '',
  };
}

export function sourceBlockedReason(source, settings) {
  if (!source) return '来源不存在';
  if (!source.enabled) return '来源已停用';
  if (settings?.excludeDepleted !== false) {
    const t = trafficInfo(source);
    if (t.depleted) return t.reason;
  }
  return '';
}
