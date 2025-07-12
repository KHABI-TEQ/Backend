import { EmailData, InspectionActionData } from "../types/inspection.types";
import { generalTemplate } from "../common/email.template";
import sendEmail from "../common/send.email";
import { generateNegotiationEmailTemplate } from "../utils/emailTemplates/generateNegotiationEmailTemplate";

interface EmailServiceParams {
  actionData: InspectionActionData;
  buyerData: any;
  sellerData: any;
  emailSubject: string;
  emailData: EmailData;
  isBuyer: boolean;
  isSeller: boolean;
}

export class InspectionEmailService {
  async sendActionEmails(params: EmailServiceParams): Promise<{ buyer: boolean; seller: boolean }> {
    const { actionData, buyerData, sellerData, emailSubject, emailData, isBuyer, isSeller } = params;

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

      // Determine email subjects based on initiator status
      const buyerEmailSubject = buyerIsInitiator 
        ? `${emailSubject} - Confirmation`
        : emailSubject;
      
      const sellerEmailSubject = sellerIsInitiator 
        ? `${emailSubject} - Confirmation`
        : emailSubject;

      // Send both emails
      const emailResults = await Promise.allSettled([
        sendEmail({
          to: buyerData.email,
          subject: buyerEmailSubject,
          html: generalTemplate(buyerEmailTemplate.html),
          text: buyerEmailTemplate.text,
        }),
        sendEmail({
          to: sellerData.email,
          subject: sellerEmailSubject,
          html: generalTemplate(sellerEmailTemplate.html),
          text: sellerEmailTemplate.text,
        }),
      ]);

      console.log(
        `📧 Emails sent - Buyer: ${buyerData.email} (${buyerEmailSubject}), Seller: ${sellerData.email} (${sellerEmailSubject})`
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