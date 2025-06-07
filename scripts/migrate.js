import { neon } from "@neondatabase/serverless";
import { execSync } from "child_process";

async function runMigrations() {
  try {
    console.log("🚀 Starting database migrations...");

    // Get the database URL from Netlify CLI
    const databaseUrl = execSync("netlify env:get NETLIFY_DATABASE_URL", {
      encoding: "utf8",
    }).trim();

    if (!databaseUrl) {
      throw new Error(
        "NETLIFY_DATABASE_URL not found. Make sure you have linked your site and the database is set up."
      );
    }

    const sql = neon(databaseUrl);

    console.log("📝 Running migrations...");

    // Execute todos table migration
    console.log("Creating todos table...");
    await sql`
      CREATE TABLE IF NOT EXISTS todos (
          id SERIAL PRIMARY KEY,
          text TEXT NOT NULL,
          completed BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    console.log("Creating todos index...");
    await sql`
      CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at DESC)
    `;

    // Execute messages table migration
    console.log("Creating messages table...");
    await sql`
      CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    console.log("Creating messages index...");
    await sql`
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC)
    `;

    console.log("Inserting sample messages...");
    await sql`
      INSERT INTO messages (username, message) VALUES
          ('System', 'Welcome to the chat! 🎉'),
          ('Alice', 'Hey everyone! This chat app is awesome!'),
          ('Bob', 'Hello! Nice to meet you all 👋')
      ON CONFLICT DO NOTHING
    `;

    // Create user presence table for tracking online users
    console.log("Creating user_presence table...");
    await sql`
      CREATE TABLE IF NOT EXISTS user_presence (
          username VARCHAR(50) PRIMARY KEY,
          last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    console.log("Creating user_presence index...");
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen DESC)
    `;

    // Migration 003: Add typing indicators
    console.log("Adding typing indicators to user_presence table...");
    await sql`
      ALTER TABLE user_presence
      ADD COLUMN IF NOT EXISTS is_typing BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS typing_started_at TIMESTAMP WITH TIME ZONE
    `;

    console.log("Creating typing indicators index...");
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_presence_typing
      ON user_presence(is_typing, typing_started_at)
      WHERE is_typing = TRUE
    `;

    // Migration 004: Add reply functionality to messages table
    console.log("Adding reply functionality to messages table...");
    await sql`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES messages(id),
      ADD COLUMN IF NOT EXISTS reply_to_username VARCHAR(50),
      ADD COLUMN IF NOT EXISTS reply_preview TEXT
    `;

    console.log("Creating reply functionality index...");
    await sql`
      CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id)
    `;

    // Migration 005: Add image support to messages table
    console.log("Adding image support to messages table...");
    await sql`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS image_url TEXT,
      ADD COLUMN IF NOT EXISTS image_filename TEXT
    `;

    console.log("Creating image support index...");
    await sql`
      CREATE INDEX IF NOT EXISTS idx_messages_image_url ON messages(image_url) WHERE image_url IS NOT NULL
    `;

    console.log("✅ Migration completed successfully!");
    console.log(
      "🎉 Your chat app with user presence, typing indicators, reply functionality, and image upload is ready to use!"
    );
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();
