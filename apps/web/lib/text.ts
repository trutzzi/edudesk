// Case- and accent-insensitive, so "romana" finds "Limba română"
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

// Whether `text` contains `search`; an empty search matches everything
export function containsText(text: string, search: string) {
  const query = fold(search.trim());
  return !query || fold(text).includes(query);
}
