import { describe, expect, test } from "bun:test";
import { cleanHours, closedDaysText, hasBackwardPeriod, hoursText, type OpeningHours } from "./opening-hours";

const p = (open: string, close: string) => ({ open, close });
const week = (over: Partial<Record<number, { open: string; close: string }[]>> = {}): OpeningHours => ({
  days: Array.from({ length: 7 }, (_, i) => over[i] ?? []),
  noteJa: null,
  noteEn: null,
});

describe("opening hours text", () => {
  test("joins days with the same hours and names the closed days", () => {
    const h = week({ 0: [p("10:30", "17:30")], 1: [p("10:30", "17:30")], 2: [p("10:30", "17:30")], 3: [p("10:30", "17:30")], 4: [p("10:30", "17:30")], 6: [p("09:00", "17:00")] });
    expect(hoursText(h, "ja")).toBe("月〜金 10時30分〜17時30分｜日 9時〜17時");
    expect(hoursText(h, "en")).toBe("Mon–Fri 10:30–17:30 | Sun 9:00–17:00");
    expect(closedDaysText(h, "ja")).toBe("土");
    expect(closedDaysText(h, "en")).toBe("Sat");
  });

  test("a day open twice lists both periods, in time order", () => {
    const h = week({ 0: [p("17:00", "21:00"), p("11:00", "14:00")] });
    expect(hoursText(cleanHours(h), "ja")).toBe("月 11時〜14時、17時〜21時");
    expect(hoursText(cleanHours(h), "en")).toBe("Mon 11:00–14:00, 17:00–21:00");
  });

  test("the note follows, English falling back to Japanese", () => {
    const h = { ...week({ 5: [p("09:00", "12:00")] }), noteJa: "祝日は休み", noteEn: null };
    expect(hoursText(h, "en")).toBe("Sat 9:00–12:00 | 祝日は休み");
  });

  test("nothing entered is not filled in; closed on every day is not 'closed days'", () => {
    expect(cleanHours(week())).toBeNull();
    expect(hoursText(null, "ja")).toBeNull();
    expect(closedDaysText({ ...week(), noteJa: "要問合せ" }, "ja")).toBeNull();
    expect(closedDaysText(week({ 0: [p("09:00", "10:00")], 1: [p("09:00", "10:00")], 2: [p("09:00", "10:00")], 3: [p("09:00", "10:00")], 4: [p("09:00", "10:00")], 5: [p("09:00", "10:00")], 6: [p("09:00", "10:00")] }), "ja")).toBeNull();
  });

  test("a period that ends before it starts is caught", () => {
    expect(hasBackwardPeriod(week({ 0: [p("18:00", "09:00")] }))).toBe(true);
    expect(hasBackwardPeriod(week({ 0: [p("09:00", "18:00")] }))).toBe(false);
  });
});
