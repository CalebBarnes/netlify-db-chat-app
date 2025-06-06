-- Migration: Add typing indicators to user presence
-- This extends the existing user_presence table to track typing state

-- Add typing state columns to user_presence table
ALTER TABLE user_presence 
ADD COLUMN IF NOT EXISTS is_typing BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS typing_started_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient typing queries
CREATE INDEX IF NOT EXISTS idx_user_presence_typing 
ON user_presence(is_typing, typing_started_at) 
WHERE is_typing = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN user_presence.is_typing IS 'Whether the user is currently typing a message';
COMMENT ON COLUMN user_presence.typing_started_at IS 'When the user started typing (for timeout purposes)';
