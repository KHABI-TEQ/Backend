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
                <p><strong>Tenant Criteria:</strong> ${
                  data.tenantCriteria?.map((c: any) => c.criteria).join(', ') || 'N/A'
                }</p>
                <p><strong>Documents on Property:</strong> ${
                  data.docOnProperty
                    ?.map((doc: any) => `${doc.docName} (${doc.isProvided ? 'Provided' : 'Not Provided'})`)
                    .join(', ') || 'N/A'
                }</p>
                <p>Owner Email: ${data.owner.email}</p>
                <p><strong>Owner Name:</strong> ${data.owner.fullName}</p>
                <p><strong>Owner Phone:</strong> ${data.owner.phoneNumber}</p>
                <p><strong>Owner Status:</strong> ${data.areYouTheOwner ? 'Yes' : 'No'}</p>
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
            
            ${data.isAdmin ? '<p>Admin, please review and take the necessary actions.</p>' : ''}
            
        </div>`;
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
                <!DOCTYPE html>
                <html>
                <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Property ${status}</title>
                        <style>
                                body {
                                        font-family: Arial, sans-serif;
                                        background-color: #f4f4f4;
                                        padding: 20px;
                                }
                                .container {
                                        max-width: 600px;
                                        margin: 0 auto;
                                        background: #fff;
                                        padding: 20px;
                                        border-radius: 8px;
                                        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                                }
                                h2 {
                                        color: #333;
                                }
                                p {
                                        line-height: 1.6;
                                }
                                .details {
                                        background: #f9f9f9;
                                        padding: 10px;
                                        border-radius: 5px;
                                }
                                .footer {
                                        margin-top: 20px;
                                        text-align: center;
                                        font-size: 14px;
                                        color: #777;
                                }
                        </style>
                </head>
                <body>
                        <div class="container">
                        <h1> Hello ${name},</h1>
                                <h2>Property ${status}</h2>
                                <p>Your property ${status} successfully. Here are the details:</p>
                                
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
                                        <p><strong>Owner Email:</strong> ${data.owner.email}</p>
                                        <p><strong>Owner Name:</strong> ${data.owner.fullName}</p>
                                        <p><strong>Owner Phone:</strong> ${data.owner.phoneNumber}</p>
                                        <p><strong>Owner Status:</strong> ${data.areYouTheOwner ? 'Yes' : 'No'}</p>
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
                                
                                <div class="footer">&copy; ${new Date().getFullYear()} Khabi-Teq</div>                   </div>       </body>           </html>           `;
}
export function DeactivateOrActivateAgent(name: string, status: boolean, reason: string): string {
  return `
                <!DOCTYPE html>
                <html>
                <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Agent ${status}</title>
                        <style>
                                body {
                                        font-family: Arial, sans-serif;
                                        background-color: #f4f4f4;
                                        padding: 20px;
                                }
                                .container {
                                        max-width: 600px;
                                        margin: 0 auto;
                                        background: #fff;
                                        padding: 20px;
                                        border-radius: 8px;
                                        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                                }
                                h2 {
                                        color: #333;
                                }
                                p {
                                        line-height: 1.6;
                                }
                                .details {
                                        background: #f9f9f9;
                                        padding: 10px;
                                        border-radius: 5px;
                                }
                                .footer {
                                        margin-top: 20px;
                                        text-align: center;
                                        font-size: 14px;
                                        color: #777;
                                }
                        </style>
                </head>
                <body>
                        <div class="container">
                        <h1> Hello ${name},</h1>
                                <h2>Agent ${status ? 'Deactivated' : 'Activated'}</h2>
                                <p>Your agent account has been ${status ? 'deactivated or suspended' : 'activated'}</p>
                                ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                                <div class="footer">&copy; ${new Date().getFullYear()} Khabi-Teq</div>                   </div>       </body>           </html>           `;
}
export function DeleteAgent(name: string, reason: string): string {
  return `
                        <!DOCTYPE html>
                        <html>
                        <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <title>Agent Deleted</title>
                                <style>
                                        body {
                                                font-family: Arial, sans-serif;
                                                background-color: #f4f4f4;
                                                padding: 20px;
                                        }
                                        .container {
                                                max-width: 600px;
                                                margin: 0 auto;
                                                background: #fff;
                                                padding: 20px;
                                                border-radius: 8px;
                                                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                                        }
                                        h2 {
                                                color: #333;
                                        }
                                        p {
                                                line-height: 1.6;
                                        }
                                        .details {
                                                background: #f9f9f9;
                                                padding: 10px;
                                                border-radius: 5px;
                                        }
                                        .footer {
                                                margin-top: 20px;
                                                text-align: center;
                                                font-size: 14px;
                                                color: #777;
                                        }
                                </style>
                        </head>
                        <body>
                                <div class="container">
                                <h1> Hello ${name},</h1>
                                        <h2>Agent Deleted</h2>
                                        <p>Your agent account has been deleted. Due to: </p>
                                        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                                        <div class="footer">&copy; ${new Date().getFullYear()} Khabi-Teq</div>                   </div>       </body>           </html>           `;
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
