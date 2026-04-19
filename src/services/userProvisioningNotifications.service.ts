import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import { adminProvisionedUserWelcome } from "../common/emailTemplates/userProvisioningMail";
import WhatsAppNotificationService from "./whatsAppNotification.service";

export async function notifyUserAdminProvisioned(params: {
  email: string;
  firstName: string;
  phoneNumber?: string;
  temporaryPassword: string;
  userType: string;
}): Promise<void> {
  const loginUrl = process.env.CLIENT_LINK
    ? `${process.env.CLIENT_LINK.replace(/\/$/, "")}/login`
    : "https://app.khabiteqrealty.com/login";

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
      await wa.sendMessage(phone, "admin_provisioned_account", {
        firstName: params.firstName,
        email: params.email,
        loginUrl,
        userType: params.userType,
      });
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
      await wa.sendMessage(phone, "property_created_by_admin", {
        firstName: params.firstName,
        summaryLine: params.summaryLine,
      });
    } catch (e) {
      console.warn("[WhatsApp] property_created_by_admin failed:", e);
    }
  }
}
