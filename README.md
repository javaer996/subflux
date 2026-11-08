# SubFlux · 订阅汇聚

一个轻量的自托管订阅聚合面板（Node.js 20.18+）：把多个机场 / 自建订阅汇聚到一处，定时刷新，解析后统一做 IP 画像、站点解锁检测、筛选、重命名，并生成适配不同客户端的订阅链接。

- **单进程、零前端框架、零数据库**：Node.js + 原生 HTTP + 少量 npm 依赖，数据保存在本地 JSON。
- **订阅解析**：Clash / Mihomo YAML、Base64、纯节点链接、Sing-box JSON。
- **协议支持**：SS / SSR / VMess / VLESS / Trojan / Hysteria2 / TUIC / HTTP / SOCKS5 / AnyTLS；Clash 专有协议可作为 Clash 透传。
- **一个链接自动识别客户端**：根据 User-Agent 自动返回 Clash YAML、Sing-box JSON、Base64 或节点链接；也可以用 `/clash`、`/singbox`、`/base64`、`/plain` 强制格式。
- **扫码添加**：每个输出订阅都生成二维码，手机相机或客户端扫码即可添加，支持自动 / Clash / Sing-box / Base64 格式。
- **刷新后自动检测**：可配置刷新后自动补入口延迟、IP 画像和站点解锁，避免输出里的站点 / 延迟过滤条件没有数据；UDP 节点由站点检测补实际连通。
- **流量识别**：读取 `Subscription-Userinfo` 响应头；流量耗尽或订阅过期时自动从输出中剔除该源节点。
- **IP 画像**：解析入口 IP 的 ASN，识别家宽 / 机房 / CDN / 移动 / 企业，结合 TCP 入口延迟计算启发式质量分。
- **站点解锁检测**：通过本地 Mihomo 引擎让节点真实访问 YouTube / ChatGPT / Claude / Grok / Gemini（默认 5 项），结果以 `YT·GPT·CL·GRK·GEM` 简写追加到节点名；支持自定义站点。
- **中国连通检测**：主服务在国外时，可接入部署在中国大陆的 `probe.js`，支持 TCP 入口检测和 Mihomo 实际代理检测（含 HY2/TUIC/WireGuard UDP），并支持主服务 ↔ 探针双向连通测试。
- **订阅拉取代理**：可配置 HTTP/HTTPS 代理，并让单个订阅源通过该代理拉取。
- **分流规则**：默认私网直连、国内常见域名显式直连、AI / 流媒体走代理，并用 `GEOSITE/GEOIP CN` 兜底；支持在全局与单个输出中追加自定义规则，Sing-box 会自动转换常用规则。
- **输出格式**：Clash / Mihomo、Sing-box、Base64 (V2Ray / Shadowrocket)、纯节点链接。
- **分组**：手动选择、自动测速（url-test）、故障转移（fallback）、按地区自动分组。
- **客户端兼容**：生成的 Clash / Sing-box 配置已通过 `mihomo -t` 与 `sing-box check` 校验。

## 启动

```bash
# 依赖已安装在 node_modules
node server.js

# 或使用启动脚本（后台）
./start.sh

# 停止
./stop.sh
```

默认监听 `0.0.0.0:8888`，打开 `http://<主机IP>:8888`。

环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8888` | 监听端口 |
| `HOST` | `0.0.0.0` | 绑定地址 |
| `DATA_DIR` | `./data` | 数据目录 |
| `MIHOMO_BIN` | `./bin/mihomo` | 站点检测引擎路径 |
| `PROBE_TOKEN` | — | 仅 `probe.js` 使用，至少 16 位 |
| `PROBE_PORT` | `8899` | 仅 `probe.js` 使用 |

## 使用流程

1. **订阅源** → 添加订阅链接，或粘贴 Clash / Base64 / 节点文本。可单独设置刷新周期与 User-Agent。
2. **节点池** → 点击「测速当前筛选」做 TCP 入口延迟与 IP 画像；再点「站点检测」让节点真实访问站点。支持按来源、协议、地区、类型、站点、CN 连通、质量、延迟筛选。
3. **输出订阅** → 新建输出，选择回退格式和筛选条件；复制自动链接 `/sub/<token>`，或点二维码扫码导入客户端。

输出链接格式：

```text
http://<host>:8888/sub/<token>         # 自动识别客户端（推荐）
http://<host>:8888/sub/<token>/clash
http://<host>:8888/sub/<token>/singbox
http://<host>:8888/sub/<token>/base64
http://<host>:8888/sub/<token>/plain
```

自动识别依据 User-Agent：

| 客户端 | 返回格式 |
| --- | --- |
| Clash / Mihomo / Stash / Clash Verge / FlClash | Clash YAML |
| Sing-box / SFA / SFI / SFT / NekoBox | Sing-box JSON |
| V2RayN / V2RayNG / Shadowrocket / Loon / Surge 等 | Base64 节点列表 |
| 无法识别 | 输出订阅的「回退格式」 |

## 刷新后自动检测

在「设置 → 刷新与检测」中可开启：

- **自动 TCP 测速**：刷新后对新节点做入口 TCP 延迟测试；HY2 / TUIC / WireGuard 等 UDP 协议会跳过 TCP 探测，实际连通由站点检测补充；
- **自动 IP 画像**：刷新后对新节点做 ASN / 家宽识别；
- **自动站点检测**：刷新后对新节点真实访问已启用站点（单次最多 `siteCheckLimit` 个）。

自动任务只处理缺数据的新节点，已有结果不会重复检测；检测任务在后台运行，不阻塞刷新。

## 站点解锁检测

默认站点：YouTube (`YT`)、ChatGPT (`GPT`)、Claude (`CL`)、Grok (`GRK`)、Gemini (`GEM`)。

- 检测不是靠 ASN 猜测，而是启动 `bin/mihomo`，把节点作为代理真实访问站点；需要检测引擎可执行。
- 每个节点最多检测一次，单次默认最多 30 个节点（设置可调）。站点请求并行，节点串行。
- 命名中只标记明确支持的站点；Cloudflare 挑战、超时和无法确认的结果不会写入节点名。
- 自定义站点可设置名称、简写和 URL；默认以 HTTP 2xx/3xx 且不是挑战页判定为支持。
- 检测会消耗少量节点流量。`bin/mihomo` 为 Linux arm64 构建；其他架构请设置 `MIHOMO_BIN` 指向本机可执行文件。

## 中国连通检测（被墙）

主服务部署在国外时，国外服务器无法直接判断节点在中国大陆是否可达。正确做法是增加一个**中国大陆探针**。探针不拉订阅，主服务把节点信息通过 Tailscale 下发：

- **CN 实际**：主服务把 Clash 代理配置发给探针，探针启动 Mihomo 真实代理访问测试地址。支持 HY2 / TUIC / WireGuard 等 UDP 协议。
- **CN TCP**：只测 host:port 的 TCP 入口，适合快速诊断 TCP 类节点；UDP 节点会被跳过。

节点池的「CN 实际」按钮使用实际代理模式，结果标记为 `CN 可达` / `CN 不可达`，并支持节点过滤和输出订阅过滤。

### 直接运行

```bash
# 在中国大陆的机器上（Node.js 20+ 和 mihomo）
PROBE_TOKEN=至少16位随机字符串 MIHOMO_BIN=/path/to/mihomo node probe.js
# 默认监听 0.0.0.0:8899
```

### 容器内运行（推荐）

`Dockerfile.probe` 会自动下载对应架构的 Mihomo：

```bash
docker build -f Dockerfile.probe -t subflux-probe .
docker run -d --name subflux-probe --restart unless-stopped \
  --network host \
  -e PROBE_TOKEN='至少16位随机字符串' \
  -e PROBE_HOST='100.x.y.z' \
  subflux-probe
```

如果 GitHub 下载慢，可以用 `--build-arg MIHOMO_URL='https://你的镜像/mihomo.gz'`，或者直接挂载已有的 mihomo 并设置 `MIHOMO_BIN`。

`PROBE_HOST` 填国内机器的 Tailscale IP；也可以使用桥接网络并发布到该 IP：

```bash
docker run -d --name subflux-probe --restart unless-stopped \
  -p 100.x.y.z:8899:8899 \
  -e PROBE_TOKEN='至少16位随机字符串' \
  subflux-probe
```

国内机器不需要公网 IP，也不需要订阅链接：主服务通过 Tailscale 把 `{host, port}` 或 `{id, proxy}` 发给探针，探针只负责从国内发起测试。探针本身需要能出站访问这些节点。实际代理模式会把节点配置（含密钥）发到国内探针，因此探针必须只监听 Tailscale 内网，并保护好 Token。

如果主服务也在容器里，先确认容器能访问 Tailscale 地址：

```bash
curl http://100.x.y.z:8899/health
# 失败时给主服务容器加 --network host，或配置 Tailscale sidecar / 路由
```

### 双向连通测试

在「设置 → 中国连通检测」填写：

- 探针地址：`http://100.x.y.z:8899/api/probe/tcp`
- Token：与 `PROBE_TOKEN` 相同
- 反向测试地址：`http://100.y.y.y:8888/api/health`（主服务的 Tailscale 地址）

点「双向连通测试」会验证：

1. 国外主服务 → 国内探针（`/health`）
2. 国内探针 → 国外主服务（反向请求反向测试地址）

注意：实际连接失败可能是 GFW，也可能是运营商路由、端口封锁或节点本身故障，所以界面使用“CN 不可达 / 疑似被墙”，不做 100% 断言。记得在 Tailscale ACL / 防火墙只允许主服务访问 8899。

## 订阅拉取代理

在「设置 → 刷新与检测」填写 HTTP/HTTPS 代理（例如 Clash 的 mixed-port `http://127.0.0.1:7890`），然后在订阅源编辑 → 高级选项打开「通过代理拉取」。当前不支持 `socks5://` Proxy URL；Clash mixed-port 本身同时提供 HTTP 代理，可直接使用。

## 节点命名

默认模板：

```text
{flag} {region} · {type} · {quality}{score} · {seq:02}
```

可用变量：

| 变量 | 含义 |
| --- | --- |
| `{flag}` | 国旗 emoji |
| `{region}` / `{country}` / `{cc}` | 中文地区名 / 英文国家名 / 国家码 |
| `{type}` | 家宽 / 机房 / CDN / 移动 / 企业 / 未知 |
| `{quality}` / `{score}` | 入口质量标签 / 质量分（待测时为空） |
| `{sites}` | 站点简写，例如 `YT·GPT·GRK` |
| `{seq:02}` | 序号，`02` 表示补零到两位 |
| `{isp}` / `{asn}` | ISP / ASN |
| `{protocol}` / `{source}` / `{name}` | 协议 / 来源名 / 原始节点名 |

如果开启「节点名追加站点简写」，且模板里没有 `{sites}`，会在名称末尾自动追加 `[YT·GPT]` 形式的后缀。输出时会自动去重、截断并保证名称唯一。

## 分流规则

默认生成的规则包括：

- 私网 / 回环 / `.local` / `.lan` 直连；
- OpenAI / Claude / Gemini / Grok / YouTube 域名走「🚀 节点选择」；
- 可选的常见广告域名拦截；
- 内置 **159 条**国内常见域名显式直连（百度、腾讯、阿里、字节、网易、京东、B 站、知乎、美团、12306、运营商、银行等），避免 `GEOSITE` 数据缺失时把国内站点错误代理；
- `.cn`、`GEOSITE,cn` 与 `GEOIP,CN` 作为兜底直连；
- 最终 `MATCH` 走手动选择组。

国内域名清单在 `lib/cn-direct.js`，可以继续补充；你自定义的规则仍会排在默认规则之前，优先覆盖。

自定义规则使用可视化编辑器：在下拉框选择「匹配类型 / 匹配内容 / 动作」即可，不需要手写规则语法。全局规则在「设置 → 分流规则」，单个输出也可以在高级设置中追加。底层支持：

```text
DOMAIN-SUFFIX,example.com,DIRECT
DOMAIN-KEYWORD,corp,🚀 节点选择
IP-CIDR,203.0.113.0/24,PROXY,no-resolve
GEOSITE,cn,DIRECT
PROCESS-NAME,foo.exe,DIRECT
MATCH,🚀 节点选择
```

可视化编辑器会实时显示生成的 Clash 规则预览；生成 Sing-box 时自动转换常用规则。`GEOSITE CN` / `GEOIP CN` 与 `MATCH` 动作也都在下拉框中。

## IP 画像的边界

入口质量分基于节点**入口 IP** 的公共 ASN 情报（`ip-api.com`，失败时回退 `ipwho.is`），并参考 `hosting` / `mobile` 标记、ISP 关键词与 TCP 入口延迟。它是 SubFlux 自算的启发式分数，不是官方评分。

- 域名节点会先做 DNS 解析，因此 Cloudflare 等 CDN 节点显示的是 **CDN 入口**，不是代理真实落地 IP。
- 站点解锁检测会真实穿过节点，因此比入口质量分更接近实际可用性，但仍受 Cloudflare 挑战、目标站点反爬和检测时网络状况影响。
- 两个指标分开呈现，不把「入口质量」误称为「原生 IP / 流媒体解锁」。

## 数据与安全

- 数据文件：`data/db.json`（原子写入，180ms 防抖）。
- 订阅 URL、输出 token 均以明文保存在本机 JSON 中，请限制文件权限。
- 面板没有账号体系，默认绑定 `0.0.0.0`。**不要把 8888 直接暴露到公网**；远程使用请在反向代理层增加认证与 HTTPS。
- 服务会请求用户填写的任意 HTTP(S) 地址；不要添加不可信的内部地址。

## 目录

```text
server.js             HTTP / API / 订阅端点
probe.js              中国大陆 TCP 探针（独立运行）
Dockerfile.probe      探针容器镜像（可选）
bin/mihomo            站点检测引擎（Linux arm64）
bin/MIHOMO_LICENSE    Mihomo GPL-3.0 许可证
lib/
  store.js            JSON 持久化
  parser.js           Clash / Base64 / URI / Sing-box 解析
  uri.js              节点 URI 与指纹
  refresher.js        抓取、流量头解析、节点合并
  quality.js          DNS、ASN 画像、质量评分
  sites.js            站点定义、简写与识别结果判定
  site-tester.js      Mihomo 代理站点检测任务
  china-tester.js     中国探针 TCP 连通任务
  tester.js           TCP 延迟 + 后台测试任务
  scheduler.js        定时刷新调度
  traffic.js          流量/过期计算
  routing.js          默认 / 自定义分流规则
  clients.js          User-Agent 客户端识别
  generator.js        筛选、重命名、Clash / Sing-box / Base64 生成
  presentation.js     状态统计与节点筛选
public/               无构建步骤的前端
data/                 运行时数据
start.sh / stop.sh    后台启停脚本
```

## 校验命令

若本机有对应二进制：

```bash
mihomo -t -f output.yaml
sing-box check -c output.json
```
