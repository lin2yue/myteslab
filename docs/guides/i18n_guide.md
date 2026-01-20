# i18n (多语言) 实现指南

## 目标

为 Tesla Studio 实现完整的多语言支持（中文和英文），包括 SEO 友好的 URL 结构、数据库多语言字段和前端国际化。

## 完成的工作

### 1. 架构搭建

#### 安装依赖
```bash
npm install next-intl
```

#### 核心配置文件
- **[routing.ts](file:///Users/linpengfei/work/tesla-studio-monorepo/apps/web/src/i18n/routing.ts)**: 定义支持的语言（`zh`, `en`）和默认语言（`zh`）
- **[request.ts](file:///Users/linpengfei/work/tesla-studio-monorepo/apps/web/src/i18n/request.ts)**: 配置翻译文件加载逻辑
- **[middleware.ts](file:///Users/linpengfei/work/tesla-studio-monorepo/apps/web/src/middleware.ts)**: 实现语言检测和路由重定向

#### 翻译文件
- **[zh.json](file:///Users/linpengfei/work/tesla-studio-monorepo/apps/web/messages/zh.json)**: 中文翻译
- **[en.json](file:///Users/linpengfei/work/tesla-studio-monorepo/apps/web/messages/en.json)**: 英文翻译

### 2. 路由结构迁移

将所有现有路由移至 `[locale]` 动态路由下：
```
src/app/
├── [locale]/
│   ├── layout.tsx        (支持 locale 参数)
│   ├── page.tsx          (首页)
│   └── wraps/
│       └── [slug]/
│           └── page.tsx  (详情页)
├── api/                  (API 路由保持不变)
└── globals.css
```

**URL 结构**:
- 中文: `http://localhost:3000/zh/wraps/model-3-acid-drip`
- 英文: `http://localhost:3000/en/wraps/model-3-acid-drip`
- 根路径 `/` 自动重定向到 `/zh` (默认语言)

### 3. 数据库架构升级

为支持多语言内容，扩展了数据库表结构：

```sql
-- 车型表增加英文名
ALTER TABLE wrap_models ADD COLUMN IF NOT EXISTS name_en VARCHAR(100);

-- 贴图表增加英文名和描述
ALTER TABLE wraps ADD COLUMN IF NOT EXISTS name_en VARCHAR(200);
ALTER TABLE wraps ADD COLUMN IF NOT EXISTS description_en TEXT;

-- 初始化车型英文名
UPDATE wrap_models SET name_en = 'Model 3' WHERE slug = 'model-3';
-- ... (其他车型同理)
```

### 4. 组件国际化

#### Layout
- 接收 `locale` 参数
- 动态设置 `<html lang={locale}>`
- 使用 `NextIntlClientProvider` 提供翻译上下文

#### Homepage
- 使用 `useTranslations` hook 获取静态翻译
- 根据 locale 显示对应的 UI 文本

#### WrapCard
- 使用 `useLocale` 检测当前语言
- 动态选择 `name_en` 或 `name` 字段
- 使用 i18n 路由 Link

#### FilterBar
- 车型名称多语言显示
- 筛选标签本地化

#### WrapDetailPage
- 详情页信息多语言化
- 下载按钮和提示文本国际化

### 5. 数据同步脚本

创建了 [translate_data.js](file:///Users/linpengfei/work/tesla-studio-monorepo/apps/web/scripts/translate_data.js) 自动化脚本：

**功能**:
- 从数据库读取所有 `name_en` 为空的记录
- 从 URL slug 中提取并生成英文名称（如 `model-3-acid-drip` → `Acid Drip`）
- 自动填充 `name_en` 和 `description_en` 字段

### 6. TypeScript 类型更新

更新了 [types.ts](file:///Users/linpengfei/work/tesla-studio-monorepo/apps/web/src/lib/types.ts):
```typescript
export interface Model {
    // ...
    name_en?: string  // 新增
}

export interface Wrap {
    // ...
    name_en?: string       // 新增
    description_en?: string // 新增
}
```

## 技术亮点

### 1. SEO 优化
- **URL 结构**: 使用子目录模式 (`/zh/`, `/en/`) 而非查询参数，对 SEO 更友好
- **HTML lang 属性**: 动态设置 `<html lang="zh">` 或 `<html lang="en">`
- **Hreflang 支持**: 架构已就绪，可轻松添加 `<link rel="alternate" hreflang="...">`

### 2. 数据回退策略
```typescript
const name = locale === 'en' ? wrap.name_en || wrap.name : wrap.name
```
如果英文名不存在，自动回退到中文名，确保内容不会"消失"。

### 3. 增量迁移
- API 路由无需修改
- 现有数据结构向后兼容
- 可以逐步填充多语言内容

## 验证与故障排查

### 手动验证
1. **访问中文/英文首页**: 确保路由正确切换，且 UI 文本正确显示。
2. **访问详情页**: 确保动态路由和内容加载正确。

### 常见问题
- **500 错误 "Couldn't find next-intl config file"**: 确保 `next.config.ts` 正确使用了 `createNextIntlPlugin`。
- **Server Component 错误**: 确保在 Server Component 中使用 `getTranslations` 而不是 client-side hook `useTranslations`。

## 文件清单

### 新增文件
- `src/i18n/routing.ts`
- `src/i18n/request.ts`
- `src/middleware.ts`
- `messages/zh.json`
- `messages/en.json`
- `scripts/translate_data.js`
