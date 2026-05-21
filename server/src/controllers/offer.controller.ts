import { Router } from "express";
import { getDb } from "../db";
import { AuthenticatedRequest, authenticateJWT, requireRole } from "../middleware/auth.middleware";
import { calculateMatchScore } from "./profile.controller";

const offerRouter = Router();

// Helper: recalculate match scores for all students when a new offer is posted
async function recalculateAllStudentsForOffer(offerId: number, offerTitle: string, offerDesc: string) {
  const db = await getDb();
  const students = await db.all("SELECT user_id, skills FROM student_profiles");
  await db.run("BEGIN TRANSACTION;");
  try {
    for (const student of students) {
      const score = calculateMatchScore(student.skills || "", offerTitle, offerDesc);
      await db.run(
        `INSERT INTO match_scores (student_id, offer_id, score)
         VALUES (?, ?, ?)
         ON CONFLICT(student_id, offer_id) DO UPDATE SET score = excluded.score`,
        [student.user_id, offerId, score]
      );
    }
    await db.run("COMMIT;");
  } catch (err) {
    await db.run("ROLLBACK;");
    console.error("Error recalculating match scores for offer:", err);
  }
}

// GET /api/offers — List offers with optional filters and match scores
offerRouter.get("/", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { search, type, location, field_of_study, duration } = req.query as Record<string, string>;
    const db = await getDb();

    let query = `
      SELECT o.*, cp.company_name, cp.logo_url
      FROM offers o
      JOIN company_profiles cp ON cp.user_id = o.company_id
      WHERE o.status = 'Active'
    `;
    const params: string[] = [];

    if (search) {
      query += ` AND (o.title LIKE ? OR o.description LIKE ? OR cp.company_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (type) {
      const types = type.split(",").map(t => t.trim()).filter(Boolean);
      if (types.length > 0) {
        query += ` AND o.type IN (${types.map(() => "?").join(",")})`;
        params.push(...types);
      }
    }
    if (location) {
      query += ` AND o.location LIKE ?`;
      params.push(`%${location}%`);
    }
    if (field_of_study) {
      const fields = field_of_study.split(",").map(f => f.trim()).filter(Boolean);
      if (fields.length > 0) {
        query += ` AND o.field_of_study IN (${fields.map(() => "?").join(",")})`;
        params.push(...fields);
      }
    }
    if (duration) {
      const durations = duration.split(",").map(d => d.trim()).filter(Boolean);
      if (durations.length > 0) {
        query += ` AND o.duration IN (${durations.map(() => "?").join(",")})`;
        params.push(...durations);
      }
    }

    query += ` ORDER BY o.published_at DESC`;

    const offers = await db.all(query, params);

    // Attach match scores if the requester is a student
    if (req.user?.role === "student") {
      for (const offer of offers) {
        const scoreRow = await db.get(
          "SELECT score FROM match_scores WHERE student_id = ? AND offer_id = ?",
          [req.user.id, offer.id]
        );
        offer.match = scoreRow?.score ?? 50;

        // Check if saved
        const saved = await db.get(
          "SELECT id FROM saved_offers WHERE student_id = ? AND offer_id = ?",
          [req.user.id, offer.id]
        );
        offer.saved = !!saved;

        // Check if already applied
        const applied = await db.get(
          "SELECT id FROM applications WHERE student_id = ? AND offer_id = ?",
          [req.user.id, offer.id]
        );
        offer.applied = !!applied;
      }
    }

    return res.json({ success: true, data: offers, message: "Offers fetched successfully." });
  } catch (error: any) {
    console.error("Get Offers Error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

// POST /api/offers — Create a new offer (company only)
offerRouter.post("/", authenticateJWT, requireRole(["company"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { title, type, location, description, field_of_study, duration } = req.body;
    const companyId = req.user!.id;

    if (!title || !type || !location || !description) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Title, type, location, and description are required."
      });
    }

    const db = await getDb();
    const result = await db.run(
      `INSERT INTO offers (company_id, title, type, location, description, field_of_study, duration) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [companyId, title, type, location, description, field_of_study || "Computer Science", duration || "3-6 months"]
    );
    const offerId = result.lastID!;
    const offer = await db.get("SELECT * FROM offers WHERE id = ?", [offerId]);

    // Trigger async match score computation for all students
    setImmediate(() => recalculateAllStudentsForOffer(offerId, title, description));

    return res.status(201).json({ success: true, data: offer, message: "Offer created successfully." });
  } catch (error: any) {
    console.error("Create Offer Error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

// GET /api/offers/saved — Get saved offers for a student
offerRouter.get("/saved", authenticateJWT, requireRole(["student"]), async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDb();
    const savedOffers = await db.all(
      `SELECT o.*, cp.company_name, cp.logo_url, ms.score as match
       FROM saved_offers so
       JOIN offers o ON o.id = so.offer_id
       JOIN company_profiles cp ON cp.user_id = o.company_id
       LEFT JOIN match_scores ms ON ms.student_id = ? AND ms.offer_id = o.id
       WHERE so.student_id = ?`,
      [req.user!.id, req.user!.id]
    );
    for (const o of savedOffers) { o.saved = true; }
    return res.json({ success: true, data: savedOffers, message: "Saved offers fetched." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

// GET /api/offers/company — Get all offers for the logged-in company
offerRouter.get("/company", authenticateJWT, requireRole(["company"]), async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDb();
    const offers = await db.all(
      `SELECT o.*,
              (SELECT COUNT(*) FROM applications a WHERE a.offer_id = o.id) as applications
       FROM offers o
       WHERE o.company_id = ?
       ORDER BY o.published_at DESC`,
      [req.user!.id]
    );
    return res.json({ success: true, data: offers, message: "Company offers fetched." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

// GET /api/offers/:id — Get single offer detail
offerRouter.get("/:id", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    // Increment view count
    await db.run("UPDATE offers SET view_count = view_count + 1 WHERE id = ?", [id]);

    const offer = await db.get(
      `SELECT o.*, cp.company_name, cp.logo_url FROM offers o
       JOIN company_profiles cp ON cp.user_id = o.company_id
       WHERE o.id = ?`,
      [id]
    );

    if (!offer) {
      return res.status(404).json({ success: false, error: "Not Found", message: "Offer not found." });
    }

    return res.json({ success: true, data: offer, message: "Offer details fetched." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

// PUT /api/offers/:id — Update offer (company only)
offerRouter.put("/:id", authenticateJWT, requireRole(["company"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { title, type, location, description, status, field_of_study, duration } = req.body;
    const db = await getDb();

    const offer = await db.get("SELECT * FROM offers WHERE id = ? AND company_id = ?", [id, req.user!.id]);
    if (!offer) {
      return res.status(404).json({ success: false, error: "Not Found", message: "Offer not found or not owned by this company." });
    }

    await db.run(
      `UPDATE offers SET title = ?, type = ?, location = ?, description = ?, status = ?, field_of_study = ?, duration = ? WHERE id = ?`,
      [
        title ?? offer.title,
        type ?? offer.type,
        location ?? offer.location,
        description ?? offer.description,
        status ?? offer.status,
        field_of_study ?? offer.field_of_study,
        duration ?? offer.duration,
        id
      ]
    );

    const updated = await db.get("SELECT * FROM offers WHERE id = ?", [id]);
    return res.json({ success: true, data: updated, message: "Offer updated successfully." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

// DELETE /api/offers/:id — Delete offer (company only)
offerRouter.delete("/:id", authenticateJWT, requireRole(["company"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const offer = await db.get("SELECT * FROM offers WHERE id = ? AND company_id = ?", [id, req.user!.id]);
    if (!offer) {
      return res.status(404).json({ success: false, error: "Not Found", message: "Offer not found or not owned by this company." });
    }

    await db.run("DELETE FROM offers WHERE id = ?", [id]);
    return res.json({ success: true, data: null, message: "Offer deleted successfully." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

// Helper: Create a notification
async function createNotification(userId: number, message: string) {
  const db = await getDb();
  await db.run("INSERT INTO notifications (user_id, message) VALUES (?, ?)", [userId, message]);
}

// POST /api/offers/:id/apply — Student applies to an offer
offerRouter.post("/:id/apply", authenticateJWT, requireRole(["student"]), async (req: AuthenticatedRequest, res) => {
  try {
    const studentId = req.user!.id;
    const offerId = parseInt(req.params.id);
    const { cover_letter, cv_url } = req.body;
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

export default offerRouter;
