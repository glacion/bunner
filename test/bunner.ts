import { Namespace } from "#/lib/namespace";

const root = new Namespace({ name: "root" });

root.task({
  name: "build",
  color: "cyan",
  run: () => 0,
});

root.task({
  name: "hello",
  color: "magenta",
  run: () => 0,
});

root.task({
  name: "test",
  color: "yellow",
  run: () => 0,
  dependencies: ["root:build", "root:child:beta"],
});

root.task({
  name: "command",
  color: "green",
  command: ["bun", "-e", "console.log('cmd-out'); console.error('cmd-err')"],
});

root.task({
  name: "function",
  color: "blue",
  run: () => {
    console.log("fn-out");
    console.error("fn-err");
  },
});

const child = root.child(new Namespace({ name: "child" }));

child.task({
  name: "alpha",
  run: () => 0,
  dependencies: ["root:build"],
});

child.task({
  name: "beta",
  run: () => 0,
});

const cycle = root.child(new Namespace({ name: "cycle" }));

cycle.task({
  name: "a",
  run: () => 0,
  dependencies: ["cycle:b"],
});

cycle.task({
  name: "b",
  run: () => 0,
  dependencies: ["cycle:a"],
});

export default root;
