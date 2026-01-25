import bcrypt from "bcryptjs";
import { User } from "../users/user.model.js";
import { Driver } from "./driver.model.js";

/**
 * Generate temporary password
 */
function generateTempPassword() {
  return Math.random().toString(36).slice(-8);
}

/**
 * Create driver
 */
export async function createDriver(req, res) {
  const { name, email, phone, licenseNumber } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: "Name and email required" });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(400).json({ message: "Email already exists" });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const user = await User.create({
    email,
    passwordHash,
    role: "DRIVER",
  });

  const driver = await Driver.create({
    userId: user._id,
    name,
    phone,
    licenseNumber,
  });

  res.json({
    message: "Driver created",
    driver,
    credentials: {
      email,
      password: tempPassword, // show ONCE
    },
  });
}

/**
 * Update driver profile
 */
export async function updateDriver(req, res) {
  const { id } = req.params;
  const { name, phone, licenseNumber } = req.body;

  const driver = await Driver.findById(id);
  if (!driver) {
    return res.status(404).json({ message: "Driver not found" });
  }

  if (name !== undefined) driver.name = name;
  if (phone !== undefined) driver.phone = phone;
  if (licenseNumber !== undefined) driver.licenseNumber = licenseNumber;

  await driver.save();

  res.json({
    message: "Driver updated",
    driver,
  });
}

/**
 * Activate / Deactivate driver (soft disable)
 */
export async function toggleDriverStatus(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  if (typeof isActive !== "boolean") {
    return res.status(400).json({
      message: "isActive must be boolean",
    });
  }

  const driver = await Driver.findById(id);
  if (!driver) {
    return res.status(404).json({ message: "Driver not found" });
  }

  driver.isActive = isActive;
  await driver.save();

  res.json({
    message: `Driver ${isActive ? "activated" : "deactivated"}`,
    driver,
  });
}

/**
 * Delete driver (hard delete)
 * ⚠ Removes both Driver and linked User
 */
export async function deleteDriver(req, res) {
  const { id } = req.params;

  const driver = await Driver.findById(id);
  if (!driver) {
    return res.status(404).json({ message: "Driver not found" });
  }

  await User.findByIdAndDelete(driver.userId);
  await Driver.findByIdAndDelete(id);

  res.json({
    message: "Driver deleted permanently",
  });
}
