import {
  getKhabiteqEmailFooterLogoUrl,
  getKhabiteqEmailLogoUrl,
  KHABITEQ_EMAIL_LOGO_ALT,
} from "../constants/emailBranding";

export const generalEmailLayout = (body: string): string => {
  const logoUrl = getKhabiteqEmailLogoUrl();
  const footerLogoUrl = getKhabiteqEmailFooterLogoUrl();
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
                              <img src="${logoUrl}" alt="${KHABITEQ_EMAIL_LOGO_ALT} Logo" width="169" style="max-width:169px;height:auto;">
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
                                      <p><strong>Khabi-Teq</strong></p>
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
                            <td align="start" style="padding: 30px 100px; font-family: Arial, sans-serif; font-size: 12px; color: #D6DDEB; background-color: #0B423D;">
                                <img src="${footerLogoUrl}" alt="${KHABITEQ_EMAIL_LOGO_ALT} Logo" width="180" style="max-width:180px;height:auto;"><br><br>

                                <p style="margin-top: 20px; color: #D6DDEB;">Copyright © ${new Date().getFullYear()} Khabi-Teq Limited.<br>
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
