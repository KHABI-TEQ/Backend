import { Request, Response, NextFunction } from "express";
import { DB } from "..";
import { generateToken, RouteError } from "../../common/classes";
import HttpStatusCodes from "../../common/HttpStatusCodes";

const sendLoginSuccessResponse = async (user: any, res: Response) => {

    const token = generateToken({
        id: user._id,
        email: user.email,
        userType: user.userType,
    });

    const userResponse = {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        userType: user.userType,
        isAccountVerified: user.isAccountVerified,
        accountApproved: user.accountApproved,
        isAccountInRecovery: user.isAccountInRecovery,
        address: user.address,
        profile_picture: user.profile_picture,
        isInActive: user.isInActive,
        isDeleted: user.isDeleted,
        accountStatus: user.accountStatus,
        isFlagged: user.isFlagged,
        accountId: user.accountId,
    };

    if (user.userType === 'Agent') {
        const agentData = await DB.Models.Agent.findOne({ userId: user._id });
        return res.status(HttpStatusCodes.OK).json({
            message: 'Email verified successfully!',
            token,
            user: userResponse,
            agentData,
            isAccountApproved: user.accountApproved,
        });
    }

    return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: 'Email verified successfully!',
        token,
        user: userResponse,
    });
};

export const verifyAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== "string") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Token is missing or invalid.");
    }

    const tokenDoc = await DB.Models.VerificationToken.findOne({ token }).exec();
    if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Token has expired or is invalid.");
    }

    const user = await DB.Models.User.findById(tokenDoc.userId);
    if (!user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found.");
    }

    if (user.isAccountVerified) {
        await DB.Models.VerificationToken.deleteOne({ _id: tokenDoc._id });
      return res.status(HttpStatusCodes.OK).json({ message: "Account already verified. please login" });
    }

    user.isAccountVerified = true;
    user.accountStatus = "active";
    await user.save();

    await DB.Models.VerificationToken.deleteOne({ _id: tokenDoc._id });
 
    await sendLoginSuccessResponse(user, res);

  } catch (err: any) {
    console.error("Verification Error:", err.message);
    next(err);
  }
};
