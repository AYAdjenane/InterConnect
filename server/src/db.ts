import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";

let db: Database<sqlite3.Database, sqlite3.Statement>;

export async function getDb() {
  if (!db) {
    const dbPath = path.join(__dirname, "../database.sqlite");
    
    // Open SQLite database
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Enable foreign keys
    await db.run("PRAGMA foreign_keys = ON;");

    // Read and run schema.sql
    let schemaPath = path.join(__dirname, "db/schema.sql");
    if (!fs.existsSync(schemaPath)) {
      // If we are in dist/ and schemaPath wasn't copied, look in src/db/schema.sql
      schemaPath = path.join(__dirname, "../src/db/schema.sql");
    }

    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, "utf8");
      // Split statements by semicolon and run them one by one
      // to avoid issues with compound statements in SQLite runs
      const statements = schemaSql
        .split(/;\s*$/m)
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const statement of statements) {
        await db.run(statement);
      }
      // Migrations for new columns on offers table if they already exist
      try {
        await db.run("ALTER TABLE offers ADD COLUMN field_of_study TEXT DEFAULT 'Computer Science';");
      } catch (e) {}
      try {
        await db.run("ALTER TABLE offers ADD COLUMN duration TEXT DEFAULT '3-6 months';");
      } catch (e) {}
      try {
        await db.run("ALTER TABLE applications ADD COLUMN cover_letter TEXT;");
      } catch (e) {}
      try {
        await db.run("ALTER TABLE applications ADD COLUMN cv_url TEXT;");
      } catch (e) {}
      console.log("Database schema initialized successfully.");
    } else {
      console.error("schema.sql not found at", schemaPath);
    }
  }
  return db;
}
