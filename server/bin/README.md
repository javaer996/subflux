# Mihomo 站点检测引擎

`bin/mihomo` 是运行时下载的二进制，不纳入 Git 仓库（约 55MB，且区分架构）。
站点检测、自动站点检测把节点真实访问网站，以及国内探针的「CN 实际」代理检测都需要它。

## 下载

从 [MetaCubeX/mihomo Releases](https://github.com/MetaCubeX/mihomo/releases) 下载对应架构：

- Linux amd64：`mihomo-linux-amd64-compatible-v1.19.33.gz`
- Linux arm64：`mihomo-linux-arm64-v1.19.33.gz`

```bash
gunzip -c mihomo-linux-*-v1.19.33.gz > bin/mihomo
chmod +x bin/mihomo
```

也可以把二进制放到任意位置，启动时设置 `MIHOMO_BIN=/path/to/mihomo`。

## 许可

Mihomo 使用 GPL-3.0，许可证见 `MIHOMO_LICENSE`。主项目不包含该二进制。
