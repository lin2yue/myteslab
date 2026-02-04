-- Migration: Update Credit System
-- 
-- 1. Multiply existing user balances and total_earned by 5
--    (Assuming previously 1 credit = 1 generation, now 5 credits = 1 generation)
UPDATE public.user_credits
SET 
  balance = balance * 5,
  total_earned = total_earned * 5;

-- 2. Update new user sign-up bonus to 15 credits
--    (Find the function that handles new user creation, typically 'handle_new_user' or similar trigger function)

-- CHECK your existing function first with:
-- \nf public.handle_new_user

-- Proposed update for the trigger function:
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');

  -- UPDATED: Give 15 credits on signup
  insert into public.user_credits (user_id, balance, total_earned)
  values (new.id, 15, 15);

  return new;
end;
$function$;

-- NOTE: If your trigger function is named differently, please adapt the above SQL.
