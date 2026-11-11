# SubFlux · 订阅汇聚

一个自托管的订阅聚合面板：把多个机场 / 自建订阅汇聚到一处，定时刷新，解析后统一做 IP 画像、站点解锁检测、筛选、重命名，并生成适配不同客户端的订阅链接。

仓库按部署位置分成两个独立目录，代码互不依赖：

```text
overseas-server/  国外主服务：面板、订阅解析、节点管理、订阅生成、站点检测
china-probe/      国内探针：在中国大陆发起 TCP / 实际代理连通检测
```

- 只有国外主服务需要长期运行，端口 `8888`。
- 国内探针是可选的，只在国内机器上运行，端口 `8899`；主服务通过内网或 Tailscale 访问它。
- 两部分都只用 Node.js（20.18+），无需数据库。

## 目录

```text
docker-compose.yml   国外主服务的 compose 部署（不需要 Dockerfile）
.env.example         compose 环境变量示例
docker/
  bootstrap.mjs      容器启动引导：依赖缓存、下载 Mihomo、转发信号

overseas-server/
  server.js           HTTP / API / 订阅端点
  lib/                解析、生成、检测、存储
  public/             前端（原生 HTML/CSS/JS）
  bin/                站点检测引擎放置位置（二进制不入库）
  data/               运行时数据（不入库）
  start.sh stop.sh    裸机后台启停

china-probe/
  probe.js            中国大陆探针
  docker-compose.yml  探针的 compose 部署（不需要 Dockerfile）
  start.sh            裸机后台启停
```

## 用 Docker Compose 部署（推荐）

只需要 Docker 和 compose，**不需要 Dockerfile，也不用在本机构建镜像**。`docker-compose.yml` 直接拉官方 `node:22-bookworm-slim` 和 `alpine/git`：

```bash
cp .env.example .env     # 可选，改端口 / 仓库地址 / Mihomo 镜像
docker compose up -d
```

启动链路：

1. `sources` 用 `alpine/git` 把 GitHub 代码克隆 / 更新到命名卷 `subflux-src`，更新时只做 `fetch + reset --hard`，不重新克隆。
2. `app` 用 `node:22-bookworm-slim` 运行 `docker/bootstrap.mjs`：
   - 依赖装到宿主机 `./cache/node_modules`，用 `package-lock.json` 哈希做标记，**只有首次启动或 lock 变化才执行 `npm ci`**；
   - npm 下载缓存在 `./cache/npm`，重装时无需重新下载；
   - Mihomo 下载到 `./cache/mihomo`，已有可执行文件就直接复用，不重复下载；
   - 以子进程启动 `server.js`，并把 `SIGTERM` 转发给它，`docker stop` 能优雅退出。
3. 数据落在 `./data`，容器重建不丢。

宿主机目录：

```text
./data                  db.json、logs/、.secret-key、.session-secret
./cache/node_modules    依赖（跨重启复用）
./cache/npm             npm 缓存
./cache/mihomo          mihomo 二进制
```

常用操作：

```bash
docker compose logs -f app        # 看日志，会打印"依赖已就绪，复用宿主机缓存"
docker compose restart app        # 重启：不重装依赖、不重下 Mihomo
docker compose down               # 停止；加 -v 会连代码卷一起删，宿主机缓存目录仍在
```

改了代码后要更新部署：

```bash
docker compose run --rm sources    # 重新拉取代码（一次性任务，不删缓存）
docker compose restart app         # 重启加载新代码；依赖与 Mihomo 命中宿主机缓存
```

也可以直接 `docker compose up -d`：它会重新跑一遍 `sources` 同步代码，但 `app` 已在运行不会自动重启，之后仍需 `docker compose restart app`。如果只更新了文件却没重启，面板会提示「前端文件比服务进程新」。

`REPO_URL` 可以换成自己的 fork；私有仓库用 `https://<token>@github.com/...` 或把 SSH key 挂进 `sources`。

Mihomo 默认按容器架构从 GitHub Releases 下载（`amd64-compatible` / `arm64`），服务器在国外时 `.env` 里 **`MIHOMO_URL` 和 `MIHOMO_MIRROR` 都留空即可**，不用填。只有国内网络下载不动时才需要：`MIHOMO_MIRROR=https://ghfast.top/https://github.com`（镜像前缀），或 `MIHOMO_URL` 给完整 `.gz` 直链（优先级最高，填了就完全绕过拼接）。

没装 Docker 时也可以裸机跑，见 `overseas-server/README.md`；国内探针的容器部署见 `china-probe/README.md`。

## 启动主服务（裸机）

```bash
cd overseas-server
npm install
./start.sh          # 后台启动，日志在 data/logs/app-YYYY-MM-DD.log
# 或 node server.js
```

打开 `http://<主机IP>:8888`，首次会跳到登录页；默认账号 `admin` / `subflux`，请通过环境变量修改。

`bin/mihomo` 不入库（约 55MB，区分架构），首次部署按 `overseas-server/bin/README.md` 下载，或设置 `MIHOMO_BIN`。也可以用 Docker Compose（引擎自动下载到 `/opt/mihomo/mihomo`），或在面板「设置 → 站点解锁检测 → Mihomo 引擎路径」里直接填绝对路径。找不到引擎时面板仍可启动，但站点检测、自动站点检测和 CN 实际检测不可用。

环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8888` | 监听端口 |
| `HOST` | `0.0.0.0` | 绑定地址 |
| `DATA_DIR` | `./data` | 数据目录（db.json、logs、密钥） |
| `SUBFLUX_USERNAME` | `admin` | 面板登录用户名 |
| `SUBFLUX_PASSWORD` | `subflux` | 面板登录密码，**部署后请立即修改** |
| `SUBFLUX_SESSION_SECRET` | 自动生成 | 会话签名密钥（≥16 字符），留空则写入 `data/.session-secret` |
| `SUBFLUX_SECRET_KEY` | 自动生成 | 敏感字段加密密钥（≥16 字符），留空则写入 `data/.secret-key`；设置后不要随意更换 |
| `MIHOMO_BIN` | 自动查找 | 站点检测引擎路径；未设置时依次尝试 `/opt/mihomo/mihomo`（compose 默认下载位置）→ `bin/mihomo` |

## 使用流程

1. **订阅源** → 添加订阅链接，或粘贴 Clash / Base64 / 节点文本。可单独设置刷新周期、User-Agent，以及拉取方式（直连 / 走节点池里的某个节点 / 指定外部代理地址）。
2. **节点池** → 测速、IP 画像、站点检测、CN 实际检测。支持按来源、协议、地区、类型、站点、CN 连通、质量、延迟筛选。
3. **输出订阅** → 新建输出，选择回退格式和筛选条件；复制自动链接 `/sub/<token>`，或扫码导入客户端。

输出链接：

```text
http://<host>:8888/sub/<token>         # 自动识别客户端（推荐）
http://<host>:8888/sub/<token>/clash
http://<host>:8888/sub/<token>/singbox
http://<host>:8888/sub/<token>/base64
http://<host>:8888/sub/<token>/plain
```

## 功能

- **订阅解析**：Clash / Mihomo YAML、Base64、纯节点链接、Sing-box JSON。
- **协议**：SS / SSR / VMess / VLESS / Trojan / Hysteria2 / TUIC / HTTP / SOCKS5 / AnyTLS。
- **客户端识别**：按 User-Agent 返回对应格式，也可用路径强制格式。
- **扫码添加**：自动 / Clash / Sing-box / Base64 二维码。
- **订阅地址前缀**：可在设置里填其它域名或公网 IP，订阅链接和二维码不必使用面板的访问地址。
- **刷新后自动检测**：自动补 IP 画像、TCP 入口延迟和站点解锁；UDP 节点由站点检测补实际连通。
- **拉取代理**：每个订阅源可选直连、走节点池中的某个节点（Mihomo 临时单节点出口），或指定 HTTP / HTTPS / SOCKS5 外部代理。
- **流量识别**：读取 `Subscription-Userinfo`；流量耗尽或过期时可自动剔除。
- **IP 画像**：入口 IP 的 ASN 类型（家宽 / 机房 / CDN / 移动 / 企业）+ 代理 / VPN / 滥用风险（ProxyCheck）+ 延迟，综合成 1–99 质量分；与 iplark 等第三方口径不同，仅供参考。
- **站点解锁**：通过 Mihomo 让节点真实访问站点，默认 YouTube / ChatGPT / Claude / Grok / Gemini，结果以 `YT·GPT·CL·GRK·GEM` 写入节点名。
- **CN 连通检测**：由 `china-probe/` 从中国大陆发起 TCP 或实际代理检测（含 HY2 / TUIC / WireGuard）。
- **分流规则**：私网直连、159 条国内常见域名显式直连、AI / 流媒体代理、`GEOSITE/GEOIP CN` 兜底，支持可视化自定义规则。
- **输出格式**：Clash / Mihomo、Sing-box、Base64、纯节点链接；已通过 `mihomo -t` 与 `sing-box check`。
- **按需输出**：每个订阅可限制最多返回多少条（0 = 不限），还能按国家/地区分别限制（例如每国最多 3 个，避免输出被同一地区刷满），也支持链接上加 `?limit=N` 临时覆盖；每次请求都按最新节点池实时生成。输出订阅可以复制一份作为新订阅，筛选、分组、规则和推送目标都会带过去。
- **定时推送**：每个输出订阅可按间隔推送到服务器本地文件、HTTP 地址，或阿里云 OSS / S3 兼容对象存储。
- **定时测速**：按间隔自动重测全部节点的 TCP 入口延迟，并发与超时都可调，也可以一键全测。
- **任务中心**：集中查看延迟测速、站点检测、CN 检测、订阅刷新和推送的进度与下次执行时间，运行中的任务可以取消。
- **登录认证**：面板页面和 `/api` 需要登录；账号通过 `SUBFLUX_USERNAME` / `SUBFLUX_PASSWORD` 配置，订阅链接 `/sub/<token>` 仍用令牌认证。
- **敏感数据加密**：db.json 里的订阅令牌、节点凭据、OSS AccessKey、探针 Token 等字段用 AES-256-GCM 加密，密钥在 `data/.secret-key`（0600）。
- **日志保留**：应用日志按天写入 `data/logs/`，只保留最近 24 小时；容器日志由 compose 限制为 10MB × 1。
- **刷新周期**：订阅源刷新间隔不设七天上限，可以按需设到任意长；快捷按钮提供 7 / 14 / 30 天。
- **订阅源导出 / 导入**：把全部订阅源导出成 JSON，换机器时导入即可；合并导入会跳过重复链接，不影响现有订阅源。

## 分流规则

默认顺序：

1. 私网 / 回环 / `.local` / `.lan` 直连
2. 自定义规则（全局 + 单订阅）
3. OpenAI / Claude / Gemini / Grok / YouTube 走「🚀 节点选择」
4. 可选广告拦截
5. 内置 159 条国内常见域名显式直连
6. `.cn` + `GEOSITE,cn` + `GEOIP,CN` 兜底
7. `MATCH` 走手动选择

国内域名清单在 `overseas-server/lib/cn-direct.js`。自定义规则使用可视化编辑器，不需要手写语法；也可在单订阅中追加，优先级高于默认规则。

## 清理说明

- 生成的 Clash 配置不使用 YAML 锚点，兼容性更好。
- Sing-box 使用远程 `geosite-cn` / `geoip-cn` rule-set，首次启动需联网下载。
- `Mihomo` 使用 GPL-3.0，许可证见 `overseas-server/bin/MIHOMO_LICENSE`。

## 许可

本项目代码以 MIT 许可发布。`overseas-server/bin/` 下的 Mihomo 二进制不属于本仓库，遵循其自身的 GPL-3.0 许可。
