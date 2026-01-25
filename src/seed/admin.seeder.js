import bcrypt from "bcryptjs";
import { User } from "../modules/users/user.model.js";

export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn("⚠️ Admin seeder skipped (missing env vars)");
    return;
  }

  const existing = await User.findOne({ email });

  if (existing) {
    console.log("✅ Admin already exists");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await User.create({
    email,
    passwordHash,
    role: "ADMIN",
  });

  console.log("🚀 Admin account created:", email);
}
