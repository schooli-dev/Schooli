import { pool } from "./pool.js";

async function status(): Promise<void> {
  const tables = await pool.query<{ table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
  );

  const migrations = await pool.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations ORDER BY filename"
  );

  console.log(
    JSON.stringify(
      {
        tableCount: tables.rows.length,
        tables: tables.rows.map((row) => row.table_name),
        migrations: migrations.rows.map((row) => row.filename)
      },
      null,
      2
    )
  );
}

status()
  .catch((error) => {
    console.error("Database status check failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
