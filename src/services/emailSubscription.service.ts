import { DB } from "../controllers";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import { Types } from "mongoose";
import { generalTemplate } from "../common/email.template";

interface IReceiverMode {
  type?: "general" | "dealSite";
  dealSiteID?: Types.ObjectId;
}

interface SubscribeInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  receiverMode?: IReceiverMode; // ✅ Added here
  dealSite?: any;
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
      text: `Thank you for subscribing!\n\nUnsubscribe: ${process.env.CLIENT_LINK}/un-subscribe?email=${encodeURIComponent(
        email
      )}`,
    });

    return subscription.toObject();
  }


  /**
   * Subscribe a user by email
   */
  public static async subscribeDealSite(input: SubscribeInput) {
    const { email, receiverMode, dealSite } = input;

    // Check if email already exists
    let subscription = await DB.Models.EmailSubscription.findOne({ email });

    if (subscription) {
      if (subscription.status === "unsubscribed") {
        subscription.status = "subscribed";
        subscription.receiverMode = receiverMode ?? subscription.receiverMode;
        await subscription.save();
      }
    } else {
      // Create new subscription
      subscription = await DB.Models.EmailSubscription.create({
        email,
        status: "subscribed",
        receiverMode: receiverMode,
      });
    }

    const {
      paymentDetails,
      logoUrl,
      title,
      footer,
      socialLinks = {},
    } = dealSite;

    const companyName = title || paymentDetails?.businessName || "Our Partner";
    const address = footer?.shortDescription || "Lagos, Nigeria";

    const baseHtml = `
      <div style="font-family: Arial, sans-serif; color: #2d3748; line-height: 1.6;">
        <h2 style="color: #2b6cb0; margin-bottom: 10px;">Welcome to ${companyName}!</h2>
        <p>Hello <strong>${email}</strong>,</p>
        <p>
          Thank you for subscribing to <strong>${companyName}</strong> updates. 
          You’ll now receive timely information on new deals, exclusive property listings, 
          and insider opportunities tailored just for you.
        </p>
        <p>
          Stay tuned — our team is dedicated to bringing you only the best real estate offers 
          and opportunities that match your interests.
        </p>
        <p style="margin-top: 20px;">
          Best regards,<br />
          <strong>The ${companyName} Team</strong>
        </p>
      </div>
    `;
    
    const dealSiteMail = generalTemplate(baseHtml, {
      companyName,
      logoUrl:
        logoUrl ||
        "https://res.cloudinary.com/dkqjneask/image/upload/v1744050595/logo_1_flo1nf.png",
      address,
      facebookUrl: socialLinks.facebook || "",
      instagramUrl: socialLinks.instagram || "",
      linkedinUrl: socialLinks.linkedin || "",
      twitterUrl: socialLinks.twitter || "",
    })

    // Send DealSite subscription confirmation email
    await sendEmail({
      to: email,
      subject: `🎉 You’re Subscribed to ${companyName} Updates!`,
      html: dealSiteMail,
      text: `Hello ${email},

    Thank you for subscribing to ${companyName} updates.
    You’ll now receive new deals, exclusive listings, and real estate opportunities straight to your inbox.

    Best regards,
    The ${companyName} Team`,
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
    if (status) filter.status = status;

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
