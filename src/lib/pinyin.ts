// Strip combining tone marks + spaces → ASCII lowercase, so "laoshi"
// matches "lǎo shī".
export function normalizePinyin(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export const HAN_RE = /[㐀-鿿豈-﫿]/;
