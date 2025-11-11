# bunner

A simple task runner for Bun.

## Usage

**Install dependencies:**
```bash
bun install
```

**List available tasks:**
```bash
bun run src/index.ts
```

**Run tasks:**

Provide one or more regular expressions to match the tasks you want to run.

```bash
# Run all tasks named 'ls'
bun run index.ts '.*:ls'

# Run all tasks in the 'child' namespace
bun run index.ts 'child:.*'
```

**Preview execution:**

Use `--dry-run` to print the dependency graph (in Graphviz DOT format) that would be executed without running any commands. You can pipe it straight into Graphviz to render an image:

```bash
bun run index.ts 'child:build' 'child:test' --dry-run | dot -Tpng > graph.png
```

Alternatively, let bunner call Graphviz for you:

```bash
# Writes graph.png using Graphviz (requires `dot` on PATH)
bun run index.ts 'child:build' --graph graph.png

# Control the Graphviz format (e.g., SVG)
bun run index.ts 'child:build' --graph graph.svg --graph-format svg
```

## Defining Tasks

Create `bunner.ts` files to define namespaces and tasks.

**`bunner.ts`**
```typescript
import { Namespace } from "#/src/namespace";
import "#/child/bunner";

const ns = new Namespace({ name: "root" });

ns.task({
  name: "build",
  command: ["bun", "build", "./src/index.ts"],
});

export default ns;
```

**`child/bunner.ts`**
```typescript
import root from "#/bunner";

const ns = root.child({ name: "child" });

ns.task({
  name: "test",
  command: ["bun", "test"],
  dependencies: ["build"], // Depends on the 'build' task
});
```
