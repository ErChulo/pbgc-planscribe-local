const WHITESPACE = /\s+/g;
const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;

export function normalizeText(input: string): string {
  return input.replace(WHITESPACE, " ").trim();
}

export function tokenize(input: string): string[] {
  const normalized = normalizeText(input).toLowerCase();
  if (!normalized) {
    return [];
  }

  return normalized
    .replace(PUNCTUATION, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

