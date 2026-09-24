import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import { kycSubmissionAcknowledgement } from "../common/emailTemplates/agentMails";
import { kycVerificationAdminNotification } from "../common/emailTemplates/adminMails";
import { SystemSettingService } from "./systemSetting.service";
import { notifyAllActiveAdmins } from "./adminNotification.service";

const KYC_USER_TYPE_LABEL: Record<string, string> = {
  Agent: "Agent",
  Developer: "Developer",
  Landowners: "Landlord",
  PropertyScout: "Property Scout",
};

export async function notifyKycSubmitted(params: {
  userId: string;
  userType: string;
  firstName?: string;
  email?: string;
}): Promise<void> {
  const roleLabel = KYC_USER_TYPE_LABEL[params.userType] || params.userType;
  const firstName = params.firstName || roleLabel;

  if (params.email) {
    const emailBody = generalEmailLayout(kycSubmissionAcknowledgement(firstName));
    await sendEmail({
      to: params.email,
      subject: "KYC Verification Request Received – Khabi-Teq",
      html: emailBody,
      text: emailBody,
    });
  }

  const reviewPath =
    params.userType === "Agent"
      ? "agents"
      : params.userType === "Developer"
        ? "developers"
        : "landlords";
  const reviewLink = `${process.env.ADMIN_CLIENT_LINK || ""}/${reviewPath}/${params.userId}`;

  try {
    const companyEmailData = await SystemSettingService.getSetting("company_email");
    const adminEmailBody = generalEmailLayout(
      kycVerificationAdminNotification(firstName, params.email || "", reviewLink),
    );
    await sendEmail({
      to: companyEmailData?.value || process.env.ADMIN_EMAIL,
      subject: `New ${roleLabel} KYC Verification Request – Khabi-Teq`,
      html: adminEmailBody,
      text: adminEmailBody,
    });
  } catch (err) {
    console.warn("[notifyKycSubmitted] admin email failed:", err);
  }

  void notifyAllActiveAdmins({
    type: "kyc_submitted",
    title: `New ${roleLabel} KYC verification request`,
    message: `${firstName} (${params.email || "no email"}) submitted KYC for review.`,
    meta: {
      userId: params.userId,
      userType: params.userType,
      reviewPath,
    },
  });
}
