# 环境变量配置说明

## 上传3D模型需要的环境变量

请在项目根目录创建 `.env.local` 文件,并填入以下内容:

```env
# Supabase配置
SUPABASE_URL=https://eysiovvlutxhgnnydedr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# 阿里云OSS配置
OSS_REGION=oss-cn-beijing
OSS_BUCKET=lock-sounds
OSS_ACCESS_KEY_ID=your_access_key_id_here
OSS_ACCESS_KEY_SECRET=your_access_key_secret_here

# CDN域名
CDN_DOMAIN=https://cdn.tewan.club
```

## 如何获取这些值

1. **SUPABASE_SERVICE_ROLE_KEY**: 
   - 登录 Supabase Dashboard
   - 进入项目设置 → API
   - 复制 "service_role" key (注意:不是anon key)

2. **OSS凭证**:
   - 登录阿里云控制台
   - 访问控制 → 用户 → AccessKey管理
   - 创建或查看AccessKey

## 配置完成后

运行上传脚本:
```bash
cd /Users/linpengfei/work/tesla-studio-monorepo/apps/miniprogram
node scripts/upload_models_from_assets.js
```
