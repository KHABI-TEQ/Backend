/** Off-plan preference form options (aligned with PropertyDetails.tsx). */

export const OFF_PLAN_PREFERENCE_DEVELOPMENT_STAGES = [
  { value: "planning", label: "Planning Stage" },
  { value: "foundation", label: "Foundation Stage" },
  { value: "structural", label: "Structural Stage" },
  { value: "finishing", label: "Finishing Stage" },
  { value: "near-completion", label: "Near Completion" },
] as const;

export const OFF_PLAN_PREFERENCE_PAYMENT_PLANS = [
  { value: "outright", label: "Outright Payment" },
  { value: "installment-6-months", label: "6 Months Installment" },
  { value: "installment-12-months", label: "12 Months Installment" },
  { value: "installment-18-months", label: "18 Months Installment" },
  { value: "installment-24-months", label: "24 Months Installment" },
  { value: "installment-36-months", label: "36 Months Installment" },
] as const;

export const OFF_PLAN_DEVELOPMENT_STAGE_LABELS =
  OFF_PLAN_PREFERENCE_DEVELOPMENT_STAGES.map((o) => o.label);

export const OFF_PLAN_PAYMENT_PLAN_LABELS =
  OFF_PLAN_PREFERENCE_PAYMENT_PLANS.map((o) => o.label);
