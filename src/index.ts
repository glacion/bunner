import { parseArgs } from "node:util";
import type { Namespace } from "#/src/namespace";

const args = parseArgs({
  allowPositionals: true,
  args: Bun.argv,
  strict: true,
  options: {
    file: { default: "bunner.ts", multiple: false, short: "f", type: "string" },
    list: { default: true, multiple: false, short: "l", type: "boolean" },
    task: { multiple: true, short: "t", type: "string" },
  },
});

const main = async () => {
  const module = await import(args.values.file);
  const namespace = module.default as Namespace;
  const namespaces = namespace.collect();
  if (args.values.task) {
    const targets = args.values.task.flatMap((pattern) => namespace.select(new RegExp(pattern)));
    await Promise.all(targets.map((task) => task.spawn()));
  } else if (args.values.list)
    console.table(
      namespaces.flatMap((namespace) => Object.values(namespace.tasks)),
      ["fqdn", "description"],
    );
};

main().catch(console.error);
