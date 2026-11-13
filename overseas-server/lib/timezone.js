/**
 * 全站时区：只有一个来源。
 *
 * - 默认：服务器时区（系统 `TZ` / `/etc/localtime`）。
 * - 如果配了时区环境变量（`SUBFLUX_TZ`，其次 `TZ`），启动时就把进程时区切过去，
 *   日志、订阅文件头、界面上的所有时间都按这个时区显示；系统时区本身不动。
 * - 前端不再使用浏览器时区，只渲染后端给的 `meta.timezone`。
 */

const ENV_KEYS = ['SUBFLUX_TZ', 'TZ'];

let cached = '';

/** 时区名是否可用。 */
export function isValidTimezone(value) {
  const tz = String(value ?? '').trim();
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** 环境变量里配置的时区（`SUBFLUX_TZ` 优先，其次 `TZ`）；没配置返回空串。 */
export function envTimezone() {
  for (const key of ENV_KEYS) {
    const value = String(process.env[key] ?? '').trim();
    if (value && isValidTimezone(value)) return value;
  }
  return '';
}

function resolveTimezone() {
  const name = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  // 容器里 /etc/localtime 不可读时 Node 会给出 Etc/Unknown，退回 UTC 免得界面显示怪名字。
  if (!name || name === 'Etc/Unknown' || !isValidTimezone(name)) return 'UTC';
  return name;
}

/**
 * 启动时调用一次（要在任何时间格式化之前）：把进程时区对齐到时区环境变量。
 * 没配环境变量就保持服务器时区。
 */
export function initTimezone() {
  const wanted = envTimezone();
  if (wanted) {
    if (process.env.TZ !== wanted) process.env.TZ = wanted;
  } else if (process.env.TZ !== undefined && !String(process.env.TZ).trim()) {
    // compose 里 `TZ: ${...:-}` 会传进来一个空字符串，Node 会当成「未知时区」
    // （resolvedOptions().timeZone === 'Etc/Unknown'）。删掉它才能回到服务器时区。
    delete process.env.TZ;
  }
  cached = resolveTimezone();
  return cached;
}

/** 当前生效的时区名（服务器时区，或被时区环境变量覆盖后的时区）。 */
export function serverTimezone() {
  if (!cached) cached = resolveTimezone();
  return cached;
}

const partsFormatters = new Map();

function partsFormatter(timeZone) {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatters.set(timeZone, f);
  }
  return f;
}

/** 取某个时刻在指定时区里的年月日时分秒。 */
export function zoneParts(ms, timeZone = serverTimezone()) {
  const parts = partsFormatter(timeZone).formatToParts(new Date(ms));
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** 目标时区相对 UTC 的偏移分钟数（东八区为 480）。 */
export function zoneOffsetMinutes(ms, timeZone = serverTimezone()) {
  const p = zoneParts(ms, timeZone);
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** 本地时区的「YYYY-MM-DD」，日志分天用它。 */
export function localDayKey(ms = Date.now(), timeZone = serverTimezone()) {
  const p = zoneParts(ms, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** 日志时间戳：「2026-11-13 08:30:00+08:00」。 */
export function logStamp(ms = Date.now(), timeZone = serverTimezone()) {
  const p = zoneParts(ms, timeZone);
  const offset = zoneOffsetMinutes(ms, timeZone);
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const zone = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}${zone}`;
}

/** 把时间戳格式化成「2026-11-13 08:30」（界面/事件文案用）。 */
export function formatInZone(ms, timeZone = serverTimezone()) {
  const p = zoneParts(ms, timeZone);
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}`;
}
