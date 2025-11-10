import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { Namespace } from "#/lib/namespace";
import { FunctionTask } from "#/lib/task/function";

const createNamespace = (name = "namespace") => new Namespace({ name });

const withTempDir = async <T>(fn: (temp: string) => Promise<T>, cleanup?: () => void | Promise<void>) => {
  const temp = await mkdtemp("/tmp/");
  const finalize = () => Promise.resolve(cleanup?.()).then(() => rm(temp, { force: true, recursive: true }));
  return Promise.resolve(fn(temp)).finally(finalize);
};

describe("task", () => {
  describe("fqn", () => {
    test("returns the fully qualified name", () => {
      const namespace = createNamespace("namespace");
      const task = namespace.task({ name: "test", command: ["true"] });
      expect(task.fqn).toBe("namespace:test");
    });

    test("includes nested namespaces", () => {
      const parent = createNamespace("parent");
      const child = new Namespace({ name: "child" });
      parent.child(child);
      const task = child.task({ name: "task", command: ["true"] });
      expect(task.fqn).toBe("parent:child:task");
    });
  });

  describe("graph", () => {
    test("runs dependencies before dependants", async () => {
      const namespace = createNamespace();
      await withTempDir(async (temp) => {
        const file = `${temp}/bunner.txt`;
        const a = namespace.task({ name: "a", command: ["bash", "-c", `echo a >> ${file}`] });
        namespace.task({ name: "b", command: ["bash", "-c", `echo b >> ${file}`], dependencies: [a] });
        namespace.task({ name: "c", command: ["bash", "-c", `echo c >> ${file}`], dependencies: ["b"] });

        await namespace.resolve("c").spawn();
        const content = await readFile(file, "utf-8");
        expect(content).toBe("a\nb\nc\n");
      });
    });

    test("supports regex-based dependencies", async () => {
      const namespace = createNamespace();
      const order: string[] = [];

      namespace.task({
        name: "build-alpha",
        run: () => {
          order.push("alpha");
        },
      });

      namespace.task({
        name: "build-beta",
        run: () => {
          order.push("beta");
        },
      });

      const meta = namespace.task({
        name: "all",
        dependencies: [/namespace:build-.+/],
        run: () => {
          order.push("all");
        },
      });

      await meta.spawn();
      expect(order).toEqual(["alpha", "beta", "all"]);
    });

    test("throws when regex dependency matches nothing", async () => {
      const namespace = createNamespace();
      const failing = namespace.task({
        name: "all",
        dependencies: [/missing/],
        run: () => undefined,
      });

      expect(failing.spawn()).rejects.toThrow("dependency pattern");
    });

    test("halts when a dependency fails", async () => {
      const namespace = createNamespace();
      const order: string[] = [];

      const first = namespace.task({
        name: "first",
        run: () => {
          order.push("first");
          return 1;
        },
      });

      namespace.task({
        name: "second",
        run: () => {
          order.push("second");
          return 0;
        },
      });

      const root = namespace.task({
        name: "root",
        run: () => {
          order.push("root");
        },
        dependencies: [first, "second"],
      });

      const code = await root.spawn();
      expect(code).toBe(1);
      expect(order).toEqual(["first"]);
    });

    test("detects cycles", async () => {
      const namespace = createNamespace();
      const a = namespace.task({ name: "a", dependencies: ["namespace:b"], run: () => undefined });
      namespace.task({ name: "b", dependencies: [a], run: () => undefined });

      expect(a.spawn()).rejects.toThrow("cycle detected");
    });
  });

  describe("cache", () => {
    test("skips execution when inputs unchanged", async () => {
      const namespace = createNamespace();
      await withTempDir(
        async (temp) => {
          const source = `${temp}/source.txt`;
          const output = `${temp}/output.txt`;
          process.env["BUNNER_CACHE"] = `${temp}/cache.json`;
          await Bun.write(source, "v1");

          let runs = 0;
          const task = new FunctionTask({
            name: "build",
            namespace,
            directory: temp,
            sources: ["source.txt"],
            outputs: ["output.txt"],
            run: async () => {
              runs += 1;
              await Bun.write(output, `result-${runs}`);
            },
          });

          await task.spawn();
          expect(runs).toBe(1);

          await task.spawn();
          expect(runs).toBe(1);

          await rm(output, { force: true });
          await task.spawn();
          expect(runs).toBe(2);

          await Bun.write(source, "v2");
          await task.spawn();
          expect(runs).toBe(3);
        },
        () => {
          delete process.env["BUNNER_CACHE"];
        },
      );
    });

    test("respects force run flag", async () => {
      const namespace = createNamespace();
      await withTempDir(
        async (temp) => {
          const source = `${temp}/source.txt`;
          const output = `${temp}/output.txt`;
          process.env["BUNNER_CACHE"] = `${temp}/cache.json`;
          await Bun.write(source, "v1");

          let runs = 0;
          const task = new FunctionTask({
            name: "build",
            namespace,
            directory: temp,
            sources: ["source.txt"],
            outputs: ["output.txt"],
            run: async () => {
              runs += 1;
              await Bun.write(output, `result-${runs}`);
            },
          });

          await task.spawn();
          expect(runs).toBe(1);

          await task.spawn();
          expect(runs).toBe(1);

          await task.spawn(process.stderr, process.stdout, true);
          expect(runs).toBe(2);
        },
        () => {
          delete process.env["BUNNER_CACHE"];
        },
      );
    });
  });
});
