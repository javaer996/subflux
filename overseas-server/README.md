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
| `MIHOMO_BIN` | 自动查找 | 站点检测引擎路径；未设置时依次尝试 `/opt/mihomo/mihomo`（compose 默认下载位置）→ `bin/mihomo` |

`bin/mihomo` 不入库（约 55MB，区分架构），首次部署按 `bin/README.md` 下载，或设置 `MIHOMO_BIN`。引擎查找顺序是：设置里的路径 → `MIHOMO_BIN` → `/opt/mihomo/mihomo`（Docker Compose 默认下载位置）→ 项目内置 `bin/mihomo`；面板「设置 → 站点解锁检测」里可以看到当前解析到哪个路径。找不到引擎时面板仍可启动，但站点检测、自动站点检测和 CN 实际检测不可用。

## 使用流程

1. **订阅源** → 添加订阅链接或粘贴 Clash / Base64 / 节点文本。可设置刷新周期（不限上限，快捷按钮含 7 / 14 / 30 天）、User-Agent，以及拉取方式（直连 / 走节点池里的某个节点 / 指定外部代理地址）；也可以关闭「自动刷新」，让这个源只在手动点刷新时才抓取。
2. **节点池** → 测速（TCP 入口延迟）、IP 画像、站点检测、CN 实际检测。支持按来源、协议、地区、类型、站点、CN 连通、质量、延迟筛选。
3. **输出订阅** → 新建输出，选择回退格式和筛选条件；「最多输出节点」控制每个订阅返回的条数（填 0 表示不限制）。复制自动链接或扫码导入客户端。

输出链接：

```text
/sub/<token>           自动识别客户端（推荐）
/sub/<token>/clash
/sub/<token>/singbox
/sub/<token>/base64
/sub/<token>/plain
```

「设置 → 订阅访问地址」可以填订阅链接使用的前缀（例如 `https://sub.example.com` 或 `http://203.0.113.10:8888`），留空则用浏览器当前地址；二维码和复制出来的链接都会用这个前缀。

`/sub/<token>` 按 User-Agent 判断客户端并设置 `Vary: User-Agent`，响应头 `x-subflux-format` 表示实际返回的格式。回退格式仅在 UA 无法识别时使用。每次请求都会按当前节点池和筛选条件实时生成，不缓存；需要临时限制条数时可以在链接后加 `?limit=100`。

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

订阅源可以单独选择拉取方式：

- **直连**：服务器直接请求订阅站（默认）。
- **节点池节点**：选一个已有节点作为出口。面板会用内置 Mihomo 临时拉起单节点代理，因此 vmess / vless / trojan / ss / hysteria2 等协议都能用；节点被删除后刷新会提示重新选择。
- **外部代理地址**：填 `http://`、`https://` 或 `socks5://`（socks5 由 Mihomo 转成本地混合端口）。留空则回退到「设置 → 刷新与检测 → 订阅拉取代理」。

改了拉取方式会立刻触发一次抓取，方便确认能不能连通。

## 定时推送

每个输出订阅可以单独开启「定时推送」，到点生成该订阅并推送到一个或多个目标（最多 5 个）：

- **本地文件**：写到服务器路径，例如 `/data/sub/subflux.yaml`；目录会自动创建，先写临时文件再替换，避免读到半截内容。
- **HTTP 地址**：PUT 或 POST 到指定 URL，可附加 `Authorization` 等请求头，适合对象存储预签名地址、WebDAV 网关或自己的接收端。
- **对象存储**：支持阿里云 OSS（原生签名）和 S3 兼容存储（R2 / MinIO / AWS，SigV4）。填写 Endpoint、Bucket、AccessKey、对象路径；S3 兼容还需要 Region。

推送间隔独立于订阅源刷新间隔，可以按分钟设置，也可以设到任意长；推送失败只会标记在订阅卡片上，不影响订阅本身。卡片上的上传图标可以随时立即推送。

注意：AccessKey Secret 以明文保存在 `data/db.json`，请限制面板访问范围并保管好备份文件。

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
lib/pusher.js   定时推送（文件 / HTTP / OSS / S3）
lib/store.js    JSON 持久化与迁移
public/         前端
```
