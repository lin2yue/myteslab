# Tesla Studio Monorepo

> 特斯拉 3D 车身改色预览平台 - 国内小程序 & 海外 Web 版

## 🎯 项目概述

Tesla Studio 是一个让用户实时预览特斯拉车身改色贴图效果的平台，支持多种车型和官方设计方案。

- **Web 版** (海外)：基于 Next.js，支持中英文双语，已完成 MVP 可上线
- **小程序版** (国内)：基于 uni-app，针对微信生态优化

---

## 📁 项目结构

```
tesla-studio-monorepo/
├── apps/
│   ├── web/            # Next.js Web 应用 (MVP 已完成)
│   └── miniprogram/    # uni-app 微信小程序
├── assets/             # 共享资源
│   ├── models/         # 3D 车型模型 (.glb)
│   ├── masks/          # AI 生成所需的车身 Mask (车头已旋转校正)
│   └── catalog/        # 贴图纹理和预览图
├── dev-studio/         # 本地开发调试工具
│   └── tweak.html      # 3D 模型和贴图调试界面
└── scripts/            # 通用工具脚本
```

**注意**：`packages/` 目录已清理，两个应用当前独立开发。

---

## 📐 贴图旋转与方向标准 (Texture Standards)

**核心原则**：所有动态生成的贴图（AI 或 DIY）必须在输出端完成方向校正，3D 查看器默认信任资产方向。

| 车型 | 官方规格 | 旋转逻辑 (从 AI 构图转回) |
|------|----------|-------------------------|
| **Model 3 / Y** | 1024x1024, **车头朝上** | 顺时针旋转 **180°** |
| **Cybertruck** | 1024x768, **车头朝左** | 顺时针旋转 **90°** |

> [!CAUTION]
> **严禁**在 `ModelViewer.tsx` 或 `viewer-config.json` 中针对动态资产添加二次旋转补偿。

---

## 🔗 共享资源策略

### Supabase 数据库（共享）
- **数据库实例**：两个应用连接同一个 Supabase 项目
- **表结构**：
  - `wrap_models` - 车型信息
  - `wraps` - 贴图方案
  - `wrap_model_map` - 车型与贴图的关联
- **Schema 定义**：参见 `apps/web/database/schema.sql`
- **RLS 策略**：启用行级安全，两端共享权限逻辑

**环境变量配置**：
```bash
# apps/web/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# apps/miniprogram/.env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### CDN 资源（共享）
- **CDN 域名**：`cdn.tewan.club`
- **存储后端**：阿里云 OSS
- **资源类型**：
  - 3D 模型文件：`/models/{car-slug}/model.glb`
  - 贴图纹理：`/wraps/{wrap-slug}.png`
  - 预览图：`/previews/{wrap-slug}.webp`

**上传脚本**：
```bash
# 上传 3D 模型到 OSS
node apps/miniprogram/scripts/upload_models_from_assets.js
```

### 3D 模型资源（共享）
- **存放位置**：`assets/models/{car-slug}/`
- **包含车型**：
  - Cybertruck
  - Model 3 / Model 3 2024+
  - Model Y / Model Y 2025+
- **格式**：GLB (Binary glTF)
- **UV 通道**：支持 `uv` 和 `uv1` (用于非对称贴图)

---

## 🚀 快速开始

### 前置要求
- Node.js 18+
- pnpm 8+

### 安装依赖
```bash
pnpm install
```

### 开发命令
```bash
# Web 版开发
cd apps/web
npm run dev
# 访问 http://localhost:3000

# 小程序开发
cd apps/miniprogram
pnpm dev:mp-weixin

# 3D 调试工具
cd dev-studio
# 使用 Live Server 打开 tweak.html
```

### 构建部署
```bash
# Web 版构建
cd apps/web
npm run build
npm run start

# 小程序构建
cd apps/miniprogram
pnpm build:mp-weixin
```

---

## 🛠️ 核心技术栈

| 应用 | 框架 | UI 库 | 3D 渲染 | 数据库 |
|------|------|-------|---------|--------|
| Web | Next.js 16 | Tailwind CSS | @google/model-viewer | Supabase |
| Miniprogram | uni-app | uView UI | model-viewer (WebView) | Supabase |

---

## 📖 开发指南

### Web 版特性
- ✅ 中英文双语支持 (next-intl)
- ✅ SEO 优化 (动态 metadata)
- ✅ 3D 实时预览 (UV 映射自动切换)
- ✅ 响应式设计
- ✅ CDN 资源代理 (CORS 处理)

详见：[docs/guides/i18n_guide.md](docs/guides/i18n_guide.md) 和 [apps/web/README.md](apps/web/README.md)

### 小程序版特性
- 微信生态优化
- 本地缓存策略
- 分享功能

### 开发工具 (dev-studio)
**tweak.html** - 3D 模型调试界面
- 实时预览贴图效果
- 调整 UV 映射和纹理参数
- 测试多个车型和贴图组合

---

## 🤝 协作开发建议

### 何时共享代码到 `packages/`？
只在满足以下条件时才考虑提取：
1. ✅ 发现 **3 处以上相同代码**
2. ✅ 两个应用需要 **同步更新**
3. ✅ 有 **复杂的业务逻辑** 值得抽象

### 数据库变更流程
1. 在 `apps/web/database/schema.sql` 中更新 Schema
2. 在 Supabase Dashboard 执行 SQL
3. 更新 TypeScript 类型定义 (`apps/web/src/lib/types.ts`)
4. 同步更新小程序端的类型（如需要）

### CDN 资源管理
- 使用统一的上传脚本确保路径一致
- 图片优化后再上传（WebP 格式优先）
- 3D 模型尽量压缩（draco 编码）

---

## 📊 当前状态

| 应用 | MVP 状态 | 上线状态 | 多语言 |
|------|---------|---------|--------|
| Web | ✅ 100% | 🚀 可部署 | ✅ 中英文 |
| Miniprogram | 🔄 维护中 | ✅ 已上线 | ❌ 仅中文 |

---

## 📚 相关文档

所有项目文档已整合至 `docs/` 目录：

- **[文档中心首页](docs/README.md)**
- **[AI 上下文 (CONTEXT)](docs/CONTEXT.md)** (⭐ AI 必读)
- [AI 协作指南](docs/guides/ai_workflow_guide.md)
- [MVP 状态报告](docs/reports/mvp_status_report.md)
- [多语言实现指南](docs/guides/i18n_guide.md)
- [Monorepo 架构分析](docs/architecture/monorepo_analysis.md)
- [数据库设置指南](docs/guides/database_setup.md)
- [环境配置指南](docs/guides/environment_setup.md)
- [开发原则与技术实践沉淀](docs/guides/development_principles.md) (⭐ 技术必读)
---

## 🐛 常见问题

### Q: 如何添加新的车型？
A: 
1. 将 GLB 模型放到 `assets/models/{car-slug}/`
2. 在 Supabase 的 `wrap_models` 表中添加记录
3. 更新 `viewer-config.json` 添加车型专属参数

### Q: 如何删除用户账户？
A: 参见 `apps/web/scripts/delete-user.ts`。

---

## 📄 License

MIT

---

**技术支持**：查看各子项目的 README 获取详细文档
