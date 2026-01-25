import { loginSchema } from "./auth.validators.js";
import { login } from "./auth.service.js";

export async function loginController(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const result = await login(parsed.data);
  if (!result) return res.status(401).json({ message: "Invalid credentials" });

  return res.json(result);
}
