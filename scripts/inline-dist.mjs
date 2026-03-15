import { promises as fs } from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const htmlPath = path.join(distDir, "index.html");

async function readFileOrNull(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function run() {
  const html = await fs.readFile(htmlPath, "utf8");

  const cssLinks = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
  const scriptTags = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)];

  let nextHtml = html;

  for (const match of cssLinks) {
    const href = match[1];
    if (!href) continue;
    const cssPath = path.join(distDir, href.replace(/^\//, ""));
    const css = await readFileOrNull(cssPath);
    if (!css) continue;
    nextHtml = nextHtml.replace(match[0], `<style>${css}</style>`);
    await fs.rm(cssPath, { force: true });
  }

  for (const match of scriptTags) {
    const src = match[1];
    if (!src) continue;
    const jsPath = path.join(distDir, src.replace(/^\//, ""));
    const js = await readFileOrNull(jsPath);
    if (!js) continue;
    nextHtml = nextHtml.replace(match[0], `<script type="module">${js}</script>`);
    await fs.rm(jsPath, { force: true });
  }

  await fs.writeFile(htmlPath, nextHtml, "utf8");

  const assetsDir = path.join(distDir, "assets");
  try {
    const assets = await fs.readdir(assetsDir);
    if (assets.length === 0) {
      await fs.rmdir(assetsDir);
    }
  } catch {
    // Assets dir can be absent.
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

