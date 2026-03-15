import { describe, expect, it } from "vitest";
import {
  parseEarlyRetirementReduction,
  parseNormalRetirementAge,
  parseVestingSchedule,
} from "../../src/domain/extraction/parsers";

describe("typed extraction parsers", () => {
  it("parses normal retirement age and vesting years", () => {
    expect(parseNormalRetirementAge("Normal retirement age is 65 under this plan.")).toEqual({
      kind: "age_years",
      value: 65,
    });
    expect(parseVestingSchedule("Vesting schedule is graded over 6 years of service.")).toEqual({
      kind: "years",
      value: 6,
    });
  });

  it("parses early retirement reduction percent", () => {
    expect(parseEarlyRetirementReduction("Early retirement reduction is 4.5% per year.")).toEqual({
      kind: "percent",
      value: 4.5,
    });
  });
});
