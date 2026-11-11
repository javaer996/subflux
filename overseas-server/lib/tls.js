/**
 * 证书相关的判定工具。
 *
 * 不是所有节点都有「证书」这回事：
 * - SS / SOCKS5 / 明文 HTTP 代理在传输层根本不走 TLS，没有证书可校验；
 * - VLESS + Reality 虽然握手是 TLS，但客户端校的是公钥而不是站点的证书链，
 *   证书对不对不影响可用性；
 * - 只有 HTTP(S) 代理、Trojan、Hysteria2 / TUIC 这类才是「真的会校验站点证书」。
 *
 * 因此过滤时要把「没有证书」和「证书不受信」分开：前者不该被顺带剔除，
 * 否则选「只保留证书可信」会把一堆本来能用的节点一起干掉。
 */

/** 节点的传输层是否涉及需要校验的 TLS 证书。 */
export function nodeUsesTls(node) {
  const raw = (node && node.raw) || {};
  // Reality 用的是公钥认证，客户端不校验站点证书链。
  if (raw['reality-opts']) return false;
  const type = String(raw.type || node?.protocol || '').toLowerCase();
  const tls = raw.tls === true || raw.tls === 'true';
  if (type === 'https') return true;
  if (type === 'http') return tls;
  if (type === 'hysteria' || type === 'hysteria2' || type === 'tuic'
    || type === 'anytls' || type === 'trojan') return true;
  return tls;
}

/** 节点是否有「已确认不受信」的证书。 */
export function certRejected(node) {
  return node?.certTrusted === false && nodeUsesTls(node);
}

/**
 * 按证书可信度过滤单个节点。
 *
 * - `exclude`：只剔除已确认校验失败的节点；没有证书概念的节点保留。
 * - `only`：要求 TLS 节点的证书明确通过校验；没有证书概念的节点同样保留。
 * - `untrusted`：只看已确认不受信的节点（节点池排查用）。
 */
export function certFilterPass(node, mode) {
  if (mode === 'exclude') return !certRejected(node);
  if (mode === 'only') return !nodeUsesTls(node) || node.certTrusted === true;
  if (mode === 'untrusted') return certRejected(node);
  return true;
}
