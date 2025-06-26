import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { DB } from "../controllers";

interface Request extends Express.Request {
	user?: any; // Add the user property to the Request interface
	headers?: any;
	url?: string;
	admin?: any; // Add the admin property to the Request interface
}

const ROLES = ["superAdmin", "admin"];

export const authorizeAdmin = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const authHeader = req.headers.authorization || req.headers.Authorization;

		if (!authHeader) {
			return res.status(401).json({ message: "Authorization header missing" });
		}

		console.log(authHeader);
		const token = authHeader.split(" ")[1];

		if (!token) {
			return res.status(401).json({ message: "Token missing" });
		}

		jwt.verify(
			token,
			process.env.JWT_SECRET_ADMIN,
			async (err: any, decoded: { id: string }) => {
				if (err) {
					console.log(err);
					return res.status(401).json({ message: "Token is not valid" });
				}
    jwt.verify(token, process.env.JWT_SECRET, async (err: any, decoded: any) => {
      if (err) {
        return res.status(401).json({ message: 'Token is not valid' });
      }

				console.log("Decoded:", decoded);
      if (!decoded.isAdmin) {
        return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
      }

				const admin = await DB.Models.Admin.findById(decoded.id);

				if (!admin) {
					return res.status(401).json({ message: "Admin not found" });
				}

      if (!ROLES.includes(admin.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (!admin.isAccountVerified) {
        return res.status(403).json({ message: 'Admin account not verified' });
      }

      req.admin = admin;
      next();
    });
  } catch (error) {
    console.log('Error in admin authorization:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during authorization',
    });
  }
};
