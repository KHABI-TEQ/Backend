const SPEECH_AND_TYPING_HINT =
  "The following text may come from voice dictation or hurried typing. " +
  "Before extracting fields: (1) Correct likely misheard or misspelled words; " +
  "(2) Fix Nigerian place names, areas, LGAs, landmarks, and common property terms; " +
  "(3) Normalize spoken numbers and naira amounts to sensible figures; DO NOT change the user's intent. " +
  "Use the corrected understanding for extraction only — output structured data as usual.\n\n" +
  "--- USER DESCRIPTION ---\n";

const MULTI_FIELD_HINT =
  "The user may describe several preference details in one message (location, budget, bedrooms, " +
  "property type, dates, etc.). Extract every field you can infer into the JSON object in a single response.\n\n";

export function wrapUserInputForAiSuggest(userInput: string): string {
  const t = typeof userInput === "string" ? userInput.trim() : "";
  if (!t) return "";
  return SPEECH_AND_TYPING_HINT + t;
}

export function buildSuggestPreferenceUserInput(
  userInput: string,
  options?: { focusedField?: string; allowMultiField?: boolean }
): string {
  const t = typeof userInput === "string" ? userInput.trim() : "";
  if (!t) return "";
  const parts: string[] = [SPEECH_AND_TYPING_HINT.replace("--- USER DESCRIPTION ---\n", "")];
  if (options?.allowMultiField !== false) parts.push(MULTI_FIELD_HINT);
  if (options?.focusedField?.trim()) {
    parts.push(
      `The user is primarily answering this field: ${options.focusedField.trim()}. ` +
        "Still extract any other clear fields from the same message.\n\n"
    );
  }
  parts.push("--- USER DESCRIPTION ---\n", t);
  return parts.join("");
}

export function isLongMultiFieldUtterance(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const words = t.split(/\s+/).filter(Boolean).length;
  const commas = (t.match(/,/g) || []).length;
  return words >= 12 || commas >= 2 || (words >= 8 && commas >= 1);
}
