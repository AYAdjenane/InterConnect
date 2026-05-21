import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getDb } from "./db";
import authRouter from "./controllers/auth.controller";
import profileRouter from "./controllers/profile.controller";
import offerRouter from "./controllers/offer.controller";
import applicationRouter from "./controllers/application.controller";
import savedRouter from "./controllers/saved.controller";
import notificationRouter from "./controllers/notification.controller";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// Routes
app.use("/api/auth", authRouter);
app.use("/api", profileRouter);
app.use("/api/offers", offerRouter);
app.use("/api/applications", applicationRouter);
app.use("/api/offers", savedRouter);
app.use("/api/notifications", notificationRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" }, message: "InternConnect API is running." });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Not Found", message: "Route not found." });
});

// Start server with DB init
async function start() {
  await getDb();
  app.listen(PORT, () => {
    console.log(`✅ InternConnect API running at http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
