import OpenAI from "openai";

const PROPERTY_SYSTEM_PROMPT = `You are a real-estate form assistant. The user will describe a property they want to list (sale, rent, shortlet, or joint venture) in Nigeria. Extract structured data from their message and return ONLY a valid JSON object with the following optional fields. Use Nigerian locations (state, LGA, area). Omit any field you cannot infer; use null for missing optional fields. Return no other text.

Schema (all optional except you must return an object):
{
  "propertyType": "sell" | "rent" | "shortlet" | "jv",
  "propertyCategory": "Residential" | "Commercial" | "Land" | "Industrial" | "Mixed-Use",
  "propertyCondition": "New" | "Renovated" | "Fairly Used" | "Old" etc,
  "typeOfBuilding": "Duplex" | "Bungalow" | "Flat" | "Terrace" | "Self Contain" | "Shop" | "Warehouse" | "Land" etc,
  "price": number (in Naira),
  "location": { "state": string, "localGovernment": string, "area": string, "streetAddress": string | null },
  "landSize": { "measurementType": "SQM" | "SQFT" | "Acres" etc, "size": number } | null,
  "additionalFeatures": { "noOfBedroom": number, "noOfBathroom": number, "noOfToilet": number, "noOfCarPark": number },
  "description": string (short property description),
  "addtionalInfo": string | null,
  "features": string[] (e.g. ["Parking", "Security", "Water"]),
  "rentalType": string | null (if rent: "Monthly" | "Yearly" etc),
  "shortletDuration": string | null (if shortlet),
  "holdDuration": string | null (if jv),
  "isTenanted": "yes" | "no",
  "inspectionFee": number | null (1000-50000 Naira),
  "agentCommissionPercent": number | null (0-5),
  "agentCommissionAmount": number | null (Naira)
}`;

const PREFERENCE_SYSTEM_PROMPT = `You are a real-estate form assistant in Nigeria. The user will describe what kind of property they are looking for (buy, rent, shortlet, or joint venture). Extract structured data and return ONLY a valid JSON object with the following optional fields. Use Nigerian locations. Omit any field you cannot infer; use null for missing optional fields. Return no other text.

Schema (all optional except you must return an object):
{
  "preferenceType": "buy" | "rent" | "joint-venture" | "shortlet",
  "preferenceMode": "buy" | "tenant" | "developer" | "shortlet",
  "location": {
    "state": string,
    "localGovernmentAreas": string[],
    "lgasWithAreas": [{ "lgaName": string, "areas": string[] }],
    "customLocation": string
  },
  "budget": { "minPrice": number, "maxPrice": number, "currency": "NGN" },
  "propertyDetails": {
    "propertyType": string,
    "buildingType": string,
    "minBedrooms": string,
    "minBathrooms": number,
    "leaseTerm": string,
    "propertyCondition": string,
    "purpose": string,
    "landSize": string,
    "documentTypes": string[],
    "landConditions": string[]
  } | null,
  "developmentDetails": {
    "minLandSize": string,
    "maxLandSize": string,
    "measurementUnit": string,
    "developmentTypes": ["residential" | "commercial" | "mixed-use" | "industrial"],
    "preferredSharingRatio": string,
    "proposalDetails": string,
    "minimumTitleRequirements": string[],
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
    "travelType": string,
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: apiKey.trim() });
  }
  return openaiClient;
}

export type FormType = "property" | "preference";

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
          content: `Extract property listing form data from this description. Return only valid JSON.\n\n${userInput.trim()}`,
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

    const data = JSON.parse(jsonStr) as Record<string, unknown>;
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return { success: false, error: "Invalid AI response shape" };
    }

    return { success: true, data };
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message.includes("OPENAI_API_KEY")) {
        return { success: false, error: "AI service is not configured" };
      }
      return { success: false, error: err.message };
    }
    return { success: false, error: "AI request failed" };
  }
}
