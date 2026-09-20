/**
 * Reference IDs shown in buyer emails for transaction registration lookup.
 */

function publicPropertyCode(options: {
  propertyCode?: string | null;
  propertyId?: string | null;
}): string {
  const code = options.propertyCode?.trim() || "";
  if (code) return code;
  const id = options.propertyId?.trim() || "";
  return /^KH-[A-Z0-9-]+$/i.test(id) ? id.toUpperCase() : "";
}

export function transactionReferenceIdsBlock(options: {
  propertyId?: string | null;
  propertyCode?: string | null;
  inspectionId?: string | null;
}): string {
  const propertyCode = publicPropertyCode(options);
  const inspectionId = options.inspectionId?.trim() || "";
  if (!propertyCode && !inspectionId) return "";

  const rows = [
    propertyCode ? `<li><strong>Property Code:</strong> <code style="font-size:13px;">${propertyCode}</code></li>` : "",
    inspectionId ? `<li><strong>Inspection ID:</strong> <code style="font-size:13px;">${inspectionId}</code></li>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <ul style="background-color: #F0FDF4; padding: 20px; border-radius: 10px; margin-top: 15px; border: 1px solid #BBF7D0;">
      <p style="margin: 0 0 8px 0;"><strong>Reference IDs (for transaction registration)</strong></p>
      ${rows}
      <li style="margin-top: 8px; list-style: none; margin-left: -20px; color: #166534; font-size: 13px;">
        Save these — you will need the Property Code when checking status or registering your transaction on KHABITEQ.
      </li>
    </ul>
  `;
}

export function buildTransactionRegistrationPageUrl(
  clientLink: string,
  options?: { propertyId?: string | null; propertyCode?: string | null; inspectionId?: string | null }
): string {
  const base = (clientLink || "").replace(/\/$/, "");
  if (!base) return "#";
  const url = new URL(`${base}/transaction-registration`);
  const propertyCode = publicPropertyCode(options || {});
  const inspectionId = options?.inspectionId?.trim();
  if (propertyCode) url.searchParams.set("propertyCode", propertyCode);
  if (inspectionId) url.searchParams.set("inspectionId", inspectionId);
  return url.toString();
}

export function buildCertificateDownloadPageUrl(clientLink: string): string {
  const base = (clientLink || "").replace(/\/$/, "");
  if (!base) return "#";
  return `${base}/transaction-registration?tab=certificate`;
}
