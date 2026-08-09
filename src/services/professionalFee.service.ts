import { SystemSettingService } from "./systemSetting.service";
import { RouteError } from "../common/classes";
import HttpStatusCodes from "../common/HttpStatusCodes";

const DEFAULTS = {
  lawyer_verification_fee_min: 15000,
  lawyer_verification_fee_max: 250000,
  surveyor_fee_min: 10000,
  surveyor_fee_max: 500000,
  lawyer_platform_charge_percent: 10,
  surveyor_platform_charge_percent: 10,
};

async function numSetting(key: keyof typeof DEFAULTS): Promise<number> {
  const setting = await SystemSettingService.getSetting(key);
  const n = Number(setting?.value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULTS[key];
}

export async function getLawyerFeeBounds() {
  const min = await numSetting("lawyer_verification_fee_min");
  const max = await numSetting("lawyer_verification_fee_max");
  return { min, max };
}

export async function getSurveyorFeeBounds() {
  const min = await numSetting("surveyor_fee_min");
  const max = await numSetting("surveyor_fee_max");
  return { min, max };
}

export async function assertLawyerFeeInRange(fee: number): Promise<void> {
  const { min, max } = await getLawyerFeeBounds();
  if (!Number.isFinite(fee) || fee < min || fee > max) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      `Verification fee must be between ₦${min.toLocaleString()} and ₦${max.toLocaleString()}.`
    );
  }
}

export async function assertSurveyorFeeInRange(fee: number): Promise<void> {
  const { min, max } = await getSurveyorFeeBounds();
  if (!Number.isFinite(fee) || fee < min || fee > max) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      `Survey fee must be between ₦${min.toLocaleString()} and ₦${max.toLocaleString()}.`
    );
  }
}

export async function getLawyerPlatformChargePercent(): Promise<number> {
  return numSetting("lawyer_platform_charge_percent");
}

export async function getSurveyorPlatformChargePercent(): Promise<number> {
  return numSetting("surveyor_platform_charge_percent");
}
