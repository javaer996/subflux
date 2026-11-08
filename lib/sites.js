export const DEFAULT_SITES = [
  { id: 'youtube', name: 'YouTube', short: 'YT', url: 'https://www.youtube.com/', enabled: true, preset: true },
  { id: 'chatgpt', name: 'ChatGPT', short: 'GPT', url: 'https://chatgpt.com/', enabled: true, preset: true },
  { id: 'claude', name: 'Claude', short: 'CL', url: 'https://claude.ai/', enabled: true, preset: true },
  { id: 'grok', name: 'Grok', short: 'GRK', url: 'https://grok.com/', enabled: true, preset: true },
  { id: 'gemini', name: 'Gemini', short: 'GEM', url: 'https://gemini.google.com/', enabled: true, preset: true },
];

const BLOCK_MARKERS = [
  'not available in your country',
  "isn't available in your country",
  'is not available in your country',
  'not available in your region',
  'unsupported_country',
  'unsupported country',
  'service is not available in your country',
  'has not been released in your country',
  'is not available in your location',
  'not available in this country',
];

const CHALLENGE_MARKERS = [
  'just a moment',
  'enable javascript and cookies',
  'attention required',
  'cf-chl',
  'checking your browser',
  'verify you are human',
  'ddos protection by',
];

export function normalizeSites(input) {
  if (!Array.isArray(input)) return DEFAULT_SITES.map((s) => ({ ...s }));
  const seen = new Set();
  const out = [];
  for (const raw of input.slice(0, 30)) {
    if (!raw || typeof raw !== 'object') continue;
    const id = String(raw.id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    let name = String(raw.name || '').trim().slice(0, 30);
    let url = String(raw.url || '').trim().slice(0, 500);
    if (!id || !name) continue;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) continue;
      url = parsed.toString();
    } catch {
      continue;
    }
    if (seen.has(id)) continue;
    const preset = DEFAULT_SITES.find((s) => s.id === id);
    let short = String(raw.short || preset?.short || name.slice(0, 3)).trim().toUpperCase().replace(/\s+/g, '').slice(0, 6);
    if (!short) short = id.slice(0, 3).toUpperCase();
    seen.add(id);
    out.push({
      id,
      name,
      short,
      url,
      enabled: raw.enabled === undefined ? true : Boolean(raw.enabled),
      ...(preset ? { preset: true } : {}),
    });
  }
  return out;
}

export function siteTags(node, sites) {
  if (!node?.sites || !Array.isArray(sites)) return '';
  return sites
    .filter((s) => s.enabled !== false && node.sites[s.id] === true)
    .map((s) => s.short)
    .join('·');
}

export function nodeSiteState(node, siteId) {
  if (!node?.sites || !(siteId in node.sites)) return 'untested';
  if (node.sites[siteId] === true) return 'ok';
  if (node.sites[siteId] === false) return 'fail';
  return 'unknown';
}

export function summarizeSites(nodes, sites) {
  return (sites || []).map((site) => {
    let tested = 0;
    let ok = 0;
    for (const node of nodes) {
      const state = nodeSiteState(node, site.id);
      if (state !== 'untested') tested += 1;
      if (state === 'ok') ok += 1;
    }
    return { id: site.id, name: site.name, short: site.short, enabled: site.enabled !== false, tested, ok };
  });
}

function includesAny(text, markers) {
  return markers.some((marker) => text.includes(marker));
}

export function evaluateSiteResult(site, result) {
  const status = Number(result.status) || 0;
  const finalUrl = String(result.finalUrl || '');
  const text = String(result.text || '');
  const lower = text.toLowerCase();
  const title = (text.match(/<title[^>]*>([\s\S]{0,240}?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
  const titleLower = title.toLowerCase();
  const blocked = includesAny(lower, BLOCK_MARKERS);
  const challenge = includesAny(lower, CHALLENGE_MARKERS) || status === 429 || titleLower.includes('just a moment');

  if (blocked) return false;
  if (challenge) return null;
  if (!status) return false;

  const id = site.id;
  if (id === 'youtube') {
    if (status >= 200 && status < 400 && titleLower.includes('youtube')) return true;
    return status >= 200 && status < 400 ? null : false;
  }
  if (id === 'chatgpt') {
    if (status >= 200 && status < 400 && (titleLower.includes('chatgpt') || lower.includes('openai'))) return true;
    if (status === 401 || status === 403) return null;
    return false;
  }
  if (id === 'claude') {
    if (status >= 200 && status < 400 && (titleLower.includes('claude') || lower.includes('anthropic'))) return true;
    if (status === 401 || status === 403) return null;
    return false;
  }
  if (id === 'grok') {
    if (status >= 200 && status < 400 && (titleLower.includes('grok') || lower.includes('xai'))) return true;
    return status >= 200 && status < 400 ? null : false;
  }
  if (id === 'gemini') {
    if (/support\.google|policies\.google|accounts\.google/i.test(finalUrl)) return false;
    if (status >= 200 && status < 400 && titleLower.includes('gemini')) return true;
    return status >= 200 && status < 400 ? null : false;
  }
  if (status >= 200 && status < 400) return true;
  if (status === 401 || status === 403 || status === 429) return null;
  return false;
}

export function siteResponseSnippet(result) {
  const text = String(result.text || '');
  const title = (text.match(/<title[^>]*>([\s\S]{0,120}?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
  return title || (text ? text.slice(0, 80).replace(/\s+/g, ' ') : '');
}
