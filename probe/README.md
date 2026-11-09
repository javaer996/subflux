# SubFlux 国内探针

在中国大陆的机器上运行，用于判断节点在国内是否可达。探针**不拉订阅、不保存节点库**，只接收主服务通过内网 / Tailscale 发来的测试请求。

支持两种模式：

- **CN 实际**（推荐）：主服务把 Clash 代理配置发给探针，探针启动 Mihomo 真实代理访问测试地址。支持 HY2 / TUIC / WireGuard 等 UDP 协议。
- **CN TCP**：只对 `host:port` 发起 TCP 连接，适合快速诊断 TCP 类节点；UDP 节点会被跳过。

## 运行

需要 Node.js 20+ 和 Mihomo。直接运行：

```bash
PROBE_TOKEN='至少16位随机字符串' \
PROBE_HOST='100.x.y.z' \
MIHOMO_BIN=/path/to/mihomo \
node probe.js
```

默认监听 `0.0.0.0:8899`。`PROBE_HOST` 建议直接绑定 Tailscale IP，避免暴露到公网。

环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PROBE_TOKEN` | — | 必填，至少 16 位，主服务使用同一值 |
| `PROBE_HOST` | `0.0.0.0` | 监听地址，建议填 Tailscale IP |
| `PROBE_PORT` | `8899` | 监听端口 |
| `MIHOMO_BIN` | `mihomo` | Mihomo 可执行文件路径 |
| `PROBE_DATA_DIR` | 系统临时目录 | Mihomo 临时配置目录 |

## 容器运行

`Dockerfile` 会自动下载对应架构的 Mihomo：

```bash
docker build -t subflux-probe .
docker run -d --name subflux-probe --restart unless-stopped \
  --network host \
  -e PROBE_TOKEN='至少16位随机字符串' \
  -e PROBE_HOST='100.x.y.z' \
  subflux-probe
```

GitHub 下载慢时可以用 `--build-arg MIHOMO_URL='https://你的地址/mihomo.gz'`，或把已有的 mihomo 挂载进容器并设置 `MIHOMO_BIN`。

桥接网络：

```bash
docker run -d --name subflux-probe --restart unless-stopped \
  -p 100.x.y.z:8899:8899 \
  -e PROBE_TOKEN='至少16位随机字符串' \
  subflux-probe
```

## 在主服务中配置

在「设置 → 中国连通检测」填写：

- 探针地址：`http://100.x.y.z:8899/api/probe/tcp`
- Token：与 `PROBE_TOKEN` 相同
- 反向测试地址：`http://100.y.y.y:8888/api/health`（主服务的 Tailscale 地址）
- CN 实际检测地址：默认 `https://www.qq.com/`

点「双向连通测试」会验证：

1. 国外主服务 → 国内探针（`/health`）
2. 国内探针 → 国外主服务（反向请求）

如果主服务在容器内，先确认能访问 Tailscale 地址：

```bash
curl http://100.x.y.z:8899/health
# 失败时给主服务容器加 --network host，或配置 Tailscale sidecar / 路由
```

## 安全

- 探针只应监听 Tailscale 内网，不要暴露公网 `8899`。
- 实际代理模式会把节点配置（含密码 / 密钥）发送到探针，务必保护好 `PROBE_TOKEN`。
- Tailscale ACL / 防火墙只允许主服务访问探针端口。
- 探针需要能出站访问被测节点。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 健康检查，不需要 Token |
| `POST` | `/api/probe/tcp` | `{ nodes: [{ id, host, port }], timeoutMs }` |
| `POST` | `/api/probe/proxy` | `{ nodes: [{ id, proxy }], testUrl, timeoutMs }` |
| `POST` | `/api/probe/http` | `{ url }`，用于反向连通测试 |

所有 `POST` 需要 `Authorization: Bearer <PROBE_TOKEN>`。
