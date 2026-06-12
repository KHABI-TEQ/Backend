export function prepareTextForNaturalSpeech(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\bLGAs\b/gi, "local government areas")
    .replace(/\bLGA\b/gi, "local government area")
    .replace(/\bJV\b/gi, "joint venture")
    .replace(/\bsqm\b/gi, "square metres")
    .replace(/\s+/g, " ")
    .trim();
}
