#!/bin/bash

# =================================================================
# web-cn ECS 一键部署脚本 (精简安全版)
# =================================================================

# 配置信息
CONTAINER_NAME="web-cn"
IMAGE_URL="crpi-2gk4b5rysu1wr37v.cn-beijing.personal.cr.aliyuncs.com/tewan/web-cn:latest"

# 默认环境变量 (请在服务器本地修改或通过命令行传入)
DATABASE_URL=${DATABASE_URL:-"postgresql://tewan:YOUR_PASSWORD@pgm-2zeum4kehtj5049x.pg.rds.aliyuncs.com:5432/tewan_web_cn"}
NEXT_PUBLIC_CDN_URL="https://cdn.tewan.club"
OSS_REGION="oss-cn-beijing"
OSS_BUCKET="lock-sounds"
OSS_ACCESS_KEY_ID="LTAI***"
OSS_ACCESS_KEY_SECRET="GNAL***"

# 邮件服务配置
DM_SMTP_HOST="smtpdm.aliyun.com"
DM_SMTP_PORT="465"
DM_SMTP_USER="no-reply@tewan.club"
DM_SMTP_PASS="YOUR_SMTP_PASSWORD"
DM_FROM_ALIAS="Tewan Club"
NEXT_PUBLIC_APP_URL="https://tewan.club"

echo "🚀 开始部署 ${CONTAINER_NAME}..."

# 1. 停止并删除旧容器
if [ "$(docker ps -aq -f name=${CONTAINER_NAME})" ]; then
    echo "🛑 停止并删除旧容器..."
    docker stop ${CONTAINER_NAME}
    docker rm ${CONTAINER_NAME}
fi

# 2. 拉取最新镜像
echo "📥 拉取最新镜像: ${IMAGE_URL}"
docker pull ${IMAGE_URL}

# 3. 运行新容器
# 注意：敏感 AK/SK 建议通过 ECS 环境变量或本地 .env 文件管理
echo "🏗️ 启动新容器..."
docker run -d \
  --name ${CONTAINER_NAME} \
  --restart always \
  -p 3000:3000 \
  -e DATABASE_URL="${DATABASE_URL}" \
  -e NEXT_PUBLIC_CDN_URL="${NEXT_PUBLIC_CDN_URL}" \
  -e OSS_REGION="${OSS_REGION}" \
  -e OSS_BUCKET="${OSS_BUCKET}" \
  -e OSS_ACCESS_KEY_ID="${OSS_ACCESS_KEY_ID}" \
  -e OSS_ACCESS_KEY_SECRET="${OSS_ACCESS_KEY_SECRET}" \
  -e DM_SMTP_HOST="${DM_SMTP_HOST}" \
  -e DM_SMTP_PORT="${DM_SMTP_PORT}" \
  -e DM_SMTP_USER="${DM_SMTP_USER}" \
  -e DM_SMTP_PASS="${DM_SMTP_PASS}" \
  -e DM_FROM_ALIAS="${DM_FROM_ALIAS}" \
  -e NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL}" \
  ${IMAGE_URL}

echo "✅ 部署完成！"
echo "🔍 使用 'docker logs -f ${CONTAINER_NAME}' 查看运行日志。"
