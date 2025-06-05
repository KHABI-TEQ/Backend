export const generalTemplate = (body: string): string => {
  return `
        <html>
<head>
    <meta charset="UTF-8">
    <title>Inspection Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; height: 100%; display: flex; align-items: center; justify-content: center;">
    
    <!-- Main Wrapper -->
    <table role="presentation" width="60%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F0F3F1" style="margin: auto; padding-bottom: 40px">
        <tr>

            <!-- Header Logo -->
            <tr>
                <td align="start" style="padding: 50px 0px 0 100px;">
                    <img src="https://res.cloudinary.com/dkqjneask/image/upload/v1744050595/logo_1_flo1nf.png" alt="Khabi-teq Realty Logo" width="150">
                </td>
            </tr>
            <td align="center" style="padding: 30px;">
                
                <!-- Email Container -->
                <table role="presentation" width="90%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);">
                
                    <!-- Email Body -->
                    <tr>
                        <td style="padding: 40px; font-family: Arial, sans-serif; font-size: 16px; color: #333; line-height: 1.6;">
                            ${body}
                            <p>Best regards,</p>
                            <p><strong>Khabiteq Realty</strong></p>
                        </td>
                    </tr>
                </table>
                                 <!-- Footer Section -->
                                 <tr>
                                    <td align="start" style="padding: 20px 0px 0 100px;">
                                        
                                        <!-- Social Media Icons -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td style="padding: 0 15px; ">
                                                    <a href="https://www.facebook.com/profile.php?id=61568584928290&mibextid=ZbWKwL"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" width="30" alt="Facebook"></a>
                                                </td>
                                                <td style="padding: 0 15px;">
                                                    <a href="https://www.instagram.com/khabiteq_realty/profilecard/?igsh=YjRvanQ3YmlmdDNl"><img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" width="30" alt="Instagram"></a>
                                                </td>
                                                <td style="padding: 0 15px;">
                                                    <a href="#"><img src="https://cdn-icons-png.flaticon.com/512/145/145807.png" width="30" alt="LinkedIn"></a>
                                                </td>
                                                <td style="padding: 0 15px;">
                                                    <a href="https://x.com/Khabi_Teq?t=Jq6MpEMfwfJ6aQ46CYGPpQ&s=09"><img src="https://cdn-icons-png.flaticon.com/512/733/733635.png" width="30" alt="Twitter"></a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
            
                                <!-- Copyright Section -->
                                <tr>
                                    <td align="start" style="padding: 40px 0px 0 100px; font-family: Arial, sans-serif; font-size: 12px; color: #777;">
                                        <img src="https://res.cloudinary.com/dkqjneask/image/upload/v1744050595/Black_Logo_1_gkxdph.png" alt="Khabi-teq Realty Logo" width="120"><br><br>
                                        
                                        <p style="margin-top: 20px;">Copyright © 2020 Khabiteq Realty Limited.<br>
                                        Block B, Suite 8SF Goldrim Plaza, Yaya Abatan, Ogba Lagos.</p>
                                    </td>
                                </tr>
            </td>
        </tr>
    </table>

</body>
</html>
        `;
};

export const propertyRequestTemplate = (buyerName: string, propertyAddress: string): string => {
  return `
                <html>
                <body>
                        <p>Dear ${buyerName},</p>
                        <p>Thank you for your interest in inspecting the property at ${propertyAddress}. We are currently
                        confirming availability and will update you shortly with the next steps.</p>
                        <p>Best regards,<br/>
                        Khabi-Teq Realty</p> 
                </body>
                </html>
        `;
};

export const agentNotificationTemplate = (agentName: string, propertyAddress: string): string => {
  return `
                        <p>
                        Dear ${agentName},

                        A buyer has requested an inspection for a property linked to one of your briefs. Please confirm the property's availability for inspection by logging into your Agent Portal and updating the status.

                        Thank you for your prompt attention to this matter.
                        </p>    
                        `;
};

export const propertyAvailableTemplate = (agentName: string, propertyAddress: string, calendlyLink: string): string => {
  return `
                <html>
                <body>
                        <p>Dear ${agentName},</p>
                        <p>We are pleased to inform you that the property at ${propertyAddress} is available for inspection.
                        Please select a convenient date and time using the link below:</p>
                        <p>📅 <a href="${calendlyLink}">Schedule Inspection</a></p>
                        <p>Best regards,<br/>
                        Khabi-Teq Realty</p>
                </body>
                </html>
        `;
};

export const propertyNotAvailableTemplate = (recepientName: string, propertyAddress: string): string => {
  return `
                <html>
                <body>
                        <p>Dear ${recepientName},</p>
                        <p>We regret to inform you that ${propertyAddress} is no longer available. However, we
                        have similar properties that match your criteria. Please let us know if you’d like to
                        explore them.</p>
                        <p>Best regards,<br/>
                        Khabi-Teq Realty</p>
                </body>
                </html>
        `;
};

export const inspectionScheduledTemplate = (agentName: string, propertyAddress: string, dateTime: string): string => {
  return `
      <div>
          <p>Dear ${agentName},</p>
          <p>The inspection for ${propertyAddress} has been scheduled for ${dateTime}. Please
          ensure you are available to meet the buyer. Contact us if any issues arise.</p>
          <p>Best regards,<br/>
          Khabi-Teq Realty</p>
      </div>
                                `;
};

export const verifyEmailTemplate = (name: string, verificationLink: string): string => {
  return `
        <p>Dear ${name},</p>
        <p>Thank you for registering with Khabi-Teq Realty. To complete your onboarding process, please verify your email address by clicking the link below:</p>
        <p>🔗 <a href="${verificationLink}">Verify Email</a></p>
        <p>If you did not request this, please ignore this email.</p>
`;
};

export const accountUnderReviewTemplate = (name: string): string => {
  return `
        <p>Hi ${name},</p>
        <p>Thank you for registering with Khabi-Teq Realty. Your agent account is currently <strong>under review</strong>. We are verifying your submitted documents and details. You will receive a confirmation email once your account is approved. If we require any additional information, we will reach out to you.</p>
        `;
};

export const accountUpgradeTemplate = (name: string): string => {
  return `
                <p>Hi ${name},</p>
                <p>Thank you for your recent upgrade request with Khabi-Teq Realty. Your request is currently under review. We will notify you once the review is complete.</p>
                `;
};

export const accountUpgradeApprovedTemplate = (name: string): string => {
  return `
                        <p>Dear ${name},</p>
                        <p>Congratulations! Your upgrade request with Khabi-Teq Realty has been approved. You now have access to enhanced features and benefits. We are excited to support your growth in the real estate market.</p>
                        `;
};

export const accountUpgradeDisapprovedTemplate = (name: string): string => {
  return `
                                <p>Dear ${name},</p>
                                <p>Thank you for your recent upgrade request with Khabi-Teq Realty. After careful consideration, we regret to inform you that your request has not been approved at this time. If you have any questions or would like to discuss further, please feel free to reach out.</p>
                                `;
};

export const accountApproved = (name: string): string => {
  return `
                <p>Dear ${name},</p>
                <p>Welcome to Khabi-Teq Realty! We are excited to have you join our exclusive network of partner agents. Our platform is designed to empower you with direct access to buyer preferences, streamlined transaction processes, and advanced tools to boost your business.</p>
                <p>Get ready to unlock new opportunities and grow your real estate career with us.</p>
        `;
};

export const accountDisaapproved = (name: string): string => {
  return `
        <p>
        Dear ${name},

        Thank you for your interest in joining Khabi-Teq Realty. After reviewing your application, we regret to inform you that your account has not been approved at this time.

        If you have any questions or wish to provide additional information, please feel free to contact us at agent.support@khabiteqrealty.com.
        </p>
        `;
};

export function generatePropertyRentBriefEmail(data: any) {
  return `
  <div class="container">
            <h2>New Property Rental Brief Created</h2>
            <p>A new property rental brief has been submitted for rent. Here are the details:</p>
            
            <div class="details">
                <p><strong>Property Type:</strong> ${data.propertyType}</p>
                <p><strong>Condition:</strong> ${data.propertyCondition}</p>
                <p><strong>Location:</strong> ${data.location.state}, ${data.location.localGovernment}, ${
    data.location.area
  }</p>
                <p><strong>Rental Price:</strong> ₦${data.rentalPrice}</p>
                <p><strong>Number of Bedrooms:</strong> ${data.noOfBedrooms}</p>
                <p><strong>Features:</strong> ${data.features.map((f: any) => f.featureName).join(', ')}</p>
                <p><strong>Tenant Criteria:</strong> ${data.tenantCriteria.map((c: any) => c.criteria).join(', ')}</p>
                <p>Owner Email: ${data.owner.email}</p>
                <p><strong>Owner Name:</strong> ${data.owner.fullName}</p>
                <p><strong>Owner Phone:</strong> ${data.owner.phoneNumber}</p>

                <p><strong>Owner Status:</strong> ${data.areYouTheOwner ? 'Yes' : 'No'}</p>
                <p><strong>Availability:</strong> ${data.isAvailable}</p>
                <p><strong>Budget Range:</strong> ${data.budgetRange || 'N/A'}</p>
            </div>
    
            ${
              data.pictures && data.pictures.length
                ? `
            <h3>Property Pictures</h3>
            <div class="pictures">
                ${data.pictures
                  .map(
                    (pic: any) =>
                      `<img src="${pic}" alt="Property Image" width="400px" height="400px" style="margin-top: 10px; border-radius: 5px;">`
                  )
                  .join('')}
            </div>
            `
                : ''
            }
            
            ${data.isAdmin ? '<p>Admin, please review and take the necessary actions.</p>' : ''}
        </div>
  `;
}

export function generatePropertySellBriefEmail(data: any) {
  return ` <div class="container">
            <h2>New Property Brief Created</h2>
            <p>A new property brief has been submitted for sale. Here are the details:</p>
            
            <div class="details">
                <p><strong>Property Type:</strong> ${data.propertyType}</p>
                <p><strong>Location:</strong> ${data.location.state}, ${data.location.localGovernment}, ${
    data.location.area
  }</p>
                <p><strong>Price:</strong> ₦${data.price || data.rentalPrice}</p>
                <p><strong>Number of Bedrooms:</strong> ${data.propertyFeatures?.noOfBedrooms || data.noOfBedrooms}</p>
                <p><strong>Features:</strong> ${
                  data.propertyFeatures?.additionalFeatures?.join(', ') ||
                  data.features?.map((f: any) => f.featureName).join(', ')
                }</p>
                ${
                  data.tenantCriteria.length > 0 &&
                  `<p><strong>Tenant Criteria:</strong> ${data.tenantCriteria
                    ?.map((c: any) => c.criteria)
                    .join(', ')}</p>`
                }
               ${
                 data.docOnProperty.length > 0 &&
                 `<p><strong>Documents on Property:</strong> ${data.docOnProperty
                   ?.map((doc: any) => `${doc.docName} (${doc.isProvided ? 'Provided' : 'Not Provided'})`)
                   .join(', ')}</p>`
               }
                <p>Owner Email: ${data.owner.email}</p>
                <p><strong>Owner Name:</strong> ${data.owner.fullName}</p>
                <p><strong>Owner Phone:</strong> ${data.owner.phoneNumber}</p>
                <p><strong>Owner Status:</strong> ${data.areYouTheOwner ? 'Yes' : 'No'}</p>
               ${
                 data.docOnProperty.length > 0 &&
                 `<p><strong>Usage Options:</strong> ${data.docOnProperty?.join(', ')}</p>`
               }
               
                ${data.budgetRange && `<p><strong>Budget Range:</strong> ${data.budgetRange}</p>`}
            </div>
    
            ${
              data.pictures && data.pictures.length
                ? `
            <h3>Property Pictures</h3>
            <div class="pictures">
                ${data.pictures
                  .map(
                    (pic: any) =>
                      `<img src="${pic}" alt="Property Image" width="400px" height="400px" style="margin-top: 10px; border-radius: 5px;">`
                  )
                  .join('')}
            </div>
            `
                : ''
            }
            
            ${data.isAdmin ? '<p>Admin, please review and take the necessary actions.</p>' : ''}
            
        </div>`;
}

export function generatePropertPreferenceBriefEmail(data: any) {
  return ` <div class="container">
            <h2>New Property Preference</h2>
            <p>A new property preference has been submitted. Here are the details:</p>
            
            <div class="details">
                <p><strong>Property Type:</strong> ${data.propertyType}</p>
                <p><strong>Location:</strong> ${data.location.state}, ${data.location.localGovernment}, ${
    data.location.area
  }</p>
                <p><strong>Price:</strong> ₦${data.price || data.rentalPrice}</p>
                <p><strong>Number of Bedrooms:</strong> ${data.propertyFeatures?.noOfBedrooms || data.noOfBedrooms}</p>
                <p><strong>Features:</strong> ${
                  data.propertyFeatures?.additionalFeatures?.join(', ') ||
                  data.features?.map((f: any) => f.featureName).join(', ')
                }</p>
                ${
                  data.tenantCriteria.length > 0 &&
                  `<p><strong>Tenant Criteria:</strong> ${data.tenantCriteria
                    ?.map((c: any) => c.criteria)
                    .join(', ')}</p>`
                }
               ${
                 data.docOnProperty.length > 0 &&
                 `<p><strong>Documents on Property:</strong> ${data.docOnProperty
                   ?.map((doc: any) => `${doc.docName} (${doc.isProvided ? 'Provided' : 'Not Provided'})`)
                   .join(', ')}</p>`
               }
               
               ${
                 data.docOnProperty.length > 0 &&
                 `<p><strong>Usage Options:</strong> ${data.docOnProperty?.join(', ')}</p>`
               }
               
                ${data.budgetRange && `<p><strong>Budget Range:</strong> ${data.budgetRange}</p>`}
            </div>
    
            ${
              data.pictures && data.pictures.length
                ? `
            <h3>Property Pictures</h3>
            <div class="pictures">
                ${data.pictures
                  .map(
                    (pic: any) =>
                      `<img src="${pic}" alt="Property Image" width="400px" height="400px" style="margin-top: 10px; border-radius: 5px;">`
                  )
                  .join('')}
            </div>
            `
                : ''
            }
            
            ${data.isAdmin ? '<p>Admin, please review and take the necessary actions.</p>' : ''}
            
        </div>`;
}

export function generatePropertyBriefEmail(ownerName: string, data: any) {
  let details = '';

  if (data.briefType) details += `<p><strong>Brief Type:</strong> ${data.briefType}</p>`;
  if (data.propertyType) details += `<p><strong>Property Type:</strong> ${data.propertyType}</p>`;
  if (data.propertyCondition) details += `<p><strong>Property Condition:</strong> ${data.propertyCondition}</p>`;
  if (data.location)
    details += `<p><strong>Location:</strong> ${data.location.state}, ${data.location.localGovernment}, ${data.location.area}</p>`;
  if (data.price) details += `<p><strong>Price:</strong> ₦${data.price}</p>`;
  if (data.landSize)
    details += `<p><strong>Land Size:</strong> ${data.landSize.size} ${data.landSize.measurementType}</p>`;
  if (data.buildingType) details += `<p><strong>Building Type:</strong> ${data.buildingType}</p>`;
  if (data.additionalFeatures?.noOfBedrooms)
    details += `<p><strong>Number of Bedrooms:</strong> ${data.additionalFeatures.noOfBedrooms}</p>`;
  if (data.additionalFeatures?.noOfBathrooms)
    details += `<p><strong>Number of Bathrooms:</strong> ${data.additionalFeatures.noOfBathrooms}</p>`;
  if (data.additionalFeatures?.noOfToilets)
    details += `<p><strong>Number of Toilets:</strong> ${data.additionalFeatures.noOfToilets}</p>`;
  if (data.additionalFeatures?.noOfCarParks)
    details += `<p><strong>Number of Car Parks:</strong> ${data.additionalFeatures.noOfCarParks}</p>`;
  if (data.additionalFeatures?.additionalFeatures?.length)
    details += `<p><strong>Additional Features:</strong> ${data.additionalFeatures.additionalFeatures.join(', ')}</p>`;
  if (data.features?.length) details += `<p><strong>Features:</strong> ${data.features.join(', ')}</p>`;
  if (data.tenantCriteria?.length)
    details += `<p><strong>Tenant Criteria:</strong> ${data.tenantCriteria.join(', ')}</p>`;
  // if (data.docOnProperty?.length)
  //   details += `<p><strong>Documents on Property:</strong> ${data.docOnProperty.join(', ')}</p>`;
  // if (data.owner?.email) details += `<p><strong>Owner Email:</strong> ${data.owner.email}</p>`;
  // if (data.owner?.fullName) details += `<p><strong>Owner Name:</strong> ${data.owner.fullName}</p>`;
  // if (data.owner?.phoneNumber) details += `<p><strong>Owner Phone:</strong> ${data.owner.phoneNumber}</p>`;
  // if (typeof data.areYouTheOwner === 'boolean')
  //   details += `<p><strong>Owner Status:</strong> ${data.areYouTheOwner ? 'Yes' : 'No'}</p>`;
  // if (typeof data.isAvailable !== 'undefined')
  //   details += `<p><strong>Availability:</strong> ${data.isAvailable}</p>`;
  // if (data.budgetRange) details += `<p><strong>Budget Range:</strong> ${data.budgetRange}</p>`;
  // if (typeof data.isApproved === 'boolean')
  //   details += `<p><strong>Approved:</strong> ${data.isApproved ? 'Yes' : 'No'}</p>`;
  // if (typeof data.isRejected === 'boolean')
  //   details += `<p><strong>Rejected:</strong> ${data.isRejected ? 'Yes' : 'No'}</p>`;
  details += `<p><strong>Under Review:</strong>Yes</p>`;

  return `
      <p>Hi ${ownerName},</p>
      <p>Thank you for submitting your property brief to Khabi-Teq Realty. We have received your brief with the following details:</p>
      <ul class="" style="background-color: #E4EFE7; padding-top: 25px; padding-right: 20px; padding-bottom: 25px; padding-left: 20px; gap: 10px; border-radius: 10px;">
        ${details}
        ${
          data.pictures && data.pictures.length
            ? `
        <h3>Property Pictures</h3>
        <div style=" display: flex; flex-wrap: wrap; gap: 10px;">
          ${data.pictures
            .map(
              (pic: string) =>
                `<img src="${pic}" alt="Property Image" width="400px" height="400px" style="margin-top: 10px; border-radius: 5px;">`
            )
            .join('')}
        </div>
        `
            : ''
        }
      
      </ul>
  `;
}

export function generatePropertyPreferenceBriefEmail(ownerName: string, data: any) {
  let details = '';

  // if (data.briefType) details += `<p><strong>Brief Type:</strong> ${data.briefType}</p>`;
  if (data.propertyType) details += `<p><strong>Property Type:</strong> ${data.propertyType}</p>`;
  if (data.location)
    details += `<p><strong>Location:</strong> ${data.location.state}, ${data.location.localGovernment}, ${data.location.area}</p>`;
  if (data.price) details += `<p><strong>Price Range:</strong> ₦${data.budgetMin} - #${data.budgetMin}</p>`;
  if (data.buildingType) details += `<p><strong>Building Type:</strong> ${data.buildingType}</p>`;
  details += `<p><strong>Property Features:</strong> ${data.additionalFeatures.additionalFeatures.join(', ')}</p>`;
  if (data.landSize)
    details += `<p><strong>Land Size:</strong> ${data.landSize.size} ${data.landSize.measurementType}</p>`;
  // if (data.docOnProperty?.length)
  //   details += `<p><strong>Documents on Property:</strong> ${data.docOnProperty.join(', ')}</p>`;
  // if (data.owner?.email) details += `<p><strong>Owner Email:</strong> ${data.owner.email}</p>`;
  // if (data.owner?.fullName) details += `<p><strong>Owner Name:</strong> ${data.owner.fullName}</p>`;
  // if (data.owner?.phoneNumber) details += `<p><strong>Owner Phone:</strong> ${data.owner.phoneNumber}</p>`;
  // if (typeof data.areYouTheOwner === 'boolean')
  //   details += `<p><strong>Owner Status:</strong> ${data.areYouTheOwner ? 'Yes' : 'No'}</p>`;
  // if (typeof data.isAvailable !== 'undefined')
  //   details += `<p><strong>Availability:</strong> ${data.isAvailable}</p>`;
  // if (data.budgetRange) details += `<p><strong>Budget Range:</strong> ${data.budgetRange}</p>`;
  // if (typeof data.isApproved === 'boolean')
  //   details += `<p><strong>Approved:</strong> ${data.isApproved ? 'Yes' : 'No'}</p>`;
  // if (typeof data.isRejected === 'boolean')
  //   details += `<p><strong>Rejected:</strong> ${data.isRejected ? 'Yes' : 'No'}</p>`;

  return `
      <p>Hi ${ownerName},</p>
      <p>Thank you for sharing your preferences with Khabi-Teq Realty! We'll match you with property briefs tailored to your needs:</p>
      <ul class="" style="background-color: #E4EFE7; padding-top: 25px; padding-right: 20px; padding-bottom: 25px; padding-left: 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Submitted Preference: </strong></p>
        ${details}
       
      
      </ul>
      <p>Our team will get back to you with the necessary feedback.</p>
      <p>Thank you for trusting Khabi-Teq Realty with your property listing.</p>
  `;
}

export function propertySellPreferenceTemplate(data: any) {
  return `
                        <p>Hi ${data.fullName},</p>
                        <p>A property preference for sale with the following details was submitted:</p>
                
                        <ul class="" style="background-color: #E4EFE7; padding-top: 25px; padding-right: 20px; padding-bottom: 25px; padding-left: 20px; gap: 10px; border-radius: 10px;">
                                <p>Submitted Preference: </p>
                                                        <li><strong>Property Type:</strong> ${data.propertyType}</li>
                                                
                                                        <li><strong>Location:</strong> ${data.location.state}, ${
    data.location.localGovernment
  }, ${data.location.area}</li>
                                                        <li><strong>Price Range:</strong> ₦${data.price}</li>
                                                        <li><strong>Usage Options:</strong> ${
                                                          data.usageOptions?.join(', ') || 'N/A'
                                                        }</li>
                                                        <li><strong>Property Features:</strong>
                                                        <ul>
                                                                                        ${Object.entries(
                                                                                          data.propertyFeatures
                                                                                        )
                                                                                          .map(
                                                                                            ([key, value]) =>
                                                                                              `<li>${key}: ${value}</li>`
                                                                                          )
                                                                                          .join('')}
                                                        </ul>
                                                        </li>
                
                                        </ul>
                        <p>Our team will review your submission and contact you if any additional information is needed or once your preference is approved.</p>
                        <p>Thank you for trusting Khabi-Teq Realty with your property needs.</p>
                        `;
}

export function propertyRentPreferenceTemplate(data: any) {
  return `
                        <p>Hi ${data.fullName},</p>
                        <p>A property preference for rent with the following details was submitted:</p>
                
                        <ul class="" style="background-color: #E4EFE7; padding-top: 25px; padding-right: 20px; padding-bottom: 25px; padding-left: 20px; gap: 10px; border-radius: 10px;">
                                <p>Submitted Preference: </p>
                                                        <li><strong>Property Type:</strong> ${data.propertyType}</li>
                                                
                                                        <li><strong>Location:</strong> ${data.location.state}, ${
    data.location.localGovernment
  }, ${data.location.area}</li>
                                                        <li><strong>Rental Price:</strong> ₦${data.rentalPrice}</li>
                                                        <li><strong>Tenant Criteria:</strong> ${data.tenantCriteria
                                                          .map((c: any) => c.criteria)
                                                          .join(', ')}</li>
                                                        <li><strong>Property Features:</strong>
                                                        <ul>
                                                                                        ${data.features
                                                                                          .map(
                                                                                            (feature: any) =>
                                                                                              `<li>${feature.featureName}</li>`
                                                                                          )
                                                                                          .join('')}
                                                        </ul>
                                                        </li>
                
                                        </ul>
                        <p>Our team will review your submission and contact you if any additional information is needed or once your preference is approved.</p>
                        <p>Thank you for trusting Khabi-Teq Realty with your property needs.</p>
                        `;
}

export function buyerPropertyRentPreferenceTemplate(data: any) {
  return `
                        <p>Hi ${data.fullName},</p>
                        <p>Thank you for submitting your property rent preference to Khabi-Teq Realty. We have received your preference with the following details:</p>
                
                        <ul class="" style="background-color: #E4EFE7; padding-top: 25px; padding-right: 20px; padding-bottom: 25px; padding-left: 20px; gap: 10px; border-radius: 10px;">
                                <p>Submitted Preference: </p>
                                                        <li><strong>Property Type:</strong> ${data.propertyType}</li>
                                                
                                                        <li><strong>Location:</strong> ${data.location.state}, ${
    data.location.localGovernment
  }, ${data.location.area}</li>
                                                        <li><strong>Rental Price:</strong> ₦${data.rentalPrice}</li>
                                                        <li><strong>Tenant Criteria:</strong> ${data.tenantCriteria
                                                          .map((c: any) => c.criteria)
                                                          .join(', ')}</li>
                                                        <li><strong>Property Features:</strong>
                                                        <ul>
                                                                                        ${data.features
                                                                                          .map(
                                                                                            (feature: any) =>
                                                                                              `<li>${feature.featureName}</li>`
                                                                                          )
                                                                                          .join('')}
                                                        </ul>
                                                        </li>
                
                                        </ul>
                        <p>Our team will review your submission and contact you if any additional information is needed or once your preference is approved.</p>
                        <p>Thank you for trusting Khabi-Teq Realty with your property needs.</p>
                        `;
}

export function buyerPropertySellPreferenceTemplate(data: any) {
  return `
                        <p>Hi ${data.fullName},</p>
                        <p>Thank you for submitting your property preference to Khabi-Teq Realty. We have received your preference with the following details:</p>
                
                        <ul class="" style="background-color: #E4EFE7; padding-top: 25px; padding-right: 20px; padding-bottom: 25px; padding-left: 20px; gap: 10px; border-radius: 10px;">
                                <p>Submitted Brief: </p>
                                                        <li><strong>Property Type:</strong> ${data.propertyType}</li>
                                                
                                                        <li><strong>Location:</strong> ${data.location.state}, ${
    data.location.localGovernment
  }, ${data.location.area}</li>
                                                        <li><strong>Price Range:</strong> ₦${data.price}</li>
                                                        <li><strong>Usage Options:</strong> ${
                                                          data.usageOptions?.join(', ') || 'N/A'
                                                        }</li>
                                                        <li><strong>Property Features:</strong>
                                                        <ul>
                                                                                        ${Object.entries(
                                                                                          data.propertyFeatures
                                                                                        )
                                                                                          .map(
                                                                                            ([key, value]) =>
                                                                                              `<li>${key}: ${value}</li>`
                                                                                          )
                                                                                          .join('')}
                                                        </ul>
                                                        </li>
                
                                        </ul>
                        <p>Our team will review your submission and contact you if any additional information is needed or once your a preference is found.</p>
                        <p>Thank you for trusting Khabi-Teq Realty with your property listing.</p>
                        `;
}

export function ForgotPasswordVerificationTemplate(email: string, verificationLink: string): string {
  return `
                        <div>
                                <p>Dear ${email},</p>
                                <p>You requested to reset your password. Please click the link below to reset your password:</p>
                                <p>🔗 <a href="${verificationLink}">Reset Password</a></p>
                                <p>Best regards,<br/>
                                Khabi-Teq Realty</p>
                        </div>
                      
                `;
}

export function PropertyApprovedOrDisapprovedTemplate(name: string, status: string, data: any): string {
  return `
<div class="">
                        <h1> Hello ${name},</h1>
                                <h2>Property ${status}</h2>
                                <p>Your property was ${status}. Here are the details:</p>
                                
                                <div class="details">
                                        <p><strong>Property Type:</strong> ${data.propertyType}</p>
                                        <p><strong>Location:</strong> ${data.location.state}, ${
    data.location.localGovernment ? data.location.localGovernment + ', ' : ''
  }${data.location.area}</p>
                                        <p><strong>Price:</strong> ₦${data.price || data.rentalPrice}</p>
                                        <p><strong>Number of Bedrooms:</strong> ${
                                          data.propertyFeatures?.noOfBedrooms || data.noOfBedrooms
                                        }</p>
                                        <p><strong>Features:</strong> ${
                                          data.propertyFeatures?.additionalFeatures?.join(', ') ||
                                          data.features?.map((f: any) => f.featureName).join(', ')
                                        }</p>
                                        <p><strong>Tenant Criteria:</strong> ${
                                          data.tenantCriteria?.map((c: any) => c.criteria).join(', ') || 'N/A'
                                        }</p>
                                        <p><strong>Documents on Property:</strong> ${
                                          data.docOnProperty
                                            ?.map(
                                              (doc: any) =>
                                                `${doc.docName} (${doc.isProvided ? 'Provided' : 'Not Provided'})`
                                            )
                                            .join(', ') || 'N/A'
                                        }</p>
                                        <p><strong>Usage Options:</strong> ${data.usageOptions?.join(', ') || 'N/A'}</p>
                                        <p><strong>Availability:</strong> ${data.isAvailable ? 'Yes' : 'No'}</p>
                                        <p><strong>Budget Range:</strong> ${data.budgetRange || 'N/A'}</p>
                                </div>
                                
                                ${
                                  data.pictures && data.pictures.length
                                    ? `
                                <h3>Property Pictures</h3>
                                <div class="pictures">
                                        ${data.pictures
                                          .map(
                                            (pic: any) =>
                                              `<img src="${pic}" alt="Property Image" width="400px" height="400px" style="margin-top: 10px; border-radius: 5px;">`
                                          )
                                          .join('')}
                                </div>
                                `
                                    : ''
                                }
</div>
  `;
}
export function DeactivateOrActivateAgent(name: string, status: boolean, reason: string): string {
  return `
                        <div class="">
                        <h1> Hello ${name},</h1>
                                <h2>Agent ${status ? 'Deactivated' : 'Activated'}</h2>
                                <p>Your agent account has been ${status ? 'deactivated or suspended' : 'activated'}</p>
                                ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                                   `;
}
export function DeleteAgent(name: string, reason: string): string {
  return `
                                <div class="">
                                <h1> Hello ${name},</h1>
                                        <h2>Agent Deleted</h2>
                                        <p>Your agent account has been deleted. Due to: </p>
                                        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                                           `;
}

export function PropertyReceivedTemplate(ownerName: string, property: any): string {
  return ` 
        <p>Hi ${ownerName},</p>
        <p>Thank you for submitting your property brief to Khabi-Teq Realty. We have received your brief with the following details:</p>
      
        <ul class="" style="background-color: #E4EFE7; padding-top: 25px; padding-right: 20px; padding-bottom: 25px; padding-left: 20px; gap: 10px; border-radius: 10px;">
          <p>Submitted Brief: </p>
                <li><strong>Property Type:</strong> ${property.propertyType}</li>
              
                <li><strong>Location:</strong> ${property.location.state}, ${property.location.localGovernment}, ${
    property.location.area
  }</li>
                <li><strong>Price Range:</strong> ₦${property.price}</li>
                <li><strong>Usage Options:</strong> ${property.usageOptions?.join(', ') || 'N/A'}</li>
                <li><strong>Property Features:</strong>
                <ul>
                        ${Object.entries(property.propertyFeatures)
                          .map(([key, value]) => `<li>${key}: ${value}</li>`)
                          .join('')}
                </ul>
                </li>
      
            </ul>
        <p>Our team will review your submission and contact you if any additional information is needed or once your brief is approved.</p>
        <p>Thank you for trusting Khabi-Teq Realty with your property listing.</p>
            `;
}

export function PropertyRentReceivedTemplate(ownerName: string, property: any): string {
  return `
        <p>Hi ${ownerName},</p>
        <p>Thank you for submitting your property brief to Khabi-Teq Realty. We have received your brief with the following details:</p>
      
        <ul class="" style="background-color: #E4EFE7; padding-top: 25px; padding-right: 20px; padding-bottom: 25px; padding-left: 20px; gap: 10px; border-radius: 10px;">
          <p>Submitted Brief: </p>
                <li><strong>Property Type:</strong> ${property.propertyType}</li>
              
                <li><strong>Location:</strong> ${property.location.state}, ${property.location.localGovernment}, ${
    property.location.area
  }</li>
                <li><strong>Price Range:</strong> ₦${property.rentalPrice}</li>
                <li><strong>Tenant Criteria:</strong> ${
                  property.tenantCriteria?.map((p: any) => p.criteria).join(', ') || 'N/A'
                }</li>
                <li><strong>Property Features:</strong>
              
                        ${property.features.map((f: any) => f.featureName).join(', ')}
              
                </li>
      
            </ul>
        <p>Our team will review your submission and contact you if any additional information is needed or once your brief is approved.</p>
        <p>Thank you for trusting Khabi-Teq Realty with your property listing.</p>
        `;
}

export function InspectionRequestWithNegotiation(buyerName: string, propertyData: any): string {
  return `
    <p>Dear ${buyerName},</p>
    
   ${
     propertyData.letterOfIntention
       ? `<p style="margin-top: 10px;">
      Your property inspection has been successfully scheduled, and your Letter of Intent (LOI) has been submitted. 
      Please allow up to <span style="color: #FF2539">48 hours</span> for a response from the seller. Kindly be patient. 
      Below are the details of your inspection and LOI submission:
    </p>`
       : propertyData.isNegotiating
       ? `<p style="margin-top: 10px;">
      Your property inspection has been successfully scheduled, and your negotiation offer has been submitted. The seller has up to <span style="color: #FF2539">48 hours</span> to respond, so we appreciate your patience.
Please find your inspection details and negotiation price information below.
    </p>`
       : `<p style="margin-top: 10px;">Your property inspection has been successfully scheduled. It may take up to 48 hours for the seller to respond, so please be patient.
Below are your inspection details:</p>`
   }

    <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyData.propertyType}</li>
      <li><strong>Location:</strong> ${propertyData.location}</li>
      <li><strong>Price:</strong> ₦${propertyData.price}</li>
    </ul>

    ${
      propertyData.letterOfIntention
        ? `
      <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Submitted LOI Document:</strong></p>
        <li><a href=${propertyData.letterOfIntention}>click here</a> to view the uploaded document</li>
      </ul>
    `
        : ''
    }

    ${
      propertyData.isNegotiating
        ? `
      <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Negotiation Details:</strong></p>
        <li><strong>Seller's Asking Price:</strong> ₦${propertyData.price}</li>
        <li><strong>Your Offer:</strong> ₦${propertyData.negotiationPrice}</li>
      </ul>
    `
        : ''
    }

    <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Inspection Details:</strong></p>
      <li><strong>Date:</strong> ${propertyData.inspectionDate}</li>
      <li><strong>Time:</strong> ${propertyData.inspectionTime}</li>
    </ul>

    <p style="margin-top: 15px;">
      If you have any questions or need to reschedule, please let us know in advance.
    </p>
  `;
}

export function InspectionRequestWithNegotiationSellerTemplate(sellerName: string, propertyData: any): string {
  // Calculate deadline: 48 hours from inspectionDate
  const inspectionDate = new Date(propertyData.inspectionDate);
  const deadline = new Date(inspectionDate.getTime() + 48 * 60 * 60 * 1000);
  const deadlineString = deadline.toLocaleString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
    <p>Dear ${sellerName},</p>
    
   ${
     propertyData.letterOfIntention
       ? `<p style="margin-top: 10px;">
      A potential developer has submitted an LOI and requested an inspection for your property at ${propertyData.location} on ${propertyData.inspectionDate} at ${propertyData.inspectionTime}.
    </p>`
       : propertyData.isNegotiating
       ? `<p style="margin-top: 10px;">
      A potential buyer has negotiated your asking price and requested an inspection of ${propertyData.location} on ${propertyData.inspectionDate} at ${propertyData.inspectionTime}.
    </p>`
       : `<p style="margin-top: 10px;">
      A potential buyer has requested an inspection for your property at ${propertyData.location} on ${propertyData.inspectionDate} at ${propertyData.inspectionTime}.
    </p>`
   }

    

    <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyData.propertyType}</li>
      <li><strong>Location:</strong> ${propertyData.location}</li>
      <li><strong>Price:</strong> ₦${propertyData.price}</li>
    </ul>

    ${
      propertyData.isNegotiating
        ? `
      <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Offer Details:</strong></p>
        <li><strong>Proposed Price:</strong> ₦${propertyData.price}</li>
        <li><strong>Deadline:</strong> ₦${propertyData.negotiationPrice}</li>
      </ul>
    `
        : ''
    }

    ${
      propertyData.letterOfIntention
        ? `
      <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Submitted LOI Document:</strong></p>
        <li><a href=${propertyData.letterOfIntention}>click here</a> to view the uploaded document</li>
        <li><strong>Deadline:</strong> ${deadlineString} <span style="color: #FF2539;">(48 hours from now)</span></li>

      </ul>
    `
        : ''
    }

    <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Inspection Details:</strong></p>
      <li><strong>Date:</strong> ${propertyData.inspectionDate}</li>
      <li><strong>Time:</strong> ${propertyData.inspectionTime}</li>
      <li><strong>Deadline:</strong> ${deadlineString} <span style="color: #FF2539;">(48 hours from now)</span></li>
    </ul>

    <p style="margin-top: 15px;">
      Click here to respond:
    </p>

    <a href="${
      propertyData.responseLink
    }" style="display: inline-block; width: 162px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; gap: 8px; padding: 8px 16px;">
      Confirm Availability
    </a>

      ${
        propertyData.isNegotiating
          ? `
      <p style="margin-top: 15px;">Please <span style="color: #1AAD1F">accept</span> accept, <span style="color: #FF2539">reject</span>, or send a counter-offer<span style="color: #1976D2">counter-offer</span>. Your response is appreciated</p>
    `
          : ''
      }

    <p style="margin-top: 15px;">
      If you have any questions, feel free to contact us.
    </p>
  `;
}

export function confirmTemplate(sellerName: string, propertyData: any): string {
  return `
    <p>Dear ${sellerName},</p>
    
    <p style="margin-top: 10px;">
      You’ve successfully confirmed the inspection date. The appointment is approved!.
    </p>

    <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Inspection Details:</strong></p>
      <li><strong>Date:</strong> ${propertyData.inspectionDate}</li>
      <li><strong>Time:</strong> ${propertyData.inspectionTime}</li>
    </ul>

    <p style="margin-top: 15px;">
      If you have any questions or need to reschedule, please let us know in advance.
    </p>
  `;
}

export function unavailableTemplate(sellerName: string): string {
  return `
    <p>Hi ${sellerName},</p>
    
    <p style="margin-top: 10px;">
      You have declined the inspection date, and the appointment has been <span style="color=#FF2539;">cancelled</span>.
    </p>

    <p style="margin-top: 15px;">
      If you have any questions, feel free to contact us.
    </p>
  `;
}

export function declineTemplate(sellerName: string, propertyData: any): string {
  return `
    <p>Dear ${sellerName},</p>
    
    <p style="margin-top: 10px;">
      We’re sorry to inform you that the seller has <span style="color=#FF2539;">Declined</span> your inspection request for ${propertyData.location}.<br/>Don’t worry we have other properties that may match your needs. <a href="${propertyData.browse}">Browse Listings</a> or <a href="${propertyData.browse}">Submit Your Preferences</a>, and we’ll help you find the perfect match
    </p>


    <p style="margin-top: 15px;">
      Thank you for your understanding.
    </p>
  `;
}

export function NegotiationAcceptedTemplate(buyerName: string, propertyData: any): string {
  // Calculate deadline: 48 hours from inspectionDate

  return `
    <p>Dear ${buyerName},</p>
    
    <p style="margin-top: 10px;">
     Great news! The seller has <span style="color: #1AAD1F;">accepted</span> your negotiation offer and confirmed the inspection for the property at ${propertyData.location}.
    </p>

     <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Here are the details:</strong></p>
        <li><strong>Inspection Date:</strong> ${propertyData.inspectionDate}</li>
        <li><strong>Accepted Price:</strong> ₦${propertyData.negotiationPrice}</li>
      </ul>

    <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyData.propertyType}</li>
      <li><strong>Location:</strong> ${propertyData.location}</li>
      <li><strong>Price:</strong> ₦${propertyData.price}</li>
    </ul>

    <p style="margin-top: 15px;">
      You’ll receive a reminder before the inspection. If you have any questions, feel free to reach out.
    </p>

    <p style="margin-top: 15px;">
      We look forward to seeing you then. If you need to reschedule, please let us know.

    </p>

    <a href="${propertyData.responseLink}" style="display: inline-block; width: 162px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; gap: 8px; padding: 8px 16px;">
      Reschedule Inspection
    </a>
  `;
}

export function InspectionAcceptedTemplate(buyerName: string, propertyData: any): string {
  // Calculate deadline: 48 hours from inspectionDate

  return `
    <p>Hi ${buyerName},</p>
    
    <p style="margin-top: 10px;">
     Good news! The seller has <span style="color: #1AAD1F;">accepted</span> your inspection request for ${propertyData.location}.
    </p>

     <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Confirmed Date & Time:</strong></p>
        <li><strong>Date:</strong> ${propertyData.inspectionDate}</li>
        <li><strong>Time:</strong> ₦${propertyData.inspectionTime}</li>
      </ul>

    <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyData.propertyType}</li>
      <li><strong>Location:</strong> ${propertyData.location}</li>
      <li><strong>Price:</strong> ₦${propertyData.price}</li>
    </ul>

    <p style="margin-top: 15px;">
      You’ll receive a reminder before the inspection. If you have any questions, feel free to reach out.
    </p>

    <p style="margin-top: 15px;">
      We look forward to seeing you then. If you need to reschedule, please let us know.

    </p>

    <a href="${propertyData.responseLink}" style="display: inline-block; width: 162px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; gap: 8px; padding: 8px 16px;">
      Reschedule Inspection
    </a>
  `;
}

export function NegotiationAcceptedSellerTemplate(sellerName: string, propertyData: any): string {
  return `
    <p>Hi ${sellerName},</p>
    
    <p style="margin-top: 10px;">
     You’ve successfully <span style="color: #1AAD1F;">accepted</span> the buyer’s offer, and the inspection date has been Approved for inspection.
    </p>

     <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p style="color: #34A853;"><strong>Offer Accepted:</strong></p>
        <li><strong>Buyer Price:</strong> ${propertyData.negotiationPrice}</li>
      </ul>

    <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Inspection Details:</strong></p>
      <li><strong>Date:</strong> ${propertyData.inspectionDate}</li>
      <li><strong>Time:</strong> ${propertyData.inspectionTime}</li>
    </ul>

    <p style="margin-top: 15px;">
      If you have any questions, feel free to contact us.
    </p>
  `;
}

export function CounterSellerTemplate(sellerName: string, propertyData: any): string {
  return `
    <p>Hi ${sellerName},</p>
    
    <p style="margin-top: 10px;">
     You’ve successfully <span style="color: #1AAD1F;">count offer</span> the buyer’s offer, and the inspection date has been updated by you to a new selection.</p>
     <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p style=""><strong>Negotiation:</strong></p>
        <li><strong>Buyer Price:</strong> #${propertyData.negotiationPrice}</li>
        <li><strong>Your Count Offer:</strong> #${propertyData.sellerCounterOffer}</li>
      </ul>

    <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Updated Inspection Details:</strong></p>
      <li><strong>Date:</strong> ${propertyData.newDate}</li>
      <li><strong>Date:</strong> ${propertyData.inspectionDate}</li>
      <li><strong>Time:</strong> ${propertyData.inspectionTime}</li>
    </ul>

    <p style="margin-top: 15px;">
      If you have any questions, feel free to contact us.
    </p>
  `;
}

export function CounterBuyerTemplate(buyerName: string, propertyData: any): string {
  return `
    <p>Hi ${buyerName},</p>
    
    <p style="margin-top: 10px;">
    The seller has reviewed your offer and responded with a <span style="color: #1976D2;">counter-offer</span>. The inspection has also been approved.
     </p>
     <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p style="color: #34A853;"><strong>Details:</strong></p>
        <li><strong>Inspection Date:</strong> ${propertyData.inspectionDate}</li>
        <li><strong>Seller's Counter-Offer:</strong> #${propertyData.sellerCounterOffer}</li>
      </ul>

      <p style="margin-top: 15px;">Please click below to accept or decline the Offer.</p>

      <div style="display: flex; width: 104px; height: 40px; gap: 16px;">
        <a href="${propertyData.acceptLink}" style="flex: 1; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Offer</a>
      </div>

    <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyData.propertyType}</li>
      <li><strong>Location:</strong> ${propertyData.location}</li>
      <li><strong>Price:</strong> ₦${propertyData.price}</li>
    </ul>

    <p style="margin-top: 15px;">
      Thanks for your flexibility!.
    </p>
  `;
}

export function NegotiationRejectedBuyerTemplate(buyerName: string, propertyData: any): string {
  return `
    <p>Hi ${buyerName},</p>
    
    <p style="margin-top: 10px;">
      The seller has <span style="color: #FF2539;">rejected</span> your negotiation offer, but there's still an opportunity to inspect the property.
    </p>

    <ul style="background-color: #FAFAFA; padding: 25px 20px; border-radius: 10px; margin-top: 15px; list-style: none;">
      <p style="color: #34A853;"><strong>Here are the next steps:</strong></p>
      <li><strong>Inspection Date:</strong> ${propertyData.inspectionDate}</li>
      <li><strong>You can submit a new offer after the inspection if you’re still interested.</strong></li>
    </ul>

    <p style="margin-top: 15px;">Would you like to continue with the inspection?</p>

    <table cellspacing="0" cellpadding="0" style="margin-top: 15px;">
      <tr>
        <td style="padding-right: 10px;">
          <a href="${propertyData.checkLink}" style="display: inline-block; background-color: #1A7F64; color: #ffffff; text-align: center; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Yes</a>
        </td>
        <td style="padding-right: 10px;">
          <a href="${propertyData.rejectLink}" style="display: inline-block; background-color: #FF2539; color: #ffffff; text-align: center; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">No</a>
        </td>
        <td>
          <a href="${propertyData.browse}" style="display: inline-block; border: 1px solid #000000; color: #000000; text-align: center; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Browse Other Listings</a>
        </td>
      </tr>
    </table>
  `;
}

export function NegotiationRejectedSellerTemplate(buyerName: string, propertyData: any): string {
  return `
    <p>Hi ${buyerName},</p>
    
    <p style="margin-top: 10px;">
    You’ve successfully <span style="color: #FF2539;">Rejected</span> the buyer’s offer, and the inspection date has been <span style="color: #1AAD1F;">Approved</span> for inspection.
     </p>
     <ul style="background-color: #FFE7E5; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p style="color: #FF2539;"><strong>Offer Rejected:</strong></p>
        <li><strong>Buyer Price:</strong> ${propertyData.negotiationPrice}</li>
      </ul>

        <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong> Inspection Details:</strong></p>
        <li><strong>Date:</strong> ${propertyData.inspectionDate}</li>
        <li><strong>Time:</strong> ${propertyData.inspectionTime}</li>
      </ul>

      <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>
  `;
}

export function NegotiationLOIRejectedSellerTemplate(sellerName: string, propertyData: any): string {
  return `
    <p>Hi ${sellerName},</p>
    
    <p style="margin-top: 10px;">
    You’ve successfully <span style="color: #FF2539;">Rejected</span> the Developer LOI, and the inspection date has been <span style="color: #1AAD1F;">Approved</span> for inspection.
     </p>

        <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong> Inspection Details:</strong></p>
        <li><strong>Date:</strong> ${propertyData.inspectionDate}</li>
        <li><strong>Time:</strong> ${propertyData.inspectionTime}</li>
      </ul>

      <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>
  `;
}

export function NegotiationLOIAcceptedSellerTemplate(sellerName: string, propertyData: any): string {
  return `
    <p>Hi ${sellerName},</p>
    
    <p style="margin-top: 10px;">
    You’ve successfully <span style="color: #FF2539;">Accepted</span> the Developer LOI, and the inspection date has been updated by you to a new selection.
     </p>

        <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Updated Inspection Details:</strong></p>
         <li><strong>Previous Date:</strong> ${propertyData.inspectionDate}</li>
        <li><strong>Date:</strong> ${propertyData.newDate}</li>
        <li><strong>Time:</strong> ${propertyData.inspectionTime}</li>
      </ul>

      <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>
  `;
}

export function LOIAcceptedSellerTemplate(sellerName: string, propertyData: any): string {
  return `
    <p>Hi ${sellerName},</p>
    
    <p style="margin-top: 10px;">
    You’ve successfully <span style="color: #FF2539;">Accepted</span> the buyer's LOI, and the inspection date has been Approved for inspection.
     </p>

        <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Inspection Details:</strong></p>
        <li><strong>Date:</strong> ${propertyData.inspectionDate}</li>
        <li><strong>Time:</strong> ${propertyData.inspectionTime}</li>
      </ul>

      <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>
  `;
}

export function LOINegotiationAcceptedTemplate(buyerName: string, propertyData: any): string {
  // Calculate deadline: 48 hours from inspectionDate

  return `
    <p>Dear ${buyerName},</p>
    
    <p style="margin-top: 10px;">
     Great news! The seller has <span style="color: #1AAD1F;">accepted</span> your Letter of Intent (LOI) for the property at ${propertyData.location}.
    </p>

     <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Please find the details:</strong></p>
        <li><strong>Inspection Date:</strong> ${propertyData.inspectionDate} ${propertyData.inspectionTime}</li>
        <li><strong>LOI Offer:</strong> Accepted</li>
      </ul>

    <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyData.propertyType}</li>
      <li><strong>Location:</strong> ${propertyData.location}</li>
    </ul>

    <p style="margin-top: 15px;">
      Our team will follow up with you shortly to ensure a smooth inspection process. <br/><br/>Thank you for using Khabi-Teq Realty. We’re committed to helping you close your deal faster.
    </p>

    <p style="margin-top: 15px;">You’ll receive a reminder before the inspection. If you have any questions, feel free to reach out.</p>

    <p style="margin-top: 15px;">
      We look forward to seeing you then. If you need to reschedule, please let us know.

    </p>

    <a href="${propertyData.responseLink}" style="display: inline-block; width: 162px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; gap: 8px; padding: 8px 16px;">
      Reschedule Inspection
    </a>
  `;
}

export function LOIRejectedBuyerTemplate(buyerName: string, propertyData: any): string {
  return `
    <p>Hi ${buyerName},</p>
    
    <p style="margin-top: 10px;">
      The seller has <span style="color: #FF2539;">rejected</span> your LOI offer, but there's still an opportunity to inspect the property.
    </p>

    <ul style="background-color: #FAFAFA; padding: 25px 20px; border-radius: 10px; margin-top: 15px; list-style: none;">
      <p style="color: #34A853;"><strong>Here are the next steps:</strong></p>
      <li><strong>Inspection Date:</strong> ${propertyData.inspectionDate}</li>
      <li><strong>You can submit a new offer after the inspection if you’re still interested.</strong></li>
    </ul>

    <p style="margin-top: 15px;">Would you like to continue with the inspection?</p>

    <table cellspacing="0" cellpadding="0" style="margin-top: 15px;">
      <tr>
        <td style="padding-right: 10px;">
          <a href="${propertyData.checkLink}" style="display: inline-block; background-color: #1A7F64; color: #ffffff; text-align: center; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Yes</a>
        </td>
        <td style="padding-right: 10px;">
          <a href="${propertyData.rejectLink}" style="display: inline-block; background-color: #FF2539; color: #ffffff; text-align: center; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">No</a>
        </td>
        <td>
          <a href="${propertyData.browse}" style="display: inline-block; border: 1px solid #000000; color: #000000; text-align: center; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Browse Other Listings</a>
        </td>
      </tr>
    </table>
  `;
}

export function LOICounterBuyerTemplate(buyerName: string, propertyData: any): string {
  return `
    <p>Hi ${buyerName},</p>
    
    <p style="margin-top: 10px;">
    The seller has reviewed your LOI offer and responded with a <span style="color: #1976D2;">counter-offer</span>. The inspection has also been approved.
     </p>
     <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p style="color: #34A853;"><strong>Details:</strong></p>
        <li><strong>Inspection Date:</strong> ${propertyData.inspectionDate}</li>
        <li><strong>Seller's Counter-Offer:</strong> #${propertyData.sellerCounterOffer}</li>
      </ul>

      <p style="margin-top: 15px;">Please click below to accept or decline the Offer.</p>

      <div style="display: flex; width: 104px; height: 40px; gap: 16px;">
        <a href="${propertyData.acceptLink}" style="flex: 1; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Offer</a>
      </div>

    <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyData.propertyType}</li>
      <li><strong>Location:</strong> ${propertyData.location}</li>
      <li><strong>Price:</strong> ₦${propertyData.price}</li>
    </ul>

    <p style="margin-top: 15px;">
      Thanks for your flexibility!.
    </p>
  `;
}

export function LOICounterSellerTemplate(sellerName: string, propertyData: any): string {
  return `
    <p>Hi ${sellerName},</p>
    
    <p style="margin-top: 10px;">
     You’ve successfully <span style="color: #1AAD1F;">count offer</span> the buyer’s LOI offer, and the inspection date has been updated by you to a new selection.</p>
     <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p style=""><strong>Negotiation:</strong></p>
        <li><strong>Buyer Price:</strong> #${propertyData.negotiationPrice}</li>
        <li><strong>Your Count Offer:</strong> #${propertyData.sellerCounterOffer}</li>
      </ul>

    <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Updated Inspection Details:</strong></p>
      <li><strong>Date:</strong> ${propertyData.newDate}</li>
      <li><strong>Date:</strong> ${propertyData.inspectionDate}</li>
      <li><strong>Time:</strong> ${propertyData.inspectionTime}</li>
    </ul>

    <p style="margin-top: 15px;">
      If you have any questions, feel free to contact us.
    </p>
  `;
}
