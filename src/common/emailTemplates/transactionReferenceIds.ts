/**
 * Reference IDs shown in buyer emails for transaction registration lookup.
 */

export function transactionReferenceIdsBlock(options: {
  propertyId?: string | null;
  inspectionId?: string | null;
}): string {
  const propertyId = options.propertyId?.trim() || "";
  const inspectionId = options.inspectionId?.trim() || "";
  if (!propertyId && !inspectionId) return "";

  const rows = [
    propertyId ? `<li><strong>Property ID:</strong> <code style="font-size:13px;">${propertyId}</code></li>` : "",
    inspectionId ? `<li><strong>Inspection ID:</strong> <code style="font-size:13px;">${inspectionId}</code></li>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <ul style="background-color: #F0FDF4; padding: 20px; border-radius: 10px; margin-top: 15px; border: 1px solid #BBF7D0;">
      <p style="margin: 0 0 8px 0;"><strong>Reference IDs (for transaction registration)</strong></p>
      ${rows}
      <li style="margin-top: 8px; list-style: none; margin-left: -20px; color: #166534; font-size: 13px;">
        Save these — you will need the Property ID when checking status or registering your transaction on KHABITEQ.
      </li>
    </ul>
  `;
}

export function buildTransactionRegistrationPageUrl(
  clientLink: string,
  options?: { propertyId?: string | null; inspectionId?: string | null }
): string {
  const base = (clientLink || "").replace(/\/$/, "");
  if (!base) return "#";
  const url = new URL(`${base}/transaction-registration`);
  const propertyId = options?.propertyId?.trim();
  const inspectionId = options?.inspectionId?.trim();
  if (propertyId) url.searchParams.set("propertyId", propertyId);
  if (inspectionId) url.searchParams.set("inspectionId", inspectionId);
  return url.toString();
}
