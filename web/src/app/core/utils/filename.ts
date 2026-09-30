/** Mirrors the API's PDF filename slug so downloads match the server. */
export function slugifyName(fullName: string): string {
  const base = fullName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return `${base || 'cv'}.pdf`;
}
