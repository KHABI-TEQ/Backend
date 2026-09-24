import {
  getKhabiteqEmailFooterLogoUrl,
  getKhabiteqEmailLogoUrl,
  KHABITEQ_EMAIL_LOGO_ALT,
} from "../constants/emailBranding";

const EMAIL_CONTENT_WIDTH = 680;

const DEFAULT_SOCIAL = {
  facebookUrl: "https://www.facebook.com/profile.php?id=61568584928290&mibextid=ZbWKwL",
  instagramUrl: "https://www.instagram.com/khabiteq_realty/profilecard/?igsh=YjRvanQ3YmlmdDNl",
  linkedinUrl: "#",
  twitterUrl: "https://x.com/Khabi_Teq?t=Jq6MpEMfwfJ6aQ46CYGPpQ&s=09",
};

export type EmailShellOptions = {
  title?: string;
  logoUrl?: string;
  footerLogoUrl?: string;
  logoAlt?: string;
  signOffHtml?: string;
  address?: string;
  copyrightName?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
};

function socialCell(href: string | undefined, iconSrc: string, alt: string): string {
  if (!href) return "";
  return `
    <td style="padding: 0 10px 0 0;">
      <a href="${href}" style="text-decoration: none;">
        <img src="${iconSrc}" width="28" height="28" alt="${alt}" style="display:block;border:0;">
      </a>
    </td>`;
}

/** Shared wide email chrome used by every transactional template. */
export function renderEmailShell(body: string, options: EmailShellOptions = {}): string {
  const logoUrl = options.logoUrl || getKhabiteqEmailLogoUrl();
  const footerLogoUrl = options.footerLogoUrl || getKhabiteqEmailFooterLogoUrl();
  const logoAlt = options.logoAlt || KHABITEQ_EMAIL_LOGO_ALT;
  const copyrightName = options.copyrightName || "Khabi-Teq Limited";
  const address =
    options.address || "Block B, Suite 8SF Goldrim Plaza, Yaya Abatan, Ogba Lagos.";
  const title = options.title || "Khabiteq";
  const signOffHtml =
    options.signOffHtml ??
    `<p style="margin:24px 0 0;">Best regards,</p>
     <p style="margin:8px 0 0;"><strong>Khabi-Teq</strong></p>`;

  const facebookUrl = options.facebookUrl ?? DEFAULT_SOCIAL.facebookUrl;
  const instagramUrl = options.instagramUrl ?? DEFAULT_SOCIAL.instagramUrl;
  const linkedinUrl = options.linkedinUrl ?? DEFAULT_SOCIAL.linkedinUrl;
  const twitterUrl = options.twitterUrl ?? DEFAULT_SOCIAL.twitterUrl;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${title}</title>
    <style type="text/css">
      html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; }
      body { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
      @media only screen and (max-width: 700px) {
        .email-outer { width: 100% !important; max-width: 100% !important; }
        .email-pad { padding-left: 16px !important; padding-right: 16px !important; }
        .email-card-pad { padding: 24px 20px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#F0F3F1;width:100%;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F0F3F1" style="width:100%;background-color:#F0F3F1;margin:0;padding:0;">
      <tr>
        <td align="center" style="padding:24px 12px 40px;">
          <!--[if mso]>
          <table role="presentation" width="${EMAIL_CONTENT_WIDTH}" cellspacing="0" cellpadding="0" border="0" align="center"><tr><td>
          <![endif]-->
          <table role="presentation" class="email-outer" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="width:100%;max-width:${EMAIL_CONTENT_WIDTH}px;">
            <tr>
              <td class="email-pad" align="left" style="padding:8px 24px 20px;">
                <img src="${logoUrl}" alt="${logoAlt} Logo" width="169" style="display:block;max-width:169px;height:auto;border:0;">
              </td>
            </tr>
            <tr>
              <td>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#ffffff;border-radius:8px;">
                  <tr>
                    <td class="email-card-pad" style="padding:32px 36px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#333333;word-break:normal;overflow-wrap:break-word;">
                      ${body}
                      ${signOffHtml}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" align="left" style="padding:24px 24px 8px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    ${socialCell(facebookUrl, "https://cdn-icons-png.flaticon.com/512/733/733547.png", "Facebook")}
                    ${socialCell(instagramUrl, "https://cdn-icons-png.flaticon.com/512/2111/2111463.png", "Instagram")}
                    ${socialCell(linkedinUrl, "https://cdn-icons-png.flaticon.com/512/145/145807.png", "LinkedIn")}
                    ${socialCell(twitterUrl, "https://cdn-icons-png.flaticon.com/512/733/733635.png", "Twitter")}
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" align="left" style="padding:24px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#D6DDEB;background-color:#0B423D;border-radius:0 0 8px 8px;">
                <img src="${footerLogoUrl}" alt="${logoAlt} Logo" width="180" style="display:block;max-width:180px;height:auto;border:0;">
                <p style="margin:16px 0 0;color:#D6DDEB;">Copyright © ${new Date().getFullYear()} ${copyrightName}.<br>${address}</p>
              </td>
            </tr>
          </table>
          <!--[if mso]>
          </td></tr></table>
          <![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const generalEmailLayout = (body: string): string => renderEmailShell(body);
