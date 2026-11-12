/**
 * 夜间模式（免打扰时段）：在这段时间里不自动触发定时任务。
 *
 * 时间区间按服务器所在时区解释（自动识别，不跟随浏览器），
 * 支持跨零点（例如 23:30 → 07:00）。只拦截「定时 / 自动」任务，
 * 手动刷新、手动测试、手动推送不受影响。
 */

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** 把 "23:30" / "7:00" 解析成当天分钟数；无效返回 null。 */
export function parseClock(value) {
  const m = TIME_RE.exec(String(value ?? '').trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 规整成 "HH:MM"；无效时返回 fallback。 */
export function normalizeClock(value, fallback = '') {
  const minutes = parseClock(value);
  if (minutes == null) return fallback;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** 服务器本机时区名。 */
export function serverTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** 从设置对象里取出规整后的夜间模式配置。 */
export function quietHoursConfig(settings = {}) {
  return {
    enabled: settings.quietHoursEnabled === true,
    start: normalizeClock(settings.quietHoursStart, '23:00'),
    end: normalizeClock(settings.quietHoursEnd, '07:00'),
    timezone: serverTimezone(),
  };
}

const formatters = new Map();
function clockFormatter(timeZone) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** 指定时刻在目标时区里的分钟数（0–1439）。 */
export function minutesOfDay(nowMs, timeZone) {
  const parts = clockFormatter(timeZone).formatToParts(new Date(nowMs));
  const get = (type) => parts.find((p) => p.type === type)?.value || '0';
  const hour = Number(get('hour')) % 24;
  return hour * 60 + Number(get('minute'));
}

function inRange(minutes, from, to) {
  return from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

/** 当前时间是否落在夜间模式区间内（跨零点也算）。 */
export function inQuietHours(settings = {}, nowMs = Date.now()) {
  const { enabled, start, end, timezone } = quietHoursConfig(settings);
  if (!enabled) return false;
  const from = parseClock(start);
  const to = parseClock(end);
  if (from == null || to == null || from === to) return false;
  return inRange(minutesOfDay(nowMs, timezone), from, to);
}

/**
 * 夜间模式期间的说明文字，例如「夜间模式（23:00–07:00）」。
 * 未启用时返回空串。
 */
export function quietHoursLabel(settings = {}) {
  const { enabled, start, end } = quietHoursConfig(settings);
  return enabled ? `夜间模式（${start}–${end}）` : '';
}

/**
 * 从 nowMs 起算，跨过夜间区间之后实际可以开始执行的时间（精确到分钟）。
 * 不在夜间区间内时原样返回 nowMs。
 */
export function afterQuietHours(settings = {}, nowMs = Date.now()) {
  if (!inQuietHours(settings, nowMs)) return nowMs;
  const { end, timezone } = quietHoursConfig(settings);
  const to = parseClock(end);
  // 先按「目标时区相对 UTC 的偏移」直接算出今天的结束时刻，再校验一次；
  // 遇到夏令时或跨日误差时向后逐分钟微调（通常 0 次）。
  const localMinutes = minutesOfDay(nowMs, timezone);
  const utcMinutes = new Date(nowMs).getUTCHours() * 60 + new Date(nowMs).getUTCMinutes();
  let offset = localMinutes - utcMinutes;
  if (offset > 720) offset -= 1440;
  else if (offset < -720) offset += 1440;
  const localMidnightUtc = Math.floor((nowMs + offset * 60000) / 86400000) * 86400000 - offset * 60000;
  let at = localMidnightUtc + to * 60000;
  if (at <= nowMs) at += 86400000;
  at = Math.ceil(at / 60000) * 60000;
  for (let i = 0; i < 120 && inQuietHours(settings, at); i += 1) at += 60000;
  return at;
}

/** 把时间戳按指定时区格式化成「2026-11-12 23:00」。 */
export function formatInZone(ms, timeZone = serverTimezone()) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString('zh-CN', { hour12: false });
  }
}
