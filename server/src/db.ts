import pg from "pg";
import path from "path";
import fs from "fs";

export interface DatabaseInterface {
  get(sql: string, params?: any[]): Promise<any>;
  all(sql: string, params?: any[]): Promise<any[]>;
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
}

let dbInstance: DatabaseInterface | null = null;
let pgPool: pg.Pool | null = null;

class PostgresDatabase implements DatabaseInterface {
  private pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  private convertQuery(sql: string, params: any[]): { sql: string; params: any[] } {
    let index = 1;
    // 1. Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
    let pgSql = sql.replace(/\?/g, () => `$${index++}`).trim();

    // 2. Strip trailing semicolon if exists, to append RETURNING id properly
    if (pgSql.endsWith(";")) {
      pgSql = pgSql.slice(0, -1);
    }

    // 3. For INSERT statements, append RETURNING id so we can mock sqlite's lastID
    const upperSql = pgSql.toUpperCase();
    if (upperSql.startsWith("INSERT INTO") && !upperSql.includes("RETURNING")) {
      pgSql += " RETURNING id";
    }

    return { sql: pgSql, params };
  }

  async get(sql: string, params: any[] = []): Promise<any> {
    const { sql: pgSql, params: pgParams } = this.convertQuery(sql, params);
    const res = await this.pool.query(pgSql, pgParams);
    return res.rows[0] || null;
  }

  async all(sql: string, params: any[] = []): Promise<any[]> {
    const { sql: pgSql, params: pgParams } = this.convertQuery(sql, params);
    const res = await this.pool.query(pgSql, pgParams);
    return res.rows;
  }

  async run(sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
    const trimmed = sql.trim();
    const upperSql = trimmed.toUpperCase();

    // Intercept and ignore SQLite-specific PRAGMA commands
    if (upperSql.startsWith("PRAGMA ")) {
      return { changes: 0 };
    }

    const { sql: pgSql, params: pgParams } = this.convertQuery(sql, params);
    const res = await this.pool.query(pgSql, pgParams);

    let lastID: number | undefined;
    if (res.rows && res.rows.length > 0 && res.rows[0].id !== undefined) {
      lastID = Number(res.rows[0].id);
    }

    return {
      lastID,
      changes: res.rowCount || 0
    };
  }
}

export async function getDb(): Promise<DatabaseInterface> {
  if (dbInstance) return dbInstance;

  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    console.log("🔌 Connecting to Supabase PostgreSQL database...");
    if (!pgPool) {
      pgPool = new pg.Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false } // Required for Supabase cloud hosting
      });
    }
    dbInstance = new PostgresDatabase(pgPool);
    console.log("✅ Connected to Supabase PostgreSQL.");
  } else {
    console.log("💾 No DATABASE_URL found. Falling back to local SQLite database...");
    
    // Dynamically import SQLite libraries to avoid Vercel build binary issues
    const { open } = await import("sqlite");
    const sqlite3 = await import("sqlite3");

    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "../database.sqlite");
    const sqliteDb = await open({
      filename: dbPath,
      driver: sqlite3.default.Database
    });

    await sqliteDb.run("PRAGMA foreign_keys = ON;");

    // Wrap SQLite instance to conform perfectly to DatabaseInterface
    dbInstance = {
      async get(sql: string, params: any[] = []): Promise<any> {
        return sqliteDb.get(sql, params);
      },
      async all(sql: string, params: any[] = []): Promise<any[]> {
        return sqliteDb.all(sql, params);
      },
      async run(sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
        const res = await sqliteDb.run(sql, params);
        return {
          lastID: res.lastID,
          changes: res.changes
        };
      }
    };

    console.log("✅ Connected to local SQLite database.");
  }

  return dbInstance;
}
