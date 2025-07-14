import { DB } from "../controllers";

/**
 * Generates a unique 8-digit numeric accountId.
 * Repeats until no other user has the same ID.
 */
export const generateUniqueAccountId = async (): Promise<string> => {
  let isUnique = false;
  let accountId: string = "";

  while (!isUnique) {
    const randomId = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8-digit number
    const exists = await DB.Models.User.findOne({ accountId: randomId }).lean();
    if (!exists) {
      isUnique = true;
      accountId = randomId;
    }
  }

  return accountId;
};
