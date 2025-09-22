import path from "node:path";
import { Namespace } from "@glacion/bunner/lib/namespace";
import { version } from "#/package.json";

const bunner = new Namespace({ name: "bunner" });
bunner.task({ name: "install", command: ["bun", "install"] });

const common = ["bun", "build", "--compile", "--minify", "./index.ts", `--define=process.env.VERSION="${version}"`];
const darwin = bunner.child(new Namespace({ name: "darwin" }));
const linux = bunner.child(new Namespace({ name: "linux" }));
const windows = bunner.child(new Namespace({ name: "windows" }));

darwin.task({ name: "arm64", command: [...common, "--outfile=dist/bunner_darwin_arm64", "--target=bun-darwin-arm64"], dependencies: ["bunner:install"] });
darwin.task({ name: "amd64", command: [...common, "--outfile=dist/bunner_darwin_amd64", "--target=bun-darwin-x64"], dependencies: ["bunner:install"] });

linux.task({ name: "amd64", command: [...common, "--outfile=dist/bunner_linux_amd64", "--target=bun-linux-x64-baseline"], dependencies: ["bunner:install"] });
linux.task({ name: "arm64", command: [...common, "--outfile=dist/bunner_linux_arm64", "--target=bun-linux-arm64"], dependencies: ["bunner:install"] });

windows.task({ name: "amd64", command: [...common, "--outfile=dist/bunner_windows_amd64", "--target=bun-windows-x64"], dependencies: ["bunner:install"] });

bunner.task({
  command: ["bash", "-c", "sha256sum bunner_* > CHECKSUM"],
  dependencies: [...Object.values(darwin.tasks), ...Object.values(linux.tasks), ...Object.values(windows.tasks)],
  directory: path.resolve(__dirname, "dist"),
  name: "checksum",
});

bunner.task({ dependencies: ["bunner:checksum"], name: "release" });

export default bunner;
