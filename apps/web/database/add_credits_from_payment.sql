-- RPC function to add credits from a payment
CREATE OR REPLACE FUNCTION add_credits_from_payment(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT DEFAULT 'Credits purchased via payment',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- 1. Update user_credits
  UPDATE user_credits
  SET 
    balance = balance + p_amount,
    total_earned = total_earned + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- 2. Record in credit_ledger
  INSERT INTO credit_ledger (user_id, amount, type, description, metadata)
  VALUES (p_user_id, p_amount, 'top-up', p_description, p_metadata);

  RETURN jsonb_build_object(
    'success', TRUE,
    'new_balance', v_new_balance
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
