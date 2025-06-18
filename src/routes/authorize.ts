import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { DB } from "../controllers";

interface Request extends Express.Request {
	user?: any; // Add the user property to the Request interface
	headers?: any;
	url?: string;
}

const authorize = (req: Request, res: Response, next: NextFunction) => {
	try {
		const authHeader = req.headers.authorization || req.headers.Authorization;
		if (!authHeader) {
			return res.status(401).json({ message: "Authorization header missing" });
		}

		const token = authHeader.split(" ")[1];

		if (!token) {
			return res.status(401).json({ message: "Token missing" });
		}

		const user = jwt.verify(
			token,
			process.env.JWT_SECRET,
			async (err: any, decoded: { id: string }) => {
				if (err) {
					console.log(err);
					return res.status(401).json({ message: "Token is not valid" });
				}

				console.log("Decoded:", decoded);

				const agent = await DB.Models.Agent.findById(decoded.id);

				if (!agent) {
					return res.status(401).json({ message: "Agent not found" });
				}

				if (req.url !== "/onboard" && !agent.accountApproved) {
					return res
						.status(403)
						.json({
							message: "Account not approved, You cannot perform this action",
						});
				}

				req.user = agent;
				next();
			}
		);

		// return res.status(401).json({ message: 'Not Authorized' });
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

export default authorize;
