import bcrypt from "bcryptjs";
import fs from "fs";
import path from "node:path";
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
  try {
    const {
      name,
      email,
      phone,
      licenseNumber,
      city,
      homeAddress,
      assignedCarId,
    } = req.body;

    /* Required validation */
    if (!name || !email || !city || !homeAddress) {
      return res.status(400).json({
        message:
          "Name, email, city and homeAddress are required",
      });
    }

    /* Upload license document */
    let licenseDocument = "";

    if (req.file) {
      licenseDocument = `/uploads/drivers/${req.file.filename}`;
    }

    /* Check existing email */
    const existing = await User.findOne({ email });

    if (existing) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    /* Optional:
       prevent same car assigned to multiple drivers
    */
    if (assignedCarId) {
      const existingDriverWithCar = await Driver.findOne({
        assignedCarId,
      });

      if (existingDriverWithCar) {
        return res.status(400).json({
          message: "This car is already assigned to another driver",
        });
      }
    }

    /* Generate temp password */
    const tempPassword = generateTempPassword();

    const passwordHash = await bcrypt.hash(
      tempPassword,
      10
    );

    /* Create auth user */
    const user = await User.create({
      email,
      passwordHash,
      role: "DRIVER",
    });

    /* Create driver profile */
    const driver = await Driver.create({
      userId: user._id,
      name,
      phone,
      city,
      homeAddress,
      assignedCarId: assignedCarId || null,
      licenseNumber,
      licenseDocument,
    });

    res.json({
      message: "Driver created",
      driver,
      credentials: {
        email,
        password: tempPassword, // show once only
      },
    });
  } catch (e) {

    res.status(500).json({
      message: e.message || "Internal Server Error",
    });
  }
}

/**
 * Update driver profile
 */
export async function updateDriver(req, res) {
  let saved = false;
  try {
    const { id } = req.params;

    const {
      name,
      phone,
      licenseNumber,
      city,
      homeAddress,
      assignedCarId,
    } = req.body || {};

    if ([name, city, homeAddress].some((value) => value !== undefined && (typeof value !== "string" || !value.trim()))) {
      return res.status(400).json({ message: "Name, city and home address cannot be blank" });
    }

    const driver = await Driver.findById(id);

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    /* Prevent duplicate car assignment */
    if (assignedCarId) {
      const existingDriverWithCar = await Driver.findOne({
        assignedCarId,
        _id: { $ne: id },
      });

      if (existingDriverWithCar) {
        return res.status(400).json({
          message: "This car is already assigned to another driver",
        });
      }
    }

    // Keep the existing file until the replacement is saved successfully.
    const oldDocument = driver.licenseDocument;
    if (req.file) driver.licenseDocument = `/uploads/drivers/${req.file.filename}`;

    /* Partial updates */
    if (name !== undefined) {
      driver.name = name;
    }

    if (phone !== undefined) {
      driver.phone = phone;
    }

    if (licenseNumber !== undefined) {
      driver.licenseNumber = licenseNumber;
    }

    if (city !== undefined) {
      driver.city = city;
    }

    if (homeAddress !== undefined) {
      driver.homeAddress = homeAddress;
    }

    if (assignedCarId !== undefined) {
      driver.assignedCarId = assignedCarId || null;
    }

    await driver.save();
    saved = true;

    if (req.file && oldDocument?.startsWith("/uploads/drivers/") && oldDocument !== driver.licenseDocument) {
      await removeDriverDocument(path.basename(oldDocument));
    }

    res.json({
      message: "Driver updated",
      driver,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: e.message || "Internal Server Error",
    });
  } finally {
    if (req.file && !saved) await removeDriverDocument(req.file.filename);
  }
}

async function removeDriverDocument(filename) {
  const directory = path.resolve("uploads/drivers");
  const target = path.resolve(directory, path.basename(filename));
  if (path.dirname(target) !== directory) return;
  try { await fs.promises.unlink(target); }
  catch (error) { if (error.code !== "ENOENT") console.error("Driver document cleanup failed:", error.message); }
}

/**
 * Activate / Deactivate driver
 */
export async function toggleDriverStatus(req, res) {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "isActive must be boolean",
      });
    }

    const driver = await Driver.findById(id);

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    driver.isActive = isActive;

    await driver.save();

    res.json({
      message: `Driver ${
        isActive ? "activated" : "deactivated"
      }`,
      driver,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: e.message || "Internal Server Error",
    });
  }
}

/**
 * Delete driver
 * Removes both Driver and linked User
 */
export async function deleteDriver(req, res) {
  try {
    const { id } = req.params;

    const driver = await Driver.findById(id);

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    /* Delete uploaded license document */
    if (driver.licenseDocument) {
      const docPath = driver.licenseDocument.replace("/", "");

      if (fs.existsSync(docPath)) {
        fs.unlinkSync(docPath);
      }
    }

    /* Delete linked auth user */
    await User.findByIdAndDelete(driver.userId);

    /* Delete driver */
    await Driver.findByIdAndDelete(id);

    res.json({
      message: "Driver deleted permanently",
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: e.message || "Internal Server Error",
    });
  }
}
