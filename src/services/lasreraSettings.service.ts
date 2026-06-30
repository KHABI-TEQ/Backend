import { DB } from "../controllers";

export const LASRERA_SETTINGS_KEY = "lasrera_certificate_config";

/** Official LASRERA logo from the Lagos State portal. */
export const DEFAULT_LASRERA_LOGO_URL =
  "https://lasrera.lagosstate.gov.ng/images/lasrera_logo.png";

export interface ILasreraCertificateConfig {
  logoUrl: string;
  signatureUrl?: string;
  signatoryName: string;
  signatoryTitle: string;
}

const DEFAULT_CONFIG: ILasreraCertificateConfig = {
  logoUrl: DEFAULT_LASRERA_LOGO_URL,
  signatureUrl: "",
  signatoryName: "Director General",
  signatoryTitle: "Lagos State Real Estate Regulatory Authority",
};

export async function getLasreraCertificateConfig(): Promise<ILasreraCertificateConfig> {
  const row = await DB.Models.SystemSetting.findOne({ key: LASRERA_SETTINGS_KEY, status: "active" }).lean();
  if (!row?.value || typeof row.value !== "object") {
    return { ...DEFAULT_CONFIG };
  }
  const value = row.value as Partial<ILasreraCertificateConfig>;
  return {
    logoUrl: value.logoUrl?.trim() || DEFAULT_CONFIG.logoUrl,
    signatureUrl: value.signatureUrl?.trim() || "",
    signatoryName: value.signatoryName?.trim() || DEFAULT_CONFIG.signatoryName,
    signatoryTitle: value.signatoryTitle?.trim() || DEFAULT_CONFIG.signatoryTitle,
  };
}

export async function updateLasreraCertificateConfig(
  patch: Partial<ILasreraCertificateConfig>
): Promise<ILasreraCertificateConfig> {
  const current = await getLasreraCertificateConfig();
  const next: ILasreraCertificateConfig = {
    logoUrl: patch.logoUrl?.trim() || current.logoUrl,
    signatureUrl: patch.signatureUrl !== undefined ? patch.signatureUrl.trim() : current.signatureUrl,
    signatoryName: patch.signatoryName?.trim() || current.signatoryName,
    signatoryTitle: patch.signatoryTitle?.trim() || current.signatoryTitle,
  };

  await DB.Models.SystemSetting.findOneAndUpdate(
    { key: LASRERA_SETTINGS_KEY },
    {
      key: LASRERA_SETTINGS_KEY,
      value: next,
      description: "LASRERA transaction registration certificate branding and signature",
      category: "lasrera",
      isEditable: true,
      status: "active",
    },
    { upsert: true, new: true }
  );

  return next;
}
