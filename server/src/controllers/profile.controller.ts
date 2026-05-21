import { Router } from "express";
import { getDb } from "../db";
import { AuthenticatedRequest, authenticateJWT, requireRole } from "../middleware/auth.middleware";

const profileRouter = Router();

// Helper to calculate score between student skills and an offer
export function calculateMatchScore(skillsString: string, offerTitle: string, offerDesc: string): number {
  if (!skillsString) return 50;
  const skills = skillsString.split(",").map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
  if (skills.length === 0) return 50;

  let matches = 0;
  const content = `${offerTitle} ${offerDesc}`.toLowerCase();

  for (const skill of skills) {
    if (content.includes(skill)) {
      matches++;
    }
  }

  // Base 50% + 10% per matching skill, capped at 100%
  const score = 50 + (matches * 10);
  return Math.min(score, 100);
}

// Helper to recalculate match scores for a student across all offers
export async function recalculateStudentMatchScores(studentId: number, skillsString: string) {
  const db = await getDb();
  
  // Get all active offers
  const offers = await db.all("SELECT id, title, description FROM offers WHERE status = 'Active'");
  
  await db.run("BEGIN TRANSACTION;");
  try {
    // Clear old scores for this student
    await db.run("DELETE FROM match_scores WHERE student_id = ?", [studentId]);
    
    // Calculate and insert new scores
    for (const offer of offers) {
      const score = calculateMatchScore(skillsString, offer.title, offer.description);
      await db.run(
        "INSERT INTO match_scores (student_id, offer_id, score) VALUES (?, ?, ?)",
        [studentId, offer.id, score]
      );
    }
    await db.run("COMMIT;");
  } catch (err) {
    await db.run("ROLLBACK;");
    console.error("Error recalculating student match scores:", err);
  }
}

// PUT /api/student/profile - Update Student Profile
profileRouter.put("/student/profile", authenticateJWT, requireRole(["student"]), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { fullName, phone, university, bio, skills, avatarUrl } = req.body;

    if (!fullName) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Full name is required."
      });
    }

    const db = await getDb();

    // Calculate profile strength
    let strength = 20; // Starts at 20 for full name
    if (phone && phone.trim().length > 0) strength += 20;
    if (university && university.trim().length > 0) strength += 20;
    if (bio && bio.trim().length > 0) strength += 20;
    if (skills && skills.trim().length > 0) strength += 20;

    // Update DB
    await db.run(
      `UPDATE student_profiles 
       SET full_name = ?, phone = ?, university = ?, bio = ?, profile_strength = ?, skills = ?, avatar_url = ?
       WHERE user_id = ?`,
      [fullName, phone || "", university || "", bio || "", strength, skills || "", avatarUrl || "", userId]
    );

    // Fetch the updated student profile
    const profile = await db.get("SELECT * FROM student_profiles WHERE user_id = ?", [userId]);

    // Recalculate match scores before sending response
    await recalculateStudentMatchScores(userId, skills || "");

    return res.json({
      success: true,
      data: profile,
      message: "Profile updated successfully."
    });

  } catch (error: any) {
    console.error("Update Student Profile Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: error.message || "An unexpected error occurred updating profile."
    });
  }
});

// GET /api/student/dashboard - Get Student Dashboard Stats
profileRouter.get("/student/dashboard", authenticateJWT, requireRole(["student"]), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const db = await getDb();

    // Counts from database
    const applicationsCount = await db.get(
      "SELECT COUNT(*) as count FROM applications WHERE student_id = ?",
      [userId]
    );
    const savedCount = await db.get(
      "SELECT COUNT(*) as count FROM saved_offers WHERE student_id = ?",
      [userId]
    );
    const unreadNotificationsCount = await db.get(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0",
      [userId]
    );
    const profile = await db.get(
      "SELECT profile_strength FROM student_profiles WHERE user_id = ?",
      [userId]
    );

    return res.json({
      success: true,
      data: {
        applications: applicationsCount?.count || 0,
        saved: savedCount?.count || 0,
        messages: unreadNotificationsCount?.count || 0,
        views: 248, // Visual mockup placeholder or standard constant
        profileStrength: profile?.profile_strength || 20
      },
      message: "Dashboard statistics retrieved successfully."
    });

  } catch (error: any) {
    console.error("Student Dashboard Stats Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: error.message || "An unexpected error occurred fetching dashboard statistics."
    });
  }
});

// PUT /api/company/profile - Update Company Profile
profileRouter.put("/company/profile", authenticateJWT, requireRole(["company"]), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { companyName, description, fieldOfActivity, address, website, contactEmail, logoUrl } = req.body;

    if (!companyName) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Company name is required."
      });
    }

    const db = await getDb();

    // Update database
    await db.run(
      `UPDATE company_profiles 
       SET company_name = ?, description = ?, field_of_activity = ?, address = ?, website = ?, contact_email = ?, logo_url = ?
       WHERE user_id = ?`,
      [
        companyName,
        description || "",
        fieldOfActivity || "",
        address || "",
        website || "",
        contactEmail || "",
        logoUrl || "",
        userId
      ]
    );

    // Fetch the updated profile
    const profile = await db.get("SELECT * FROM company_profiles WHERE user_id = ?", [userId]);

    return res.json({
      success: true,
      data: profile,
      message: "Company profile updated successfully."
    });

  } catch (error: any) {
    console.error("Update Company Profile Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: error.message || "An unexpected error occurred updating company profile."
    });
  }
});

export default profileRouter;
