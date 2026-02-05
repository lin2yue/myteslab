-- Database migration to add email verification support
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_token TEXT,
ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMP WITH TIME ZONE;

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
