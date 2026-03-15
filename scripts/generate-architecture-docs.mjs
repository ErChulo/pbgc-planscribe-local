import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

function normalizePath(pathValue) {
  return pathValue.replace(/\\/g, "/");
}

function isSrcPath(pathValue) {
  return normalizePath(pathValue).includes("/src/") || normalizePath(pathValue).startsWith("src/");
}

function pathToNodeId(pathValue) {
  return normalizePath(pathValue)
    .replace(/^src\//, "")
    .replace(/[^a-zA-Z0-9_]/g, "_");
}

function detectLayer(pathValue) {
  const normalized = normalizePath(pathValue);
  if (normalized.startsWith("src/domain/")) {
    return "domain";
  }
  if (normalized.startsWith("src/features/")) {
    return "features";
  }
  if (normalized.startsWith("src/infra/")) {
    return "infra";
  }
  if (normalized.startsWith("src/App.tsx") || normalized.startsWith("src/main.tsx")) {
    return "app";
  }
  return "other";
}

function countCycles(graph) {
  const nodeIds = Array.from(graph.keys());
  const visiting = new Set();
  const visited = new Set();
  let cycleCount = 0;

  function dfs(nodeId, stackSet) {
    if (visiting.has(nodeId)) {
      cycleCount += 1;
      return;
    }
    if (visited.has(nodeId)) {
      return;
    }

    visiting.add(nodeId);
    stackSet.add(nodeId);

    for (const next of graph.get(nodeId) ?? []) {
      if (!stackSet.has(next)) {
        dfs(next, stackSet);
      } else {
        cycleCount += 1;
      }
    }

    stackSet.delete(nodeId);
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      dfs(nodeId, new Set());
    }
  }

  return cycleCount;
}

const projectRoot = process.cwd();
const generatedDir = join(projectRoot, "docs", "generated");
mkdirSync(generatedDir, { recursive: true });

const depCruiseCommand = process.execPath;
const depCruiseArgs = [
  join(projectRoot, "node_modules", "dependency-cruiser", "bin", "dependency-cruise.mjs"),
  "--no-config",
  "--include-only",
  "^src",
  "--exclude",
  "\\.(test|spec)\\.ts$",
  "--output-type",
  "json",
  "src",
];

const depCruiseResult = spawnSync(depCruiseCommand, depCruiseArgs, {
  cwd: projectRoot,
  encoding: "utf8",
  shell: false,
});

if (depCruiseResult.status !== 0) {
  const message = depCruiseResult.stderr || depCruiseResult.stdout || "depcruise failed";
  throw new Error(message);
}

const raw = depCruiseResult.stdout.trim();
const parsed = JSON.parse(raw);
const modules = Array.isArray(parsed.modules) ? parsed.modules : [];

const graph = new Map();
const edges = [];
const nodes = [];

for (const moduleEntry of modules) {
  const sourceRaw = moduleEntry.source;
  if (!sourceRaw) {
    continue;
  }

  const source = normalizePath(relative(projectRoot, sourceRaw));
  if (!source.startsWith("src/")) {
    continue;
  }

  const sourceId = pathToNodeId(source);
  if (!graph.has(sourceId)) {
    graph.set(sourceId, new Set());
  }
  nodes.push({
    id: sourceId,
    path: source,
    layer: detectLayer(source),
  });

  for (const dep of moduleEntry.dependencies ?? []) {
    const resolvedRaw = dep.resolved;
    if (!resolvedRaw) {
      continue;
    }

    const resolved = normalizePath(relative(projectRoot, resolvedRaw));
    if (!resolved.startsWith("src/")) {
      continue;
    }
    if (!isSrcPath(resolved)) {
      continue;
    }

    const targetId = pathToNodeId(resolved);
    graph.get(sourceId).add(targetId);
    edges.push({
      sourceId,
      targetId,
      source,
      target: resolved,
    });
  }
}

const uniqueNodes = Array.from(
  new Map(nodes.map((node) => [node.id, node])).values(),
);
const uniqueEdges = Array.from(
  new Map(edges.map((edge) => [`${edge.sourceId}->${edge.targetId}`, edge])).values(),
);
const cycleCount = countCycles(graph);
const displayedEdges = uniqueEdges.slice(0, 220);

const mermaidLines = [
  "flowchart LR",
  "  classDef app fill:#fef3c7,stroke:#d97706,color:#7c2d12;",
  "  classDef domain fill:#dcfce7,stroke:#16a34a,color:#14532d;",
  "  classDef features fill:#dbeafe,stroke:#2563eb,color:#1e3a8a;",
  "  classDef infra fill:#f3e8ff,stroke:#9333ea,color:#581c87;",
  "  classDef other fill:#e5e7eb,stroke:#6b7280,color:#111827;",
];

for (const node of uniqueNodes) {
  mermaidLines.push(`  ${node.id}["${node.path}"]`);
  mermaidLines.push(`  class ${node.id} ${node.layer};`);
}

for (const edge of displayedEdges) {
  mermaidLines.push(`  ${edge.sourceId} --> ${edge.targetId}`);
}

const layerCounts = uniqueNodes.reduce(
  (acc, node) => {
    acc[node.layer] = (acc[node.layer] ?? 0) + 1;
    return acc;
  },
  { app: 0, domain: 0, features: 0, infra: 0, other: 0 },
);

const topOutDegree = uniqueNodes
  .map((node) => ({
    path: node.path,
    outgoing: uniqueEdges.filter((edge) => edge.sourceId === node.id).length,
  }))
  .sort((a, b) => b.outgoing - a.outgoing)
  .slice(0, 10);

const graphJson = {
  generatedAt: new Date().toISOString(),
  nodeCount: uniqueNodes.length,
  edgeCount: uniqueEdges.length,
  cycleCount,
  layerCounts,
  topOutDegree,
  nodes: uniqueNodes,
  edges: uniqueEdges,
};

writeFileSync(
  join(generatedDir, "dependency-graph.json"),
  JSON.stringify(graphJson, null, 2),
  "utf8",
);

writeFileSync(
  join(generatedDir, "dependency-graph.mmd"),
  `${mermaidLines.join("\n")}\n`,
  "utf8",
);

const markdown = `# Dependency Graph (Auto-Generated)

Generated: ${graphJson.generatedAt}

- Nodes: ${graphJson.nodeCount}
- Edges: ${graphJson.edgeCount}
- Potential cycles: ${graphJson.cycleCount}
- Layer counts: app=${layerCounts.app}, domain=${layerCounts.domain}, features=${layerCounts.features}, infra=${layerCounts.infra}, other=${layerCounts.other}

## Visualization

\`\`\`mermaid
${mermaidLines.join("\n")}
\`\`\`

## Highest Outgoing Dependency Count

${topOutDegree.map((item, index) => `${index + 1}. \`${item.path}\` -> ${item.outgoing}`).join("\n")}
`;

writeFileSync(join(generatedDir, "dependency-graph.md"), markdown, "utf8");
