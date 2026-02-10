# VPS 代理服务器优化指南

## 🎯 目标
优化部署在 Oracle 日本 VPS 上的 Gemini API 代理服务器 (api.aievgo.com)，提升响应速度和稳定性。

## 📋 诊断步骤

### 1. 运行诊断脚本

在您的 Oracle 日本 VPS 上运行：

```bash
# 下载脚本（或从代码库拉取）
wget https://raw.githubusercontent.com/lin2yue/myteslab/pre/apps/web-cn/scripts/diagnose-proxy-vps.sh

# 添加执行权限
chmod +x diagnose-proxy-vps.sh

# 运行诊断
bash diagnose-proxy-vps.sh
```

### 2. 关键指标检查

重点关注以下指标：

#### 🌐 网络性能
- **到 Google API 的延迟**: 应该 < 100ms (日本到 Google 亚太节点)
- **DNS 解析时间**: 应该 < 50ms
- **TLS 握手时间**: 应该 < 100ms

#### 💾 系统资源
- **CPU 使用率**: 应该 < 70%
- **内存使用率**: 应该 < 80%
- **磁盘 I/O**: 不应该成为瓶颈

#### 🔗 网络连接
- **TIME_WAIT 连接数**: 不应该过多 (< 1000)
- **ESTABLISHED 连接数**: 合理范围内

## 🔧 优化建议

### 1. 系统级 TCP 优化

创建或编辑 `/etc/sysctl.conf`，添加以下配置：

```bash
# TCP Fast Open (加速连接建立)
net.ipv4.tcp_fastopen = 3

# TIME_WAIT 重用 (减少连接等待时间)
net.ipv4.tcp_tw_reuse = 1

# 增加 socket 监听队列
net.core.somaxconn = 4096
net.core.netdev_max_backlog = 4096

# TCP 缓冲区优化
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216

# 启用 TCP BBR 拥塞控制 (需要内核 4.9+)
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr

# 连接跟踪优化
net.netfilter.nf_conntrack_max = 262144
net.netfilter.nf_conntrack_tcp_timeout_established = 1200
```

应用配置：
```bash
sudo sysctl -p
```

### 2. DNS 优化

编辑 `/etc/resolv.conf`，使用快速 DNS：

```bash
nameserver 8.8.8.8
nameserver 8.8.4.4
nameserver 1.1.1.1
```

### 3. 代理服务器配置优化

#### 如果使用 Nginx

编辑 Nginx 配置文件（通常在 `/etc/nginx/nginx.conf` 或 `/etc/nginx/sites-available/default`）:

```nginx
# HTTP 配置块
http {
    # 启用 HTTP/2
    # (在 server 块的 listen 指令中添加 http2)
    
    # 连接优化
    keepalive_timeout 65;
    keepalive_requests 100;
    
    # 代理优化
    proxy_connect_timeout 90s;
    proxy_send_timeout 90s;
    proxy_read_timeout 90s;
    
    # 缓冲区优化
    proxy_buffer_size 16k;
    proxy_buffers 8 16k;
    proxy_busy_buffers_size 32k;
    
    # 启用 Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    # 上游服务器配置
    upstream gemini_api {
        server generativelanguage.googleapis.com:443;
        keepalive 32;  # 保持连接池
    }
}

# Server 配置块
server {
    listen 443 ssl http2;  # 启用 HTTP/2
    server_name api.aievgo.com;
    
    # SSL 配置
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # 代理配置
    location / {
        proxy_pass https://gemini_api;
        proxy_ssl_server_name on;
        proxy_ssl_protocols TLSv1.2 TLSv1.3;
        
        # 保持连接
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        
        # 转发头部
        proxy_set_header Host generativelanguage.googleapis.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

重启 Nginx:
```bash
sudo nginx -t  # 测试配置
sudo systemctl restart nginx
```

#### 如果使用 Caddy

编辑 `Caddyfile`:

```caddy
api.aievgo.com {
    # 自动 HTTPS
    
    # 反向代理配置
    reverse_proxy https://generativelanguage.googleapis.com {
        # 保持连接
        transport http {
            keepalive 30s
            keepalive_idle_conns 10
            
            # TLS 配置
            tls_server_name generativelanguage.googleapis.com
        }
        
        # 超时配置
        timeout {
            read 90s
            write 90s
            dial 10s
        }
        
        # 头部转发
        header_up Host generativelanguage.googleapis.com
    }
    
    # 启用压缩
    encode gzip
    
    # 日志
    log {
        output file /var/log/caddy/api.log
        format json
    }
}
```

重启 Caddy:
```bash
sudo systemctl restart caddy
```

### 4. 防火墙优化

确保必要的端口开放：

```bash
# 如果使用 ufw
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH

# 如果使用 iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
```

### 5. 监控和日志

#### 启用访问日志分析

```bash
# 分析 Nginx 访问日志
tail -f /var/log/nginx/access.log

# 查看慢请求
awk '$NF > 5 {print $0}' /var/log/nginx/access.log
```

#### 设置性能监控

安装 `htop` 或 `glances` 监控系统资源：

```bash
sudo apt install htop glances -y
htop
```

## 🎯 预期效果

优化后，您应该看到：

1. **TTFB 降低**: 从 1400ms 降低到 800-1000ms
2. **连接建立更快**: TCP Fast Open 可节省 1 RTT
3. **更稳定**: 连接池减少重复握手
4. **更高并发**: 优化的队列和缓冲区

## 📊 验证优化效果

优化后，再次运行性能测试：

```bash
# 在 ECS 服务器上
docker exec web-cn-pre node apps/web-cn/scripts/benchmark-proxy.js
```

对比优化前后的数据。

## ⚠️ 注意事项

1. **备份配置**: 修改前备份原始配置文件
2. **逐步优化**: 一次改一项，观察效果
3. **监控资源**: 确保优化不会导致资源耗尽
4. **Oracle 限制**: 注意 Oracle 免费套餐的带宽限制
