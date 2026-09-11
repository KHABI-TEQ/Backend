/** Khabiteq keeps this from every inspection fee when a licensed Agent is assigned. */
export const INSPECTION_PLATFORM_SHARE_NAIRA = 1000;

export const LICENSED_AGENT_BANK_SETUP_PATH = "/public-access-page/setup";

export const LICENSED_AGENT_BANK_REQUIRED_MESSAGE =
  "Add your bank account on your public page to receive inspection fees. Khabiteq keeps ₦1,000; the remainder is paid to your bank automatically.";

export function computeInspectionFeeSplit(feeNaira: number): {
  platformNaira: number;
  licensedAgentNaira: number;
  scoutNaira: number;
} {
  const fee = Math.max(0, Math.round(Number(feeNaira) || 0));
  const platformNaira = Math.min(INSPECTION_PLATFORM_SHARE_NAIRA, fee);
  return {
    platformNaira,
    licensedAgentNaira: Math.max(0, fee - platformNaira),
    scoutNaira: 0,
  };
}
