import { WhatsAppMessageTemplates } from "../common/WhatsAppMessageTemplates";

type TemplateContract = {
  key: string;
  requiredVariables: string[];
};

const TEMPLATE_CONTRACTS: TemplateContract[] = [
  {
    key: "admin_provisioned_account",
    requiredVariables: ["firstName", "userType", "email", "loginUrl"],
  },
  {
    key: "property_created_by_admin",
    requiredVariables: ["firstName", "summaryLine"],
  },
  {
    key: "booking_confirmation",
    requiredVariables: [
      "userName",
      "propertyName",
      "propertyAddress",
      "date",
      "time",
      "agentName",
      "agentPhone",
      "bookingId",
    ],
  },
  {
    key: "agent_new_booking",
    requiredVariables: [
      "agentName",
      "userName",
      "userPhone",
      "propertyName",
      "propertyAddress",
      "date",
      "time",
      "bookingId",
      "userPreferences",
    ],
  },
  {
    key: "booking_cancelled",
    requiredVariables: ["userName", "propertyName", "date", "cancellationReason"],
  },
  {
    key: "booking_cancelled_agent",
    requiredVariables: ["agentName", "userName", "propertyName", "date", "reason"],
  },
  {
    key: "booking_rescheduled",
    requiredVariables: [
      "userName",
      "propertyName",
      "newDate",
      "newTime",
      "agentName",
      "rescheduleReason",
    ],
  },
  {
    key: "viewing_reminder_24h",
    requiredVariables: ["userName", "propertyName", "propertyAddress", "time", "agentName", "agentPhone"],
  },
  {
    key: "viewing_reminder_2h",
    requiredVariables: ["userName", "propertyName", "time", "agentName", "agentPhone"],
  },
  {
    key: "property_matches",
    requiredVariables: ["userName", "matchCount", "propertyList", "bookingLink", "morePropertiesLink"],
  },
  {
    key: "new_listing_match",
    requiredVariables: ["userName", "propertyDetails", "matchScore", "bookingLink"],
  },
  {
    key: "price_drop_alert",
    requiredVariables: [
      "userName",
      "propertyName",
      "propertyLocation",
      "oldPrice",
      "newPrice",
      "savings",
      "bookingLink",
    ],
  },
  {
    key: "preferences_saved",
    requiredVariables: ["userName", "preferencesSummary"],
  },
  {
    key: "preferences_updated",
    requiredVariables: ["userName", "preferencesSummary"],
  },
  {
    key: "agent_assigned",
    requiredVariables: ["userName", "agentName", "agentPhone", "agentSpecialty", "propertyName", "reason"],
  },
  {
    key: "client_assigned",
    requiredVariables: ["agentName", "userName", "userPhone", "userPreferences", "assignmentReason"],
  },
  {
    key: "follow_up_reminder",
    requiredVariables: ["userName", "daysSince", "searchLink"],
  },
  {
    key: "test_message",
    requiredVariables: ["timestamp"],
  },
];

function extractTemplateVariables(template: string): string[] {
  const regex = /{{(\w+)}}/g;
  const found: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(template)) !== null) {
    if (!seen.has(match[1])) {
      found.push(match[1]);
      seen.add(match[1]);
    }
  }

  return found;
}

function validateTemplateContracts(): string[] {
  const templates = new WhatsAppMessageTemplates();
  const errors: string[] = [];

  for (const contract of TEMPLATE_CONTRACTS) {
    const template = templates.getTemplate(contract.key);
    if (!template) {
      errors.push(`Missing WhatsApp template definition for key "${contract.key}".`);
      continue;
    }

    const actual = extractTemplateVariables(template.template);
    const expectedSet = new Set(contract.requiredVariables);
    const actualSet = new Set(actual);

    const missingInTemplate = contract.requiredVariables.filter((v) => !actualSet.has(v));
    const extraInTemplate = actual.filter((v) => !expectedSet.has(v));

    if (missingInTemplate.length > 0 || extraInTemplate.length > 0) {
      errors.push(
        `Template "${contract.key}" variable mismatch. missingInTemplate=[${missingInTemplate.join(", ")}], extraInTemplate=[${extraInTemplate.join(", ")}]`,
      );
    }
  }

  return errors;
}

function validateEnvConfiguration(): string[] {
  const errors: string[] = [];
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";
  const defaultCountryCode = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "234").replace(/\D/g, "");

  const hasAnyCoreEnv = Boolean(token || phoneNumberId || verifyToken);
  const hasAllCoreEnv = Boolean(token && phoneNumberId && verifyToken);

  if (hasAnyCoreEnv && !hasAllCoreEnv) {
    errors.push(
      "Incomplete WhatsApp env configuration. Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_VERIFY_TOKEN together.",
    );
  }

  if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(language)) {
    errors.push(
      `Invalid WHATSAPP_TEMPLATE_LANGUAGE="${language}". Expected format like "en" or "en_US".`,
    );
  }

  if (!defaultCountryCode) {
    errors.push(
      "Invalid WHATSAPP_DEFAULT_COUNTRY_CODE. It must contain digits only.",
    );
  }

  return errors;
}

export function runWhatsAppBootValidation(): void {
  const errors = [
    ...validateTemplateContracts(),
    ...validateEnvConfiguration(),
  ];

  if (errors.length > 0) {
    const message = [
      "[BOOT] WhatsApp configuration validation failed:",
      ...errors.map((e) => ` - ${e}`),
    ].join("\n");
    throw new Error(message);
  }

  console.info("[BOOT] WhatsApp configuration validation passed.");
}

