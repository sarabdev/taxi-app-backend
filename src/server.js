import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { seedAdmin } from "./seed/admin.seeder.js";

async function bootstrap() {
  await connectDB();
  await seedAdmin()
  const app = createApp();
  app.listen(env.PORT, () => console.log(`🚀 API running on :${env.PORT}`));
}

bootstrap().catch((e) => {
  console.error("Failed to start server", e);
  process.exit(1);
});
