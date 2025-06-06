-- Add reply functionality to messages table
-- This migration adds columns to support replying to specific messages

-- Add reply columns to messages table
ALTER TABLE messages ADD COLUMN reply_to_id INTEGER REFERENCES messages(id);
ALTER TABLE messages ADD COLUMN reply_to_username VARCHAR(50);
ALTER TABLE messages ADD COLUMN reply_preview TEXT;

-- Create index for efficient reply queries
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id);

-- Add comments for documentation
COMMENT ON COLUMN messages.reply_to_id IS 'ID of the message this is replying to (NULL for top-level messages)';
COMMENT ON COLUMN messages.reply_to_username IS 'Username of the person being replied to (for quick access)';
COMMENT ON COLUMN messages.reply_preview IS 'First 100 characters of the original message being replied to';
