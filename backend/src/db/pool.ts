import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

function getDatabaseConnectionString(): string {
  try {
    const databaseUrl = new URL(env.DATABASE_URL);

    // pg-connection-string treats sslmode=require strictly on newer Node/pg stacks.
    // We control TLS below so Render self-signed database certificates are accepted.
    databaseUrl.searchParams.delete("sslmode");
    databaseUrl.searchParams.delete("sslcert");
    databaseUrl.searchParams.delete("sslkey");
    databaseUrl.searchParams.delete("sslrootcert");

    return databaseUrl.toString();
  } catch {
    return env.DATABASE_URL;
  }
}

export const pool = new Pool({
  connectionString: getDatabaseConnectionString(),
  ssl:
    env.NODE_ENV === "production" || env.DATABASE_URL.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});

export async function verifyDatabaseConnection(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}
