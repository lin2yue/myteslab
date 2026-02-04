-- ============================================
-- AI Task Monitoring - Atomic Step Appender
-- ============================================

CREATE OR REPLACE FUNCTION append_task_step(
  p_task_id UUID,
  p_status generation_status DEFAULT NULL,
  p_step TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_new_step JSONB;
  v_steps JSONB;
BEGIN
  -- 1. 构建新步骤对象
  v_new_step := jsonb_build_object(
    'step', p_step,
    'ts', NOW(),
    'reason', p_reason,
    'metadata', p_metadata
  );

  -- 2. 原子更新任务状态与步骤列表
  UPDATE generation_tasks
  SET 
    status = COALESCE(p_status, status),
    steps = COALESCE(steps, '[]'::jsonb) || v_new_step,
    updated_at = NOW()
  WHERE id = p_task_id
  RETURNING steps INTO v_steps;

  RETURN v_steps;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
