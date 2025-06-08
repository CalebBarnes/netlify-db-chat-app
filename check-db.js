import { neon } from "@neondatabase/serverless";
import { execSync } from "child_process";

const databaseUrl = execSync("netlify env:get NETLIFY_DATABASE_URL", {
  encoding: "utf8",
}).trim();

const sql = neon(databaseUrl);

async function checkDatabase() {
  try {
    console.log("🔍 Checking database tables...");
    
    // Check what tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    console.log("📋 Existing tables:");
    tables.forEach(table => console.log(`  - ${table.table_name}`));
    
    // Check applied migrations
    try {
      const migrations = await sql`
        SELECT version, applied_at 
        FROM schema_migrations 
        ORDER BY version
      `;
      
      console.log("\n📊 Applied migrations:");
      migrations.forEach(migration => {
        console.log(`  - ${migration.version} (${migration.applied_at})`);
      });
    } catch (error) {
      console.log("\n❌ No schema_migrations table found");
    }
    
    // Try to check if chat_participants exists specifically
    try {
      const participantsCheck = await sql`
        SELECT COUNT(*) as count FROM chat_participants
      `;
      console.log(`\n✅ chat_participants table exists with ${participantsCheck[0].count} rows`);
    } catch (error) {
      console.log(`\n❌ chat_participants table does not exist: ${error.message}`);
    }
    
  } catch (error) {
    console.error("❌ Database check failed:", error);
  }
}

checkDatabase();
