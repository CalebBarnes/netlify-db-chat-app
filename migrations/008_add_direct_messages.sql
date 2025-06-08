-- Migration: Add Direct Messages (DMs) support
-- This enables private messaging between users

-- Create conversations table to group DM messages
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conversation participants to track who's in each conversation
CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_message_id INTEGER DEFAULT 0, -- Track read status
    PRIMARY KEY (conversation_id, username)
);

-- Create direct messages table
CREATE TABLE IF NOT EXISTS direct_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    sender_username VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reply_to_id INTEGER REFERENCES direct_messages(id),
    reply_to_username VARCHAR(50),
    reply_preview TEXT,
    image_url TEXT,
    image_filename TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_username ON conversation_participants(username);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_id ON direct_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON direct_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender ON direct_messages(sender_username);

-- Add comments for documentation
COMMENT ON TABLE conversations IS 'Groups of users for direct messaging';
COMMENT ON TABLE conversation_participants IS 'Users participating in each conversation with read tracking';
COMMENT ON TABLE direct_messages IS 'Direct messages between users in conversations';
COMMENT ON COLUMN conversation_participants.last_read_message_id IS 'ID of last message read by this user for unread count';
COMMENT ON COLUMN direct_messages.reply_to_id IS 'Reference to message being replied to';
COMMENT ON COLUMN direct_messages.image_url IS 'URL path to uploaded image stored in Netlify Blobs';
COMMENT ON COLUMN direct_messages.image_filename IS 'Original filename of uploaded image';

-- Function to update conversation updated_at when new message is added
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = NOW() 
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update conversation timestamp
CREATE TRIGGER trigger_update_conversation_timestamp
    AFTER INSERT ON direct_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- Function to get or create conversation between two users
CREATE OR REPLACE FUNCTION get_or_create_conversation(user1 VARCHAR(50), user2 VARCHAR(50))
RETURNS INTEGER AS $$
DECLARE
    conv_id INTEGER;
BEGIN
    -- Try to find existing conversation between these two users
    SELECT c.id INTO conv_id
    FROM conversations c
    WHERE c.id IN (
        SELECT cp1.conversation_id
        FROM conversation_participants cp1
        JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
        WHERE cp1.username = user1 AND cp2.username = user2
        AND cp1.conversation_id IN (
            SELECT conversation_id
            FROM conversation_participants
            GROUP BY conversation_id
            HAVING COUNT(*) = 2  -- Only 2 participants (DM, not group chat)
        )
    )
    LIMIT 1;
    
    -- If no conversation exists, create one
    IF conv_id IS NULL THEN
        INSERT INTO conversations DEFAULT VALUES RETURNING id INTO conv_id;
        
        -- Add both users as participants
        INSERT INTO conversation_participants (conversation_id, username)
        VALUES (conv_id, user1), (conv_id, user2);
    END IF;
    
    RETURN conv_id;
END;
$$ LANGUAGE plpgsql;
