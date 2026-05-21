const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:marouaAI10%40@db.eglwbfhyddowlflqvpji.supabase.co:5432/postgres';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("🔌 Connecting to Supabase...");
  const client = await pool.connect();
  console.log("✅ Connected to Supabase.");

  console.log("📖 Reading schema_postgres.sql...");
  const sqlPath = path.join(__dirname, 'src/db/schema_postgres.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log("🚀 Executing database schema on Supabase...");
  await client.query(sql);
  console.log("🎉 Database schema initialized successfully on Supabase!");
  
  client.release();
  await pool.end();
}

main().catch(err => {
  console.error("❌ Failed to initialize database:", err);
  process.exit(1);
});
