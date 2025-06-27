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

		const token = authHeader.split(" ")[1];

		if (!token) {
			return res.status(401).json({ message: "Token missing" });
		}

		// JWT_SECRET_ADMIN did not work could not verify the token so i had to use JWT_SECRET
    const user = jwt.verify(token, process.env.JWT_SECRET, async (err: any, decoded: { id: string }) => {
		if (err) {
			console.log(err);
			return res.status(401).json({ message: 'Token is not valid' });
		}

		const admin = await DB.Models.Admin.findById(decoded.id);

		if (!admin) {
			return res.status(401).json({ message: "Admin not found" });
		}

		if (!ROLES.includes(admin.role)) {
			return res.status(403).json({ message: 'Access denied' });
		}

      req.admin = admin;

      next();
    });

    // return res.status(401).json({ message: 'Not Authorized' });
  } catch (error) {
    console.log('Error exchanging code for tokens:', error.response?.data || error);
    res.status(500).json({
      success: false,
      message: 'Failed to exchange authorization code for tokens',
    });
  }
};
  