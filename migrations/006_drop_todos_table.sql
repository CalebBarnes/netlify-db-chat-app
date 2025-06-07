-- Drop legacy todos table and related indexes
-- This migration removes the todos functionality as the app has evolved into a dedicated chat application

DROP TABLE IF EXISTS todos CASCADE;
