import { GROUP_NAMES } from './constants.js';
import { CN_DIRECT_DOMAINS, CN_DIRECT_COUNT } from './cn-direct.js';

export const DEFAULT_ROUTING = {
  domesticDirect: true,
  blockAds: false,
  smartProxy: true,
  customRules: '',
  customRuleList: [],
};

export const SMART_DOMAINS = [
  'openai.com', 'chatgpt.com', 'oaistatic.com', 'oaiusercontent.com',
  'anthropic.com', 'claude.ai', 'claudeusercontent.com',
  'gemini.google.com', 'bard.google.com', 'aistudio.google.com', 'generativelanguage.googleapis.com',
  'grok.com', 'x.ai',
  'youtube.com', 'youtu.be', 'googlevideo.com', 'ytimg.com', 'youtube-nocookie.com',
];

export const AD_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com',
  'adsrvr.org', 'criteo.com', 'taboola.com', 'outbrain.com', 'adnxs.com', 'rubiconproject.com',
];

export const PRIVATE_RULES_CLASH = [
  'IP-CIDR,127.0.0.0/8,DIRECT,no-resolve',
  'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
  'IP-CIDR,172.16.0.0/12,DIRECT,no-resolve',
  'IP-CIDR,192.168.0.0/16,DIRECT,no-resolve',
  'IP-CIDR6,::1/128,DIRECT,no-resolve',
  'IP-CIDR6,fc00::/7,DIRECT,no-resolve',
  'DOMAIN-SUFFIX,local,DIRECT',
  'DOMAIN-SUFFIX,lan,DIRECT',
];

const CLASH_RULE_TYPES = new Set([
  'DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'DOMAIN-REGEX', 'GEOSITE', 'GEOIP',
  'IP-CIDR', 'IP-CIDR6', 'SRC-IP-CIDR', 'SRC-PORT', 'DST-PORT', 'PROCESS-NAME',
  'PROCESS-PATH', 'RULE-SET', 'AND', 'OR', 'NOT', 'MATCH', 'FINAL', 'NETWORK', 'UID',
]);

export const RULE_TYPES = [
  'DOMAIN-SUFFIX', 'DOMAIN', 'DOMAIN-KEYWORD', 'IP-CIDR', 'PROCESS-NAME', 'GEOSITE', 'GEOIP', 'MATCH',
];

export function normalizeRuleList(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const raw of input.slice(0, 60)) {
    if (!raw || typeof raw !== 'object') continue;
    const type = String(raw.type || '').toUpperCase();
    if (!RULE_TYPES.includes(type)) continue;
    const target = normalizeTarget(raw.target || 'DIRECT');
    if (!target) continue;
    if (type === 'MATCH') {
      out.push({ type, value: '', target, options: [], raw: `MATCH,${target}` });
      continue;
    }
    let value = String(raw.value || '').trim().slice(0, 240);
    if (type === 'GEOSITE') value = 'cn';
    if (type === 'GEOIP') value = 'CN';
    if (!value) continue;
    const options = type === 'IP-CIDR' ? ['no-resolve'] : [];
    out.push({ type, value, target, options, raw: [type, value, target, ...options].join(',') });
  }
  return out;
}

export function normalizeRouting(input) {
  const r = input && typeof input === 'object' ? input : {};
  return {
    domesticDirect: r.domesticDirect === undefined ? DEFAULT_ROUTING.domesticDirect : Boolean(r.domesticDirect),
    blockAds: r.blockAds === undefined ? DEFAULT_ROUTING.blockAds : Boolean(r.blockAds),
    smartProxy: r.smartProxy === undefined ? DEFAULT_ROUTING.smartProxy : Boolean(r.smartProxy),
    customRules: String(r.customRules || '').slice(0, 6000),
    customRuleList: normalizeRuleList(r.customRuleList),
  };
}

function normalizeTarget(target) {
  const value = String(target || '').trim().replace(/,/g, '');
  if (value === 'PROXY') return GROUP_NAMES.manual;
  if (value === 'AUTO') return GROUP_NAMES.auto;
  return value;
}

export function parseCustomRules(text) {
  const rules = [];
  const warnings = [];
  let skipped = 0;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.length > 500) {
      skipped += 1;
      continue;
    }
    const parts = line.split(',').map((x) => x.trim());
    const type = (parts[0] || '').toUpperCase();
    if (!CLASH_RULE_TYPES.has(type)) {
      warnings.push(`自定义规则类型 ${type || '(空)'} 暂不支持，已跳过`);
      skipped += 1;
      continue;
    }
    if (parts.length < 2) {
      skipped += 1;
      continue;
    }
    if (type === 'MATCH' || type === 'FINAL') {
      rules.push({ type: 'MATCH', target: normalizeTarget(parts[1]), raw: line });
    } else if (parts.length >= 3) {
      rules.push({
        type,
        value: parts[1],
        target: normalizeTarget(parts[2]),
        options: parts.slice(3),
        raw: line,
      });
    } else {
      skipped += 1;
    }
  }
  if (skipped) warnings.push(`已跳过 ${skipped} 条格式不完整的自定义规则`);
  return { rules, warnings };
}

export function collectCustomRules(routing, profile) {
  const globalText = routing?.customRules || '';
  const profileText = profile?.customRules || '';
  const globalParsed = parseCustomRules(globalText);
  const profileParsed = parseCustomRules(profileText);
  const globalList = normalizeRuleList(routing?.customRuleList);
  const profileList = normalizeRuleList(profile?.customRuleList);
  return {
    global: { rules: [...globalParsed.rules, ...globalList], warnings: globalParsed.warnings },
    profile: { rules: [...profileParsed.rules, ...profileList], warnings: profileParsed.warnings },
  };
}

export function buildClashRules(settings, profile) {
  const routing = normalizeRouting(settings?.routing);
  const custom = collectCustomRules(routing, profile);
  const warnings = [...custom.global.warnings, ...custom.profile.warnings];
  const allCustom = [...custom.global.rules, ...custom.profile.rules];
  const customMatchers = allCustom.filter((rule) => rule.type === 'MATCH');
  const customLines = allCustom
    .filter((rule) => rule.type !== 'MATCH')
    .map((rule) => [rule.type, rule.value, rule.target, ...(rule.options || [])].join(','));

  const rules = [...PRIVATE_RULES_CLASH, ...customLines];
  if (routing.smartProxy) {
    for (const domain of SMART_DOMAINS) rules.push(`DOMAIN-SUFFIX,${domain},${GROUP_NAMES.manual}`);
  }
  if (routing.blockAds) {
    for (const domain of AD_DOMAINS) rules.push(`DOMAIN-SUFFIX,${domain},REJECT`);
  }
  if (routing.domesticDirect) {
    rules.push('DOMAIN-SUFFIX,cn,DIRECT');
    for (const domain of CN_DIRECT_DOMAINS) rules.push(`DOMAIN-SUFFIX,${domain},DIRECT`);
    rules.push('GEOSITE,cn,DIRECT');
    rules.push('GEOIP,CN,DIRECT,no-resolve');
  }
  const customFinal = customMatchers.length ? customMatchers[customMatchers.length - 1].target : GROUP_NAMES.manual;
  rules.push(`MATCH,${customFinal}`);
  return { rules, warnings, customCount: allCustom.length, directDomainCount: routing.domesticDirect ? CN_DIRECT_COUNT : 0, routing };
}

function singboxTarget(target) {
  if (target === 'DIRECT') return 'direct';
  if (target === 'REJECT' || target === 'REJECT-DROP') return 'block';
  return target;
}

function toSingboxRule(rule, warnings) {
  const target = singboxTarget(rule.target);
  if (rule.type === 'MATCH') {
    return { match: true, target };
  }
  const map = {
    DOMAIN: 'domain',
    'DOMAIN-SUFFIX': 'domain_suffix',
    'DOMAIN-KEYWORD': 'domain_keyword',
    'DOMAIN-REGEX': 'domain_regex',
    'IP-CIDR': 'ip_cidr',
    'IP-CIDR6': 'ip_cidr',
    'SRC-IP-CIDR': 'source_ip_cidr',
    'PROCESS-NAME': 'process_name',
    NETWORK: 'network',
  };
  if (rule.type === 'GEOSITE') {
    if (String(rule.value).toLowerCase() !== 'cn') {
      warnings.push(`Sing-box 仅内置支持 GEOSITE,cn 规则：${rule.raw}`);
      return null;
    }
    return { rule: { rule_set: ['geosite-cn'], outbound: target } };
  }
  if (rule.type === 'GEOIP') {
    if (String(rule.value).toLowerCase() !== 'cn') {
      warnings.push(`Sing-box 仅内置支持 GEOIP,CN 规则：${rule.raw}`);
      return null;
    }
    return { rule: { rule_set: ['geoip-cn'], outbound: target } };
  }
  if (rule.type === 'RULE-SET') {
    warnings.push(`Sing-box 暂不支持自定义 RULE-SET：${rule.raw}`);
    return null;
  }
  const key = map[rule.type];
  if (!key) {
    warnings.push(`Sing-box 暂不支持规则 ${rule.type}：${rule.raw}`);
    return null;
  }
  return { rule: { [key]: [String(rule.value)], outbound: target } };
}

export function buildSingboxRoute(settings, profile) {
  const routing = normalizeRouting(settings?.routing);
  const custom = collectCustomRules(routing, profile);
  const warnings = [...custom.global.warnings, ...custom.profile.warnings];
  const rules = [
    { ip_is_private: true, outbound: 'direct' },
    { domain_suffix: ['local', 'lan'], outbound: 'direct' },
  ];
  let final = GROUP_NAMES.manual;
  let needsBlock = false;
  let needsCnRuleSets = routing.domesticDirect;

  for (const customRule of [...custom.global.rules, ...custom.profile.rules]) {
    const converted = toSingboxRule(customRule, warnings);
    if (!converted) continue;
    if (converted.match) {
      final = converted.target;
      continue;
    }
    if (converted.rule.rule_set) needsCnRuleSets = needsCnRuleSets || true;
    if (converted.rule.outbound === 'block') needsBlock = true;
    rules.push(converted.rule);
  }

  if (routing.smartProxy) {
    rules.push({ domain_suffix: SMART_DOMAINS, outbound: GROUP_NAMES.manual });
  }
  if (routing.blockAds) {
    needsBlock = true;
    rules.push({ domain_suffix: AD_DOMAINS, outbound: 'block' });
  }
  if (routing.domesticDirect) {
    rules.push({ domain_suffix: ['cn', ...CN_DIRECT_DOMAINS], outbound: 'direct' });
    rules.push({ rule_set: ['geosite-cn'], outbound: 'direct' });
    rules.push({ rule_set: ['geoip-cn'], outbound: 'direct' });
  }

  const ruleSet = needsCnRuleSets ? [
    {
      type: 'remote',
      tag: 'geosite-cn',
      format: 'binary',
      url: 'https://cdn.jsdelivr.net/gh/SagerNet/sing-geosite@rule-set/geosite-cn.srs',
      download_detour: 'direct',
      update_interval: '7d',
    },
    {
      type: 'remote',
      tag: 'geoip-cn',
      format: 'binary',
      url: 'https://cdn.jsdelivr.net/gh/SagerNet/sing-geoip@rule-set/geoip-cn.srs',
      download_detour: 'direct',
      update_interval: '7d',
    },
  ] : [];

  return {
    rules,
    final,
    rule_set: ruleSet,
    warnings,
    needsBlock,
    customCount: custom.global.rules.length + custom.profile.rules.length,
    directDomainCount: routing.domesticDirect ? CN_DIRECT_COUNT : 0,
    routing,
  };
}

export function routingSummary(settings, profile) {
  const routing = normalizeRouting(settings?.routing);
  const custom = collectCustomRules(routing, profile);
  return {
    domesticDirect: routing.domesticDirect,
    blockAds: routing.blockAds,
    smartProxy: routing.smartProxy,
    customCount: custom.global.rules.length + custom.profile.rules.length,
    directDomainCount: routing.domesticDirect ? CN_DIRECT_COUNT : 0,
  };
}
