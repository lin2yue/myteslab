# 开发日志：安全性加固与 UI 细节修复 (2026-02-05)

## 1. 任务背景
在项目快速迭代过程中，由于历史遗留调试接口和暗黑模式适配不全，导致了一些潜在的安全风险与视觉体验问题。本次任务主要针对 `web` 和 `web-cn` 两个项目进行了同步修复。

## 2. 安全性加固 (Safety Fixes)
- **禁用调试接口**：在生产环境下彻底禁用了 `/api/debug-env`、`/api/debug/login-state` 及 `/api/debug/assets`。
- **越权访问修复**：
    - `api/download/[id]`：增加非所有者无法下载私有资源的逻辑。
    - `getWrap`：修复了详情页在未知 Slug 情况下可能跳过可见性检查的问题。
- **OTP 安全增强**：引入了生产环境 Secret 强制校验机制。

## 3. 暗黑模式可见性修复 (UI Optimization)
- **个人中心全局适配**：修复了 `ProfilePage`, `ProfileContent`, `CreditsSection`, `ProfileForm` 在暗黑模式下标题、明细及历史记录文字颜色不可见的问题。
- **AI 生成页优化**：修复了历史记录项（HistoryItem）的 Prompt 和 Apply 按钮颜色。
- **成功页修复**：同步修复了 `checkout/success` 页面标题在暗黑模式下的对比度。

## 4. 功能逻辑修复 (Bug Fixes)
- **AI 生成韧性**：修复了元数据失败导致的任务状态悬挂问题。
- **Slug 处理**：对超长 Prompt 生成的 Slug 进行了 50 字符截断，防止数据库插入异常。

## 5. 项目同步 (Synchronization)
- 完成了 `apps/web-cn` 到 `apps/web` 的代码同步，确保海外版与国内版体验对齐。

## 6. 部署记录
- **分支**：`pre` -> `main`
- **自动化部署**：触发了 GitHub Actions (ECS Deployment) 与 Vercel 自动化流程。
