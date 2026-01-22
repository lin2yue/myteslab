---
description: 如何删除用户账户
---

// turbo
1. 确保已在 `apps/web/.env.local` 中配置 `SUPABASE_SERVICE_ROLE_KEY`。
2. 运行删除脚本，并将 `targetEmail` 替换为要删除的账户邮箱：
   ```bash
   npx tsx apps/web/scripts/delete-user.ts
   ```
   *注意：脚本目前硬编码了目标邮箱，执行前请根据需要修改脚本代码或稍后将其改进为接受命令行参数。*
