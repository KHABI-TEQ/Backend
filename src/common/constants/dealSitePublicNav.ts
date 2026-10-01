export type DealSiteNavItem = {
  key: string;
  label: string;
  href: string;
  enabled: boolean;
};

export const DEFAULT_DEAL_SITE_NAV: DealSiteNavItem[] = [
  { key: "home", label: "Home", href: "/", enabled: true },
  { key: "properties", label: "Properties", href: "/market-place", enabled: true },
  { key: "about", label: "About Us", href: "/about", enabled: true },
  { key: "services", label: "Services", href: "/services", enabled: true },
  { key: "faq", label: "FAQ", href: "/faq", enabled: false },
  { key: "contact", label: "Contact Us", href: "/contact", enabled: true },
  { key: "preferences", label: "Submit Preference", href: "/preferences", enabled: true },
];

export function resolveDealSiteNav(items?: DealSiteNavItem[] | null): DealSiteNavItem[] {
  if (!Array.isArray(items) || items.length === 0) return DEFAULT_DEAL_SITE_NAV;
  return items
    .filter((item) => String(item.key || "") !== "transaction-registration")
    .map((item) => ({
      key: String(item.key || "").trim() || "custom",
      label: String(item.label || "").trim() || "Page",
      href: String(item.href || "/").trim() || "/",
      enabled: item.enabled !== false,
    }));
}

/** Normalize editor aliases so hero/footer/contact actually persist. */
export function normalizeDealSiteSectionName(sectionName: string): string {
  if (sectionName === "practitionerPage") return "publicPage";
  if (sectionName === "footerSection") return "footer";
  return sectionName;
}

export const SOCIAL_LINK_FIELDS = [
  {
    key: "website",
    label: "Website (optional)",
    placeholder: "https://yourwebsite.com",
  },
  {
    key: "twitter",
    label: "Twitter (optional)",
    placeholder: "https://twitter.com/yourhandle",
  },
  {
    key: "instagram",
    label: "Instagram (optional)",
    placeholder: "https://instagram.com/yourhandle",
  },
  {
    key: "facebook",
    label: "Facebook (optional)",
    placeholder: "https://facebook.com/yourpage",
  },
  {
    key: "linkedin",
    label: "LinkedIn (optional)",
    placeholder: "https://linkedin.com/company/yourcompany",
  },
] as const;

export type SocialLinkKey = (typeof SOCIAL_LINK_FIELDS)[number]["key"];

export function emptySocialLinks(): Record<SocialLinkKey, string> {
  return {
    website: "",
    twitter: "",
    instagram: "",
    facebook: "",
    linkedin: "",
  };
}

/** Top of the Social Links settings page. Existing link values stay on `socialLinks`. */
export function buildSocialLinksSettings(socialLinks?: Record<string, unknown> | null) {
  const links = { ...emptySocialLinks(), ...(socialLinks || {}) };
  return {
    title: "Social Links",
    description:
      "Connect your social media profiles to your practitioner page. All fields are optional. Skip to continue, or Save changes after you enter a value.",
    fields: SOCIAL_LINK_FIELDS.map((field) => ({
      ...field,
      optional: true,
      value: String(links[field.key] || "").trim(),
    })),
  };
}

export function sanitizeSocialLinksUpdate(updates: Record<string, unknown>) {
  const fromFields = Array.isArray(updates.fields)
    ? Object.fromEntries(
        (updates.fields as Array<{ key?: string; value?: unknown }>).map((field) => [
          String(field?.key || ""),
          field?.value,
        ])
      )
    : {};
  const source = { ...fromFields, ...updates };
  const next: Record<string, string> = {};
  for (const field of SOCIAL_LINK_FIELDS) {
    if (!(field.key in source)) continue;
    const value = String(source[field.key] ?? "").trim();
    if (!value) {
      next[field.key] = "";
      continue;
    }
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`${field.label.replace(" (optional)", "")} must be a valid URL, for example ${field.placeholder}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`${field.label.replace(" (optional)", "")} must start with http:// or https://`);
    }
    next[field.key] = value;
  }
  return next;
}

export function normalizeDealSiteSectionPayload(sectionName: string, updates: Record<string, unknown>) {
  if (sectionName === "contactUs" && updates && typeof updates === "object") {
    const hero = (updates as { hero?: { title?: string; description?: string } }).hero;
    if (hero) {
      return {
        ...updates,
        title: updates.title || hero.title || "",
        description: updates.description || hero.description || "",
      };
    }
  }
  return updates;
}

export function toPublicDealSiteView(dealSite: Record<string, any>): Record<string, any> {
  const publicPage = dealSite.publicPage || dealSite.practitionerPage || {};
  const footer = dealSite.footer || dealSite.footerSection || {};
  const contactUs = dealSite.contactUs || {};
  return {
    ...dealSite,
    publicPage,
    practitionerPage: publicPage,
    footer,
    footerSection: {
      shortDescription: footer.shortDescription || footer.shortDesc || "",
      shortDesc: footer.shortDescription || footer.shortDesc || "",
      copyrightText: footer.copyrightText || footer.copyRight || "",
      copyRight: footer.copyrightText || footer.copyRight || "",
    },
    contactUs: {
      ...contactUs,
      title: contactUs.title || contactUs.hero?.title || "",
      description: contactUs.description || contactUs.hero?.description || "",
    },
    navigation: {
      items: resolveDealSiteNav(dealSite.navigation?.items),
    },
    faqs: dealSite.faqs || { title: "Frequently asked questions", items: [] },
    customPages: Array.isArray(dealSite.customPages) ? dealSite.customPages : [],
    socialLinks: {
      ...emptySocialLinks(),
      ...(dealSite.socialLinks || {}),
    },
    socialLinksSettings: buildSocialLinksSettings(dealSite.socialLinks),
  };
}
