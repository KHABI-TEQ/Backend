import cron from 'node-cron';
import { DB } from '../controllers';
import mongoose from 'mongoose';
import { generalEmailLayout } from './emailTemplates/emailLayout';
import { generateSubscriptionExpiredEmail, generateSubscriptionExpiringSoonEmail, generateSubscriptionFailureEmail, generateAutoRenewReceiptEmail } from './emailTemplates/subscriptionMails';
import sendEmail from './send.email';
import { PaystackService } from '../services/paystack.service';
import { kebabToTitleCase } from '../utils/helper';

// Example DB connect (adjust for your project setup)
mongoose.connect(process.env.MONGO_URI as string);


// ───────────────────────────────
// 1. DELETE OLD PENDING ITEMS
// ───────────────────────────────
const deleteOldPendingItems = async () => {
  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    // 1️⃣ Delete pending transactions older than 2 days
    const txResult = await DB.Models.NewTransaction.deleteMany({
      status: 'pending',
      createdAt: { $lt: twoDaysAgo },
    });
    console.log(`[CRON] Deleted ${txResult.deletedCount} old pending transactions`);

    // 2️⃣ Delete inspection bookings with status 'pending_transaction' older than 2 days
    const inspectionResult = await DB.Models.InspectionBooking.deleteMany({
      status: 'pending_transaction',
      createdAt: { $lt: twoDaysAgo },
    });
    console.log(`[CRON] Deleted ${inspectionResult.deletedCount} old pending inspection bookings`);

    // 2️⃣ Delete document verification with status 'pending' older than 2 days
    const documentVerficationResult = await DB.Models.DocumentVerification.deleteMany({
      status: 'pending',
      createdAt: { $lt: twoDaysAgo },
    });
    console.log(`[CRON] Deleted ${documentVerficationResult.deletedCount} old pending inspection bookings`);

    // 2️⃣ Delete Subscription with status 'pending' older than 2 days
    const subscriptionResult = await DB.Models.DocumentVerification.deleteMany({
      status: 'pending',
      createdAt: { $lt: twoDaysAgo },
    });
    console.log(`[CRON] Deleted ${subscriptionResult.deletedCount} old pending inspection bookings`);


  } catch (err) {
    console.error('[CRON] Error deleting old pending items:', err);
  }
};

// 2. Expire subscriptions that passed expiresAt
const expireSubscriptions = async () => {
  try {
    // 1️⃣ Find active subscriptions that have passed expiresAt
    const expiredSubs = await DB.Models.UserSubscriptionSnapshot.find({
      status: 'active',
      expiresAt: { $lt: new Date() },
    }).populate('user');

    console.log(`[CRON] Found ${expiredSubs.length} subscriptions to expire`);

    for (const sub of expiredSubs) {
      // Update subscription status
      sub.status = 'expired';
      await sub.save();

      const user = sub.user as any;

      const plan = await DB.Models.SubscriptionPlan.findOne({
        code: sub.plan,
        isActive: true,
      });

      if (!plan) {
        console.log(`[CRON] Subscription plan not found for code ${sub.plan}`);
        continue;
      }

      // Check if the user has any other active subscriptions
      const activeCount = await DB.Models.UserSubscriptionSnapshot.countDocuments({
        user: user._id,
        status: 'active',
      });

      if (activeCount === 0) {

        const dealSite = await DB.Models.DealSite.findOne({
          createdBy: user._id,
        });

        if (!dealSite) {
          console.log(`[CRON] DealSite not found`);
          continue;
        }

        dealSite.status = "paused";
        await dealSite.save();

        // Send email notification
        const emailBody = generalEmailLayout(
          generateSubscriptionExpiredEmail({
            fullName: user.fullName || `${user.firstName} ${user.lastName}`,
            planName: plan.name,
            expiredDate: new Date().toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            publicAccessLink: '', // now disabled, so can leave empty or old link
          })
        );

        await sendEmail({
          to: user.email,
          subject: 'Your Subscription Has Expired',
          html: emailBody,
          text: emailBody,
        });

        console.log(`[CRON] Notified user ${user.email} and disabled public access`);
      } else {
        console.log(`[CRON] User ${user.email} still has active subscriptions, public URL remains`);
      }
    }

    console.log('[CRON] Expire subscription job completed');
  } catch (err) {
    console.error('[CRON] Error expiring subscriptions:', err);
  }
};

// 3. Notify agents before subscription expires
const notifyExpiringSubscriptions = async () => {
  try {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const expiringSoon = await DB.Models.UserSubscriptionSnapshot.find({
      status: 'active',
      expiresAt: { $lte: threeDaysLater, $gte: now },
    }).populate('user');

    for (const sub of expiringSoon) {
      const user = sub.user as any;
      const daysLeft = Math.ceil(
        (sub.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const plan = await DB.Models.SubscriptionPlan.findOne({
        code: sub.plan,
        isActive: true,
      });

      if (!plan) {
        console.log(`[CRON] Subscription plan not found for code ${sub.plan}`);
        continue;
      }

      console.log(
        `[CRON] Notifying user ${user.email} about expiring subscription in ${daysLeft} day(s)`
      );
 
      // create public link
      const publicAccessCompleteLink = `${process.env.CLIENT_LINK}/public-access-page`;

      const emailHtml = generalEmailLayout(
        generateSubscriptionExpiringSoonEmail({
          fullName: user.fullName || `${user.firstName} ${user.lastName}`,
          planName: plan.name,
          expiryDate: sub.expiresAt.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          daysLeft,
          publicAccessLink: publicAccessCompleteLink,
          autoRenewEnabled: sub.autoRenew
        })
      );

      await sendEmail({
        to: user.email,
        subject: `Your subscription expires in ${daysLeft} day(s)`,
        html: emailHtml,
        text: emailHtml,
      });
    }
  } catch (err) {
    console.error('[CRON] Error notifying users:', err);
  }
};

// 4. Auto-renew subscriptions cron job
const autoRenewSubscriptionsCronJob = async () => {
  try {
    const today = new Date();

    // Fetch active subscriptions with autoRenew enabled that are expiring today or earlier
    const toRenew = await DB.Models.UserSubscriptionSnapshot.find({
      status: "active",
      autoRenew: true,
      expiresAt: { $lte: today }, // ✅ should match your schema field
    }).populate("user");

    console.log(`[CRON] Found ${toRenew.length} subscriptions to auto-renew`);

    for (const sub of toRenew) {
      const user = sub.user as any;

      // Fetch user's default payment method
      const paymentMethod = await DB.Models.PaymentMethod.findOne({
        user: user._id,
        isDefault: true,
      });

      if (!paymentMethod) {
        console.log(
          `[CRON] No default payment method for user ${user.email}, cannot auto-renew`
        );
        // Optionally, send email to update payment method
        continue;
      }

      let appliedPlanName: string;
      let price: number;
      let durationInDays: number;
      let planType: "standard" | "discounted" = "standard";
      let plan: any;

      if (sub.meta.planType === "standard") {
        // 1. Standard plan lookup
        plan = await DB.Models.SubscriptionPlan.findOne({
          code: sub.meta.planCode,
          isActive: true,
        });

        if (!plan) {
          console.log(
            `[CRON] Standard plan not found for code ${sub.meta.planCode}`
          );
          continue;
        }

        appliedPlanName = plan.name;
        price = plan.price;
        durationInDays = plan.durationInDays;
      } else {
        // 2. Discounted plan lookup
        plan = await DB.Models.SubscriptionPlan.findOne({
          "discountedPlans.code": sub.meta.planCode,
          isActive: true,
        });

        if (!plan) {
          console.log(
            `[CRON] Discounted plan not found for code ${sub.meta.planCode}`
          );
          continue;
        }

        const discounted = plan.discountedPlans.find(
          (dp: any) => dp.code === sub.meta.planCode
        );

        if (!discounted) {
          console.log(
            `[CRON] Discounted plan entry missing for code ${sub.meta.planCode}`
          );
          continue;
        }

        appliedPlanName = discounted.name;
        price = discounted.price;
        durationInDays = discounted.durationInDays;
        planType = "discounted";
      }

      // === Auto-charge user ===
      const paymentResult = await PaystackService.autoCharge({
        userId: user._id,
        subscriptionId: sub._id.toString(),
        amount: price, // ✅ use correct price (not always plan.price)
        email: user.email,
        authorizationCode: paymentMethod.authorizationCode,
        transactionType: "subscription",
      });

      if (paymentResult.success) {

        // ✅ Extend subscription dates
        const newStartDate = sub.expiresAt;
        const newEndDate = new Date(newStartDate);
        newEndDate.setDate(newEndDate.getDate() + durationInDays);

        // Map plan features into snapshot
        const planFeatures = plan.features?.map((f: any) => ({
          feature: f._id,
          type: f.type,
          value: f.type === "boolean" || f.type === "count" ? f.value : undefined,
          remaining: f.type === "count" ? f.value : undefined,
        })) || [];

        sub.startedAt = newStartDate;
        sub.expiresAt = newEndDate;
        sub.features = planFeatures;
        await sub.save();

        console.log(
          `[CRON] Subscription ${sub._id} auto-renewed successfully for ${appliedPlanName}`
        );

        // create public link
        const publicAccessCompleteLink = `${process.env.CLIENT_LINK}/public-access-page`;

        const { html, text } = generateAutoRenewReceiptEmail({
          fullName: user.fullName || `${user.firstName} ${user.lastName}`,
          planName: `${appliedPlanName} - [${kebabToTitleCase(planType)}]`,
          amount: paymentResult.transaction.amount,
          transactionRef: paymentResult.transaction.reference,
          nextBillingDate: newEndDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          publicAccessSettingsLink: publicAccessCompleteLink,
        });

        // ✅ Send success email
        const emailBody = generalEmailLayout(html);

        await sendEmail({
          to: user.email,
          subject: "Your subscription has been renewed automatically",
          html: emailBody,
          text: text,
        });
      } else {
        console.log(`[CRON] Subscription ${sub._id} auto-renewal failed`);

        // ✅ Send failure email
        const emailBody = generalEmailLayout(
          generateSubscriptionFailureEmail({
            fullName: user.fullName || `${user.firstName} ${user.lastName}`,
            planName: appliedPlanName,
            amount: price,
            transactionRef: paymentResult.transaction?.reference || "N/A",
            subscriptionPlansLink: `${process.env.CLIENT_LINK}/agent-subscriptions`,
          })
        );

        await sendEmail({
          to: user.email,
          subject: "Auto-renewal failed for your subscription",
          html: emailBody,
          text: emailBody,
        });
      }
    }
  } catch (err) {
    console.error("[CRON] Error processing auto-renew subscriptions:", err);
  }
};


// ───────────────────────────────
// CRON SCHEDULES
// ───────────────────────────────

// Runs every midnight
cron.schedule('0 0 * * *', () => {
  console.log('[CRON] Midnight job running...');
  expireSubscriptions();
  notifyExpiringSubscriptions();
});

// Runs every day at 1:00 AM
cron.schedule('0 1 * * *', () => {
  console.log('[CRON] Deleting old pending transactions and inspections...');
  deleteOldPendingItems();
});

// Run every day at 00:30 AM
cron.schedule('30 0 * * *', () => {
  console.log('[CRON] Auto-renew subscriptions job running...');
  autoRenewSubscriptionsCronJob();
});

export default {};
