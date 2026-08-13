/**
 * Build / extract in-app action paths so email CTAs are mirrored into
 * BuyerNotification / User Notification meta (and push data).
 */

export type InboxDeepLinkMeta = {
  source?: string;
  screen?: string;
  actionPath?: string;
  inspectionId?: string;
  documentVerificationId?: string;
  jobId?: string;
  surveyRequestId?: string;
  propertyId?: string;
  audience?: "buyer" | "practitioner";
  [key: string]: unknown;
};

/** Convert absolute CLIENT_LINK URLs (or raw text/html) into app screen hints. */
export function extractDeepLinkMetaFromContent(
  htmlOrText: string,
  subject = ""
): InboxDeepLinkMeta {
  const content = String(htmlOrText || "");
  const subj = String(subject || "").toLowerCase();
  const meta: InboxDeepLinkMeta = { source: "email" };

  const hrefs = [
    ...content.matchAll(/href=["']([^"']+)["']/gi),
    ...content.matchAll(/https?:\/\/[^\s<>"']+/gi),
  ].map((m) => m[1] || m[0]);

  for (const raw of hrefs) {
    try {
      const url = String(raw || "");
      const path = url.replace(/^https?:\/\/[^/]+/i, "");

      // Buyer negotiation SPA → in-app inspection detail
      const buyerNeg = path.match(
        /\/secure-buyer-response\/([^/]+)\/([^/?#]+)/i
      );
      if (buyerNeg) {
        meta.inspectionId = buyerNeg[2];
        meta.screen = "inspection";
        meta.actionPath = `/inspections/${buyerNeg[2]}`;
        meta.audience = "buyer";
        return meta;
      }

      // Document verification
      const doc = path.match(/\/third-party-verification\/([^/?#]+)/i);
      if (doc) {
        meta.documentVerificationId = doc[1];
        meta.screen = "documents";
        meta.actionPath = `/documents/${doc[1]}`;
        meta.audience = "buyer";
        return meta;
      }

      // Transaction registration
      if (/\/transaction-registration/i.test(path)) {
        meta.screen = "transactions";
        meta.actionPath = "/transactions";
        meta.audience = "buyer";
        return meta;
      }

      // Rate / report
      const rate = path.match(/[?&]inspectionId=([^&]+)/i);
      if (/\/inspection\/rate/i.test(path) && rate) {
        meta.inspectionId = decodeURIComponent(rate[1]);
        meta.screen = "inspection";
        meta.actionPath = `/inspections/${meta.inspectionId}`;
        meta.audience = "buyer";
        return meta;
      }

      // Practitioner dashboard inspections (if deep path used)
      const dashInsp = path.match(/\/dashboard\/inspections?\/([^/?#]+)/i);
      if (dashInsp) {
        meta.inspectionId = dashInsp[1];
        meta.screen = "inspections";
        meta.actionPath = `/tools/inspections`;
        meta.audience = "practitioner";
        return meta;
      }

      if (/\/dashboard/i.test(path) && /inspection/i.test(subj)) {
        meta.screen = "inspections";
        meta.actionPath = "/tools/inspections";
        meta.audience = "practitioner";
        return meta;
      }
    } catch {
      // continue
    }
  }

  // Subject-based fallbacks
  if (/inspection|negotiation|viewing/i.test(subj)) {
    meta.screen = "inspections";
    meta.actionPath = "/inspections";
  } else if (/document|verification|title/i.test(subj)) {
    meta.screen = "documents";
    meta.actionPath = "/documents";
  } else if (/transaction|registration|certificate/i.test(subj)) {
    meta.screen = "transactions";
    meta.actionPath = "/transactions";
  } else if (/survey/i.test(subj)) {
    meta.screen = "surveys";
    meta.actionPath = "/surveys";
  }

  return meta;
}

export function buildBuyerInspectionMeta(inspectionId: string): InboxDeepLinkMeta {
  return {
    source: "system",
    audience: "buyer",
    screen: "inspection",
    inspectionId: String(inspectionId),
    actionPath: `/inspections/${inspectionId}`,
  };
}

export function buildPractitionerInspectionMeta(
  inspectionId: string
): InboxDeepLinkMeta {
  return {
    source: "system",
    audience: "practitioner",
    screen: "inspections",
    inspectionId: String(inspectionId),
    actionPath: `/tools/inspections`,
  };
}

export function buildBuyerDocumentMeta(
  documentVerificationId: string
): InboxDeepLinkMeta {
  return {
    source: "system",
    audience: "buyer",
    screen: "documents",
    documentVerificationId: String(documentVerificationId),
    actionPath: `/documents/${documentVerificationId}`,
  };
}

export function buildLawyerJobMeta(jobId: string): InboxDeepLinkMeta {
  return {
    source: "system",
    audience: "practitioner",
    screen: "lawyer_job",
    jobId: String(jobId),
    actionPath: `/lawyer/jobs/${jobId}`,
  };
}

export function buildSurveyorJobMeta(surveyRequestId: string): InboxDeepLinkMeta {
  return {
    source: "system",
    audience: "practitioner",
    screen: "surveyor_job",
    surveyRequestId: String(surveyRequestId),
    actionPath: `/surveyor/jobs`,
  };
}

/** Flatten meta for FCM/Expo (all values must be strings). */
export function metaToPushData(
  meta: InboxDeepLinkMeta,
  type: string
): Record<string, string> {
  const data: Record<string, string> = {
    type,
    screen: String(meta.screen || "notifications"),
  };
  if (meta.actionPath) data.actionPath = String(meta.actionPath);
  if (meta.inspectionId) data.inspectionId = String(meta.inspectionId);
  if (meta.documentVerificationId) {
    data.documentVerificationId = String(meta.documentVerificationId);
  }
  if (meta.jobId) data.jobId = String(meta.jobId);
  if (meta.surveyRequestId) data.surveyRequestId = String(meta.surveyRequestId);
  if (meta.propertyId) data.propertyId = String(meta.propertyId);
  return data;
}
