-- Migration: Add user avatar support
-- This allows users to upload custom avatar images

-- Create user_avatars table to store avatar information
CREATE TABLE IF NOT EXISTS user_avatars (
    username VARCHAR(50) PRIMARY KEY,
    avatar_url TEXT NOT NULL,
    original_filename VARCHAR(255),
    file_size INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_avatars_username 
ON user_avatars(username);

CREATE INDEX IF NOT EXISTS idx_user_avatars_uploaded_at 
ON user_avatars(uploaded_at DESC);

-- Add comments for documentation
COMMENT ON TABLE user_avatars IS 'Stores user avatar images and metadata';
COMMENT ON COLUMN user_avatars.username IS 'Username of the avatar owner';
COMMENT ON COLUMN user_avatars.avatar_url IS 'URL path to the avatar image';
COMMENT ON COLUMN user_avatars.original_filename IS 'Original filename of uploaded image';
COMMENT ON COLUMN user_avatars.file_size IS 'Size of the avatar file in bytes';
COMMENT ON COLUMN user_avatars.uploaded_at IS 'When the avatar was first uploaded';
COMMENT ON COLUMN user_avatars.updated_at IS 'When the avatar was last updated';
