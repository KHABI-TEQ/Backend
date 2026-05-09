import sendEmail from "../common/send.email";
import { getMainWebLoginUrl } from "../utils/clientAppUrl";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import { adminProvisionedUserWelcome } from "../common/emailTemplates/userProvisioningMail";
import WhatsAppNotificationService from "./whatsAppNotification.service";
import { dealSiteOriginFromPublicSlug } from "../config/dealSitePublicHost";

export async function notifyUserAdminProvisioned(params: {
  email: string;
  firstName: string;
  phoneNumber?: string;
  temporaryPassword: string;
  userType: string;
}): Promise<void> {
  const loginUrl = getMainWebLoginUrl();

  const html = generalEmailLayout(
    adminProvisionedUserWelcome({
      firstName: params.firstName,
      email: params.email,
      temporaryPassword: params.temporaryPassword,
      loginUrl,
      userType: params.userType,
    })
  );

  await sendEmail({
    to: params.email,
    subject: "Your Khabi-Teq account is ready — change password on first sign-in",
    text: html,
    html,
  });

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const phone = (params.phoneNumber || "").replace(/\s/g, "");
  if (token && phoneId && phone.length >= 10) {
    try {
      const wa = new WhatsAppNotificationService({
        accessToken: token,
        phoneNumberId: phoneId,
      });
      const result = await wa.sendMessage(phone, "admin_provisioned_account", {
        firstName: params.firstName,
        email: params.email,
        loginUrl,
        userType: params.userType,
      });
      if (!result.success) {
        console.warn("[WhatsApp] admin_provisioned_account failed:", result.error);
      }
    } catch (e) {
      console.warn("[WhatsApp] admin_provisioned_account failed:", e);
    }
  }
}

export async function notifyUserPropertyCreatedByAdmin(params: {
  email: string;
  firstName: string;
  phoneNumber?: string;
  summaryLine: string;
}): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const phone = (params.phoneNumber || "").replace(/\s/g, "");
  if (token && phoneId && phone.length >= 10) {
    try {
      const wa = new WhatsAppNotificationService({
        accessToken: token,
        phoneNumberId: phoneId,
      });
      const result = await wa.sendMessage(phone, "property_created_by_admin", {
        firstName: params.firstName,
        summaryLine: params.summaryLine,
      });
      if (!result.success) {
        console.warn("[WhatsApp] property_created_by_admin failed:", result.error);
      }
    } catch (e) {
      console.warn("[WhatsApp] property_created_by_admin failed:", e);
    }
  }
}

export async function notifyUserDealSiteCreatedByAdmin(params: {
  email: string;
  firstName: string;
  publicSlug: string;
}): Promise<void> {
  const publicPageUrl = `${dealSiteOriginFromPublicSlug(params.publicSlug)}/`;
  const html = generalEmailLayout(`
    <h3>Your public access page is now live</h3>
    <p>Hello ${params.firstName || "there"},</p>
    <p>An admin has created your DealSite public access page successfully.</p>
    <p><strong>Public page URL:</strong> <a href="${publicPageUrl}">${publicPageUrl}</a></p>
    <p>You can now share this link with clients and visitors.</p>
  `);

  await sendEmail({
    to: params.email,
    subject: "Your DealSite public page has been created",
    text: `Your DealSite public page is now live: ${publicPageUrl}`,
    html,
  });
}
