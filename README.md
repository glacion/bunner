# bunner

`bunner` is a tiny, Bun-native task runner. Define your build, test, or release flow as a dependency graph of `Node`s and `Command`s, then run any portion of that graph with one command. Tasks stream their colored output as they execute, run concurrently when possible, and can be visualized as Graphviz DOT for quick sanity checks.

## Requirements
- Bun 1.1+ (the CLI uses `#!/usr/bin/env bun` and Bun's `spawn` API)
- macOS, Linux, or WSL2 (Graphviz is optional, only needed when rendering `.dot`)

## Installation
Install `bunner` alongside your Bun project (either locally or globally):

```bash
# project-local (recommended)
bun add -d @glacion/bunner

# or make the CLI globally available
bun add -g @glacion/bunner
```

After installing, `bunx bunner` (or the globally installed `bunner`) becomes available.

## Quick start
Create a `bunner.ts` file at the root of your repo and export a single `Node`. Each child node becomes addressable via its fully-qualified name (`<parent>:<child>`).

```ts
// bunner.ts
import { Command } from "./lib/command";
import { Node } from "./lib/node";

const root = new Node({ name: "bunner" });

const install = root.child(new Command({ name: "install", command: ["bun", "install"] }));
const lint = root.child(new Command({ name: "lint", command: ["biome", "ci"], dependencies: [install] }));
const test = root.child(new Command({ name: "test", command: ["bun", "test"], dependencies: [install] }));

root.child(
  new Command({
    name: "publish",
    command: ["bun", "publish"],
    dependencies: [lint, test],
  }),
);

export default root;
```

With that definition in place you can:

```bash
# List all known tasks
bunx bunner

# Run every task whose name matches the regex "lint|test"
bunx bunner "lint|test"

# Run the publish pipeline (dependencies run first, concurrently when possible)
bunx bunner publish
```

## Examples

### Workspace build + deploy
The snippet below shows how you can fan out builds per package while keeping the CLI invocations short.

```ts
// bunner.ts
import path from "node:path";
import { Command } from "./lib/command";
import { Node } from "./lib/node";

const root = new Node({ name: "bunner" });
const workspace = root.child(new Node({ name: "workspace" }));

const apps = ["web", "docs", "landing"];
apps.forEach((app) => {
  workspace.child(
    new Command({
      name: app,
      cwd: path.join(import.meta.dir, "apps", app),
      command: ["bun", "run", "build"],
    }),
  );
});

root.child(
  new Command({
    name: "deploy",
    command: ["bun", "run", "scripts/deploy.ts"],
    environment: { AWS_PROFILE: "prod" },
    dependencies: [/workspace:/], // wait for every workspace:<app> build
  }),
);

export default root;
```

Run a single build or the whole release:

```bash
bunx bunner workspace:web          # build just the web app
bunx bunner "workspace:(web|docs)" # build multiple apps via regex
bunx bunner deploy                 # build everything, then deploy
```

### Chaining smoke + e2e suites
You can resolve dependencies by name (`"build:api"`) or by pattern (`/^build:/`). That makes it easy to reuse graphs for test pipelines.

```ts
const root = new Node({ name: "bunner" });

const build = root.child(new Command({ name: "build", command: ["bun", "run", "build"] }));

const smoke = root.child(
  new Command({
    name: "smoke",
    command: ["bun", "run", "test", "--", "--runInBand"],
    dependencies: [build],
  }),
);

root.child(
  new Command({
    name: "e2e",
    command: ["bun", "run", "playwright", "test"],
    dependencies: [smoke],
  }),
);
```

Execute only smoke tests during PRs, then chain the e2e suite on main:

```bash
# Pull request checks
bunx bunner "smoke"

# Nightly or main-branch jobs
bunx bunner e2e
```

## CLI reference

| Flag | Description |
| ---- | ----------- |
| `-f, --file <path>` | Path to the bunner definition file. Defaults to `bunner.ts` in the current working directory. |
| `-n, --dry-run` | Print the Graphviz DOT for the execution plan instead of running commands. |
| _patterns_ | Optional positional arguments treated as regular expressions. Each expression selects matching nodes (e.g. `build`, `ci:.*`, `.*:deploy`). If omitted, bunner prints the available node names. |

`bunner` executes the resolved nodes in parallel and stops the moment one fails. When commands are running, a prefixed, colored stream makes it easy to follow mixed stdout/stderr:

```
[green lint]: Running biome ci
[yellow test]: PASS lib/node.test.ts
```

## Previewing the graph

Use `--dry-run` to inspect what would run:

```bash
bunx bunner publish --dry-run
```

The output is pure DOT, so you can visualize it directly with Graphviz:

```bash
bunx bunner publish --dry-run | dot -Tpng > graph.png
```

## Authoring nodes

- **`Node`** represents a namespace in the graph. Nodes can depend on other nodes by reference, by name, or by regular expression. When you call `node.child(...)`, the child is automatically registered under the root so it can be located later.
- **`Command`** extends `Node` and schedules a real process. It accepts `command` (`string[]`), optional `cwd`, and `environment` overrides. Standard output and error are piped back to the CLI with the node's color.

Under the hood, dependencies are resolved breadth-first and executed with `Promise.all`, so unrelated branches of your graph run concurrently. If a dependency fails, its parents are marked as failed without running their commands.

## Development

```bash
bun install   # install dependencies
bun test      # run the library test suite
```

## License

Released under the BSD 3-Clause license. See `LICENSE` for details.
