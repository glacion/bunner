import { describe, expect, test } from "bun:test";
import { Node } from "./node";

describe("node", () => {
  describe("name", () => {
    test("computes fully qualified names from constructor", () => {
      const root = new Node({ directory: "/repo", name: "root" });
      const child = new Node({ name: "child", parent: root });
      expect(child.name).toBe("root:child");
    });

    test("computes fully qualified names from child method", () => {
      const root = new Node({ directory: "/repo", name: "root" });
      const child = root.child(new Node({ name: "child" }));
      expect(child.name).toBe("root:child");
    });

    test("computes fully qualified names recursively", () => {
      const root = new Node({ directory: "/repo", name: "root" });
      const a = new Node({ name: "a", parent: root });
      const b = new Node({ name: "b", parent: a });
      expect(b.name).toBe("root:a:b");
    });
  });

  describe("directory", () => {
    test("inherits directory from its parent when unspecified", () => {
      const root = new Node({ name: "root", directory: "/repo" });
      const child = new Node({ name: "child", parent: root });
      expect(child.directory).toBe("/repo");
    });

    test("prefers explicitly configured directories", () => {
      const root = new Node({ name: "root", directory: "/repo" });
      const child = new Node({ name: "child", directory: "/custom", parent: root });
      expect(child.directory).toBe("/custom");
    });

    test("recurses through ancestors until it finds a directory", () => {
      const root = new Node({ name: "root", directory: "/repo" });
      const namespace = new Node({ name: "namespace", parent: root });
      namespace.directory = undefined;
      const nested = new Node({ name: "nested", parent: namespace });
      nested.directory = undefined;
      const deeper = new Node({ name: "deeper", parent: nested });
      deeper.directory = undefined;
      const leaf = new Node({ name: "leaf", parent: deeper });

      expect(leaf.directory).toBe("/repo");
    });
  });

  describe("resolve", () => {
    test("returns the provided node when given an instance", () => {
      const root = new Node({ directory: "/repo", name: "root" });
      const child = new Node({ name: "child", parent: root });
      expect(root.resolve(child)).toEqual([child]);
    });

    test("matches children when given a regular expression", () => {
      const root = new Node({ directory: "/repo", name: "root" });
      const match = new Node({ name: "child", parent: root });
      new Node({ name: "other", parent: root });
      expect(root.resolve(/root:child/)).toEqual([match]);
    });

    test("matches children when given a fully qualified name", () => {
      const root = new Node({ directory: "/repo", name: "root" });
      const child = new Node({ name: "child", parent: root });
      expect(root.resolve(child.name)).toEqual([child]);
    });

    test("delegates resolution to the root when called from descendants", () => {
      const root = new Node({ directory: "/repo", name: "root" });
      const namespace = new Node({ name: "namespace", parent: root });
      const task = new Node({ name: "task", parent: namespace });
      expect(task.resolve(/namespace:task/)).toEqual([task]);
    });

    test("resolves siblings from descendants when using string targets", () => {
      const root = new Node({ directory: "/repo", name: "root" });
      const namespace = new Node({ name: "namespace", parent: root });
      const sibling = new Node({ name: "sibling", parent: root });
      const task = new Node({ name: "task", parent: namespace });
      expect(task.resolve(sibling.name)).toEqual([sibling]);
    });

    test("throws when the target cannot be found", () => {
      const root = new Node({ directory: "/repo", name: "root" });
      new Node({ name: "child", parent: root });
      expect(() => root.resolve("missing")).toThrow("no nodes found");
    });

    test("handles hierarchies and regex filters", () => {
      const root = new Node({ directory: "/repo", name: "root" });

      const app = new Node({ name: "app", parent: root });
      const api = new Node({ name: "api", parent: root });
      const web = new Node({ name: "web", parent: root });

      const appBuild = new Node({ name: "build", parent: app });
      const appTest = new Node({ name: "test", parent: app });
      const apiDeploy = new Node({ name: "deploy", parent: api });
      const webLint = new Node({ name: "lint", parent: web });
      const webDeploy = new Node({ name: "deploy", parent: web });

      expect(root.resolve(/app:(build|test)/)).toEqual([appBuild, appTest]);
      expect(web.resolve(/:(deploy|lint)$/)).toEqual([apiDeploy, webLint, webDeploy]);
      expect(api.resolve(/^root:(app|api|web)$/)).toEqual([app, api, web]);
    });
  });
});
