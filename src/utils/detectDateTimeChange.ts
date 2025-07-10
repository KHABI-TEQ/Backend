export function hasDateTimeChanged(
  oldDate?: Date,
  oldTime?: string,
  newDate?: string,
  newTime?: string
): boolean {
  if (!newDate && !newTime) return false;
  const formattedOldDate = oldDate?.toISOString().split('T')[0];
  return (
    (newDate && newDate !== formattedOldDate) ||
    (newTime && newTime !== oldTime)
  );
}
