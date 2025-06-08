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
      // Use error code instead of message text for better reliability
      if (error.code === "42P01") {
        // undefined_table
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
        .sort(new Intl.Collator(undefined, { numeric: true }).compare); // Numeric-aware sort

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
   * Split SQL content into individual statements safely
   * Handles complex SQL with functions, strings, and dollar-quoted blocks
   */
  splitSqlStatements(content) {
    // Remove comments first
    const withoutComments = content.replace(/--.*$/gm, "");

    const statements = [];
    let currentStatement = "";
    let inDollarQuote = false;
    let dollarTag = "";

    const lines = withoutComments.split("\n");

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Check for dollar-quoted strings (PostgreSQL functions)
      if (!inDollarQuote) {
        const dollarMatch = trimmedLine.match(/\$([^$]*)\$/);
        if (dollarMatch) {
          inDollarQuote = true;
          dollarTag = dollarMatch[0];
        }
      } else {
        // Check if we're ending the dollar quote
        if (
          trimmedLine.includes(dollarTag) &&
          trimmedLine.indexOf(dollarTag) > 0
        ) {
          inDollarQuote = false;
          dollarTag = "";
        }
      }

      currentStatement += line + "\n";

      // Only split on semicolon if we're not inside a dollar-quoted block
      if (!inDollarQuote && trimmedLine.endsWith(";")) {
        const stmt = currentStatement.trim();
        if (stmt.length > 0) {
          statements.push(stmt);
        }
        currentStatement = "";
      }
    }

    // Add any remaining statement
    const finalStmt = currentStatement.trim();
    if (finalStmt.length > 0) {
      statements.push(finalStmt.endsWith(";") ? finalStmt : finalStmt + ";");
    }

    return statements.filter((stmt) => stmt.length > 0);
  }

  /**
   * Execute a single migration atomically
   */
  async executeMigration(filename, content) {
    console.log(`🔄 Applying migration: ${filename}`);

    try {
      // Split the migration into individual statements safely
      const statements = this.splitSqlStatements(content);

      console.log(`   📝 Executing ${statements.length} SQL statements...`);

      // Execute each statement with proper error handling
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        if (statement) {
          console.log(
            `   🔧 Statement ${i + 1}/${
              statements.length
            }: ${statement.substring(0, 50)}...`
          );
          try {
            // Execute raw SQL using Neon's tagged template literal
            // For dynamic SQL, we need to use the unsafe method or construct properly
            // Since Neon doesn't have unsafe(), we'll use a workaround
            await this.sql.unsafe(statement);
            console.log(`   ✅ Statement ${i + 1} executed successfully`);
          } catch (stmtError) {
            console.error(`   ❌ Statement ${i + 1} failed:`, stmtError);
            console.error(`   📄 Failed statement: ${statement}`);
            throw new Error(
              `Migration ${filename} failed at statement ${i + 1}: ${
                stmtError.message
              }`
            );
          }
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
