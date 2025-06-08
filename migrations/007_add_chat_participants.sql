-- Migration: Add chat participants tracking for offline user mentions
-- This allows users to @ mention anyone who has participated in chat, not just online users

-- Create chat_participants table to track all users who have sent messages
CREATE TABLE IF NOT EXISTS chat_participants (
    username VARCHAR(50) PRIMARY KEY,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_chat_participants_last_message 
ON chat_participants(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_participants_username 
ON chat_participants(username);

CREATE INDEX IF NOT EXISTS idx_chat_participants_message_count 
ON chat_participants(message_count DESC);

-- Populate initial participants from existing messages
INSERT INTO chat_participants (username, first_seen, last_message_at, message_count)
SELECT 
    username,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_message_at,
    COUNT(*) as message_count
FROM messages 
GROUP BY username
ON CONFLICT (username) DO UPDATE SET
    first_seen = LEAST(chat_participants.first_seen, EXCLUDED.first_seen),
    last_message_at = GREATEST(chat_participants.last_message_at, EXCLUDED.last_message_at),
    message_count = EXCLUDED.message_count,
    updated_at = NOW();

-- Add comments for documentation
COMMENT ON TABLE chat_participants IS 'Tracks all users who have participated in chat for offline mentions';
COMMENT ON COLUMN chat_participants.username IS 'Unique username of the participant';
COMMENT ON COLUMN chat_participants.first_seen IS 'When this user first sent a message';
COMMENT ON COLUMN chat_participants.last_message_at IS 'When this user last sent a message';
COMMENT ON COLUMN chat_participants.message_count IS 'Total number of messages sent by this user';
COMMENT ON COLUMN chat_participants.created_at IS 'When this record was created';
COMMENT ON COLUMN chat_participants.updated_at IS 'When this record was last updated';
