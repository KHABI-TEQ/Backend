import cron from "node-cron";
import { DB } from '..';

cron.schedule("0 0 * * *", async () => {
  await DB.Models.VerificationToken.deleteMany({ expiresAt: { $lt: new Date() } });
});
