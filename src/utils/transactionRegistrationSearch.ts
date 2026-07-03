function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a MongoDB filter for registration list/search lookups.
 * Supports MongoDB _id, full certificate numbers (LASRERA/TRC/YYYY/SUFFIX),
 * 8-character certificate suffixes, and partial certificate number matches.
 */
export function buildRegistrationSearchFilter(search: string): Record<string, unknown> | null {
  const trimmed = search.trim();
  if (!trimmed) return null;

  if (/^[a-fA-F0-9]{24}$/.test(trimmed)) {
    return { _id: trimmed };
  }

  const compact = trimmed.replace(/\s+/g, "").toUpperCase();

  const fullCertMatch = compact.match(/^LASRERA\/TRC\/(\d{4})\/([A-F0-9]{8})$/);
  if (fullCertMatch) {
    const [, year, suffix] = fullCertMatch;
    const certificateNumber = `LASRERA/TRC/${year}/${suffix}`;
    return {
      $or: [
        { certificateNumber },
        {
          $expr: {
            $eq: [
              { $toUpper: { $substrBytes: [{ $toString: "$_id" }, 16, 8] } },
              suffix,
            ],
          },
        },
      ],
    };
  }

  if (/^[A-F0-9]{8}$/.test(compact)) {
    return {
      $or: [
        { certificateNumber: { $regex: `/${compact}$`, $options: "i" } },
        {
          $expr: {
            $eq: [
              { $toUpper: { $substrBytes: [{ $toString: "$_id" }, 16, 8] } },
              compact,
            ],
          },
        },
      ],
    };
  }

  if (compact.includes("LASRERA/TRC")) {
    const escaped = escapeRegex(trimmed).replace(/\s+/g, "\\s*");
    return { certificateNumber: { $regex: escaped, $options: "i" } };
  }

  const escaped = escapeRegex(trimmed);
  return {
    $or: [
      { certificateNumber: { $regex: escaped, $options: "i" } },
      { "buyer.fullName": { $regex: escaped, $options: "i" } },
      { "buyer.email": { $regex: escaped, $options: "i" } },
    ],
  };
}

export function mergeRegistrationFilters(
  ...parts: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> {
  const clauses = parts.filter(
    (part): part is Record<string, unknown> => !!part && Object.keys(part).length > 0
  );
  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}
