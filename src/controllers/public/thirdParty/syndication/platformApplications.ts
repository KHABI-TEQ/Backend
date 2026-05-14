import { NextFunction, Response } from "express";
import HttpStatusCodes from "../../../../common/HttpStatusCodes";
import { RouteError } from "../../../../common/classes";
import { AppRequest } from "../../../../types/express";
import { DB } from "../../..";
import { notifyAllActiveAdmins } from "../../../../services/adminNotification.service";
import sendEmail from "../../../../common/send.email";
import { generalEmailLayout } from "../../../../common/emailTemplates/emailLayout";
import {
  normalizeSyndicationPropertyTypesInput,
  SYNDICATION_PROPERTY_TYPE_VALUES,
} from "../../../../common/syndicationPropertyTypes";

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const submitSyndicationPlatformApplication = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      companyName,
      contactName,
      contactEmail,
      contactPhone,
      platformName,
      platformKeySuggestion,
      authType,
      baseUrl,
      acceptedPropertyTypes,
      webhookSupport,
      docsUrl,
      notes,
    } = req.body || {};

    if (
      !companyName ||
      !contactName ||
      !contactEmail ||
      !platformName ||
      !platformKeySuggestion ||
      !authType ||
      !baseUrl
    ) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "companyName, contactName, contactEmail, platformName, platformKeySuggestion, authType and baseUrl are required"
      );
    }

    const normalizedTypes = normalizeSyndicationPropertyTypesInput(acceptedPropertyTypes);
    if (normalizedTypes.length === 0) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `acceptedPropertyTypes is required: provide at least one of ${SYNDICATION_PROPERTY_TYPE_VALUES.join(", ")} (e.g. sell, rent, jv, shortlet)`
      );
    }

    const created = await DB.Models.SyndicationPlatformApplication.create({
      companyName: String(companyName).trim(),
      contactName: String(contactName).trim(),
      contactEmail: String(contactEmail).trim().toLowerCase(),
      contactPhone: contactPhone ? String(contactPhone).trim() : undefined,
      platformName: String(platformName).trim(),
      platformKeySuggestion: String(platformKeySuggestion).trim().toLowerCase(),
      authType: String(authType).trim(),
      baseUrl: String(baseUrl).trim(),
      acceptedPropertyTypes: normalizedTypes,
      webhookSupport: webhookSupport !== false,
      docsUrl: docsUrl ? String(docsUrl).trim() : undefined,
      notes: notes ? String(notes).trim() : undefined,
      status: "pending",
    });

    try {
      const safeName = escapeHtml(created.contactName);
      const safeCompany = escapeHtml(created.companyName);
      const safePlatform = escapeHtml(created.platformName);
      const supportEmail = (process.env.MAIN_SUPPORT_EMAIL || process.env.ADMIN_EMAIL || "").trim();
      const supportLine = supportEmail
        ? `<p>If you have questions about this process, please email <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a> or visit our website.</p>`
        : `<p>If you have questions about this process, please visit our website and use the listed contact options.</p>`;
      const partnerHtml = generalEmailLayout(`
        <h2 style="margin-top:0;">Thank you for applying to the Khabi-Teq syndication network</h2>
        <p>Dear ${safeName},</p>
        <p>We have safely received your integration application on behalf of <strong>${safeCompany}</strong> for the platform <strong>${safePlatform}</strong>.</p>
        <p>Our partnerships team will review your submission. You do not need to take any further action at this stage.</p>
        <p><strong>What happens next</strong></p>
        <ul style="padding-left: 20px;">
          <li>You will receive <strong>email notifications</strong> as your application moves through review (for example, when it is marked under review, approved, or if we need to decline it).</li>
          <li>All status updates are issued from our side after internal review; please watch the inbox for <strong>${escapeHtml(created.contactEmail)}</strong>.</li>
        </ul>
        ${supportLine}
        <p>We appreciate your interest in listing syndication with Khabi-Teq.</p>
      `);
      const partnerTextLines = [
        `Dear ${created.contactName},`,
        "",
        `Thank you for applying to the Khabi-Teq syndication network. We have received your application for ${created.platformName} (${created.companyName}).`,
        "",
        "Our team will review your submission. You will receive email updates as your application status changes (for example, under review, approved, or declined).",
        "",
        `Please monitor the inbox for: ${created.contactEmail}`,
        "",
      ];
      if (supportEmail) {
        partnerTextLines.push(`Questions: ${supportEmail}`);
        partnerTextLines.push("");
      }
      partnerTextLines.push("Thank you,", "Khabi-Teq");
      const partnerText = partnerTextLines.join("\n");
      await sendEmail({
        to: created.contactEmail,
        subject: "We received your syndication application — Khabi-Teq",
        text: partnerText,
        html: partnerHtml,
      });
    } catch (mailErr) {
      console.warn("[submitSyndicationPlatformApplication] applicant welcome email failed:", mailErr);
    }

    try {
      const alertEmail = process.env.SYNDICATION_APPLICATION_ALERT_EMAIL || "khabiteq@gmail.com";
      const body = generalEmailLayout(`
        <h3>New Syndication Platform Application</h3>
        <p>A new platform application has been submitted.</p>
        <p><strong>Company:</strong> ${created.companyName}</p>
        <p><strong>Contact:</strong> ${created.contactName} (${created.contactEmail})</p>
        <p><strong>Platform:</strong> ${created.platformName}</p>
        <p><strong>Key Suggestion:</strong> ${created.platformKeySuggestion}</p>
        <p><strong>Auth Type:</strong> ${created.authType}</p>
        <p><strong>Base URL:</strong> ${created.baseUrl}</p>
        <p><strong>Status:</strong> ${created.status}</p>
      `);
      await sendEmail({
        to: alertEmail,
        subject: "New syndication platform application submitted",
        text: `New syndication application from ${created.companyName} (${created.platformName}).`,
        html: body,
      });
    } catch (mailErr) {
      console.warn("[submitSyndicationPlatformApplication] admin alert email failed:", mailErr);
    }

    void notifyAllActiveAdmins({
      type: "syndication_application_submitted",
      title: "New syndication platform application",
      message: `${created.companyName} applied for platform "${created.platformName}" (${created.contactEmail}).`,
      meta: {
        applicationId: String(created._id),
        platformKeySuggestion: created.platformKeySuggestion,
      },
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Platform application submitted successfully",
      data: created,
    });
  } catch (err) {
    next(err);
  }
};

