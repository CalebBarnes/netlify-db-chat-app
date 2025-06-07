import { neon } from "@neondatabase/serverless";
import { execSync } from "child_process";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MigrationRunner {
  constructor(databaseUrl) {
    this.sql = neon(databaseUrl);
    this.migrationsDir = join(__dirname, "..", "migrations");
  }

  /**
   * Create the schema_migrations table to track applied migrations
   */
  async createMigrationsTable() {
    console.log("📋 Creating schema_migrations table...");
    await this.sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log("✅ Schema migrations table ready");
  }

  /**
   * Get list of applied migrations from database
   */
  async getAppliedMigrations() {
    try {
      const result = await this.sql`
        SELECT version FROM schema_migrations ORDER BY version
      `;
      return result.map((row) => row.version);
    } catch (error) {
      // If table doesn't exist yet, return empty array
      if (
        error.message.includes('relation "schema_migrations" does not exist')
      ) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get list of available migration files from filesystem
   */
  getAvailableMigrations() {
    try {
      const files = readdirSync(this.migrationsDir)
        .filter((file) => file.endsWith(".sql"))
        .sort(); // Sort to ensure proper order

      console.log(`📁 Found ${files.length} migration files:`, files);
      return files;
    } catch (error) {
      console.error("❌ Error reading migrations directory:", error);
      throw new Error(
        `Cannot read migrations directory: ${this.migrationsDir}`
      );
    }
  }

  /**
   * Read and return the content of a migration file
   */
  readMigrationFile(filename) {
    const filePath = join(this.migrationsDir, filename);
    try {
      const content = readFileSync(filePath, "utf8");
      return content.trim();
    } catch (error) {
      throw new Error(
        `Cannot read migration file ${filename}: ${error.message}`
      );
    }
  }

  /**
   * Execute a single migration
   */
  async executeMigration(filename, content) {
    console.log(`🔄 Applying migration: ${filename}`);

    try {
      // Split the migration into individual statements
      // This handles multiple SQL statements in one file
      const statements = content
        .split(";")
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

      // Execute each statement
      for (const statement of statements) {
        if (statement.trim()) {
          await this.sql.unsafe(statement);
        }
      }

      // Record that this migration has been applied
      const version = filename.replace(".sql", "");
      await this.sql`
        INSERT INTO schema_migrations (version)
        VALUES (${version})
        ON CONFLICT (version) DO NOTHING
      `;

      console.log(`✅ Migration ${filename} applied successfully`);
    } catch (error) {
      console.error(`❌ Migration ${filename} failed:`, error);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    console.log("🚀 Starting file-based database migrations...");

    // Ensure migrations table exists
    await this.createMigrationsTable();

    // Get applied and available migrations
    const appliedMigrations = await this.getAppliedMigrations();
    const availableMigrations = this.getAvailableMigrations();

    console.log(`📊 Migration status:`);
    console.log(`   Applied: ${appliedMigrations.length} migrations`);
    console.log(`   Available: ${availableMigrations.length} migration files`);

    // Find pending migrations
    const pendingMigrations = availableMigrations.filter((filename) => {
      const version = filename.replace(".sql", "");
      return !appliedMigrations.includes(version);
    });

    if (pendingMigrations.length === 0) {
      console.log("✅ No pending migrations - database is up to date!");
      return;
    }

    console.log(`🔄 Found ${pendingMigrations.length} pending migrations:`);
    pendingMigrations.forEach((migration) => console.log(`   - ${migration}`));

    // Apply pending migrations in order
    for (const filename of pendingMigrations) {
      const content = this.readMigrationFile(filename);
      await this.executeMigration(filename, content);
    }

    console.log("✅ All migrations completed successfully!");
    console.log("🎉 Database schema is now up to date!");
  }
}

/**
 * Main migration runner function
 */
async function runMigrations() {
  try {
    // Get the database URL from Netlify CLI
    const databaseUrl = execSync("netlify env:get NETLIFY_DATABASE_URL", {
      encoding: "utf8",
    }).trim();

    if (!databaseUrl) {
      throw new Error(
        "NETLIFY_DATABASE_URL not found. Make sure you have linked your site and the database is set up."
      );
    }

    // Create and run migration runner
    const migrationRunner = new MigrationRunner(databaseUrl);
    await migrationRunner.runMigrations();
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migrations
runMigrations();
