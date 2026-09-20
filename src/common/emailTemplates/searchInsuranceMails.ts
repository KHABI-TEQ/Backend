import { SEARCH_INSURANCE_CATALOG } from "../constants/searchInsuranceCatalog";

export function searchInsuranceActivatedMail(input: {
  fullName: string;
  policyReference: string;
  preferenceId: string;
  coverAmount: number;
  premiumAmount: number;
}): string {
  return `
    <div>
      <p>Dear ${input.fullName || "there"},</p>
      <p>Your <strong>${SEARCH_INSURANCE_CATALOG.productName}</strong> is now active for this search.</p>
      <ul>
        <li><strong>Policy reference:</strong> ${input.policyReference}</li>
        <li><strong>Cover:</strong> ₦${input.coverAmount.toLocaleString()} with ${SEARCH_INSURANCE_CATALOG.partner}</li>
        <li><strong>Premium paid:</strong> ₦${input.premiumAmount.toLocaleString()}</li>
        <li><strong>Search ID:</strong> ${input.preferenceId}</li>
      </ul>
      <p>If a practitioner scams you on this search journey, sign in to your Khabiteq buyer account and file a claim with evidence.</p>
      <p>Best regards,<br/>Khabiteq</p>
    </div>
  `;
}

export function searchInsuranceClaimReceivedMail(input: {
  fullName: string;
  policyReference: string;
  claimId: string;
}): string {
  return `
    <div>
      <p>Dear ${input.fullName || "there"},</p>
      <p>We have received your search insurance claim for policy <strong>${input.policyReference}</strong>.</p>
      <p>Claim reference: <strong>${input.claimId}</strong></p>
      <p>Our team will review your evidence and update you when a decision is recorded.</p>
      <p>Best regards,<br/>Khabiteq</p>
    </div>
  `;
}

export function searchInsuranceClaimDecisionMail(input: {
  fullName: string;
  policyReference: string;
  status: string;
  adminNotes?: string;
  approvedAmount?: number;
}): string {
  const amount =
    input.approvedAmount != null
      ? `₦${Number(input.approvedAmount).toLocaleString()}`
      : "";
  return `
    <div>
      <p>Dear ${input.fullName || "there"},</p>
      <p>Your search insurance claim for policy <strong>${input.policyReference}</strong> is now <strong>${input.status}</strong>.</p>
      ${amount ? `<p>Approved amount: <strong>${amount}</strong></p>` : ""}
      ${input.adminNotes ? `<p>Notes: ${input.adminNotes}</p>` : ""}
      <p>Best regards,<br/>Khabiteq</p>
    </div>
  `;
}
