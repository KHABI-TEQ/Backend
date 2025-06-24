import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { DB } from "../controllers";

interface Request extends Express.Request {
	user?: any; // Add the user property to the Request interface
	headers?: any;
	url?: string;
}

const AuthorizeAction = (req: Request, res: Response, next: NextFunction) => {
	try {
		const authHeader = req.headers.authorization || req.headers.Authorization;

		if (!authHeader) {
		console.log(`[AUTH][$${req.url}] No Authorization header`);
		  req.user = null;
		  next();
		}

		const token = authHeader?.split(" ")[1];

		// if (!token) {
		//   req.user = null;
		//   next();
		// }

		if (token) {
			const user = jwt.verify(
				token,
				process.env.JWT_SECRET,
				async (err: any, decoded: { id: string }) => {
					if (err) {
						console.log(err);
						return res.status(401).json({ message: "Token is not valid" });
					}

					console.log("Decoded:", decoded);

					const user = await DB.Models.User.findById(decoded.id);

					if (!user) {
						return res.status(401).json({ message: "User not found" });
					}

					if (
						!user.accountApproved &&
						user.userType !== "Landowners" &&
						!req.url.includes("onboard")
					) {
						return res
							.status(403)
							.json({
								message: "Account not approved, You cannot perform this action",
							});
					}

					req.user = user;
					next();
				}
			);
		}

		if (!token) {
			req.user = null;
			next();
		}
	} catch (error) {
		console.log(
			"Error exchanging code for tokens:",
			error.response?.data || error
		);
		res.status(500).json({
			success: false,
			message: "Failed to exchange authorization code for tokens",
		});
	}
};

export default AuthorizeAction;
