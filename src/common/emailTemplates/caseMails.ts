import { generalEmailLayout } from "./emailLayout";

/**
 * Email sent to buyer when their petition has been reviewed and a formal LASRERA case is opened.
 */
export function caseOpenedMail(buyerName: string, caseNumber: string, subject: string): string {
  const content = `
    <h2 style="color: #0B423D; font-family: Arial, sans-serif; font-size: 20px; margin-bottom: 16px;">
      Case Opened — #${caseNumber}
    </h2>
    <p style="color: #333333; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
      Dear ${buyerName || "Valued Buyer"},
    </p>
    <p style="color: #333333; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
      Your petition regarding "<strong>${subject}</strong>" has been reviewed by the LASRERA Dispute Resolution Directorate, and a formal case has been opened.
    </p>
    <div style="background-color: #F4F7F6; border-left: 4px solid #0B423D; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #2C3E50;">
        <strong>Case Number:</strong> ${caseNumber}<br>
        <strong>Status:</strong> Case Opened (Under Mediation Assessment)
      </p>
    </div>
    <p style="color: #333333; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
      Our dispute resolution officers will review all transaction milestones and party records. You can track this case's progress and submit additional information directly through your dashboard.
    </p>
  `;
  return generalEmailLayout(content);
}

/**
 * Email sent to buyer when case milestone/status updates.
 */
export function caseMilestoneChangedMail(buyerName: string, caseNumber: string, milestone: string): string {
  const content = `
    <h2 style="color: #0B423D; font-family: Arial, sans-serif; font-size: 20px; margin-bottom: 16px;">
      Case Update — #${caseNumber}
    </h2>
    <p style="color: #333333; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
      Dear ${buyerName || "Valued Buyer"},
    </p>
    <p style="color: #333333; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
      The status of your case <strong>#${caseNumber}</strong> has been updated to:
    </p>
    <div style="background-color: #E8F5E9; border-left: 4px solid #2E7D32; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: #1B5E20;">
        ${milestone}
      </p>
    </div>
    <p style="color: #333333; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
      Please log in to your account for full timeline details and any pending requests.
    </p>
  `;
  return generalEmailLayout(content);
}

/**
 * Email sent to buyer requesting additional information or documentation.
 */
export function caseInfoRequestMail(params: {
  buyerFirstName: string;
  caseNumber: string;
  officerMessage: string;
}): string {
  const content = `
    <h2 style="color: #0B423D; font-family: Arial, sans-serif; font-size: 20px; margin-bottom: 16px;">
      Request for Information — Case #${params.caseNumber}
    </h2>
    <p style="color: #333333; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
      Dear ${params.buyerFirstName || "Valued Buyer"},
    </p>
    <p style="color: #333333; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
      LASRERA is currently reviewing your petition regarding Case <strong>#${params.caseNumber}</strong>. To assist the dispute resolution panel, the assigned officer has requested the following clarification or evidence:
    </p>
    <div style="background-color: #FFF9E6; border-left: 4px solid #F59E0B; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-family: Arial, sans-serif; font-size: 15px; color: #78350F; line-height: 1.6; white-space: pre-wrap;">${params.officerMessage}</p>
    </div>
    <p style="color: #333333; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
      You may respond directly from your buyer mobile app or dashboard under the active cases tab.
    </p>
  `;
  return generalEmailLayout(content);
}

/**
 * Email sent to buyer when case is closed.
 */
export function caseClosedMail(buyerName: string, caseNumber: string): string {
  const content = `
    <h2 style="color: #0B423D; font-family: Arial, sans-serif; font-size: 20px; margin-bottom: 16px;">
      Case Closed — #${caseNumber}
    </h2>
    <p style="color: #333333; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
      Dear ${buyerName || "Valued Buyer"},
    </p>
    <p style="color: #333333; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
      This is to inform you that Case <strong>#${caseNumber}</strong> has been concluded and closed by the LASRERA Case Directorate.
    </p>
    <p style="color: #333333; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
      The record has been updated in the repository. Please visit your buyer dashboard to review the summary and history.
    </p>
  `;
  return generalEmailLayout(content);
}

/**
 * Email body for EFCC referral dossier.
 */
export function efccReferralMail(params: {
  caseNumber: string;
  transactionReference: string;
}): string {
  const content = `
    <h2 style="color: #0B423D; font-family: Arial, sans-serif; font-size: 18px; margin-bottom: 14px;">
      OFFICIAL REFERRAL — LASRERA DISPUTE ESCALATION
    </h2>
    <p style="color: #333333; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">
      To: Economic and Financial Crimes Commission (EFCC),<br>
      Real Estate Fraud Investigation Section.
    </p>
    <p style="color: #333333; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">
      Please find attached the official case record and investigation dossier for real estate transaction dispute:
    </p>
    <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; padding: 14px 18px; margin: 16px 0; border-radius: 4px;">
      <p style="margin: 0; font-family: monospace; font-size: 13px; color: #1E293B;">
        <strong>CASE NUMBER:</strong> ${params.caseNumber}<br>
        <strong>TRANSACTION REFERENCE:</strong> ${params.transactionReference}<br>
        <strong>REFERRING AGENCY:</strong> Lagos State Real Estate Regulatory Authority (LASRERA)
      </p>
    </div>
    <p style="color: #333333; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">
      The attached dossier includes the complete digital transaction trail, verified payment records, buyer petition, mediation notes, and party credentials.
    </p>
  `;
  return generalEmailLayout(content);
}
