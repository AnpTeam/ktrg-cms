import { describe, expect, test } from "bun:test";
import { cumulativeDistances, type LinePoint } from "./geometry";
import { legProfile } from "./elevation";

// East along latitude 34.5, 0.001 degrees is about 92 m; rising 10 m per point to 100 m, then falling back.
const up = (i: number) => (i <= 10 ? i * 10 : 100 - (i - 10) * 10);
const line: LinePoint[] = Array.from({ length: 21 }, (_, i) => [135 + i * 0.001, 34.5, up(i)] as LinePoint);
const cum = cumulativeDistances(line);

describe("legProfile", () => {
  test("a climb: left to right it rises, with the climb and no descent", () => {
    const p = legProfile(line, cum, 0, cum[10]!)!;
    expect(p.elevations[0]).toBeCloseTo(0, 0);
    expect(p.elevations.at(-1)).toBeCloseTo(100, 0);
    expect(p.climbM).toBeGreaterThan(90);
    expect(p.descentM).toBe(0);
  });

  test("walking the other way reads as a descent", () => {
    const p = legProfile(line, cum, cum[10]!, 0)!;
    expect(p.elevations[0]).toBeCloseTo(100, 0);
    expect(p.descentM).toBeGreaterThan(90);
    expect(p.climbM).toBe(0);
  });

  test("no strip when the stretch is flat, too short, or has no elevations", () => {
    expect(legProfile(line, cum, 0, 10)).toBeNull();
    const flat: LinePoint[] = line.map((p) => [p[0], p[1], 50] as LinePoint);
    expect(legProfile(flat, cum, 0, cum[10]!)).toBeNull();
    const bare: LinePoint[] = line.map((p) => [p[0], p[1]] as LinePoint);
    expect(legProfile(bare, cum, 0, cum[10]!)).toBeNull();
  });
});
