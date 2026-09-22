import OpenAI from "openai";
import { isPilotState, PILOT_STATE } from "../common/constants/pilotLocation";

const PROPERTY_SYSTEM_PROMPT = `You are a real-estate form assistant. The user will describe a property they want to list (sale, rent, shortlet, or joint venture) in Lagos State, Nigeria. Khabiteq is currently piloting in Lagos State only. Extract structured data from their message and return ONLY a valid JSON object with the following optional fields. location.state MUST be "Lagos". Use Lagos LGAs and areas only. If the user names another Nigerian state, still set location.state to "Lagos" and leave LGA/area empty unless they also named a Lagos place. Omit any field you cannot infer; use null for missing optional fields. Return no other text.

Schema (all optional except you must return an object):
{
  "propertyType": "sell" | "rent" | "shortlet" | "jv" | "off-plan",
  "propertyCategory": "Residential" | "Commercial" | "Land" | "Industrial" | "Mixed-Use",
  "propertyCondition": "New" | "Renovated" | "Fairly Used" | "Old" etc,
  "typeOfBuilding": "Duplex" | "Bungalow" | "Flat" | "Terrace" | "Self Contain" | "Shop" | "Warehouse" | "Land" etc,
  "price": number (in Naira; convert spoken amounts: twenty million → 20000000),
  "location": { "state": string, "localGovernment": string, "area": string, "streetAddress": string | null, "estate": string | null },
  "landSize": { "measurementType": "SQM" | "SQFT" | "Acres" etc, "size": number } | null,
  "additionalFeatures": { "noOfBedroom": number, "noOfBathroom": number, "noOfToilet": number, "noOfCarPark": number },
  "description": string (short property description),
  "addtionalInfo": string | null,
  "features": string[] (e.g. ["Parking", "Security", "Water"]),
  "rentalType": string | null (if rent: "Monthly" | "Yearly" etc),
  "shortletDuration": string | null (if shortlet),
  "holdDuration": string | null (if jv),
  "isTenanted": "yes" | "no",
  "inspectionFee": number | null (omit or 0 if none; 1000-50000 Naira if set),
  "agentCommissionPercent": number | null (default rent 10, sale/off-plan 5, jv/shortlet 5; landlord may reduce to min 3, developer to min 1),
  "agentCommissionAmount": number | null (Naira)
}`;

const PREFERENCE_SYSTEM_PROMPT = `You are a real-estate form assistant for Lagos State, Nigeria. Khabiteq is currently piloting in Lagos State only. The user will describe what kind of property they are looking for (buy, rent, shortlet, off-plan, or joint venture). They may send one short answer per field OR a long compound message with many details at once — extract every field you can infer from the full text in a single JSON response. location.state MUST be "Lagos". Use Lagos LGAs, areas, and estates only. If the user names another Nigerian state, still set location.state to "Lagos" and do not copy that other state. When the user names an estate (e.g. Banana Island, VGC, Magodo GRA Phase 2), put it under lgasWithAreas[].areasWithEstates for the matching area. Omit any field you cannot infer; use null for missing optional fields. Return no other text.

Schema (all optional except you must return an object):
{
  "preferenceType": "buy" | "rent" | "joint-venture" | "shortlet" | "off-plan",
  "preferenceMode": "buy" | "tenant" | "developer" | "shortlet",
  "location": {
    "state": string,
    "localGovernmentAreas": string[],
    "lgasWithAreas": [{
      "lgaName": string,
      "areas": string[],
      "areasWithEstates": [{ "areaName": string, "estates": string[] }]
    }],
    "customLocation": string
  },
  "budget": { "minPrice": number, "maxPrice": number, "currency": "NGN" },
  IMPORTANT: all numbers must be raw JSON numbers with no thousand separators (15000000, never 15,000,000). Convert spoken English amounts to numbers (twenty million naira → 20000000, 20 million → 20000000).
  "propertyDetails": {
    "propertyType": string,
    "buildingType": "duplex" | "bungalow" | "flat-apartment" | "terraced-house" | "detached-house" | "semi-detached-house" | "any-type" | "office-complex" | "warehouse" | "plaza" | "shop",
    "minBedrooms": string,
    "minBathrooms": number,
    "toilets": number,
    "leaseTerm": string,
    "propertyCondition": "brand-new" | "fairly-new" | "good-condition" | "fairly-used" | "old-building" | "needs-renovation" | "any-condition",
    "purpose": string,
    "landSize": string,
    "documentTypes": ["deed-of-assignment" | "deed-of-ownership" | "deed-of-conveyance" | "survey-plan" | "governors-consent" | "certificate-of-occupancy" | "family-receipt" | "contract-of-sale" | "land-certificate" | "gazette" | "excision"],
    "landConditions": string[]
  } | null,
  "developmentDetails": {
    "minLandSize": string,
    "maxLandSize": string,
    "measurementUnit": "plot" | "sqm" | "acres" | "hectares",
    "developmentTypes": ["residential" | "commercial" | "mixed-use" | "industrial"],
    "preferredSharingRatio": string,
    "proposalDetails": string,
    "minimumTitleRequirements": ["deed-of-assignment" | "deed-of-ownership" | "deed-of-conveyance" | "survey-plan" | "governors-consent" | "certificate-of-occupancy" | "family-receipt" | "contract-of-sale" | "land-certificate" | "gazette" | "excision"],
    "willingToConsiderPendingTitle": boolean,
    "additionalRequirements": string
  } | null,
  "bookingDetails": {
    "propertyType": string,
    "buildingType": string,
    "minBedrooms": string,
    "minBathrooms": number,
    "numberOfGuests": number,
    "checkInDate": string (ISO date) | null,
    "checkOutDate": string (ISO date) | null,
    "travelType": "solo" | "couple" | "family" | "group" | "business",
    "preferredCheckInTime": string,
    "preferredCheckOutTime": string,
    "propertyCondition": string,
    "purpose": string
  } | null,
  "features": { "baseFeatures": string[], "premiumFeatures": string[], "autoAdjustToFeatures": boolean },
  "nearbyLandmark": string,
  "additionalNotes": string,
  "partnerExpectations": string
}`;

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  const raw = process.env.OPENAI_API_KEY;
  const apiKey =
    typeof raw === "string"
      ? raw.trim().replace(/^["']|["']$/g, "")
      : "";
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export type FormType = "property" | "preference";

/** Models often write 15,000,000 inside JSON; that is invalid. Strip grouping commas in unquoted numbers. */
function sanitizeAiJsonNumbers(jsonStr: string): string {
  return jsonStr.replace(/(:\s*)(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?)/g, (_m, prefix: string, num: string) => {
    return `${prefix}${num.replace(/,/g, "")}`;
  });
}

const SPOKEN_SCALE: Record<string, number> = {
  thousand: 1_000,
  k: 1_000,
  million: 1_000_000,
  mill: 1_000_000,
  mil: 1_000_000,
  m: 1_000_000,
  billion: 1_000_000_000,
  b: 1_000_000_000,
};

function coerceNairaValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  const compact = raw.replace(/[₦,\s]/g, "");
  if (/^\d+(\.\d+)?$/.test(compact)) {
    const n = Number(compact);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
  }
  const t = raw
    .toLowerCase()
    .replace(/₦/g, " ")
    .replace(/\b(nairas?|ngn)\b/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const m = t.match(
    /(?:(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|\d+(?:\.\d+)?))\s*(thousand|k|million|mill|mil|m|billion|b)\b/
  );
  if (!m) return undefined;
  const WORDS: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
    eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
    seventy: 70, eighty: 80, ninety: 90,
  };
  const base = WORDS[m[1]] ?? Number(m[1]);
  const scale = SPOKEN_SCALE[m[2]];
  if (!Number.isFinite(base) || !scale) return undefined;
  return Math.round(base * scale);
}

function coerceMoneyFieldsInAiData(data: Record<string, unknown>): void {
  const budget = data.budget;
  if (budget && typeof budget === "object" && !Array.isArray(budget)) {
    const b = budget as Record<string, unknown>;
    const min = coerceNairaValue(b.minPrice);
    const max = coerceNairaValue(b.maxPrice);
    if (min != null) b.minPrice = min;
    if (max != null) b.maxPrice = max;
  }
  const price = coerceNairaValue(data.price);
  if (price != null) data.price = price;
}

/**
 * Call OpenAI to suggest form fields from natural language.
 * Returns a partial object that the frontend can merge into the property or preference form.
 */
export async function suggestFormFields(
  formType: FormType,
  userInput: string
): Promise<{ success: true; data: Record<string, unknown> } | { success: false; error: string }> {
  if (!userInput || typeof userInput !== "string" || userInput.trim().length === 0) {
    return { success: false, error: "userInput is required and must be non-empty" };
  }

  const systemPrompt = formType === "property" ? PROPERTY_SYSTEM_PROMPT : PREFERENCE_SYSTEM_PROMPT;
  const maxTokens = 1500;

  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            formType === "preference"
              ? `Extract preference form data from this description. Return only valid JSON. If the message contains multiple details (location, budget, bedrooms, dates, etc.), populate all matching fields at once.\n\n${userInput.trim()}`
              : `Extract property listing form data from this description. Return only valid JSON.\n\n${userInput.trim()}`,
        },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      return { success: false, error: "No response from AI" };
    }

    // Strip possible markdown code block
    let jsonStr = content;
    const codeBlockMatch = content.match(/^```(?:json)?\s*([\s\S]*?)```$/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const data = JSON.parse(sanitizeAiJsonNumbers(jsonStr)) as Record<string, unknown>;
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return { success: false, error: "Invalid AI response shape" };
    }

    coerceMoneyFieldsInAiData(data);

    const location = data.location as Record<string, unknown> | undefined;
    if (location && typeof location === "object") {
      location.state = isPilotState(String(location.state || PILOT_STATE))
        ? PILOT_STATE
        : PILOT_STATE;
      data.location = location;
    }

    return { success: true, data };
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message.includes("OPENAI_API_KEY")) {
        return { success: false, error: "AI service is not configured" };
      }
      const msg = err.message || "";
      if (
        /incorrect api key|invalid api key|authentication|401/i.test(msg) ||
        (err as { status?: number }).status === 401
      ) {
        return {
          success: false,
          error:
            "AI service authentication failed. Update OPENAI_API_KEY in the backend .env with a valid OpenAI key, then restart the server.",
        };
      }
      return { success: false, error: msg };
    }
    return { success: false, error: "AI request failed" };
  }
}
