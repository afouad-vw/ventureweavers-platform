/** "Ahmed Fouad" → "AF". Shared by server pages and client shells, so it lives outside any "use client" file. */
export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "VW";
}
