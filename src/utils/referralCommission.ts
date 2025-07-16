import { DB } from "../controllers";
import { IUserDoc } from "../models/user";

interface CommissionPayload {
  referrer: IUserDoc;
  referredUserId: string;
  type: 'landlord_referral' | 'agent_referral';
  amount?: number; 
  note?: string;
}

export const createReferralCommission = async ({
  referrer,
  referredUserId,
  type,
  amount = 5000,
  note = '',
}: CommissionPayload) => {
  const commission = await DB.Models.ReferralCommission.create({
    referrer: referrer._id,
    referredUser: referredUserId,
    type,
    amount,
    note,
  });

  return commission;
};