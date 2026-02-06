#!/bin/bash

echo "🔍 检查 Gemini API 配置和连接状态"
echo "=========================================="
echo ""

# 1. 检查容器是否运行
echo "1️⃣ 检查容器状态:"
docker ps | grep web-cn

echo ""
echo "2️⃣ 检查环境变量:"
docker exec web-cn env | grep -i "gemini\|proxy" | sort

echo ""
echo "3️⃣ 测试 Gemini API 连接:"
docker exec web-cn curl -I https://gemini.aievgo.com/v1beta/models 2>&1 | head -20

echo ""
echo "4️⃣ 查看最近的错误日志:"
docker logs web-cn --tail 100 | grep -i "gemini\|fetch\|error" | tail -30

echo ""
echo "5️⃣ 检查容器内网络连接:"
docker exec web-cn ping -c 3 gemini.aievgo.com 2>&1 || echo "Ping 失败,可能是容器内网络问题"

echo ""
echo "=========================================="
echo "✅ 诊断完成"
