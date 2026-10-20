export const defaultArea = 'Cagayan de Oro City';
export const suggestedAreas = ['Cagayan de Oro City', 'Carmen, Cagayan de Oro City', 'Corrales Avenue, Cagayan de Oro City'];

export function normalizeArea(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, ' ').slice(0, 120);
  return /^(cdo|cagayan de oro)$/i.test(cleaned) ? defaultArea : cleaned;
}

export function matchesArea(address: string, area: string): boolean {
  const words = normalizeArea(area).toLowerCase().split(/[\s,]+/).filter(Boolean);
  const haystack = address.toLowerCase();
  return words.length > 0 && words.every(word => haystack.includes(word));
}
