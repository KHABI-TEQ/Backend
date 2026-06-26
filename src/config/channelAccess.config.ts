export type ChannelLanguage = "en" | "pcm" | "yo" | "ig" | "ha";

export interface ChannelMenuCopy {
  welcome: string;
  mainMenu: string;
  languageMenu: string;
  verifyAgentPrompt: string;
  verifyPropertyPrompt: string;
  feeInfoTitle: string;
  payFeeMenu: string;
  payFeeDialPrompt: string;
  smsReceiptPrompt: string;
  invalidChoice: string;
  sessionExpired: string;
  humanHandoff: string;
  awaitingHuman: string;
}

const EN_COPY: ChannelMenuCopy = {
  welcome: "Welcome to LASRERA-KHABITEQ Compliance.",
  mainMenu: "1. Verify Agent\n2. Verify Property\n3. Pay Fee\n9. Language",
  languageMenu: "Select language:\n1. English\n2. Pidgin\n3. Yoruba\n4. Igbo\n5. Hausa",
  verifyAgentPrompt: "Enter agent phone (e.g. 08031234567):",
  verifyPropertyPrompt: "Enter property address keyword:",
  feeInfoTitle: "Registration fees (from):",
  payFeeMenu: "Select fee:\n1. Rental N5,000\n2. Sale N15,000\n3. Land N20,000",
  payFeeDialPrompt: "Dial this on your phone to pay:",
  smsReceiptPrompt: "Send SMS receipt?\n1. Yes\n2. No",
  invalidChoice: "Invalid option. Try again.",
  sessionExpired: "Session ended. Dial again to restart.",
  humanHandoff: "A support agent will join this chat shortly.",
  awaitingHuman: "Your request is with our team. An agent will reply soon.",
};

const PCM_COPY: ChannelMenuCopy = {
  welcome: "Welcome to LASRERA-KHABITEQ.",
  mainMenu: "1. Check Agent\n2. Check Property\n3. Pay Fee\n9. Language",
  languageMenu: "Choose language:\n1. English\n2. Pidgin\n3. Yoruba\n4. Igbo\n5. Hausa",
  verifyAgentPrompt: "Type agent phone (e.g. 08031234567):",
  verifyPropertyPrompt: "Type property address keyword:",
  feeInfoTitle: "Registration fees (from):",
  payFeeMenu: "Choose fee:\n1. Rent N5,000\n2. Sale N15,000\n3. Land N20,000",
  payFeeDialPrompt: "Dial am for your phone to pay:",
  smsReceiptPrompt: "You wan SMS receipt?\n1. Yes\n2. No",
  invalidChoice: "Wrong option. Try again.",
  sessionExpired: "Session don end. Dial again.",
  humanHandoff: "Support agent go join this chat soon.",
  awaitingHuman: "We don receive your request. Agent go reply soon.",
};

const YO_COPY: ChannelMenuCopy = {
  welcome: "Kaabo si LASRERA-KHABITEQ.",
  mainMenu: "1. Ṣayẹwo Aṣoju\n2. Ṣayẹwo Ile\n3. Sanwo Owo\n9. Ede",
  languageMenu: "Yan ede:\n1. English\n2. Pidgin\n3. Yoruba\n4. Igbo\n5. Hausa",
  verifyAgentPrompt: "Tẹ nọmba foonu aṣoju (080...):",
  verifyPropertyPrompt: "Tẹ apakan adirẹsi ile:",
  feeInfoTitle: "Owo igbasilẹ (lati):",
  payFeeMenu: "Yan idiyele:\n1. Yalo N5,000\n2. Tita N15,000\n3. Ilẹ N20,000",
  payFeeDialPrompt: "Pe nọmba yii lati sanwo:",
  smsReceiptPrompt: "Fi SMS ranṣẹ?\n1. Bẹẹni\n2. Rara",
  invalidChoice: "Aṣayan ko tọ. Gbiyanju lẹkan si.",
  sessionExpired: "Igba pari. Tun pe lẹkan si.",
  humanHandoff: "Oluranlọwọ yoo darapọ mọ laipẹ.",
  awaitingHuman: "Ibeere rẹ ti wa pẹlu wa. Oluranlọwọ yoo dahun laipẹ.",
};

const IG_COPY: ChannelMenuCopy = {
  welcome: "Nnọọ na LASRERA-KHABITEQ.",
  mainMenu: "1. Nyochaa Onye nnọchi anya\n2. Nyochaa Ụlọ\n3. Kwụọ Ụgwọ\n9. Asụsụ",
  languageMenu: "Họrọ asụsụ:\n1. English\n2. Pidgin\n3. Yoruba\n4. Igbo\n5. Hausa",
  verifyAgentPrompt: "Tinye nọmba ekwentị onye nnọchi anya (080...):",
  verifyPropertyPrompt: "Tinye mkpụrụ adreesị ụlọ:",
  feeInfoTitle: "Ụgwọ ndebanye aha (site na):",
  payFeeMenu: "Họrọ ụgwọ:\n1. Rent N5,000\n2. Sale N15,000\n3. Land N20,000",
  payFeeDialPrompt: "Kpọọ nọmba a iji kwụọ ụgwọ:",
  smsReceiptPrompt: "Ziga SMS?\n1. Ee\n2. Mba",
  invalidChoice: "Nhọrọ ezighi ezi. Gbalịa ọzọ.",
  sessionExpired: "Oge agwụla. Kpọghachi ọzọ.",
  humanHandoff: "Onye nkwado ga-abata n'oge na-adịghị anya.",
  awaitingHuman: "Arịrịọ gị nọ n'aka anyị. Onye nkwado ga-aza ngwa ngwa.",
};

const HA_COPY: ChannelMenuCopy = {
  welcome: "Barka da zuwa LASRERA-KHABITEQ.",
  mainMenu: "1. Duba Wakili\n2. Duba Gida\n3. Biya Kuɗi\n9. Harshe",
  languageMenu: "Zaɓi harshe:\n1. English\n2. Pidgin\n3. Yoruba\n4. Igbo\n5. Hausa",
  verifyAgentPrompt: "Shigar da lambar wayar wakili (080...):",
  verifyPropertyPrompt: "Shigar da kalmar adireshin gida:",
  feeInfoTitle: "Kudaden rajista (daga):",
  payFeeMenu: "Zaɓi kuɗi:\n1. Hayar N5,000\n2. Sayarwa N15,000\n3. Ƙasa N20,000",
  payFeeDialPrompt: "Kira wannan lambar don biya:",
  smsReceiptPrompt: "Aika SMS?\n1. Ee\n2. A'a",
  invalidChoice: "Zaɓi ba daidai ba. Sake gwadawa.",
  sessionExpired: "Lokaci ya kare. Sake kira.",
  humanHandoff: "Wani wakili zai shigo cikin tattaunawa nan ba da jimawa ba.",
  awaitingHuman: "An karɓi buƙatarka. Wakili zai amsa nan ba da jimawa ba.",
};

const COPY_MAP: Record<ChannelLanguage, ChannelMenuCopy> = {
  en: EN_COPY,
  pcm: PCM_COPY,
  yo: YO_COPY,
  ig: IG_COPY,
  ha: HA_COPY,
};

const LANGUAGE_BY_CHOICE: Record<string, ChannelLanguage> = {
  "1": "en",
  "2": "pcm",
  "3": "yo",
  "4": "ig",
  "5": "ha",
};

export function parseLanguageChoice(choice: string): ChannelLanguage | null {
  return LANGUAGE_BY_CHOICE[String(choice).trim()] ?? null;
}

export function getChannelCopy(lang?: ChannelLanguage | string): ChannelMenuCopy {
  const key = (lang || process.env.CHANNEL_DEFAULT_LANGUAGE || "en").toLowerCase() as ChannelLanguage;
  return COPY_MAP[key] ?? EN_COPY;
}

export function getFeeSummaryLines(lang?: ChannelLanguage | string): string[] {
  const copy = getChannelCopy(lang);
  return [
    `${copy.feeInfoTitle}`,
    "Rental: from N5,000",
    "Outright sale: from N15,000",
    "Land sale: from N20,000",
  ];
}

/** USSD channel payment tiers (minimum processing fees). */
export const CHANNEL_PAYMENT_TIERS = [
  { key: "rental_agreement", choice: "1", amountNaira: 5_000, label: "Rental" },
  { key: "outright_sale", choice: "2", amountNaira: 15_000, label: "Outright sale" },
  { key: "land_sale", choice: "3", amountNaira: 20_000, label: "Land sale" },
] as const;

/** Default Paystack USSD bank code (GTBank *737#). */
export const DEFAULT_PAYSTACK_USSD_BANK = process.env.PAYSTACK_USSD_BANK_CODE || "737";

/** USSD sessions time out quickly — keep responses short. */
export const USSD_MAX_RESPONSE_CHARS = 182;
