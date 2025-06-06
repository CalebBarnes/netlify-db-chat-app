-- Create messages table for chat app
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on created_at for better performance when ordering
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Insert some sample messages
INSERT INTO messages (username, message) VALUES 
    ('System', 'Welcome to the chat! 🎉'),
    ('Alice', 'Hey everyone! This chat app is awesome!'),
    ('Bob', 'Hello! Nice to meet you all 👋')
ON CONFLICT DO NOTHING;
