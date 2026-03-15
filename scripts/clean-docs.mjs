import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const generatedDir = join(projectRoot, "docs", "generated");

if (existsSync(generatedDir)) {
  rmSync(generatedDir, { recursive: true, force: true });
}
