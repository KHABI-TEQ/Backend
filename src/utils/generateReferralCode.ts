import { generateReferralCode } from './referralUtils';
import { DB } from '../controllers'; 

export const assignReferralCode = async (user: any): Promise<string> => {
  // If the user already has a referral code, return it
  if (user.referralCode) return user.referralCode;

  let code: string;
  let exists = true;

  // Regenerate until a unique code is found
  do {
    code = generateReferralCode();
    const existingUser = await DB.Models.User.findOne({ referralCode: code });
    exists = !!existingUser;
  } while (exists);

  // Assign and save
  user.referralCode = code;
  await user.save();

  return code;
};
