import { neon } from "@neondatabase/serverless";
import { execSync } from "child_process";

const databaseUrl = execSync("netlify env:get NETLIFY_DATABASE_URL", {
  encoding: "utf8",
}).trim();

const sql = neon(databaseUrl);

async function addLumiToParticipants() {
  try {
    console.log("🤖 Checking chat_participants table structure...");

    // First, check the table structure
    const tableInfo = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'chat_participants'
      ORDER BY ordinal_position
    `;

    console.log("📋 Table structure:", tableInfo);

    // Check existing participants
    const existing = await sql`
      SELECT * FROM chat_participants LIMIT 3
    `;

    // Add Lumi as a participant so she shows up in @ autocomplete
    await sql`
      INSERT INTO chat_participants (username, first_seen, last_message_at, message_count, created_at, updated_at)
      VALUES ('Lumi', NOW(), NOW(), 1, NOW(), NOW())
      ON CONFLICT (username)
      DO UPDATE SET
        last_message_at = NOW(),
        message_count = chat_participants.message_count + 1,
        updated_at = NOW()
    `;

    console.log("✅ Lumi added to chat participants");

    // Check the results
    const participants = await sql`
      SELECT username, first_seen, last_message_at, message_count
      FROM chat_participants
      WHERE username = 'Lumi'
    `;

    console.log("📊 Lumi participant record:", participants[0]);
  } catch (error) {
    console.error("❌ Failed to add Lumi to participants:", error);
  }
}

addLumiToParticipants();
