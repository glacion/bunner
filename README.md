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

Use the `-t` flag to run tasks matching a regex.

```bash
# Run all tasks named 'ls'
bun run src/index.ts -t '.*:ls'

# Run all tasks in the 'child' namespace
bun run src/index.ts -t 'child:.*'
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