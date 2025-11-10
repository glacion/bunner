import { describe, expect, test } from "bun:test";
import { Namespace } from "#/lib/namespace";
import { buildPlan } from "#/lib/plan";

const createNamespace = (name = "namespace") => new Namespace({ name });

describe("buildPlan", () => {
  test("orders dependencies before dependants", () => {
    const namespace = createNamespace();
    const a = namespace.task({ name: "a", command: ["true"] });
    const b = namespace.task({ name: "b", dependencies: [a], command: ["true"] });
    const c = namespace.task({ name: "c", dependencies: [b], command: ["true"] });

    const plan = buildPlan([c]);
    expect(plan.map((task) => task.name)).toEqual(["a", "b", "c"]);
  });

  test("deduplicates shared dependencies", () => {
    const namespace = createNamespace();
    const shared = namespace.task({ name: "shared", command: ["true"] });
    const left = namespace.task({ name: "left", dependencies: [shared], command: ["true"] });
    const right = namespace.task({ name: "right", dependencies: [shared], command: ["true"] });

    const plan = buildPlan([left, right]);
    expect(plan.map((task) => task.name)).toEqual(["shared", "left", "right"]);
  });

  test("throws when a cycle is detected", () => {
    const namespace = createNamespace();
    const a = namespace.task({ name: "a", dependencies: ["namespace:b"], command: ["true"] });
    const b = namespace.task({ name: "b", dependencies: [a], command: ["true"] });

    expect(() => buildPlan([b])).toThrow("cycle detected involving namespace:b");
  });
});
