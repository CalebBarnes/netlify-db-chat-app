-- Add Spotify integration tables for jam sessions and voting system
-- This enables synchronized music playback with democratic controls

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS session_votes CASCADE;
DROP TABLE IF EXISTS session_queue CASCADE;
DROP TABLE IF EXISTS session_participants CASCADE;
DROP TABLE IF EXISTS spotify_tokens CASCADE;
DROP TABLE IF EXISTS jam_sessions CASCADE;

-- Jam sessions table - tracks active music sessions
CREATE TABLE IF NOT EXISTS jam_sessions (
    id SERIAL PRIMARY KEY,
    host_username VARCHAR(50) NOT NULL,
    session_name VARCHAR(100) NOT NULL,
    current_track_uri VARCHAR(255),
    current_track_name VARCHAR(255),
    current_track_artist VARCHAR(255),
    current_position INTEGER DEFAULT 0, -- milliseconds
    is_playing BOOLEAN DEFAULT false,
    volume INTEGER DEFAULT 75, -- 0-100
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session participants table - who's in each session
CREATE TABLE IF NOT EXISTS session_participants (
    session_id INTEGER REFERENCES jam_sessions(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    spotify_user_id VARCHAR(255),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (session_id, username)
);

-- Session votes table - democratic voting system
CREATE TABLE IF NOT EXISTS session_votes (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES jam_sessions(id) ON DELETE CASCADE,
    vote_type VARCHAR(20) NOT NULL, -- 'skip', 'vibe', 'volume', 'queue'
    vote_target VARCHAR(255), -- track_uri, genre, volume_level, etc.
    username VARCHAR(50) NOT NULL,
    vote_value INTEGER DEFAULT 1, -- 1 for yes, -1 for no, or numeric value
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(session_id, vote_type, vote_target, username) -- prevent duplicate votes
);

-- Session queue table - collaborative song queue
CREATE TABLE IF NOT EXISTS session_queue (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES jam_sessions(id) ON DELETE CASCADE,
    track_uri VARCHAR(255) NOT NULL,
    track_name VARCHAR(255) NOT NULL,
    track_artist VARCHAR(255) NOT NULL,
    added_by VARCHAR(50) NOT NULL,
    position INTEGER NOT NULL,
    votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spotify user tokens table - OAuth authentication
CREATE TABLE IF NOT EXISTS spotify_tokens (
    username VARCHAR(50) PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    spotify_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jam_sessions_active ON jam_sessions(ended_at) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_session_participants_session ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_votes_session ON session_votes(session_id);
CREATE INDEX IF NOT EXISTS idx_session_votes_type ON session_votes(vote_type, expires_at);
CREATE INDEX IF NOT EXISTS idx_session_queue_session ON session_queue(session_id, position);
CREATE INDEX IF NOT EXISTS idx_spotify_tokens_expires ON spotify_tokens(expires_at);

-- Add comments for documentation
COMMENT ON TABLE jam_sessions IS 'Active Spotify jam sessions with synchronized playback';
COMMENT ON TABLE session_participants IS 'Users participating in each jam session';
COMMENT ON TABLE session_votes IS 'Democratic voting system for skip, vibe, volume controls';
COMMENT ON TABLE session_queue IS 'Collaborative song queue for each session';
COMMENT ON TABLE spotify_tokens IS 'OAuth tokens for Spotify API access';

COMMENT ON COLUMN jam_sessions.current_position IS 'Current playback position in milliseconds';
COMMENT ON COLUMN session_votes.vote_type IS 'Type of vote: skip, vibe, volume, queue';
COMMENT ON COLUMN session_votes.vote_target IS 'What the vote is for (track URI, genre, etc.)';
COMMENT ON COLUMN session_votes.vote_value IS '1 for yes, -1 for no, or numeric value for volume';
