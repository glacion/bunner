# bunner

A simple task runner for Bun.

## Usage

**Install dependencies:**
```bash
bun install
```

**List available tasks (default action):**
```bash
bun run src/index.ts
```

**List tasks explicitly:**
```bash
bun run src/index.ts -- --list
```

**Dry-run execution order:**
```bash
bun run src/index.ts -- --dry-run 'child:build' 'child:test'
```

**Run tasks that match regex patterns:**
```bash
# Run all tasks named 'ls'
bun run src/index.ts -- '.*:ls'

# Run all tasks in the 'child' namespace
bun run src/index.ts -- 'child:.*'
```

### CLI options

- `-f, --file <path>` – load a specific `bunner.ts` file (defaults to `./bunner.ts`)
- `-l, --list` – print every discovered task (also the default when no patterns are supplied)
- `--dry-run` – print the dependency-resolved execution plan for the supplied task patterns without running commands
- `-F, --force` – ignore the incremental cache and run every selected task

## Defining Tasks

Create `bunner.ts` files to define namespaces and tasks. Each task can execute a shell `command`, call a synchronous/asynchronous `run` function, or just act as a meta task that wires dependencies together.

**`bunner.ts`**
```typescript
import { Namespace } from "#/lib/namespace";
import "#/child/bunner";

const ns = new Namespace({ name: "root" });

ns.task({
  name: "build",
  command: ["bun", "build", "./src/main.ts"],
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

// Tasks can also run arbitrary functions (sync or async)
ns.task({
  name: "cleanup",
  run: async () => {
    Bun.write("build.log", "");
  },
});

// Use sources/outputs to enable incremental builds
ns.task({
  name: "bundle",
  command: ["bun", "build", "./src/main.ts", "--outfile=dist/app.js"],
  sources: ["src/main.ts", "src/app.css"],
  outputs: ["dist/app.js"],
});
```

### Incremental builds

When a task declares `sources`, Bunner hashes each file (path + contents) and stores the signature in your XDG cache directory (e.g. `~/.cache/bunner/cache.json`). Declaring `outputs` is optional; when provided, Bunner also verifies that every output file exists before skipping the task. Use the `BUNNER_CACHE` environment variable to point the cache at a different file (handy for CI), or pass `--force` to re-run everything regardless of the cached signatures.

## Testing

All fixtures and helpers used by the test suite live under `test/` (for example, the CLI harness uses `test/bunner.ts`). Run the full suite through the Bunner CLI:

```bash
bun run src/index.ts -- bunner:test
```

After building Bunner, you can invoke the same task via the installed binary:

```bash
bunner bunner:test
```
