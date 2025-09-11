import { DB } from "../controllers";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";

interface SubscribeInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export class EmailSubscriptionService {
  /**
   * Subscribe a user by email
   */
  public static async subscribe(input: SubscribeInput) {
    const { email, firstName, lastName } = input;

    // Check if email already exists
    let subscription = await DB.Models.EmailSubscription.findOne({ email });

    if (subscription) {
      if (subscription.status === "unsubscribed") {
        subscription.status = "subscribed";
        subscription.firstName = firstName ?? subscription.firstName;
        subscription.lastName = lastName ?? subscription.lastName;
        await subscription.save();
      }
    } else {
      // Create new subscription
      subscription = await DB.Models.EmailSubscription.create({
        email,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        status: "subscribed",
      });
    }

    // Send confirmation email
    await sendEmail({
      to: email,
      subject: "✅ Subscription Confirmed",
      html: generalEmailLayout(`
        <p>Hello ${firstName || ""},</p>
        <p>Thank you for subscribing! You’ll now receive updates from us.</p>
        <p>If you ever wish to unsubscribe, click below:</p>
        <a href="${process.env.APP_URL}/unsubscribe?email=${encodeURIComponent(
        email
      )}" style="color:#ff0000;">Unsubscribe here</a>
      `),
      text: `Thank you for subscribing!\n\nUnsubscribe: ${process.env.FRONTEND_URL}/un-subscribe?email=${encodeURIComponent(
        email
      )}`,
    });

    return subscription.toObject();
  }

  /**
   * Unsubscribe a user by email
   */
  public static async unsubscribe(email: string) {
    const subscription = await DB.Models.EmailSubscription.findOne({ email });

    if (!subscription) {
      throw new Error("Email not found in subscription list.");
    }

    subscription.status = "unsubscribed";
    await subscription.save();

    // Send unsubscribe confirmation
    await sendEmail({
      to: email,
      subject: "❌ You Have Unsubscribed",
      html: generalEmailLayout(`
        <p>Hello ${subscription.firstName || ""},</p>
        <p>You have successfully unsubscribed from our mailing list.</p>
        <p>If this was a mistake, you can resubscribe anytime on our website.</p>
      `),
      text: `You have successfully unsubscribed from our mailing list.`,
    });

    return subscription.toObject();
  }

  /**
   * Get all subscriptions with pagination
   */
  public static async getSubscriptions(page = 1, limit = 10, status?: string) {
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    const [data, total] = await Promise.all([
      DB.Models.EmailSubscription.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DB.Models.EmailSubscription.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        perPage: limit,
      },
    };
  }
}
