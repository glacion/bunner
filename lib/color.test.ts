import { describe, expect, test } from "bun:test";
import colors, { random } from "#/lib/color";

describe("color", () => {
  test("random", () => {
    const color = random();
    expect(colors).toContain(color);
  });
});
