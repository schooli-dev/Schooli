import { pool } from "./pool.js";
import { hashPassword } from "../utils/password.js";

const DEFAULT_ADMIN = {
  firstName: "Platform",
  lastName: "Admin",
  username: "admin",
  email: "admin@schooliedu.local",
  password: "Schooli@2025"
};

async function seedAdmin(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const passwordHash = await hashPassword(DEFAULT_ADMIN.password);
    const userResult = await client.query<{ id: string }>(
      `
        INSERT INTO users (
          first_name,
          last_name,
          username,
          email,
          password_hash,
          status,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, 'active', TRUE)
        ON CONFLICT (email) DO UPDATE
        SET first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            username = EXCLUDED.username,
            password_hash = EXCLUDED.password_hash,
            status = 'active',
            is_active = TRUE,
            updated_at = NOW()
        RETURNING id
      `,
      [
        DEFAULT_ADMIN.firstName,
        DEFAULT_ADMIN.lastName,
        DEFAULT_ADMIN.username,
        DEFAULT_ADMIN.email,
        passwordHash
      ]
    );

    const userId = userResult.rows[0]?.id;

    if (!userId) {
      throw new Error("Admin user was not created");
    }

    const roleResult = await client.query<{ id: string }>("SELECT id FROM roles WHERE name = 'admin'");
    const adminRoleId = roleResult.rows[0]?.id;

    if (!adminRoleId) {
      throw new Error("Admin role not found. Run migrations before seeding.");
    }

    await client.query(
      `
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [userId, adminRoleId]
    );

    await client.query("COMMIT");

    console.log("Default admin user ready: admin");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

seedAdmin()
  .catch((error) => {
    console.error("Admin seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
