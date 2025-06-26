import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { DB } from "../controllers";

interface Request extends Express.Request {
  user?: any;
  headers?: any;
  url?: string;
}

export default function authorize(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token missing' });
  }

  // Try admin secret first
  jwt.verify(token, process.env.JWT_SECRET_ADMIN, async (err: any, decoded: any) => {
    if (!err && decoded) {
      const admin = await DB.Models.Admin.findById(decoded.id);
      if (!admin) {
        return res.status(401).json({ message: 'Admin not found' });
      }
      req.user = admin;
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
}
