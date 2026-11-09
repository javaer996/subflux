import { constants as fsConstants, accessSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** compose 部署时 bootstrap 会把引擎下载到这里，作为默认位置。 */
export const DEFAULT_ENGINE_PATH = '/opt/mihomo/mihomo';

function isExecutable(target) {
  if (!target) return false;
  try {
    accessSync(target, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * 候选引擎路径，按优先级排列：
 * 设置里的路径 → MIHOMO_BIN 环境变量 → compose 默认 /opt/mihomo/mihomo → 项目内置 bin/mihomo。
 */
export function engineCandidates(settingPath = '') {
  const list = [];
  const push = (value, from) => {
    const target = String(value || '').trim();
    if (!target) return;
    if (list.some((item) => item.path === target)) return;
    list.push({ path: target, from });
  };
  push(settingPath, '设置');
  push(process.env.MIHOMO_BIN, '环境变量 MIHOMO_BIN');
  push(DEFAULT_ENGINE_PATH, '默认 /opt/mihomo/mihomo');
  push(path.join(ROOT, 'bin', 'mihomo'), '项目内置 bin/mihomo');
  return list;
}

/** 解析出当前实际可用的引擎；都不可用时返回第一个候选，available=false。 */
export function resolveEngine(settingPath = '') {
  const explicit = String(settingPath || '').trim();
  if (explicit) {
    // 手动填写的路径以它为准，即使不可执行也要如实报出来，避免“我设了 A 却在用 B”的困惑。
    return { path: explicit, from: '设置', available: isExecutable(explicit), candidates: engineCandidates(explicit) };
  }
  const candidates = engineCandidates('');
  for (const candidate of candidates) {
    if (isExecutable(candidate.path)) return { ...candidate, available: true, candidates };
  }
  const fallback = candidates[0] || { path: '', from: '未配置' };
  return { ...fallback, available: false, candidates };
}

export function describeEngine(settingPath = '') {
  const resolved = resolveEngine(settingPath);
  return {
    available: resolved.available,
    path: resolved.path,
    from: resolved.from,
    defaultPath: DEFAULT_ENGINE_PATH,
    candidates: resolved.candidates.map((item) => ({
      path: item.path,
      from: item.from,
      ok: isExecutable(item.path),
    })),
  };
}
