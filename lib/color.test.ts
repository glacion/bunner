import { describe, expect, test } from "bun:test";
import colors, { random } from "./color";

describe("color", () => {
  test("random", () => {
    const color = random();
    expect(colors).toContain(color);
  });
});
