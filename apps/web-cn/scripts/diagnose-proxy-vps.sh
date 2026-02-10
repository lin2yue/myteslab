#!/bin/bash
# VPS 代理服务器性能诊断脚本
# 用于检查 Oracle 日本 VPS 上的 Gemini API 代理配置是否最优
# 
# Usage: bash diagnose-proxy-vps.sh

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 VPS 代理服务器性能诊断"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 系统基本信息
echo "📊 1. 系统基本信息"
echo "────────────────────────────────────────────────────"
echo "操作系统: $(uname -s) $(uname -r)"
echo "架构: $(uname -m)"
echo "主机名: $(hostname)"
echo ""

# 2. CPU 信息
echo "🖥️  2. CPU 信息"
echo "────────────────────────────────────────────────────"
if [ -f /proc/cpuinfo ]; then
    CPU_MODEL=$(grep "model name" /proc/cpuinfo | head -1 | cut -d: -f2 | xargs)
    CPU_CORES=$(grep -c "^processor" /proc/cpuinfo)
    echo "CPU 型号: $CPU_MODEL"
    echo "CPU 核心数: $CPU_CORES"
else
    echo "无法读取 CPU 信息"
fi
echo ""

# 3. 内存信息
echo "💾 3. 内存信息"
echo "────────────────────────────────────────────────────"
if [ -f /proc/meminfo ]; then
    TOTAL_MEM=$(grep "MemTotal" /proc/meminfo | awk '{printf "%.2f GB", $2/1024/1024}')
    FREE_MEM=$(grep "MemAvailable" /proc/meminfo | awk '{printf "%.2f GB", $2/1024/1024}')
    echo "总内存: $TOTAL_MEM"
    echo "可用内存: $FREE_MEM"
else
    echo "无法读取内存信息"
fi
echo ""

# 4. 磁盘信息
echo "💿 4. 磁盘信息"
echo "────────────────────────────────────────────────────"
df -h / | tail -1 | awk '{print "根分区大小: "$2"\n已使用: "$3" ("$5")\n可用空间: "$4}'
echo ""

# 5. 网络配置
echo "🌐 5. 网络配置"
echo "────────────────────────────────────────────────────"
echo "公网 IP:"
curl -s ifconfig.me || echo "无法获取公网 IP"
echo ""
echo ""
echo "网络接口:"
ip addr show | grep -E "^[0-9]+:|inet " | head -10
echo ""

# 6. DNS 配置
echo "🔍 6. DNS 配置"
echo "────────────────────────────────────────────────────"
if [ -f /etc/resolv.conf ]; then
    echo "DNS 服务器:"
    grep "^nameserver" /etc/resolv.conf
else
    echo "无法读取 DNS 配置"
fi
echo ""

# 7. 到 Google API 的网络测试
echo "🚀 7. 到 Google API 的网络测试"
echo "────────────────────────────────────────────────────"
GOOGLE_API="generativelanguage.googleapis.com"
echo "测试目标: $GOOGLE_API"
echo ""

# DNS 解析测试
echo "DNS 解析:"
if command -v dig &> /dev/null; then
    dig +short $GOOGLE_API | head -3
    echo ""
    echo "DNS 解析时间:"
    dig $GOOGLE_API | grep "Query time"
elif command -v nslookup &> /dev/null; then
    nslookup $GOOGLE_API | grep -A 2 "Name:"
else
    echo "未安装 dig 或 nslookup"
fi
echo ""

# Ping 测试
echo "Ping 测试 (5次):"
if command -v ping &> /dev/null; then
    ping -c 5 $GOOGLE_API 2>/dev/null | tail -2 || echo "Ping 失败（可能被防火墙阻止）"
else
    echo "未安装 ping"
fi
echo ""

# TCP 连接测试
echo "TCP 连接测试 (443端口):"
if command -v nc &> /dev/null; then
    timeout 5 nc -zv $GOOGLE_API 443 2>&1 || echo "连接失败"
elif command -v telnet &> /dev/null; then
    timeout 5 telnet $GOOGLE_API 443 2>&1 | head -3 || echo "连接失败"
else
    echo "未安装 nc 或 telnet"
fi
echo ""

# 8. HTTP/HTTPS 性能测试
echo "⚡ 8. HTTP/HTTPS 性能测试"
echo "────────────────────────────────────────────────────"
if command -v curl &> /dev/null; then
    echo "测试 HTTPS 连接到 Google API:"
    curl -w "\nDNS 解析: %{time_namelookup}s\nTCP 连接: %{time_connect}s\nTLS 握手: %{time_appconnect}s\n首字节时间: %{time_starttransfer}s\n总时间: %{time_total}s\n" \
         -o /dev/null -s "https://$GOOGLE_API" 2>&1 || echo "HTTPS 测试失败"
else
    echo "未安装 curl"
fi
echo ""

# 9. 系统负载
echo "📈 9. 系统负载"
echo "────────────────────────────────────────────────────"
if command -v uptime &> /dev/null; then
    uptime
else
    echo "无法获取系统负载"
fi
echo ""

# 10. 活动连接数
echo "🔗 10. 活动网络连接"
echo "────────────────────────────────────────────────────"
if command -v netstat &> /dev/null; then
    ESTABLISHED=$(netstat -an | grep ESTABLISHED | wc -l)
    TIME_WAIT=$(netstat -an | grep TIME_WAIT | wc -l)
    echo "ESTABLISHED 连接数: $ESTABLISHED"
    echo "TIME_WAIT 连接数: $TIME_WAIT"
elif command -v ss &> /dev/null; then
    ESTABLISHED=$(ss -tan | grep ESTAB | wc -l)
    TIME_WAIT=$(ss -tan | grep TIME-WAIT | wc -l)
    echo "ESTABLISHED 连接数: $ESTABLISHED"
    echo "TIME_WAIT 连接数: $TIME_WAIT"
else
    echo "未安装 netstat 或 ss"
fi
echo ""

# 11. 防火墙状态
echo "🛡️  11. 防火墙状态"
echo "────────────────────────────────────────────────────"
if command -v ufw &> /dev/null; then
    sudo ufw status 2>/dev/null || echo "需要 sudo 权限查看 ufw 状态"
elif command -v iptables &> /dev/null; then
    echo "iptables 规则数:"
    sudo iptables -L -n 2>/dev/null | grep -c "^Chain" || echo "需要 sudo 权限查看 iptables"
else
    echo "未检测到防火墙工具"
fi
echo ""

# 12. 代理服务进程检查
echo "🔄 12. 代理服务进程检查"
echo "────────────────────────────────────────────────────"
echo "检查常见代理服务:"
for service in nginx caddy traefik apache2 httpd; do
    if command -v $service &> /dev/null || systemctl is-active --quiet $service 2>/dev/null; then
        echo "✅ 检测到 $service"
        if command -v systemctl &> /dev/null; then
            systemctl status $service --no-pager -l 2>/dev/null | head -5
        fi
    fi
done
echo ""

# 13. 端口监听状态
echo "👂 13. 端口监听状态"
echo "────────────────────────────────────────────────────"
if command -v netstat &> /dev/null; then
    echo "监听中的端口:"
    netstat -tuln | grep LISTEN | head -10
elif command -v ss &> /dev/null; then
    echo "监听中的端口:"
    ss -tuln | grep LISTEN | head -10
else
    echo "未安装 netstat 或 ss"
fi
echo ""

# 14. 系统优化建议
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 优化建议"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查 TCP 优化
echo "🔧 TCP 优化检查:"
if [ -f /proc/sys/net/ipv4/tcp_fastopen ]; then
    TCP_FASTOPEN=$(cat /proc/sys/net/ipv4/tcp_fastopen)
    if [ "$TCP_FASTOPEN" -eq 3 ]; then
        echo "✅ TCP Fast Open 已启用"
    else
        echo "⚠️  TCP Fast Open 未完全启用 (当前值: $TCP_FASTOPEN)"
        echo "   建议: echo 3 > /proc/sys/net/ipv4/tcp_fastopen"
    fi
fi

if [ -f /proc/sys/net/ipv4/tcp_tw_reuse ]; then
    TCP_TW_REUSE=$(cat /proc/sys/net/ipv4/tcp_tw_reuse)
    if [ "$TCP_TW_REUSE" -eq 1 ]; then
        echo "✅ TCP TIME_WAIT 重用已启用"
    else
        echo "⚠️  TCP TIME_WAIT 重用未启用"
        echo "   建议: echo 1 > /proc/sys/net/ipv4/tcp_tw_reuse"
    fi
fi

if [ -f /proc/sys/net/core/somaxconn ]; then
    SOMAXCONN=$(cat /proc/sys/net/core/somaxconn)
    if [ "$SOMAXCONN" -ge 1024 ]; then
        echo "✅ socket 监听队列大小合适 ($SOMAXCONN)"
    else
        echo "⚠️  socket 监听队列较小 ($SOMAXCONN)"
        echo "   建议: echo 4096 > /proc/sys/net/core/somaxconn"
    fi
fi
echo ""

echo "🌐 DNS 优化建议:"
echo "   - 使用快速 DNS: 8.8.8.8 (Google) 或 1.1.1.1 (Cloudflare)"
echo "   - 日本地区建议: 8.8.8.8, 8.8.4.4"
echo ""

echo "⚡ 代理服务优化建议:"
echo "   - 启用 HTTP/2 和 HTTP/3 (QUIC)"
echo "   - 启用 Gzip/Brotli 压缩"
echo "   - 配置合理的超时时间 (建议 90s 用于 AI 请求)"
echo "   - 启用连接池和 Keep-Alive"
echo "   - 考虑使用 CDN 或边缘节点"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 诊断完成"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
