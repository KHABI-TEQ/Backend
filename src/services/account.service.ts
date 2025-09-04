import { DB } from '../controllers';
import crypto from "crypto";

export class AccountService {
  /**
   * Creates a public URL for a user using referralCode + userId
   * If already exists, just enables it
   */
  static async createPublicUrl(userId: string): Promise<string | null> {
    const user = await DB.Models.User.findById(userId);
    if (!user) return null;

    // If URL already exists, just enable it
    if (user.publicAccess?.url) {
      user.publicAccess.urlEnabled = true;
      await user.save();
      return user.publicAccess.url;
    }

    // Generate deterministic unique URL using referralCode + userId
    const rawString = `${user.referralCode}-${user._id}`;
    const hash = crypto.createHash("sha256").update(rawString).digest("hex");
    const uniqueUrl = hash.slice(0, 12); // 12-character hash for readability

    // Ensure uniqueness (just in case)
    const existing = await DB.Models.User.findOne({ "publicAccess.url": uniqueUrl });
    if (existing) {
      throw new Error("Public URL collision. Try regenerating.");
    }

    user.publicAccess = {
      url: uniqueUrl,
      urlEnabled: true,
    };

    await user.save();
    return uniqueUrl;
  }

  /**
   * Disable the public URL (user cannot be accessed publicly)
   */
  static async disablePublicUrl(userId: string): Promise<boolean> {
    const user = await DB.Models.User.findById(userId);
    if (!user || !user.publicAccess?.url) return false;

    user.publicAccess.urlEnabled = false;
    await user.save();
    return true;
  }

  /**
   * Enable the public URL (user becomes publicly accessible again)
   */
  static async enablePublicUrl(userId: string): Promise<boolean> {
    const user = await DB.Models.User.findById(userId);
    if (!user || !user.publicAccess?.url) return false;

    user.publicAccess.urlEnabled = true;
    await user.save();
    return true;
  }

  /**
   * Check if a public URL is valid & enabled
   */
  static async isPublicUrlEnabled(url: string): Promise<boolean> {
    const user = await DB.Models.User.findOne({ "publicAccess.url": url, "publicAccess.urlEnabled": true });
    return !!user;
  }
}
