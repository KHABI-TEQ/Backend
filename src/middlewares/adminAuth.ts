import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { DB } from '../controllers';
import { IAdminDoc } from '../models/admin';

interface AdminRequest extends Express.Request {
  admin?: IAdminDoc;
  headers?: any;
  url?: string;
}

export const adminAuth = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;

    if (!authHeader || typeof authHeader !== 'string') {
      return res.status(401).json({ message: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token not provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };

    const admin = await DB.Models.Admin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({ message: 'Admin not found or invalid token' });
    }

    req.admin = admin;
    next();
  } catch (error: any) {
    console.error('[adminAuth] Error:', error.message);
    return res.status(401).json({ message: 'Unauthorized access' });
  }
};
