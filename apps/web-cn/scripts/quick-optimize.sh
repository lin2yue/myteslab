#!/bin/bash
# 快速优化脚本 - 基于现有 Nginx 配置
# 只优化系统级参数，不修改 Nginx 配置文件
#
# Usage: sudo bash quick-optimize.sh

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚡ 快速优化 - 系统级 TCP 参数"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查权限
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用 sudo 运行此脚本"
    exit 1
fi

echo "📊 当前配置:"
echo "   TCP Fast Open: $(cat /proc/sys/net/ipv4/tcp_fastopen)"
echo "   TCP TW Reuse: $(cat /proc/sys/net/ipv4/tcp_tw_reuse)"
echo "   Worker Connections: $(grep worker_connections /etc/nginx/nginx.conf | awk '{print $2}' | tr -d ';')"
echo ""

read -p "是否继续优化? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "❌ 已取消"
    exit 0
fi

echo ""
echo "🔧 步骤 1/3: 应用 TCP 优化"
echo "────────────────────────────────────────────────────"

# 立即生效
sysctl -w net.ipv4.tcp_fastopen=3
sysctl -w net.ipv4.tcp_tw_reuse=1
sysctl -w net.core.default_qdisc=fq
sysctl -w net.ipv4.tcp_congestion_control=bbr

echo "✅ TCP 优化已应用（临时生效）"
echo ""

echo "🔧 步骤 2/3: 写入永久配置"
echo "────────────────────────────────────────────────────"

# 备份
cp /etc/sysctl.conf /etc/sysctl.conf.backup.$(date +%Y%m%d_%H%M%S)

# 追加配置
cat >> /etc/sysctl.conf << 'EOF'

# Gemini API 代理优化 (添加于 $(date))
net.ipv4.tcp_fastopen = 3
net.ipv4.tcp_tw_reuse = 1
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.core.somaxconn = 4096
net.core.netdev_max_backlog = 4096
EOF

echo "✅ 永久配置已写入 /etc/sysctl.conf"
echo ""

echo "🔧 步骤 3/3: 优化 Nginx worker_connections"
echo "────────────────────────────────────────────────────"

# 备份 nginx.conf
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)

# 更新 worker_connections
sed -i 's/worker_connections 768;/worker_connections 4096;/' /etc/nginx/nginx.conf

# 启用 Gzip 优化
sed -i 's/# gzip_vary on;/gzip_vary on;/' /etc/nginx/nginx.conf
sed -i 's/# gzip_proxied any;/gzip_proxied any;/' /etc/nginx/nginx.conf
sed -i 's/# gzip_comp_level 6;/gzip_comp_level 6;/' /etc/nginx/nginx.conf

# 测试并重启
if nginx -t; then
    systemctl restart nginx
    echo "✅ Nginx 已重启"
else
    echo "❌ Nginx 配置测试失败"
    # 恢复备份
    cp /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S) /etc/nginx/nginx.conf
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 优化完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 优化后配置:"
echo "   TCP Fast Open: $(cat /proc/sys/net/ipv4/tcp_fastopen)"
echo "   TCP TW Reuse: $(cat /proc/sys/net/ipv4/tcp_tw_reuse)"
echo "   TCP Congestion: $(cat /proc/sys/net/ipv4/tcp_congestion_control)"
echo "   Worker Connections: $(grep worker_connections /etc/nginx/nginx.conf | awk '{print $2}' | tr -d ';')"
echo ""
echo "🧪 验证优化效果:"
echo "   在 ECS 服务器上运行性能测试:"
echo "   docker exec web-cn-pre node apps/web-cn/scripts/benchmark-proxy.js"
echo ""
echo "📝 备份文件位置:"
echo "   /etc/sysctl.conf.backup.*"
echo "   /etc/nginx/nginx.conf.backup.*"
echo ""
