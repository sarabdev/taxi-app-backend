import bcrypt from "bcryptjs";
import { connectDB } from "../config/db.js";
import { User } from "../modules/users/user.model.js";

async function run() {
  await connectDB();

  const email = "admin@taxi.com";
  const password = "Admin@123";

  const exists = await User.findOne({ email });
  if (exists) {
    console.log("Admin already exists");
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({ email, passwordHash, role: "ADMIN" });

  console.log("✅ Admin created:", { email, password });
  process.exit(0);
}

run();
