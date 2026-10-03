const COMPLETED_STATUS = "approved";

export function buildKycNotice(params: {
  kycStatus?: string | null;
  dismissedStatus?: string | null;
  /** Action attempts always surface the overlay, even after Cancel for later. */
  forceVisible?: boolean;
}) {
  const status = String(params.kycStatus || "none");
  const completed = status === COMPLETED_STATUS;
  const dismissed = !completed && params.dismissedStatus === status;
  const visible = !completed && (params.forceVisible === true || !dismissed);

  return {
    visible,
    dismissible: !completed,
    dismissed,
    completed,
    status,
    code: completed ? null : "KYC_REQUIRED_FOR_INSPECTION",
    title: "Professional verification",
    headline: "Complete Your KYC to Proceed",
    subtitle:
      "Before you can proceed with this request, you need to complete your KYC verification.",
    message:
      "We need to verify your details before we can refer you to the core customer, in line with our verification and participation policy.",
    prompt: "Please complete your KYC to continue.",
    actions: {
      complete: { label: "Complete KYC" },
      cancel: {
        label: "Cancel for later",
        method: "PATCH",
        path: "/account/kyc-notice/dismiss",
      },
    },
  };
}
