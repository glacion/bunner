import path from "node:path";
import { Namespace } from "#/lib/namespace";
import { version } from "#/package.json";

const bunner = new Namespace({ name: "bunner" });
const install = bunner.task({ name: "install", command: ["bun", "install"] });

const common = ["bun", "build", "--compile", "./index.ts", `--define=process.env.VERSION="${version}"`];
const darwin = bunner.child(new Namespace({ name: "darwin" }));
const linux = bunner.child(new Namespace({ name: "linux" }));
const windows = bunner.child(new Namespace({ name: "windows" }));

darwin.task({ command: [...common, "--outfile=dist/bunner_darwin_arm64", "--target=bun-darwin-arm64"], dependencies: [install], name: "arm64" });
darwin.task({ command: [...common, "--outfile=dist/bunner_darwin_amd64", "--target=bun-darwin-x64"], dependencies: [install], name: "amd64" });

linux.task({ command: [...common, "--outfile=dist/bunner_linux_amd64", "--target=bun-linux-x64-baseline"], dependencies: [install], name: "amd64" });
linux.task({ command: [...common, "--outfile=dist/bunner_linux_arm64", "--target=bun-linux-arm64"], dependencies: [install], name: "arm64" });

windows.task({ command: [...common, "--outfile=dist/bunner_windows_amd64", "--target=bun-windows-x64"], dependencies: [install], name: "amd64" });

bunner.task({
  command: ["bash", "-c", "sha256sum bunner_* > CHECKSUM"],
  dependencies: bunner.collect().flatMap((namespace) => Object.values(namespace.tasks)),
  directory: path.resolve(__dirname, "dist"),
  name: "checksum",
});

bunner.task({ dependencies: ["bunner:checksum"], name: "release" });

export default bunner;
