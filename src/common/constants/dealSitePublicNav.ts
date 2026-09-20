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
  { key: "transaction-registration", label: "Transaction registration", href: "/transaction-registration", enabled: true },
];

export function resolveDealSiteNav(items?: DealSiteNavItem[] | null): DealSiteNavItem[] {
  if (!Array.isArray(items) || items.length === 0) return DEFAULT_DEAL_SITE_NAV;
  return items.map((item) => ({
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
  };
}
