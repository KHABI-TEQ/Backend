// utils/isReferralEligible.ts
import { IUserDoc } from "../models/user";
import { DB } from "../controllers";

export const isReferralEligible = async (user: IUserDoc): Promise<boolean> => {
  if (user.userType === "Landowners") return true;

  if (user.userType === "Agent") {
    const agent = await DB.Models.Agent.findOne({ userId: user._id });
    return agent?.agentType === "Company";
  }

  return false;
};
