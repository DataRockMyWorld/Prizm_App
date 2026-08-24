/** "Mar '25" — the Profile stat card's "Member since" value. */
export function formatMemberSince(dateJoined: string | null | undefined): string {
  if (!dateJoined) return "—";
  const date = new Date(dateJoined);
  if (Number.isNaN(date.getTime())) return "—";
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const year = String(date.getFullYear()).slice(-2);
  return `${month} '${year}`;
}
