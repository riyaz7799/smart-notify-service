-- Create USERS table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Create NOTIFICATIONS table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    message_id VARCHAR(255) UNIQUE,
    retries_attempted INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message VARCHAR(500)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_message_id ON notifications(message_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Seed a test user with JWT token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5ZmM4MWZkZC1mYzljLTQ5ZTMtOWRmMS1hMzZkZjdlMWVjNWEiLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiaWF0IjoxNzAzNjAwMDAwfQ.GyTdZVu2VUh8UZ5qmyY8xR2x8xN9pQ6rT5xK3jL4z8M
INSERT INTO users (id, username, password_hash, email) VALUES
('9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a', 'testuser', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm', 'test@example.com')
ON CONFLICT (username) DO NOTHING;

-- Insert additional test users
INSERT INTO users (username, password_hash, email) VALUES
('user1', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm', 'user1@example.com'),
('user2', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm', 'user2@example.com')
ON CONFLICT (username) DO NOTHING;
