import { app } from "./app.js";
import { env } from "./config/env.js";
import { verifyDatabaseConnection } from "./db/pool.js";

async function bootstrap(): Promise<void> {
  await verifyDatabaseConnection();

  app.listen(env.PORT, () => {
    console.log(`Backend API listening on port ${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start backend API", error);
  process.exit(1);
});
