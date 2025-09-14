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
