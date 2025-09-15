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

