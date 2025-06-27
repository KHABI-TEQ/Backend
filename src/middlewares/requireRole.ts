import { Request, Response, NextFunction } from 'express';

interface AuthRequest extends Request {
  admin?: any;
}

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const { admin } = req;
    if (!admin) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!roles.includes(admin.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient role privileges' });
    }

    next();
  };
};
