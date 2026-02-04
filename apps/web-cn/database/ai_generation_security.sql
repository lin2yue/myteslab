-- ============================================
-- AI 生成安全增强 (AI Generation Security)
-- ============================================

-- 1. 任务状态枚举 (Task Status Enum)
DO $$ BEGIN
    CREATE TYPE generation_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. AI 生成任务表 (Generation Tasks)
-- 用于追踪扣费和生成进度，防止盗刷和算力浪费
CREATE TABLE IF NOT EXISTS generation_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  status generation_status DEFAULT 'pending',
  credits_spent INTEGER DEFAULT 1,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 开启 RLS
ALTER TABLE generation_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own tasks" ON generation_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own tasks" ON generation_tasks FOR UPDATE USING (auth.uid() = user_id);

-- 3. 安全扣费存储过程 (Atomic Credit Deduction RPC)
-- 此函数在数据库层面保证：余额不足不扣费，扣费成功才创建任务
CREATE OR REPLACE FUNCTION deduct_credits_for_generation(
  p_prompt TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS TABLE (
  task_id UUID,
  success BOOLEAN,
  remaining_balance INTEGER,
  error_msg TEXT
) AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_task_id UUID;
BEGIN
  -- 1. 获取当前余额并加锁 (FOR UPDATE) 防止并发竞争
  SELECT balance INTO v_current_balance
  FROM user_credits
  WHERE user_id = auth.uid()
  FOR UPDATE;

  -- 2. 检查余额是否充足
  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, v_current_balance, 'Insufficient credits'::TEXT;
    RETURN;
  END IF;

  -- 3. 执行扣费
  UPDATE user_credits
  SET 
    balance = balance - p_amount,
    total_spent = total_spent + p_amount,
    updated_at = NOW()
  WHERE user_id = auth.uid();

  -- 4. 创建生成任务记录
  INSERT INTO generation_tasks (user_id, prompt, credits_spent, status)
  VALUES (auth.uid(), p_prompt, p_amount, 'pending')
  RETURNING id INTO v_new_task_id;

  -- 5. 返回结果
  RETURN QUERY SELECT v_new_task_id, TRUE, (v_current_balance - p_amount), NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  -- 发生任何错误回滚所有操作
  RETURN QUERY SELECT NULL::UUID, FALSE, v_current_balance, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
