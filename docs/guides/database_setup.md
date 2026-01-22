# 数据库设置完整指南

## 步骤1: 在Supabase创建表结构

### 方法A: 使用Supabase Dashboard (推荐)

1. 访问 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 进入 **SQL Editor**
4. 复制 `database/schema.sql` 文件内容
5. 点击 **Run** 执行

### 方法B: 使用命令行

```bash
# 安装Supabase CLI
npm install -g supabase

# 登录
supabase login

# 执行SQL
supabase db push
```

## 步骤2: 导出现有贴图数据

如果小程序已有贴图数据,可以导出复用:

```bash
cd apps/web/database

# 设置环境变量(从小程序的.env文件获取)
export SUPABASE_URL=your_supabase_url
export SUPABASE_SERVICE_ROLE_KEY=your_service_key

# 运行导出脚本
node export_data.js
```

这将生成:
- `exported_data.json` - JSON格式的完整数据
- `import_wraps.sql` - SQL导入脚本

## 步骤3: 导入数据到Web版数据库

### 如果使用相同的Supabase项目

数据已经存在,无需导入,直接使用即可!

### 如果使用不同的Supabase项目

1. 在Supabase Dashboard的SQL Editor中
2. 执行 `import_wraps.sql` 文件内容

## 步骤4: 验证数据

```bash
cd apps/web

# 创建.env.local文件
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EOF

# 验证数据(可选)
node database/setup.ts
```

## 环境变量配置

### Web版 (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key # 用于管理操作(如删除用户)
```

### 小程序 (.env)
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 常见问题

### Q: 小程序和Web版可以共享同一个Supabase项目吗?
A: 可以!这是推荐的方式,数据实时同步。

### Q: 如何获取SUPABASE_SERVICE_ROLE_KEY?
A: 在Supabase Dashboard → Settings → API → service_role key

### Q: 贴图数据从哪里来?
A: 
1. 如果小程序已有数据,使用 `export_data.js` 导出
2. 如果没有,需要手动添加或编写导入脚本

## 下一步

数据库设置完成后,继续开发核心页面:
1. 实现首页贴图列表
2. 实现详情页3D查看器
3. 实现下载功能

---

## 🛠️ 维护标准 (Critical)

为了保证数据库的一致性和可维护性，所有开发人员必须遵守以下标准：

1. **唯一事实来源 (Single Source of Truth)**:
   - `apps/web/database/schema.sql` 是整个项目数据库结构的唯一权威定义。
   - 禁止仅通过 Supabase Dashboard 修改表结构而不同步回此文件。

2. **变更管理**:
   - 所有的数据库变更（添加列、修改函数、调整 RLS 策略）必须**首先**更新到 `schema.sql` 中。
   - 如果使用了增量补丁文件（如 `001_add_column.sql`），在验证通过后，必须将其内容合并回 `schema.sql`。

3. **初始数据**:
   - `schema.sql` 底部包含基础车型数据，确保新环境部署后即可运行。
   - 新用户的初始积分（当前设置为 **3 积分**）应在此文件的触发器逻辑中统一管理。

4. **版本控制**:
   - 对 `schema.sql` 的修改必须随代码一同提交，以便于 CI/CD 和环境同步。
