import { neon } from "@neondatabase/serverless";
import { execSync } from "child_process";

const databaseUrl = execSync("netlify env:get NETLIFY_DATABASE_URL", {
  encoding: "utf8",
}).trim();

const sql = neon(databaseUrl);

async function createParticipantsTable() {
  try {
    console.log("🔧 Creating chat_participants table...");
    
    // Create the table
    await sql`
      CREATE TABLE IF NOT EXISTS chat_participants (
          username VARCHAR(50) PRIMARY KEY,
          first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          message_count INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    
    console.log("✅ chat_participants table created");
    
    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_chat_participants_last_message 
      ON chat_participants(last_message_at DESC)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_chat_participants_username 
      ON chat_participants(username)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_chat_participants_message_count 
      ON chat_participants(message_count DESC)
    `;
    
    console.log("✅ Indexes created");
    
    // Populate from existing messages
    await sql`
      INSERT INTO chat_participants (username, first_seen, last_message_at, message_count)
      SELECT 
          username,
          MIN(created_at) as first_seen,
          MAX(created_at) as last_message_at,
          COUNT(*) as message_count
      FROM messages 
      GROUP BY username
      ON CONFLICT (username) DO UPDATE SET
          first_seen = LEAST(chat_participants.first_seen, EXCLUDED.first_seen),
          last_message_at = GREATEST(chat_participants.last_message_at, EXCLUDED.last_message_at),
          message_count = EXCLUDED.message_count,
          updated_at = NOW()
    `;
    
    console.log("✅ Populated with existing message data");
    
    // Check the results
    const participants = await sql`
      SELECT username, message_count, last_message_at 
      FROM chat_participants 
      ORDER BY message_count DESC
    `;
    
    console.log(`\n📊 Found ${participants.length} participants:`);
    participants.forEach(p => {
      console.log(`  - ${p.username}: ${p.message_count} messages (last: ${p.last_message_at})`);
    });
    
  } catch (error) {
    console.error("❌ Failed to create participants table:", error);
  }
}

createParticipantsTable();
