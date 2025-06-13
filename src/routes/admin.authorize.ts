import { Response, NextFunction } from 'express';
import { DB } from '../controllers';

interface Request extends Express.Request {
  admin?: any;
}

export const authorizeAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const admin = await DB.Models.Admin.findOne({ role: 'superAdmin' });

  if (!admin) {
    return res.status(401).json({ message: 'No admin account found' });
  }

  req.admin = admin;
  next();
};
