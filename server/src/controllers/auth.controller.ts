import { Response, Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "../db";
import { AuthenticatedRequest, authenticateJWT } from "../middleware/auth.middleware";

const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || "internconnect_secret_key_2026_dev";

// Register Route
authRouter.post("/register", async (req, res) => {
  try {
    const { email, password, role, fullName, companyName } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Email, password, and role are required."
      });
    }

    if (role !== "student" && role !== "company") {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Role must be either 'student' or 'company'."
      });
    }

    if (role === "student" && !fullName) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Full name is required for student registration."
      });
    }

    if (role === "company" && !companyName) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Company name is required for company registration."
      });
    }

    const db = await getDb();

    // Check if user already exists
    const existingUser = await db.get("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "Conflict",
        message: "An account with this email address already exists."
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user (transactions make sure both user and profile are created)
    await db.run("BEGIN TRANSACTION;");

    try {
      const userResult = await db.run(
        "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
        [email, hashedPassword, role]
      );
      const userId = userResult.lastID;

      if (role === "student") {
        await db.run(
          "INSERT INTO student_profiles (user_id, full_name, profile_strength, skills) VALUES (?, ?, ?, ?)",
          [userId, fullName, 20, ""]
        );
      } else {
        await db.run(
          "INSERT INTO company_profiles (user_id, company_name, contact_email) VALUES (?, ?, ?)",
          [userId, companyName, email]
        );
      }

      await db.run("COMMIT;");

      // Generate JWT
      const token = jwt.sign({ id: userId, email, role }, JWT_SECRET, { expiresIn: "7d" });

      return res.status(201).json({
        success: true,
        data: {
          token,
          user: { id: userId, email, role }
        },
        message: "Registration successful."
      });

    } catch (err) {
      await db.run("ROLLBACK;");
      throw err;
    }

  } catch (error: any) {
    console.error("Register Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: error.message || "An unexpected error occurred during registration."
    });
  }
});

// Login Route
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Email and password are required."
      });
    }

    const db = await getDb();

    // Fetch user
    const user = await db.get("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Invalid email or password."
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Invalid email or password."
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, role: user.role }
      },
      message: "Login successful."
    });

  } catch (error: any) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: error.message || "An unexpected error occurred during login."
    });
  }
});

// Get Current User (Me) Route
authRouter.get("/me", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const db = await getDb();

    let profile = null;
    if (user.role === "student") {
      profile = await db.get("SELECT * FROM student_profiles WHERE user_id = ?", [user.id]);
    } else {
      profile = await db.get("SELECT * FROM company_profiles WHERE user_id = ?", [user.id]);
    }

    return res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, role: user.role },
        profile
      },
      message: "Current user profile fetched successfully."
    });

  } catch (error: any) {
    console.error("Get Current User Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: error.message || "An unexpected error occurred fetching current user."
    });
  }
});

export default authRouter;
