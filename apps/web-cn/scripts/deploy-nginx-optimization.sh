#!/bin/bash
# 一键优化脚本 - Oracle VPS Nginx 代理服务器
# 用于快速部署和优化 api.aievgo.com 的 Nginx 配置
#
# Usage: sudo bash deploy-nginx-optimization.sh

set -e  # 遇到错误立即退出

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Oracle VPS Nginx 代理服务器一键优化"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用 sudo 运行此脚本"
    exit 1
fi

# 1. 系统级 TCP 优化
echo "📊 步骤 1/5: 应用系统级 TCP 优化"
echo "────────────────────────────────────────────────────"

# 备份原配置
cp /etc/sysctl.conf /etc/sysctl.conf.backup.$(date +%Y%m%d_%H%M%S)

# 添加优化参数
cat >> /etc/sysctl.conf << 'EOF'

# ========================================
# Gemini API 代理优化配置
# 添加时间: $(date)
# ========================================

# TCP Fast Open (加速连接建立)
net.ipv4.tcp_fastopen = 3

# TIME_WAIT 重用 (减少连接等待时间)
net.ipv4.tcp_tw_reuse = 1

# TCP BBR 拥塞控制算法 (提升吞吐量)
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr

# TCP 缓冲区优化
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216

# 增加 socket 监听队列
net.core.somaxconn = 4096
net.core.netdev_max_backlog = 4096

# 连接跟踪优化
net.netfilter.nf_conntrack_max = 262144
net.netfilter.nf_conntrack_tcp_timeout_established = 1200
EOF

# 应用配置
sysctl -p
echo "✅ TCP 优化已应用"
echo ""

# 2. DNS 优化
echo "📊 步骤 2/5: 优化 DNS 配置"
echo "────────────────────────────────────────────────────"

# 备份原 DNS 配置
cp /etc/resolv.conf /etc/resolv.conf.backup.$(date +%Y%m%d_%H%M%S)

# 配置 Google DNS
cat > /etc/resolv.conf << 'EOF'
# Google DNS (日本节点)
nameserver 8.8.8.8
nameserver 8.8.4.4
# Cloudflare DNS (备用)
nameserver 1.1.1.1
EOF

# 防止被 systemd-resolved 覆盖
chattr +i /etc/resolv.conf 2>/dev/null || echo "注意: 无法锁定 resolv.conf，可能会被覆盖"

echo "✅ DNS 配置已优化"
echo ""

# 3. Nginx 主配置优化
echo "📊 步骤 3/5: 优化 Nginx 主配置"
echo "────────────────────────────────────────────────────"

# 备份原配置
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)

# 检查并更新 nginx.conf
if ! grep -q "worker_connections 4096" /etc/nginx/nginx.conf; then
    sed -i 's/worker_connections [0-9]*;/worker_connections 4096;/' /etc/nginx/nginx.conf
fi

# 在 http 块中添加优化配置
if ! grep -q "# Gemini API Proxy Optimization" /etc/nginx/nginx.conf; then
    sed -i '/http {/a \
    # Gemini API Proxy Optimization\
    keepalive_timeout 65;\
    keepalive_requests 100;\
    \
    # Gzip 压缩\
    gzip on;\
    gzip_vary on;\
    gzip_proxied any;\
    gzip_comp_level 6;\
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;\
    \
    # 客户端缓冲区\
    client_body_buffer_size 128k;\
    client_max_body_size 20m;\
    \
    # 代理缓冲区\
    proxy_buffering on;\
    proxy_buffer_size 16k;\
    proxy_buffers 8 16k;\
    proxy_busy_buffers_size 32k;' /etc/nginx/nginx.conf
fi

echo "✅ Nginx 主配置已优化"
echo ""

# 4. 部署站点配置
echo "📊 步骤 4/5: 部署 api.aievgo.com 站点配置"
echo "────────────────────────────────────────────────────"

# 提示用户输入 SSL 证书路径
read -p "请输入 SSL 证书路径 (默认: /etc/letsencrypt/live/api.aievgo.com/fullchain.pem): " SSL_CERT
SSL_CERT=${SSL_CERT:-/etc/letsencrypt/live/api.aievgo.com/fullchain.pem}

read -p "请输入 SSL 私钥路径 (默认: /etc/letsencrypt/live/api.aievgo.com/privkey.pem): " SSL_KEY
SSL_KEY=${SSL_KEY:-/etc/letsencrypt/live/api.aievgo.com/privkey.pem}

# 检查证书是否存在
if [ ! -f "$SSL_CERT" ] || [ ! -f "$SSL_KEY" ]; then
    echo "⚠️  警告: SSL 证书文件不存在"
    echo "   如果您还没有 SSL 证书，请先运行: certbot --nginx -d api.aievgo.com"
    read -p "是否继续部署配置? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        echo "❌ 部署已取消"
        exit 1
    fi
fi

# 创建站点配置文件
cat > /etc/nginx/sites-available/api.aievgo.com << EOF
# Nginx 配置文件 - Gemini API 反向代理
# 自动生成时间: $(date)

upstream gemini_api {
    server generativelanguage.googleapis.com:443;
    keepalive 32;
    keepalive_timeout 60s;
    keepalive_requests 100;
}

server {
    listen 80;
    listen [::]:80;
    server_name api.aievgo.com;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.aievgo.com;
    
    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    access_log /var/log/nginx/api.aievgo.com.access.log combined;
    error_log /var/log/nginx/api.aievgo.com.error.log warn;
    
    client_max_body_size 20M;
    
    location / {
        proxy_pass https://gemini_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_ssl_server_name on;
        proxy_ssl_protocols TLSv1.2 TLSv1.3;
        proxy_ssl_name generativelanguage.googleapis.com;
        proxy_set_header Host generativelanguage.googleapis.com;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 10s;
        proxy_send_timeout 90s;
        proxy_read_timeout 90s;
        proxy_cache off;
    }
    
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/api.aievgo.com /etc/nginx/sites-enabled/api.aievgo.com

echo "✅ 站点配置已部署"
echo ""

# 5. 测试并重启 Nginx
echo "📊 步骤 5/5: 测试并重启 Nginx"
echo "────────────────────────────────────────────────────"

# 测试配置
if nginx -t; then
    echo "✅ Nginx 配置测试通过"
    systemctl restart nginx
    echo "✅ Nginx 已重启"
else
    echo "❌ Nginx 配置测试失败，请检查配置"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 优化完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 已应用的优化:"
echo "   ✅ TCP Fast Open"
echo "   ✅ TCP BBR 拥塞控制"
echo "   ✅ TIME_WAIT 重用"
echo "   ✅ Google DNS"
echo "   ✅ HTTP/2"
echo "   ✅ 连接池 (32 个保持连接)"
echo "   ✅ Gzip 压缩"
echo ""
echo "🧪 验证优化效果:"
echo "   curl -I https://api.aievgo.com/health"
echo ""
echo "📈 性能测试:"
echo "   在 ECS 服务器上运行:"
echo "   docker exec web-cn-pre node apps/web-cn/scripts/benchmark-proxy.js"
echo ""
EOF

chmod +x /Users/linpengfei/work/tesla-studio-monorepo/apps/web-cn/scripts/deploy-nginx-optimization.sh
