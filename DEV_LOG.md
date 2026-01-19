# 开发日志 (2026-01-19) - 部署与资产重构

## 1. 变更摘要

### A. Vercel 部署修复
*   **问题**：Vercel 部署失败，提示认证错误及构建命令循环。
*   **解决**：
    1.  **认证**：确保使用正确的 `VERCEL_TOKEN` 链接项目 (`vercel link`)。
    2.  **turbo.json**：更名 `pipeline` -> `tasks` (Turbo 2.0 变更)。
    3.  **构建命令**：
        *   根目录 `package.json` 的 `build` 脚本修改为 `turbo run build --filter=web`，避免递归构建小程序。
        *   `apps/web/vercel.json` 明确指定 `buildCommand: "next build"` 和 `outputDirectory: ".next"`，移除 `framework: null` 设置以恢复 Next.js 自动检测。

### B. 资产路径重构 (Project Structure Refactoring)
为了优化项目体积和结构，我们将所有大型非代码资源移出了 `apps/miniprogram` 目录。
*   **Audio**: `apps/miniprogram/uploads/audios` -> **`assets/audio`**
*   **Tutorials**: `apps/miniprogram/uploads/tutorial` -> **`assets/tutorial`**
*   **Previews**: `apps/miniprogram/previews` -> **`assets/3d-previews`**
*   **Models**: `apps/miniprogram/uploads/catalog` -> **`assets/models`**
*   **删除**: 永久删除了 `apps/miniprogram/uploads` 目录。

### C. Git 仓库瘦身
*   **策略**：将 `assets/` 目录完全加入 `.gitignore`（仅本地保留，线上资源走 OSS/CDN）。
*   **清理**：移除了被意外检入的 `apps/miniprogram/dist` (构建产物) 和 `previews` 图片。
*   **结果**：仓库体积显著减小，只包含纯代码。

---

## 2. 关键错误与教训 (Lessons Learned)

### 🚨 风险提示：数据同步脚本
*   **错误现象**：在迁移 `previews` 目录时，`sync_resources_strict.js` 脚本检测到本地目录缺失。按照原有逻辑（"本地没有即为孤儿文件"），脚本准备**删除线上所有预览图**。
*   **修正方案**：增加了安全检查。
    ```javascript
    // 只有当本地目录真实存在时，才执行同步或删除操作
    if (fs.existsSync(previewsDir)) { ... }
    ```
*   **教训**：在编写涉及“删除线上资源”的同步脚本时，**必须**首先验证本地源目录是否存在。本地目录缺失不应被默认为“用户想清空线上数据”，而应视为“配置错误”并中止操作。

### 🚨 Next.js 与 Monorepo 构建
*   **错误现象**：在 Vercel 上部署时，根目录的 `build` 命令再次触发了 turbo build，导致循环或错误的构建目标（试图构建小程序）。
*   **教训**：Monorepo 在 Vercel 部署时，务必在 `vercel.json` 或 `Project Settings` 中指定 `--filter` 参数（例如 `--filter=web`），或者直接在子应用目录中进行构建设置。

### 🚨 Git 忽略规则
*   **错误现象**：尝试忽略 `dist` 目录时，直接修改 `.gitignore` 无效，因为文件已被追踪。
*   **教训**：对于已经入库的文件，必须先执行 `git rm -r --cached path/to/folder`将其从索引中移除，`.gitignore` 规则才会生效。

### ⚠️ 本地开发映射
*   **变更**：由于文件物理路径改变，前端代码（引用 `/uploads/...`）可能会失效。
*   **解决**：我们在 `dev-studio/server.js` 中建立了映射：
    ```javascript
    const ASSETS_ROOT = path.resolve(__dirname, '../assets/models');
    const UPLOADS_MOUNT = '/uploads/catalog'; // 保持 URL 结构兼容
    ```
    这样前端代码无需修改即可继续工作。

---

## 3. 后续维护指南
*   **添加新资产**：请放入 `assets/` 对应子目录，**不要**放入 `apps/miniprogram`。
*   **脚本运行**：所有运维脚本（上传、同步）均已更新路径，直接运行即可。
*   **提交代码**：确保不要提交 `assets/` 下的大文件或 `dist/` 构建产物。
