import { neon } from "@neondatabase/serverless";
import { execSync } from "child_process";

async function clearMessages() {
  try {
    console.log('🧹 Clearing messages table...');
    
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
    
    // Clear all messages
    await sql`DELETE FROM messages`;
    
    console.log('✅ Messages table cleared!');
    
    // Insert fresh sample messages
    console.log('📝 Inserting fresh sample messages...');
    await sql`
      INSERT INTO messages (username, message) VALUES 
          ('System', 'Welcome to the fresh chat! 🎉'),
          ('Alice', 'Hello everyone! 👋'),
          ('Bob', 'Hey there! Nice clean chat!')
    `;
    
    console.log('✅ Fresh sample messages added!');
    console.log('🎊 Chat is ready with clean data!');
    
  } catch (error) {
    console.error('❌ Failed to clear messages:', error);
    process.exit(1);
  }
}

clearMessages();
