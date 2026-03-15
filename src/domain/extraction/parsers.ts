export type NormalizedFieldValue =
  | { kind: "age_years"; value: number }
  | { kind: "percent"; value: number }
  | { kind: "years"; value: number };

function parseIntegerNearKeyword(input: string, keywords: string[]): number | null {
  const lower = input.toLowerCase();
  for (const keyword of keywords) {
    const idx = lower.indexOf(keyword);
    if (idx === -1) {
      continue;
    }
    const window = lower.slice(Math.max(0, idx - 40), idx + 80);
    const match = window.match(/\b(\d{1,3})\b/);
    if (match) {
      return Number.parseInt(match[1]!, 10);
    }
  }
  return null;
}

function parsePercent(input: string): number | null {
  const match = input.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  if (!match) {
    return null;
  }
  return Number.parseFloat(match[1]!);
}

export function parseNormalRetirementAge(value: string): NormalizedFieldValue | null {
  const age = parseIntegerNearKeyword(value, ["retirement age", "age"]);
  if (age === null) {
    return null;
  }
  return { kind: "age_years", value: age };
}

export function parseEarlyRetirementReduction(value: string): NormalizedFieldValue | null {
  const percent = parsePercent(value);
  if (percent !== null) {
    return { kind: "percent", value: percent };
  }
  return null;
}

export function parseVestingSchedule(value: string): NormalizedFieldValue | null {
  const years = parseIntegerNearKeyword(value, ["years", "vesting"]);
  if (years === null) {
    return null;
  }
  return { kind: "years", value: years };
}
