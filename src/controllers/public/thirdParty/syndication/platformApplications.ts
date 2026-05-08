import { NextFunction, Response } from "express";
import HttpStatusCodes from "../../../../common/HttpStatusCodes";
import { RouteError } from "../../../../common/classes";
import { AppRequest } from "../../../../types/express";
import { DB } from "../../..";
import sendEmail from "../../../../common/send.email";
import { generalEmailLayout } from "../../../../common/emailTemplates/emailLayout";

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

    const created = await DB.Models.SyndicationPlatformApplication.create({
      companyName: String(companyName).trim(),
      contactName: String(contactName).trim(),
      contactEmail: String(contactEmail).trim().toLowerCase(),
      contactPhone: contactPhone ? String(contactPhone).trim() : undefined,
      platformName: String(platformName).trim(),
      platformKeySuggestion: String(platformKeySuggestion).trim().toLowerCase(),
      authType: String(authType).trim(),
      baseUrl: String(baseUrl).trim(),
      webhookSupport: webhookSupport !== false,
      docsUrl: docsUrl ? String(docsUrl).trim() : undefined,
      notes: notes ? String(notes).trim() : undefined,
      status: "pending",
    });

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

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Platform application submitted successfully",
      data: created,
    });
  } catch (err) {
    next(err);
  }
};

