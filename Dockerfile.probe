FROM node:20-alpine

# Mihomo is required for the "CN 实际" proxy test (including HY2/TUIC UDP).
# You can override the version or supply a direct .gz URL if GitHub is blocked.
ARG TARGETARCH
ARG MIHOMO_VERSION=1.19.33
ARG MIHOMO_URL=

RUN apk add --no-cache ca-certificates curl \
 && case "${TARGETARCH:-$(uname -m)}" in \
      amd64|x86_64) MIHOMO_ARCH=amd64-compatible ;; \
      arm64|aarch64) MIHOMO_ARCH=arm64 ;; \
      *) MIHOMO_ARCH=amd64-compatible ;; \
    esac \
 && URL="${MIHOMO_URL:-https://github.com/MetaCubeX/mihomo/releases/download/v${MIHOMO_VERSION}/mihomo-linux-${MIHOMO_ARCH}-v${MIHOMO_VERSION}.gz}" \
 && curl -fsSL "$URL" -o /tmp/mihomo.gz \
 && gunzip -c /tmp/mihomo.gz > /usr/local/bin/mihomo \
 && chmod +x /usr/local/bin/mihomo \
 && rm -f /tmp/mihomo.gz

WORKDIR /app
COPY probe.js ./
ENV PROBE_HOST=0.0.0.0
ENV PROBE_PORT=8899
EXPOSE 8899
CMD ["node", "probe.js"]
