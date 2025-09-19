export const kebabToTitleCase = (str: string): string => {
  if (!str) return "";

  return str
    .split(/[-\s_]+/) // split on "-", space, or "_" just in case
    .map((word) =>
      word.length > 0
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : ""
    )
    .join(" ");
};


export const getPropertyTitleFromLocation = (location?: {
  state?: string;
  localGovernment?: string;
  area?: string;
  streetAddress?: string;
}): string => {
  if (!location) return "Untitled Property";

  const parts = [
    location.streetAddress,
    location.area,
    location.localGovernment,
    location.state,
  ].filter(Boolean);

  return parts.join(", ") || "Untitled Property";
};


/**
   * Generate a booking code
   */
  export const generateBookingCode = (prefix: string = "BK") => {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestamp = Date.now().toString().slice(-6); // last 6 digits
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Generate numeric passcode (e.g., for check-in)
   */
  export const generatePassCode = (length: number = 6) => {
    const digits = "0123456789";
    let code = "";
    for (let i = 0; i < length; i++) {
      code += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return code;
  }
