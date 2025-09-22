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


export function FieldAgentAssignmentTemplate(
  fieldAgent: any,
  propertyData: any
): string {
  return `
    <p>Dear ${fieldAgent.firstName},</p>

    <p style="margin-top: 10px;">
      You have been <strong>assigned</strong> to conduct a property inspection.
    </p>

    <ul style="background-color: #FAFAFA; padding: 20px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Type:</strong> ${propertyData.propertyType}</li>
      <li><strong>Location:</strong> ${propertyData.location.area}, ${propertyData.location.localGovernment}, ${propertyData.location.state}</li>
    </ul>

    <ul style="background-color: #E6F7FF; padding: 20px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Inspection Schedule:</strong></p>
      <li><strong>Date:</strong> ${propertyData.inspectionDate}</li>
      <li><strong>Time:</strong> ${propertyData.inspectionTime}</li>
      <li><strong>Mode:</strong> ${propertyData.inspectionMode}</li>
    </ul>

    <p style="margin-top: 15px;">
      Please review the details and ensure you are available and prepared for the inspection.
    </p>

    <p style="margin-top: 10px;">Warm regards,<br/>The Khabiteq Team</p>
  `;
}

export function FieldAgentRemovalTemplate(
  fieldAgent: any,
  propertyData: any
): string {
  return `
    <p>Dear ${fieldAgent.firstName},</p>

    <p style="margin-top: 10px;">
      This is to inform you that you have been <strong>removed</strong> from the scheduled property inspection below.
    </p>

    <ul style="background-color: #FAFAFA; padding: 20px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Type:</strong> ${propertyData.propertyType}</li>
      <li><strong>Location:</strong> ${propertyData.location.area}, ${propertyData.location.localGovernment}, ${propertyData.location.state}</li>
    </ul>

    <ul style="background-color: #FFF4F4; padding: 20px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Inspection Schedule:</strong></p>
      <li><strong>Date:</strong> ${propertyData.inspectionDate}</li>
      <li><strong>Time:</strong> ${propertyData.inspectionTime}</li>
      <li><strong>Mode:</strong> ${propertyData.inspectionMode}</li>
    </ul>

    <p style="margin-top: 15px;">
      If you have any questions or believe this change was made in error, please contact the operations team.
    </p>

    <p style="margin-top: 10px;">Warm regards,<br/>The Khabiteq Team</p>
  `;
}


/**
 * Send Buyer Details to Seller
 */
export function BuyerDetailsToSellerTemplate(
  seller: any,
  buyer: any,
  inspection: any,
  property: any
): string {
  return `
    <p>Dear ${seller.firstName || seller.fullName},</p>

    <p style="margin-top: 10px;">
      Below are the details of the <strong>buyer</strong> interested in inspecting your property.
    </p>

    <ul style="background-color: #E6F7FF; padding: 20px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Buyer Information:</strong></p>
      <li><strong>Name:</strong> ${buyer.fullName}</li>
      <li><strong>Email:</strong> ${buyer.email}</li>
      <li><strong>Phone:</strong> ${buyer.phone || "Not provided"}</li>
    </ul>

    <ul style="background-color: #FAFAFA; padding: 20px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Type:</strong> ${property.propertyType}</li>
      <li><strong>Location:</strong> ${property.location.area}, ${property.location.localGovernment}, ${property.location.state}</li>
    </ul>

    <ul style="background-color: #FFF4F4; padding: 20px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Inspection Schedule:</strong></p>
      <li><strong>Date:</strong> ${inspection.inspectionDate}</li>
      <li><strong>Time:</strong> ${inspection.inspectionTime}</li>
      <li><strong>Mode:</strong> ${inspection.inspectionMode}</li>
    </ul>

    <p style="margin-top: 15px;">
      Kindly reach out to the buyer to confirm any further details regarding this inspection.
    </p>

    <p style="margin-top: 10px;">Warm regards,<br/>The Khabiteq Team</p>
  `;
}


/**
 * Send Seller Details to Buyer
 */
export function SellerDetailsToBuyerTemplate(
  buyer: any,
  seller: any,
  inspection: any,
  property: any
): string {
  return `
    <p>Dear ${buyer.firstName || buyer.fullName},</p>

    <p style="margin-top: 10px;">
      Below are the details of the <strong>seller</strong> for the property you are scheduled to inspect.
    </p>

    <ul style="background-color: #E6F7FF; padding: 20px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Seller Information:</strong></p>
      <li><strong>Name:</strong> ${seller.fullName}</li>
      <li><strong>Email:</strong> ${seller.email}</li>
      <li><strong>Phone:</strong> ${seller.phone || "Not provided"}</li>
    </ul>

    <ul style="background-color: #FAFAFA; padding: 20px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Type:</strong> ${property.propertyType}</li>
      <li><strong>Location:</strong> ${property.location.area}, ${property.location.localGovernment}, ${property.location.state}</li>
    </ul>

    <ul style="background-color: #FFF4F4; padding: 20px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Inspection Schedule:</strong></p>
      <li><strong>Date:</strong> ${inspection.inspectionDate}</li>
      <li><strong>Time:</strong> ${inspection.inspectionTime}</li>
      <li><strong>Mode:</strong> ${inspection.inspectionMode}</li>
    </ul>

    <p style="margin-top: 15px;">
      Please review these details and prepare for your scheduled inspection.
    </p>

    <p style="margin-top: 10px;">Warm regards,<br/>The Khabiteq Team</p>
  `;
}


