import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
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
const allowedOrigins = ["http://localhost:5173", process.env.FRONTEND_URL].filter(Boolean) as string[];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
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

// Serve static frontend in production if built
const frontendDistPath = path.join(__dirname, "../../dist");
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  
  // Catch-all route to serve the SPA (since it's a single page app)
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

// 404 handler for API routes (or when frontend build isn't present)
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Not Found", message: "Route not found." });
});

// Start server with DB init (only if not running inside Vercel serverless environment)
async function start() {
  await getDb();
  app.listen(PORT, () => {
    console.log(`✅ InternConnect API running at http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

export default app;

