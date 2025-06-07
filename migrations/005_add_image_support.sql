-- Add image support to messages table
-- This allows users to upload and share images in chat messages

ALTER TABLE messages 
ADD COLUMN image_url TEXT,
ADD COLUMN image_filename TEXT;

-- Add index for better performance when querying messages with images
CREATE INDEX idx_messages_image_url ON messages(image_url) WHERE image_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN messages.image_url IS 'URL path to the uploaded image stored in Netlify Blobs';
COMMENT ON COLUMN messages.image_filename IS 'Original filename of the uploaded image for display purposes';
