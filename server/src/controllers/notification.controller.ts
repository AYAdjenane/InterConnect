import { Router } from "express";
import { getDb } from "../db";
import { AuthenticatedRequest, authenticateJWT } from "../middleware/auth.middleware";

const notificationRouter = Router();

// GET /api/notifications — Get all notifications for logged-in user
notificationRouter.get("/", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDb();
    const notifications = await db.all(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      [req.user!.id]
    );
    const unreadCount = notifications.filter((n: any) => !n.read).length;
    return res.json({ success: true, data: { notifications, unreadCount }, message: "Notifications fetched." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

// PUT /api/notifications/:id/read — Mark single notification as read
notificationRouter.put("/:id/read", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDb();
    await db.run(
      "UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?",
      [req.params.id, req.user!.id]
    );
    return res.json({ success: true, data: null, message: "Notification marked as read." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

// PUT /api/notifications/read-all — Mark all notifications as read
notificationRouter.put("/read-all", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDb();
    await db.run("UPDATE notifications SET read = 1 WHERE user_id = ?", [req.user!.id]);
    return res.json({ success: true, data: null, message: "All notifications marked as read." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

// DELETE /api/notifications/:id — Delete single notification
notificationRouter.delete("/:id", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDb();
    await db.run(
      "DELETE FROM notifications WHERE id = ? AND user_id = ?",
      [req.params.id, req.user!.id]
    );
    return res.json({ success: true, data: null, message: "Notification deleted." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

// DELETE /api/notifications — Clear all notifications for user
notificationRouter.delete("/", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDb();
    await db.run("DELETE FROM notifications WHERE user_id = ?", [req.user!.id]);
    return res.json({ success: true, data: null, message: "All notifications cleared." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
  }
});

export default notificationRouter;
