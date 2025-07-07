import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { DB } from "../controllers";

interface Request extends Express.Request {
  user?: any;
  admin?: any;
  headers?: any;
  url?: string;
}

const authorize = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    // 🔹 No Authorization header — just proceed (unauthenticated)
    if (!authHeader) {
      console.log(`[AUTH][${req.url}] No Authorization header`); // ✅ FIXED: Changed $${} to ${}
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token missing' });
    }

    // Try admin secret first
    jwt.verify(token, process.env.JWT_SECRET, async (err: any, decoded: any) => {
      if (!err && decoded) {
        const admin = await DB.Models.Admin.findById(decoded.id);
        if (!admin) {
          return res.status(401).json({ message: 'Admin not found' });
        }
        req.admin = admin;
        return next();
      }

      // Fallback to agent (user) secret
      jwt.verify(token, process.env.JWT_SECRET, async (err2: any, decoded2: any) => {
        if (err2) {
          return res.status(401).json({ message: 'Token is not valid' });
        }

        const agent = await DB.Models.Agent.findById(decoded2.id);
        if (!agent) {
          return res.status(401).json({ message: 'Agent not found' });
        }

        if (req.url !== '/onboard' && !agent.accountApproved) {
          return res.status(403).json({ message: 'Account not approved, You cannot perform this action' });
        }

        req.user = agent;
        next();
      });
    });
  } catch (error) { // ✅ ADDED: Proper error handling
    console.error('[AUTH] Error in authorization middleware:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export { authorize };

// ✅ OPTIONAL: Admin-specific middleware for stricter admin-only routes
export const authorizeAdminOnly = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token missing' });
    }

    // Only check admin secret (no fallback to agent)
    jwt.verify(token, process.env.JWT_SECRET, async (err: any, decoded: any) => {
      if (err) {
        return res.status(401).json({ message: 'Invalid admin token' });
      }

      const admin = await DB.Models.Admin.findById(decoded.id);
      if (!admin) {
        return res.status(401).json({ message: 'Admin not found' });
      }

      req.user = admin;
      return next();
    });
  } catch (error) {
    console.error('[AUTH] Error in admin-only middleware:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};