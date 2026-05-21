import { Router } from "express";
import { getDb } from "../db";
import { AuthenticatedRequest, authenticateJWT, requireRole } from "../middleware/auth.middleware";

const applicationRouter = Router();

// Helper: Create a notification
async function createNotification(userId: number, message: string) {
  const db = await getDb();
  await db.run("INSERT INTO notifications (user_id, message) VALUES (?, ?)", [userId, message]);
}

// POST /api/offers/:id/apply — Student applies to an offer
applicationRouter.post("/:id/apply", authenticateJWT, requireRole(["student"]), async (req: AuthenticatedRequest, res) => {
  try {
    const studentId = req.user!.id;
    const offerId = parseInt(req.params.id);
    const { cover_letter, cv_url } = req.body || {};
    const db = await getDb();

    // Check offer exists
    const offer = await db.get(
      `SELECT o.*, cp.user_id as company_user_id, cp.company_name FROM offers o
       JOIN company_profiles cp ON cp.user_id = o.company_id
       WHERE o.id = ? AND o.status = 'Active'`,
      [offerId]
    );
    if (!offer) {
      return res.status(404).json({ success: false, error: "Not Found", message: "Offer not found or no longer active." });
    }

    // Get student name
    const studentProfile = await db.get("SELECT full_name FROM student_profiles WHERE user_id = ?", [studentId]);

    // Check for duplicate application
    const existing = await db.get(
      "SELECT id FROM applications WHERE student_id = ? AND offer_id = ?",
      [studentId, offerId]
    );
    if (existing) {
      return res.status(409).json({ success: false, error: "Conflict", message: "You have already applied to this offer." });
    }

    // Insert application
    const result = await db.run(
      "INSERT INTO applications (student_id, offer_id, status, cover_letter, cv_url) VALUES (?, ?, 'Under Review', ?, ?)",
      [studentId, offerId, cover_letter || null, cv_url || null]
    );

    const application = await db.get("SELECT * FROM applications WHERE id = ?", [result.lastID]);

    // Notify student
    await createNotification(studentId, `Your application to "${offer.title}" at ${offer.company_name} has been received and is under review.`);

    // Notify company
    await createNotification(offer.company_user_id, `New application received for "${offer.title}" from ${studentProfile?.full_name || "a student"}.`);

    return res.status(201).json({ success: true, data: application, message: "Application submitted successfully." });
  } catch (error: any) {
    console.error("Apply Error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

// GET /api/applications/student — Get all of a student's applications
applicationRouter.get("/student", authenticateJWT, requireRole(["student"]), async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDb();
    const applications = await db.all(
      `SELECT a.*, o.title, o.type, o.location, o.company_id, cp.company_name
       FROM applications a
       JOIN offers o ON o.id = a.offer_id
       JOIN company_profiles cp ON cp.user_id = o.company_id
       WHERE a.student_id = ?
       ORDER BY a.applied_at DESC`,
      [req.user!.id]
    );
    return res.json({ success: true, data: applications, message: "Student applications fetched." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

// GET /api/applications/company — Get all candidates for a company's offers
applicationRouter.get("/company", authenticateJWT, requireRole(["company"]), async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDb();
    const applications = await db.all(
      `SELECT a.id as application_id, a.status, a.applied_at, a.cover_letter, a.cv_url,
              o.title as offer_title, o.type, o.location,
              sp.full_name, sp.university, sp.skills, sp.bio,
              COALESCE(ms.score, 50) as match
       FROM applications a
       JOIN offers o ON o.id = a.offer_id
       JOIN student_profiles sp ON sp.user_id = a.student_id
       LEFT JOIN match_scores ms ON ms.student_id = a.student_id AND ms.offer_id = a.offer_id
       WHERE o.company_id = ?
       ORDER BY a.applied_at DESC`,
      [req.user!.id]
    );
    return res.json({ success: true, data: applications, message: "Company applications fetched." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

// GET /api/applications/company/:offerId — Get candidates for a specific offer
applicationRouter.get("/company/:offerId", authenticateJWT, requireRole(["company"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { offerId } = req.params;
    const db = await getDb();

    const offer = await db.get("SELECT * FROM offers WHERE id = ? AND company_id = ?", [offerId, req.user!.id]);
    if (!offer) {
      return res.status(404).json({ success: false, error: "Not Found", message: "Offer not found." });
    }

    const candidates = await db.all(
      `SELECT a.id as application_id, a.status, a.applied_at,
              sp.full_name, sp.university, sp.skills, sp.bio, sp.user_id as student_id,
              COALESCE(ms.score, 50) as match
       FROM applications a
       JOIN student_profiles sp ON sp.user_id = a.student_id
       LEFT JOIN match_scores ms ON ms.student_id = a.student_id AND ms.offer_id = a.offer_id
       WHERE a.offer_id = ?
       ORDER BY match DESC`,
      [offerId]
    );
    return res.json({ success: true, data: candidates, message: "Candidates fetched." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

// PUT /api/applications/:id/status — Company updates application status
applicationRouter.put("/:id/status", authenticateJWT, requireRole(["company"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ["Under Review", "Interview", "Viewed", "Rejected", "Accepted"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: "Bad Request", message: "Invalid application status." });
    }

    const db = await getDb();

    // Verify the company owns this application's offer
    const application = await db.get(
      `SELECT a.*, o.title, o.company_id, sp.user_id as student_user_id, sp.full_name
       FROM applications a
       JOIN offers o ON o.id = a.offer_id
       JOIN student_profiles sp ON sp.user_id = a.student_id
       WHERE a.id = ?`,
      [id]
    );

    if (!application || application.company_id !== req.user!.id) {
      return res.status(404).json({ success: false, error: "Not Found", message: "Application not found or not authorized." });
    }

    await db.run("UPDATE applications SET status = ? WHERE id = ?", [status, id]);

    // Notify student of status change
    await createNotification(
      application.student_user_id,
      `Your application for "${application.title}" has been updated to: ${status}.`
    );

    const updated = await db.get("SELECT * FROM applications WHERE id = ?", [id]);
    return res.json({ success: true, data: updated, message: "Application status updated successfully." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

export default applicationRouter;
