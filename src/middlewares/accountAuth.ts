import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { DB } from "../controllers";
import { AppRequest } from "../types/express";

const accountAuth = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const rawAuthHeader = req.headers.authorization || req.headers.Authorization;

    if (!rawAuthHeader || typeof rawAuthHeader !== "string") {
      req.user = null;
      return next();
    }

    const token = rawAuthHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Token missing" });
    }

    // 🔐 Verify token
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    } catch (err) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // 🧑‍💼 Fetch user (could be Admin, Agent, Regular User, etc.)
    const user = await DB.Models.User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // 🛑 If user is an Agent, check approval
    if (user.userType === "Agent") {
      const agent = await DB.Models.Agent.findOne({ userId: user._id });
      if (!agent) {
        return res.status(403).json({ message: "Agent profile not found" });
      }

      if (!agent.accountApproved && req.url !== "/onboard") {
        return res.status(403).json({
          message: "Account not approved. You cannot perform this action.",
        });
      }
    }

    req.user = user; 

    return next();
  } catch (error) {
    console.error("[AUTH] Error in accountAuth middleware:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export { accountAuth };
