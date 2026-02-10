# Tesla Studio - Web Application

这是基于 Next.js 16 (App Router) 构建的特斯拉车身改色预览平台。

## 🎯 核心功能
- **3D 实时预览**：基于 `<model-viewer>` 实现 GLB 模型的高保真渲染。
- **AI 生图 (Gemini Integrated)**：通过 Gemini Pro Vision 实现个性化贴图生成。
- **DIY 系统**：支持用户上传图片并在浏览器中完成 3D 贴合。
- **全自动下载**：导出 1:1 物理像素对齐的官方规格贴图。

## 📐 核心技术实践

### 1. 云端图像处理 (OSS IMG)
为了减轻服务端 CPU 压力，本应用深度集成了阿里云 OSS 的 IMG 处理能力。
- **动态校正**：AI 生成的“车头向下”贴图，在读取时由 OSS 实时旋转 90°/180° 为“官方标准”。
- **响应式加载**：通过自定义 `aliyunLoader` 自动适配 device rendering 比例，分发 WebP 格式提升 LCP 面板评分。

### 2. 多语言支持 (i18n)
使用 `next-intl` 实现 URL 路由级的国际化支持（`/zh`, `/en`）。

## 🛠️ 开发指南

### 环境变量
请确保 `.env.local` 包含以下关键配置：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`
- `GEMINI_API_BASE_URL`（使用代理时）
- `GEMINI_IMAGE_MODEL`（例如：`gemini-2.5-flash-image`）
- `GEMINI_TEXT_MODEL`（例如：`gemini-2.5-flash`）
- `GEMINI_IMAGE_TIMEOUT_MS`（可选，默认 60000）
- `GEMINI_IMAGE_RETRIES`（可选，默认 2）
- `GEMINI_TEXT_TIMEOUT_MS`（可选，默认 60000）
- `GEMINI_TEXT_RETRIES`（可选，默认 1）
- `GEMINI_RETRY_BASE_MS`（可选，默认 800）
- `GEMINI_RETRY_MAX_MS`（可选，默认 5000）
- `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`

### 本地运行
```bash
npm install
npm run dev
```

## 📚 说明文档
- [AI 背景与架构逻辑 (CONTEXT)](../../docs/CONTEXT.md)
- [贴图旋转标准指南](../../docs/guides/development_principles.md#4-贴图旋转与方向标准-texture-orientation-standards)
- [数据库 Schema](../../database/schema.sql)
