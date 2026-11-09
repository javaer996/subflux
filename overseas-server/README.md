# SubFlux 国外主服务

部署在国外的聚合面板：拉取多个订阅、解析节点、做画像与检测、按条件筛选，并生成多客户端订阅。

## 启动

```bash
cd overseas-server
npm install
./start.sh      # 后台启动，日志写入 server.log
# 或 node server.js
```

默认监听 `0.0.0.0:8888`，打开 `http://<主机IP>:8888`。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8888` | 监听端口 |
| `HOST` | `0.0.0.0` | 绑定地址 |
| `DATA_DIR` | `./data` | 数据目录 |
| `MIHOMO_BIN` | `./bin/mihomo` | 站点检测引擎路径 |

`bin/mihomo` 不入库（约 55MB，区分架构），首次部署按 `bin/README.md` 下载。没有它时面板仍可启动，但站点检测、自动站点检测和 CN 实际检测不可用。

## 使用流程

1. **订阅源** → 添加订阅链接或粘贴 Clash / Base64 / 节点文本。可设置刷新周期、User-Agent、是否通过代理拉取；也可以关闭「自动刷新」，让这个源只在手动点刷新时才抓取。
2. **节点池** → 测速（TCP 入口延迟）、IP 画像、站点检测、CN 实际检测。支持按来源、协议、地区、类型、站点、CN 连通、质量、延迟筛选。
3. **输出订阅** → 新建输出，选择回退格式和筛选条件；复制自动链接或扫码导入客户端。

输出链接：

```text
/sub/<token>           自动识别客户端（推荐）
/sub/<token>/clash
/sub/<token>/singbox
/sub/<token>/base64
/sub/<token>/plain
```

`/sub/<token>` 按 User-Agent 判断客户端并设置 `Vary: User-Agent`，响应头 `x-subflux-format` 表示实际返回的格式。回退格式仅在 UA 无法识别时使用。

## 刷新后自动检测

「设置 → 刷新与检测」可开启：

- **自动 IP 画像**：刷新后为缺少数据的节点补 ASN / 家宽识别。
- **自动连通 / 延迟检测**：TCP 节点测入口端口；HY2 / TUIC / WireGuard 等 UDP 协议跳过 TCP 探测。
- **自动站点检测**：对缺少站点结果的新节点真实访问已启用站点，单次最多 `siteCheckLimit` 个。

自动任务只处理缺数据的新节点，后台执行，不阻塞刷新。UDP 节点的实际连通以站点检测结果为准。

关闭「自动刷新」的订阅源不参与定时任务，卡片上会标「仅手动刷新」；点卡片上的刷新按钮或「全部刷新」仍会抓取，只是抓完不排下一次。

## 站点解锁检测

通过本地 Mihomo 让节点真实访问站点，默认 5 项：

| 站点 | 简写 |
| --- | --- |
| YouTube | `YT` |
| ChatGPT | `GPT` |
| Claude | `CL` |
| Grok | `GRK` |
| Gemini | `GEM` |

- 可在设置中增删站点、修改简写和检测地址。
- 只有明确支持（HTTP 2xx/3xx 且非挑战页）才写入节点名；超时、Cloudflare 挑战等不确定结果不会写成支持。
- 节点名默认追加 `[YT·GPT]`；模板含 `{sites}` 时按模板位置插入。
- 输出订阅的站点过滤要求所选站点**全部**为支持。

## 分流规则

默认顺序：

1. 私网 / 回环 / `.local` / `.lan` 直连
2. 自定义规则（全局 + 单订阅，优先级最高）
3. OpenAI / Claude / Gemini / Grok / YouTube 走手动选择
4. 可选广告拦截
5. 内置 159 条国内常见域名显式直连（`lib/cn-direct.js`）
6. `.cn` + `GEOSITE,cn` + `GEOIP,CN` 兜底
7. `MATCH` 走手动选择

显式直连列表覆盖百度、腾讯、阿里、字节、网易、京东、B 站、知乎、美团、12306、运营商、银行等，避免 GeoSite 数据缺失时误代理国内站点。自定义规则使用可视化编辑器，不需要手写语法。

Sing-box 会转换常用规则并使用远程 `geosite-cn` / `geoip-cn` rule-set；不支持的语法会在预览中提示。

## 订阅拉取代理

「设置 → 刷新与检测」填写 HTTP/HTTPS 代理（例如 Clash mixed-port `http://127.0.0.1:7890`），再在订阅源高级选项打开「通过代理拉取」。不支持 `socks5://` 形式的代理 URL；Clash mixed-port 本身同时提供 HTTP 代理。

## 中国连通检测

主服务在国外无法直接判断节点在国内是否可达，需要配合 `../china-probe/` 部署国内探针。配置后在节点池使用「CN 实际」执行实际代理检测，详见 [../china-probe/README.md](../china-probe/README.md)。

## 数据与安全

- 所有数据保存在 `data/db.json`，包含订阅地址、节点信息和输出令牌。
- 面板没有登录鉴权，不要直接暴露到公网；需要外部访问时用反向代理加认证或仅走内网 / Tailscale。
- 定期备份 `data/`；升级前先停止服务。

## 目录

```text
server.js       HTTP / API / 订阅端点
lib/parser.js   订阅解析（Clash / Base64 / 节点链接 / Sing-box）
lib/generator.js Clash / Sing-box / Base64 / 纯链接生成
lib/routing.js  分流规则与自定义规则
lib/cn-direct.js 国内直连域名清单
lib/tester.js   TCP 延迟与 IP 画像任务
lib/site-tester.js Mihomo 站点检测
lib/china-tester.js 中国探针任务
lib/store.js    JSON 持久化与迁移
public/         前端
```
