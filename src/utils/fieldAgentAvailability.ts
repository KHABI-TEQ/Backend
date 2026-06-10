/** User + profile checks for listing or assigning a Field Agent. */
export function isFieldAgentAvailableForRepresentation(
  user: {
    userType?: string;
    isDeleted?: boolean;
    isInActive?: boolean;
    accountApproved?: boolean;
  } | null | undefined,
  profile: { isFlagged?: boolean } | null | undefined,
): boolean {
  if (!user || user.userType !== "FieldAgent") return false;
  if (user.isDeleted) return false;
  if (user.isInActive) return false;
  if (!user.accountApproved) return false;
  if (!profile) return false;
  if (profile.isFlagged) return false;
  return true;
}
