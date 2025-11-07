/**
 * Contact Confirmation — User
 */
export const generateDealSiteContactUserMail = ({
  name,
  email,
  subject,
  message,
  phoneNumber,
  whatsAppNumber,
  dealSiteName,
}: {
  name: string;
  email: string;
  subject?: string;
  message: string;
  phoneNumber?: string;
  whatsAppNumber?: string;
  dealSiteName: string;
}): string => {
  return `
  <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333;">
    <p>Dear ${name},</p>
    <p>Thank you for reaching out to <strong>${dealSiteName}</strong>. We have successfully received your message.</p>
    <p>Here’s a summary of your inquiry:</p>
    <ul>
      <li><strong>Email:</strong> ${email}</li>
      ${phoneNumber ? `<li><strong>Phone:</strong> ${phoneNumber}</li>` : ""}
      ${whatsAppNumber ? `<li><strong>WhatsApp:</strong> ${whatsAppNumber}</li>` : ""}
      ${subject ? `<li><strong>Subject:</strong> ${subject}</li>` : ""}
    </ul>
    <p style="margin-top: 10px;"><strong>Message:</strong></p>
    <p style="background: #f8f9fa; padding: 10px; border-radius: 4px;">${message}</p>

    <p>Our team will review your message and respond shortly.</p>
    <hr />
    <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
  </div>
  `;
};



/**
 * Contact Notification — DealSite Owner
 */
export const generateDealSiteContactOwnerMail = ({
  ownerName,
  dealSiteName,
  name,
  email,
  phoneNumber,
  whatsAppNumber,
  subject,
  message,
}: {
  ownerName: string;
  dealSiteName: string;
  name: string;
  email: string;
  phoneNumber?: string;
  whatsAppNumber?: string;
  subject?: string;
  message: string;
}): string => {
  return `
  <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333;">
    <p>Dear ${ownerName},</p>
    <p>You’ve received a new inquiry via your DealSite <strong>${dealSiteName}</strong>. Below are the details:</p>
    <ul>
      <li><strong>Name:</strong> ${name}</li>
      <li><strong>Email:</strong> ${email}</li>
      ${phoneNumber ? `<li><strong>Phone:</strong> ${phoneNumber}</li>` : ""}
      ${whatsAppNumber ? `<li><strong>WhatsApp:</strong> ${whatsAppNumber}</li>` : ""}
      ${subject ? `<li><strong>Subject:</strong> ${subject}</li>` : ""}
    </ul>

    <p style="margin-top: 10px;"><strong>Message:</strong></p>
    <p style="background: #f8f9fa; padding: 10px; border-radius: 4px;">${message}</p>

    <p>Please follow up with the sender as soon as possible.</p>
    <hr />
    <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
  </div>
  `;
};
