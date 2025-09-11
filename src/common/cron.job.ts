import cron from 'node-cron';
import { DB } from '../controllers';
import mongoose from 'mongoose';
import { AccountService } from '../services/account.service';
import { generalEmailLayout } from './emailTemplates/emailLayout';
import { generateSubscriptionExpiredEmail, generateSubscriptionExpiringSoonEmail, generateSubscriptionFailureEmail, generateSubscriptionSuccessEmail } from './emailTemplates/subscriptionMails';
import sendEmail from './send.email';
import { PaystackService } from '../services/paystack.service';

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

// 2. Expire subscriptions that passed endDate
const expireSubscriptions = async () => {
  try {
    // 1️⃣ Find active subscriptions that have passed endDate
    const expiredSubs = await DB.Models.Subscription.find({
      status: 'active',
      endDate: { $lt: new Date() },
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
      const activeCount = await DB.Models.Subscription.countDocuments({
        user: user._id,
        status: 'active',
      });

      if (activeCount === 0) {
        // Disable public URL
        await AccountService.disablePublicUrl(user._id.toString());

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

    const expiringSoon = await DB.Models.Subscription.find({
      status: 'active',
      endDate: { $lte: threeDaysLater, $gte: now },
    }).populate('user');

    for (const sub of expiringSoon) {
      const user = sub.user as any;
      const daysLeft = Math.ceil(
        (sub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
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

      const emailHtml = generalEmailLayout(
        generateSubscriptionExpiringSoonEmail({
          fullName: user.fullName || `${user.firstName} ${user.lastName}`,
          planName: plan.name,
          expiryDate: sub.endDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          daysLeft,
          publicAccessLink: user.publicAccess?.urlEnabled ? user.publicAccess.url : undefined,
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

// 4. Auto-renew subscriptions
const autoRenewSubscriptions = async () => {
  try {
    const today = new Date();

    // Fetch active subscriptions with autoRenew enabled that are expiring today or earlier
    const toRenew = await DB.Models.Subscription.find({
      status: 'active',
      autoRenew: true,
      endDate: { $lte: today },
    }).populate('user');

    console.log(`[CRON] Found ${toRenew.length} subscriptions to auto-renew`);

    for (const sub of toRenew) {
      const user = sub.user as any;

      // Fetch user's default payment method
      const paymentMethod = await DB.Models.PaymentMethod.findOne({
        user: user._id,
        isDefault: true,
      });

      if (!paymentMethod) {
        console.log(`[CRON] No default payment method for user ${user.email}, cannot auto-renew`);
        // Optionally, send email to update payment method
        continue;
      }

      const plan = await DB.Models.SubscriptionPlan.findOne({
        code: sub.plan,
        isActive: true,
      });

      if (!plan) {
        console.log(`[CRON] Subscription plan not found for code ${sub.plan}`);
        continue;
      }

      // === Use autoCharge instead of manual charge ===
      const paymentResult = await PaystackService.autoCharge({
        userId: user._id,
        subscriptionId: sub._id.toString(),
        amount: plan.price,
        email: user.email,
        authorizationCode: paymentMethod.authorizationCode,
        transactionType: 'subscription',
      });

      if (paymentResult.success) {
        // Update subscription dates
        const newStartDate = sub.endDate;
        const newEndDate = new Date(newStartDate);
        newEndDate.setDate(newEndDate.getDate() + plan.durationInDays);

        sub.startDate = newStartDate;
        sub.endDate = newEndDate;
        await sub.save();

        console.log(`[CRON] Subscription ${sub._id} auto-renewed successfully`);

        // Send success email
        const emailBody = generalEmailLayout(
          generateSubscriptionSuccessEmail({
            fullName: user.fullName || `${user.firstName} ${user.lastName}`,
            planName: plan.name,
            amount: paymentResult.transaction.amount,
            transactionRef: paymentResult.transaction.reference,
            nextBillingDate: newEndDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            publicAccessLink: user.publicAccess?.url || '',
          })
        );

        await sendEmail({
          to: user.email,
          subject: 'Your subscription has been renewed automatically',
          html: emailBody,
          text: emailBody,
        });
      } else {
        console.log(`[CRON] Subscription ${sub._id} auto-renewal failed`);

        // Optionally, disable public URL
        await AccountService.disablePublicUrl(user._id.toString());

        // Send failure email
        const emailBody = generalEmailLayout(
          generateSubscriptionFailureEmail({
            fullName: user.fullName || `${user.firstName} ${user.lastName}`,
            planName: plan.name,
            amount: plan.price,
            transactionRef: paymentResult.transaction?.reference || 'N/A',
            retryLink: `${process.env.CLIENT_LINK}/subscription/update-payment`,
          })
        );

        await sendEmail({
          to: user.email,
          subject: 'Auto-renewal failed for your subscription',
          html: emailBody,
          text: emailBody,
        });
      }
    }
  } catch (err) {
    console.error('[CRON] Error processing auto-renew subscriptions:', err);
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
  autoRenewSubscriptions();
});

export default {};
