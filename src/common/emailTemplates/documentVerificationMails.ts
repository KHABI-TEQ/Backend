interface VerificationDoc {
  documentType: string;
  documentNumber: string;
}

interface GenerateVerificationEmailParams {
  fullName: string;
  phoneNumber: string;
  address: string;
  amountPaid: number;
  documents: VerificationDoc[];
}

export const generateVerificationSubmissionEmail = ({
  fullName,
  phoneNumber,
  address,
  amountPaid,
  documents,
}: GenerateVerificationEmailParams): string => {
  const docsList = documents
    .map(
      (doc, index) =>
        `<li><strong>Document ${index + 1}:</strong> ${doc.documentType} (No: ${doc.documentNumber})</li>`
    )
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${fullName},</p>

      <p>Thank you for submitting your documents for verification.</p>

      <p>We have received the following details:</p>

      <ul style="padding-left: 20px;">
        <li><strong>Full Name:</strong> ${fullName}</li>
        <li><strong>Phone Number:</strong> ${phoneNumber}</li>
        <li><strong>Address:</strong> ${address}</li>
        <li><strong>Amount Paid:</strong> ₦${amountPaid.toLocaleString()}</li>
        <li><strong>Transaction Receipt:</strong> Uploaded Successfully</li>
      </ul>

      <p><strong>Document Details:</strong></p>
      <ul style="padding-left: 20px;">
        ${docsList}
      </ul>

      <p>Your submission is currently under review. We’ll notify you once the process is completed or if any clarification is needed.</p>

      <p>Thank you for choosing our service.</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};
