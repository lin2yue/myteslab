-- ============================================
-- 1. 添加角色类型 (Enum)
-- ============================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 2. 向 profiles 表添加 role 字段
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user';

-- ============================================
-- 2.1 修复 profiles 和 user_credits 的关联 (辅助 Supabase Join)
-- ============================================
-- 确保 user_credits 的外键指向 profiles(id) 而不仅仅是 auth.users(id)
ALTER TABLE user_credits 
  DROP CONSTRAINT IF EXISTS user_credits_user_id_fkey;

ALTER TABLE user_credits
  ADD CONSTRAINT user_credits_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================
-- 3. 强化 RLS 策略 (管理端权限隔离)
-- ============================================

-- 3.1 车型管理：仅管理员可增删改
DROP POLICY IF EXISTS "Admin All" ON wrap_models;
CREATE POLICY "Admin All" ON wrap_models 
FOR ALL TO authenticated 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin') );

-- 3.2 贴图管理 (官方作品)：仅管理员可编辑/删除
DROP POLICY IF EXISTS "Admin Manage Official Wraps" ON wraps;
CREATE POLICY "Admin Manage Official Wraps" ON wraps 
FOR ALL TO authenticated 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin') )
WITH CHECK ( (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin') );

-- 3.3 积分流水/余额可见性：普通用户仅看自己，管理员看全部
DROP POLICY IF EXISTS "Admin View All Ledgers" ON credit_ledger;
CREATE POLICY "Admin View All Ledgers" ON credit_ledger 
FOR SELECT TO authenticated 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin') );

DROP POLICY IF EXISTS "Admin View All Credits" ON user_credits;
CREATE POLICY "Admin View All Credits" ON user_credits 
FOR ALL TO authenticated 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin') );

-- 3.4 生成任务可见性：普通用户仅看自己，管理员看全部
DROP POLICY IF EXISTS "Admin View All Tasks" ON generation_tasks;
CREATE POLICY "Admin View All Tasks" ON generation_tasks 
FOR ALL TO authenticated 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin') );

-- 3.5 用户档可见性：管理员可更新角色
DROP POLICY IF EXISTS "Admin Update Profiles" ON profiles;
CREATE POLICY "Admin Update Profiles" ON profiles 
FOR UPDATE TO authenticated 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin') );

-- ============================================
-- 4. 辅助函数：判断是否为管理员 (用于后端/中间件)
-- ============================================
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
