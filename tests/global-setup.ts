import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

export default function setup() {
  const distWorkbench = resolve(import.meta.dirname, "../dist/workbench.mjs");
  if (!existsSync(distWorkbench)) {
    const packageRoot = resolve(import.meta.dirname, "..");
    execSync("pnpm build", { cwd: packageRoot, stdio: "inherit" });
  }
}
