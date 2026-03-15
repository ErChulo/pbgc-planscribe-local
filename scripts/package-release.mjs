import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const projectRoot = process.cwd();
const distDir = join(projectRoot, "dist");
const releaseRoot = join(projectRoot, "release");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const releaseDirName = process.env.RELEASE_DIR_NAME || `planscribe-local-${stamp}`;
const releaseDir = join(releaseRoot, releaseDirName);

if (!existsSync(distDir)) {
  throw new Error("dist/ not found. Run npm run build first.");
}

mkdirSync(releaseDir, { recursive: true });
cpSync(distDir, join(releaseDir, "dist"), { recursive: true });

const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const gitCommit = execSync("git rev-parse HEAD", { cwd: projectRoot }).toString().trim();

const manifest = {
  packageName: packageJson.name,
  version: packageJson.version,
  generatedAt: new Date().toISOString(),
  gitCommit,
  included: ["dist/**"],
};

writeFileSync(join(releaseDir, "release-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log(`Release package created at ${releaseDir}`);
