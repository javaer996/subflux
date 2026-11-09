import { normalizeFormat } from './generator.js';

const RULES = [
  {
    format: 'clash',
    client: 'Clash / Mihomo',
    test: /clash|mihomo|stash|clashx|clash-verge|flclash|clashforwindows|clash for windows|clash-nyanpasu|meta/,
  },
  {
    format: 'singbox',
    client: 'Sing-box',
    test: /sing-box|singbox|sfa\/|sfi\/|sft\/|nekobox|nekoray|hiddify/,
  },
  {
    format: 'base64',
    client: 'V2Ray / Shadowrocket',
    test: /v2rayn|v2rayng|v2ray|xray|shadowrocket|quantumult|loon|surfboard|kitsunebi|bifrost|surge/,
  },
];

export function identifyClient(ua) {
  const text = String(ua || '').toLowerCase();
  for (const rule of RULES) {
    if (rule.test.test(text)) return { format: rule.format, client: rule.client, source: 'ua' };
  }
  return null;
}

export function detectClientFormat(ua, explicit, fallback = 'clash') {
  if (explicit && explicit !== 'auto') {
    const format = normalizeFormat(explicit);
    return { format, client: labelForFormat(format), source: 'explicit' };
  }
  const identified = identifyClient(ua);
  if (identified) return identified;
  const format = normalizeFormat(fallback);
  return { format, client: labelForFormat(format), source: 'fallback' };
}

export function labelForFormat(format) {
  const f = normalizeFormat(format);
  if (f === 'singbox') return 'Sing-box';
  if (f === 'base64') return 'V2Ray / Base64';
  if (f === 'plain') return '节点链接';
  return 'Clash / Mihomo';
}
