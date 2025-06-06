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

    console.log("✅ Migration completed successfully!");
    console.log("🎉 Your chat app with user presence is ready to use!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();
