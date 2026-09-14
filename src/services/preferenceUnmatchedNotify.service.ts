import { DB } from "../controllers";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import {
  noMatchesPreferenceFeedbackMail,
  stillSearchingPreferenceMail,
} from "../common/emailTemplates/preference";
import { dealSiteBaseUrlFromPublicSlug } from "../utils/matchedPropertiesDealSiteUrl";
import { isLikelyE164CapableLocalPhone, runWhatsapp } from "./whatsappClient.service";
import { createBuyerInboxNotification } from "./buyerNotification.service";

export const UNMATCHED_SEARCH_REMINDER_MS = 48 * 60 * 60 * 1000;
const CRON_BATCH_LIMIT = 200;

function buyerNameFromPreference(preference: any): string {
  return (
    (preference.contactInfo as any)?.fullName ||
    (preference.contactInfo as any)?.contactPerson ||
    "there"
  );
}

function preferenceSummaryLine(preference: any): string {
  const type = String(preference.preferenceType || "property").replace(/-/g, " ");
  const state = preference.location?.state || "";
  const lgas = (preference.location?.localGovernmentAreas || []).filter(Boolean);
  const loc = [state, lgas.length ? lgas.join(", ") : ""].filter(Boolean).join(" · ");
  const minP = preference.budget?.minPrice;
  const maxP = preference.budget?.maxPrice;
  const currency = preference.budget?.currency || "NGN";
  const budget =
    minP != null || maxP != null
      ? `${Number(minP || 0).toLocaleString()} – ${Number(maxP || 0).toLocaleString()} ${currency}`
      : "";
  return [type, loc, budget].filter(Boolean).join(" · ");
}

async function resolvePreferenceRecipientEmail(preference: any): Promise<string | undefined> {
  let email: string | undefined;

  if (preference.buyer) {
    const buyer = await DB.Models.Buyer.findById(preference.buyer).select("email").lean();
    email = (buyer as any)?.email;
  }

  if (!email) {
    email = (preference.contactInfo as any)?.email;
  }

  const normalized = String(email || "").trim();
  if (!normalized || normalized === "unknown@example.com") {
    return undefined;
  }

  return normalized;
}

async function resolveSubmitPreferenceUrl(preference: any): Promise<string | undefined> {
  const receiverMode = preference?.receiverMode;
  if (receiverMode?.type === "dealSite" && receiverMode.dealSiteID) {
    const dealSite = await DB.Models.DealSite.findById(receiverMode.dealSiteID)
      .select("publicSlug")
      .lean();
    const slug = String((dealSite as any)?.publicSlug || "").trim();
    if (slug) {
      const base = dealSiteBaseUrlFromPublicSlug(slug).replace(/\/$/, "");
      return `${base}/submit-preference`;
    }
  }

  const clientBase = (process.env.CLIENT_LINK || process.env.APP_URL || "").replace(/\/$/, "");
  return clientBase ? `${clientBase}/preferences/submit` : undefined;
}

function unmatchedInboxMeta(preference: any) {
  const preferenceId = String(preference._id);
  const buyerId = String(preference.buyer?._id || preference.buyer || "");
  return {
    source: "system" as const,
    audience: "buyer" as const,
    screen: "preferences",
    preferenceId,
    buyerId,
    actionPath: `/preferences/${preferenceId}`,
  };
}

async function deliverUnmatchedChannels(params: {
  preference: any;
  email: string | undefined;
  subject: string;
  htmlInner: string;
  text: string;
  inboxTitle: string;
  inboxMessage: string;
}): Promise<void> {
  const { preference, email, subject, htmlInner, text, inboxTitle, inboxMessage } = params;
  const buyerId = String(preference.buyer?._id || preference.buyer || "");
  const html = generalEmailLayout(htmlInner);

  if (email) {
    await sendEmail({
      to: email,
      subject,
      html,
      text,
      skipBuyerInbox: true,
      inboxMeta: unmatchedInboxMeta(preference),
    });
  } else {
    console.warn(
      "[preferenceUnmatched] Email skipped — no recipient for preference",
      String(preference._id),
    );
  }

  if (buyerId) {
    await createBuyerInboxNotification({
      buyerId,
      title: inboxTitle,
      message: inboxMessage,
      type: "preference",
      meta: unmatchedInboxMeta(preference),
    });
  }
}

async function markUnmatchedNotified(preferenceId: string, at: Date): Promise<void> {
  await DB.Models.Preference.updateOne(
    { _id: preferenceId },
    { $set: { lastUnmatchedNotifyAt: at } },
  );
}

async function sendNoMatchWhatsApp(preference: any, buyerName: string): Promise<void> {
  const clientBase = (process.env.CLIENT_LINK || process.env.APP_URL || "").replace(/\/$/, "");
  let phone: string | undefined = (preference.contactInfo as any)?.phoneNumber;
  if (!phone && preference.buyer) {
    const b = await DB.Models.Buyer.findById(preference.buyer)
      .select("phoneNumber whatsAppNumber")
      .lean();
    phone = (b as any)?.whatsAppNumber || (b as any)?.phoneNumber;
  }
  const phoneLine = String(phone || "").replace(/\s/g, "");
  const appLink = clientBase || "Khabi-Teq app or website";

  if (!isLikelyE164CapableLocalPhone(phoneLine)) return;

  void runWhatsapp("preference_no_match", async (wa) => {
    const r = await wa.sendPreferenceNoMatchesYet({
      user: { name: buyerName, phone: phoneLine, id: String(preference.buyer || "") },
      appLink,
    });
    if (!r.success) {
      console.warn("[preferenceUnmatched] no-match WhatsApp failed:", r.error);
    }
  });
}

/** Immediate no-match notice: email + in-app + push (if device tokens exist). */
export async function notifyPreferenceNoMatches(preferenceId: string): Promise<void> {
  const preference = await DB.Models.Preference.findById(preferenceId).lean();
  if (!preference) return;

  const email = await resolvePreferenceRecipientEmail(preference);
  const buyerName = buyerNameFromPreference(preference);
  const submitPreferenceUrl = await resolveSubmitPreferenceUrl(preference);
  const firstName = String(buyerName).trim().split(/\s+/)[0] || "there";
  const inner = noMatchesPreferenceFeedbackMail({ buyerName, submitPreferenceUrl });
  const text =
    `Hi ${firstName}, thank you for your patience while we reviewed your property preference. ` +
    `At this time, we have not identified a suitable match based on your current requirements. ` +
    `Your preference will now be reviewed through our professional network. ` +
    `We'll continue to keep you informed as relevant opportunities become available.`;

  await deliverUnmatchedChannels({
    preference,
    email,
    subject: "Update on Your Property Preference",
    htmlInner: inner,
    text,
    inboxTitle: "Update on your property preference",
    inboxMessage:
      "We have not identified a suitable match based on your current requirements. Your preference is being reviewed through our professional network.",
  });

  await sendNoMatchWhatsApp(preference, buyerName);
  await markUnmatchedNotified(String(preference._id), new Date());
}

/** Recurring 48-hour “still searching” notice: email + in-app + push. */
export async function notifyPreferenceStillSearching(preference: any): Promise<void> {
  const email = await resolvePreferenceRecipientEmail(preference);
  const buyerName = buyerNameFromPreference(preference);
  const summary = preferenceSummaryLine(preference);
  const inner = stillSearchingPreferenceMail({
    buyerName,
    preferenceSummary: summary,
  });
  const text =
    `Hi ${buyerName}, we are still actively searching for a listing that matches your preference` +
    (summary ? ` (${summary})` : "") +
    `. We will notify you as soon as we find a match.`;

  await deliverUnmatchedChannels({
    preference,
    email,
    subject: "We are still searching for your preference – Khabi-Teq",
    htmlInner: inner,
    text,
    inboxTitle: "Still searching for your preference",
    inboxMessage:
      "We are actively looking for listings that match your preference. We will notify you as soon as we find a match.",
  });
}

async function preferenceAlreadyHasMatches(preferenceId: unknown): Promise<boolean> {
  const match = await DB.Models.MatchedPreferenceProperty.findOne({
    preference: preferenceId,
  })
    .select("matchedProperties")
    .lean();
  return Array.isArray(match?.matchedProperties) && match.matchedProperties.length > 0;
}

/**
 * Send “still searching” reminders for approved preferences with no matches
 * whose last unmatched notice was at least 48 hours ago.
 */
export async function processUnmatchedPreferenceSearchReminders(): Promise<{ sent: number }> {
  const cutoff = new Date(Date.now() - UNMATCHED_SEARCH_REMINDER_MS);
  const now = new Date();

  const candidates = await DB.Models.Preference.find({
    status: "approved",
    lastUnmatchedNotifyAt: { $lte: cutoff },
  })
    .limit(CRON_BATCH_LIMIT)
    .lean();

  let sent = 0;

  for (const pref of candidates) {
    try {
      if (await preferenceAlreadyHasMatches(pref._id)) {
        await DB.Models.Preference.updateOne(
          { _id: pref._id, status: "approved" },
          { $set: { status: "matched" } },
        );
        continue;
      }

      const claimed = await DB.Models.Preference.findOneAndUpdate(
        {
          _id: pref._id,
          status: "approved",
          lastUnmatchedNotifyAt: { $lte: cutoff },
        },
        { $set: { lastUnmatchedNotifyAt: now } },
        { new: true },
      );
      if (!claimed) continue;

      await notifyPreferenceStillSearching(claimed);
      sent += 1;
    } catch (e) {
      console.warn(
        "[preferenceUnmatched] 48h reminder failed for preference",
        String(pref._id),
        e,
      );
    }
  }

  return { sent };
}
