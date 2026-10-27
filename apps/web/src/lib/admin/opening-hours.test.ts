import { describe, expect, test } from "bun:test";
import { addPeriod, copyDay, emptyHours, hasBackward, hoursPayload, hoursText, parseHours, removePeriod, setClosed, setTime } from "./opening-hours";

describe("opening hours editor", () => {
  test("opening a day gives it 9:00-17:00; a second period follows the first; closing clears it", () => {
    let h = setClosed(emptyHours(), 0, false);
    expect(h.days[0]).toEqual([{ open: "09:00", close: "17:00" }]);
    h = addPeriod(h, 0);
    expect(h.days[0]).toEqual([{ open: "09:00", close: "17:00" }, { open: "17:00", close: "18:00" }]);
    h = setTime(h, 0, 0, "close", "14:00");
    expect(h.days[0]![0]!.close).toBe("14:00");
    expect(removePeriod(h, 0, 1).days[0]).toHaveLength(1);
    expect(setClosed(h, 0, true).days[0]).toEqual([]);
  });

  test("a closed day cannot get a second period, and at most three", () => {
    expect(addPeriod(emptyHours(), 2)).toEqual(emptyHours());
    let h = setClosed(emptyHours(), 0, false);
    for (let i = 0; i < 5; i++) h = addPeriod(h, 0);
    expect(h.days[0]).toHaveLength(3);
  });

  test("copies a day onto others without sharing the objects", () => {
    const h = copyDay(setClosed(emptyHours(), 0, false), 0, [1, 2, 3, 4]);
    expect(h.days[4]).toEqual(h.days[0]);
    expect(h.days[4]![0]).not.toBe(h.days[0]![0]);
    expect(h.days[5]).toEqual([]);
  });

  test("the payload is null when nothing is entered; notes are trimmed", () => {
    expect(hoursPayload("")).toBeNull();
    expect(hoursPayload(hoursText(emptyHours()))).toBeNull();
    expect(hoursPayload(hoursText({ ...setClosed(emptyHours(), 0, false), noteJa: " 祝日休み ", noteEn: " " }))).toMatchObject({ noteJa: "祝日休み", noteEn: null });
    expect(parseHours("not json")).toEqual(emptyHours());
  });

  test("a backward period is detected", () => {
    expect(hasBackward(setTime(setClosed(emptyHours(), 0, false), 0, 0, "close", "08:00"))).toBe(true);
    expect(hasBackward(setClosed(emptyHours(), 0, false))).toBe(false);
  });
});
