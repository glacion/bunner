import { describe, expect, test } from "bun:test";
import { Node, NodeStatus } from "./node";

describe("node", () => {
  test("computes fully qualified names", () => {
    const root = new Node({ directory: "/repo", name: "root" });
    const child = new Node({ name: "child", parent: root });
    expect(child.fqn).toBe("root:child");

    const child2 = root.child(new Node({ name: "child2" }));
    expect(child2.fqn).toBe("root:child2");

    const grandchild = new Node({ name: "grandchild", parent: child });
    expect(grandchild.fqn).toBe("root:child:grandchild");
  });

  test("determines the correct working directory", () => {
    const root = new Node({ name: "root", directory: "/repo" });
    const child = new Node({ name: "child", parent: root });
    expect(child.cwd).toBe("/repo");

    const customCwd = new Node({ name: "custom", directory: "/custom", parent: root });
    expect(customCwd.cwd).toBe("/custom");

    const grandchild = new Node({ name: "grandchild", parent: child });
    expect(grandchild.cwd).toBe("/repo");
  });

  describe("collect", () => {
    test("returns direct children", () => {
      const root = new Node({ directory: "/repo", name: "root" });
      const task = new Node({ name: "task", parent: root });
      const lint = new Node({ name: "lint", parent: root });

      expect(root.collect()).toEqual([task, lint]);
    });

    test("flattens descendants depth-first", () => {
      const root = new Node({ directory: "/repo", name: "root" });
      const workspace = new Node({ name: "workspace", parent: root });
      const api = new Node({ name: "api", parent: workspace });
      const web = new Node({ name: "web", parent: workspace });
      const lint = new Node({ name: "lint", parent: web });

      expect(root.collect()).toEqual([workspace, api, web, lint]);
      expect(workspace.collect()).toEqual([api, web, lint]);
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
      expect(root.resolve(child.fqn)).toEqual([child]);
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
      expect(task.resolve(sibling.fqn)).toEqual([sibling]);
    });

    test("throws when the target cannot be found", () => {
      const root = new Node({ directory: "/repo", name: "root" });
      new Node({ name: "child", parent: root });
      expect(() => root.resolve("missing")).toThrow("no nodes found for target missing");
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

  describe("child", () => {
    test("throws an error when adding a child with a duplicate name", () => {
      const root = new Node({ name: "root" });
      new Node({ name: "child", parent: root });
      expect(() => new Node({ name: "child", parent: root })).toThrow("another child with the same name exists: child");
    });
  });

  describe("execute", () => {
    test("succeeds when there are no dependencies", async () => {
      const node = new Node({ name: "node" });
      const result = await node.execute();
      expect(result).toBe(NodeStatus.SUCCESS);
    });

    test("succeeds when a dependency succeeds", async () => {
      const dependency = new Node({ name: "dependency" });
      dependency.execute = () => Promise.resolve(NodeStatus.SUCCESS);
      const node = new Node({ name: "node", dependencies: [dependency] });
      const result = await node.execute();
      expect(result).toBe(NodeStatus.SUCCESS);
    });

    test("fails when a dependency fails", async () => {
      const dependency = new Node({ name: "dependency" });
      dependency.execute = () => Promise.resolve(NodeStatus.FAIL);
      const node = new Node({ name: "node", dependencies: [dependency] });
      const result = await node.execute();
      expect(result).toBe(NodeStatus.FAIL);
    });

    test("fails when one of multiple dependencies fails", async () => {
      const pass = new Node({ name: "pass" });
      pass.execute = () => Promise.resolve(NodeStatus.SUCCESS);
      const fail = new Node({ name: "fail" });
      fail.execute = () => Promise.resolve(NodeStatus.FAIL);
      const node = new Node({ name: "node", dependencies: [pass, fail] });
      const result = await node.execute();
      expect(result).toBe(NodeStatus.FAIL);
    });

    test("succeeds when all of multiple dependencies succeed", async () => {
      const a = new Node({ name: "a" });
      a.execute = () => Promise.resolve(NodeStatus.SUCCESS);
      const b = new Node({ name: "b" });
      b.execute = () => Promise.resolve(NodeStatus.SUCCESS);
      const node = new Node({ name: "node", dependencies: [a, b] });
      const result = await node.execute();
      expect(result).toBe(NodeStatus.SUCCESS);
    });
  });
});
