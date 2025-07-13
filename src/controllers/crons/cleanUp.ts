import cron from "node-cron";
import VerificationToken from "@/models/VerificationToken";

cron.schedule("0 0 * * *", async () => {
  await VerificationToken.deleteMany({ expiresAt: { $lt: new Date() } });
});
