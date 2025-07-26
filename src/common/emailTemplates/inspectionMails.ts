export function InspectionLoiRejectionTemplate(
  buyerName: string,
  propertyData: any
): string {
  return `
    <p>Dear ${buyerName},</p>

    <p style="margin-top: 10px;">
      We appreciate your interest in collaborating with us on the following property. However, after reviewing the submitted <strong>Letter of Intention (LOI)</strong>, we regret to inform you that it has not been approved at this time.
    </p>

    <p style="margin-top: 10px;">
      The rejection may be due to missing, incomplete, or incorrect information in the LOI document. We encourage you to review the requirements and re-upload a corrected version for further consideration.
    </p>

    <ul style="background-color: #FDEDED; padding: 25px 20px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyData.propertyType}</li>
      <li><strong>Location:</strong> ${propertyData.location}</li>
      <li><strong>Expected Joint Venture Terms:</strong> ${propertyData.reason || 'Not specified'}</li>
    </ul>

    ${
      propertyData.letterOfIntention
        ? `
        <ul style="background-color: #FAFAFA; padding: 25px 20px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Submitted LOI Document:</strong></p>
          <li><a href="${propertyData.letterOfIntention}" style="color: #FF2539;">Click here</a> to view your uploaded LOI document</li>
        </ul>
        `
        : ''
    }

    <ul style="background-color: #FAFAFA; padding: 25px 20px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Attempted Inspection Schedule:</strong></p>
      <li><strong>Date:</strong> ${propertyData.inspectionDate}</li>
      <li><strong>Time:</strong> ${propertyData.inspectionTime}</li>
      <li><strong>Mode:</strong> ${propertyData.inspectionMode}</li>
    </ul>

    <p style="margin-top: 15px;">
      If you have questions about the rejection or need guidance on preparing a valid LOI, our support team is available to assist you.
    </p>

    <p style="margin-top: 10px;">Warm regards,<br/>The Khabiteq Team</p>
  `;
}
