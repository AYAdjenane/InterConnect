import { Router } from "express";
import { getDb } from "../db";
import { AuthenticatedRequest, authenticateJWT, requireRole } from "../middleware/auth.middleware";

const savedRouter = Router();

// POST /api/offers/:id/save — Toggle save/unsave an offer
savedRouter.post("/:id/save", authenticateJWT, requireRole(["student"]), async (req: AuthenticatedRequest, res) => {
  try {
    const studentId = req.user!.id;
    const offerId = parseInt(req.params.id);
    const db = await getDb();

    const offer = await db.get("SELECT id FROM offers WHERE id = ?", [offerId]);
    if (!offer) {
      return res.status(404).json({ success: false, error: "Not Found", message: "Offer not found." });
    }

    const existing = await db.get(
      "SELECT id FROM saved_offers WHERE student_id = ? AND offer_id = ?",
      [studentId, offerId]
    );

    if (existing) {
      await db.run("DELETE FROM saved_offers WHERE student_id = ? AND offer_id = ?", [studentId, offerId]);
      return res.json({ success: true, data: { saved: false }, message: "Offer removed from saved list." });
    } else {
      await db.run("INSERT INTO saved_offers (student_id, offer_id) VALUES (?, ?)", [studentId, offerId]);
      return res.json({ success: true, data: { saved: true }, message: "Offer saved successfully." });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

export default savedRouter;
