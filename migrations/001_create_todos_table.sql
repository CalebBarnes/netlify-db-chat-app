-- Create todos table
CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on created_at for better performance when ordering
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at DESC);

-- Insert some sample data (optional)
INSERT INTO todos (text, completed) VALUES 
    ('Welcome to your new todo app!', false),
    ('Try adding a new todo', false),
    ('Mark this todo as complete', false)
ON CONFLICT DO NOTHING;
