import { EmailData, InspectionActionData } from "../types/inspection.types";
import { generalTemplate } from "../common/email.template";
import sendEmail from "../common/send.email";
import { generateNegotiationEmailTemplate } from "../utils/emailTemplates/generateNegotiationEmailTemplate";
import { buildBuyerInspectionMeta } from "../utils/notificationDeepLinks";

interface EmailServiceParams {
  actionData: InspectionActionData;
  buyerData: any;
  sellerData: any;
  emailData: EmailData;
  isBuyer: boolean;
  isSeller: boolean;
}

export class InspectionEmailService {
  async sendActionEmails(params: EmailServiceParams): Promise<{ buyer: boolean; seller: boolean }> {
    const { actionData, buyerData, sellerData, emailData, isBuyer, isSeller } = params;

    try {
      // Email to buyer (determine if they are the initiator)
      const buyerIsInitiator = isBuyer;
      const buyerEmailTemplate = generateNegotiationEmailTemplate({
        userType: isSeller ? "seller" : "buyer",
        action: actionData.action,
        buyerName: buyerData.fullName,
        sellerName: sellerData.fullName,
        recipientType: "buyer",
        payload: emailData,
        isLOI: actionData.inspectionType === "LOI",
        isInitiator: buyerIsInitiator,
      });

      // Email to seller (determine if they are the initiator)
      const sellerIsInitiator = isSeller;
      const sellerEmailTemplate = generateNegotiationEmailTemplate({
        userType: isSeller ? "seller" : "buyer",
        action: actionData.action,
        buyerName: buyerData.fullName,
        sellerName: sellerData.fullName,
        recipientType: "seller",
        payload: emailData,
        isLOI: actionData.inspectionType === "LOI",
        isInitiator: sellerIsInitiator,
      });

      const linkMatch = String(
        (emailData as any)?.responseLink ||
          (emailData as any)?.checkLink ||
          ""
      ).match(/\/secure-buyer-response\/[^/]+\/([^/?#]+)/i);
      const inspectionId = String(
        (emailData as any)?.inspectionId ||
          (actionData as any)?.inspectionId ||
          linkMatch?.[1] ||
          ""
      );
      const buyerMeta = inspectionId
        ? buildBuyerInspectionMeta(inspectionId)
        : undefined;

      // Send both emails — buyer inbox gets structured deep-link meta
      const emailResults = await Promise.allSettled([
        sendEmail({
          to: buyerData.email,
          subject: buyerEmailTemplate.subject,
          html: generalTemplate(buyerEmailTemplate.html),
          text: buyerEmailTemplate.text,
          ...(buyerMeta ? { inboxMeta: buyerMeta } : {}),
        }),
        sendEmail({
          to: sellerData.email,
          subject: sellerEmailTemplate.subject,
          html: generalTemplate(sellerEmailTemplate.html),
          text: sellerEmailTemplate.text,
          // Seller/practitioner emails are User accounts; skip buyer inbox
          skipBuyerInbox: true,
        }),
      ]);

      console.log(
        `📧 Emails sent - Buyer: ${buyerData.email} (${buyerEmailTemplate.subject}), Seller: ${sellerData.email} (${sellerEmailTemplate.subject})`
      );

      const emailsSent = {
        buyer: emailResults[0].status === "fulfilled",
        seller: emailResults[1].status === "fulfilled",
      };

      if (emailResults[0].status === "rejected") {
        console.error("Failed to send email to buyer:", emailResults[0].reason);
      }

      if (emailResults[1].status === "rejected") {
        console.error(
          "Failed to send email to seller:",
          emailResults[1].reason
        );
      }

      return emailsSent;
    } catch (emailError) {
      console.error("Failed to send emails:", emailError);
      return { buyer: false, seller: false };
    }
  }
}