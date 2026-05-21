import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "internconnect_secret_key_2026_dev";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: "student" | "company";
  };
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "Invalid or expired authentication token."
        });
      }
      
      req.user = decoded as { id: number; email: string; role: "student" | "company" };
      next();
    });
  } else {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Authentication token is missing or malformed."
    });
  }
}

export function requireRole(roles: Array<"student" | "company">) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "User is not authenticated."
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: `Role '${req.user.role}' is not authorized to access this resource.`
      });
    }

    next();
  };
}
