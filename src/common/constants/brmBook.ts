export const BRM_BOOK_USER_TYPES = [
  "Agent",
  "Developer",
  "Lawyer",
  "Surveyor",
  "Valuer",
] as const;

export type BrmBookUserType = (typeof BRM_BOOK_USER_TYPES)[number];

export function isBrmBookUserType(value: unknown): value is BrmBookUserType {
  return BRM_BOOK_USER_TYPES.includes(String(value) as BrmBookUserType);
}

export const BRM_BOOK_ROLE_LABEL: Record<BrmBookUserType, string> = {
  Agent: "Agent",
  Developer: "Developer",
  Lawyer: "Lawyer",
  Surveyor: "Surveyor",
  Valuer: "Valuer",
};
