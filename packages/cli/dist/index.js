#!/usr/bin/env node
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/index.ts
import { Command } from "commander";

// src/commands/create.ts
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import { execSync } from "child_process";
import os from "os";
import { readFileSync } from "fs";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
function isConvexLoggedIn() {
  try {
    const configPath = path.join(os.homedir(), ".convex", "config.json");
    if (!fs.existsSync(configPath)) {
      return false;
    }
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    return !!config.accessToken && config.accessToken.length > 0;
  } catch {
    return false;
  }
}
async function createProject(projectName, options) {
  const targetDir = path.resolve(process.cwd(), projectName);
  if (await fs.pathExists(targetDir)) {
    console.error(`Error: Directory "${projectName}" already exists.`);
    process.exit(1);
  }
  console.log(`
\u{1F528} Creating AgentForge project: ${projectName}
`);
  const searchDirs = [
    path.resolve(__dirname, options.template),
    // dist/default (built)
    path.resolve(__dirname, "..", "templates", options.template),
    // packages/cli/templates/default (dev)
    path.resolve(__dirname, "..", "..", "templates", options.template)
    // fallback
  ];
  let templateDir = "";
  for (const dir of searchDirs) {
    if (await fs.pathExists(dir)) {
      templateDir = dir;
      break;
    }
  }
  if (!templateDir) {
    console.error(`Error: Template "${options.template}" not found.`);
    console.error(`Searched in:`);
    searchDirs.forEach((d) => console.error(`  - ${d}`));
    process.exit(1);
  }
  await fs.copy(templateDir, targetDir);
  const pkgPath = path.join(targetDir, "package.json");
  if (await fs.pathExists(pkgPath)) {
    const pkg2 = await fs.readJson(pkgPath);
    pkg2.name = projectName;
    await fs.writeJson(pkgPath, pkg2, { spaces: 2 });
  }
  const dashPkgPath = path.join(targetDir, "dashboard", "package.json");
  if (await fs.pathExists(dashPkgPath)) {
    const dashPkg = await fs.readJson(dashPkgPath);
    dashPkg.name = `${projectName}-dashboard`;
    await fs.writeJson(dashPkgPath, dashPkg, { spaces: 2 });
  }
  console.log(`  \u2705 Project scaffolded at ./${projectName}`);
  console.log(`
\u{1F4E6} Installing dependencies...
`);
  let rootInstalled = false;
  for (const pm of ["pnpm", "npm"]) {
    try {
      execSync(`${pm} install`, { cwd: targetDir, stdio: "inherit" });
      console.log(`
  \u2705 Dependencies installed (via ${pm})`);
      rootInstalled = true;
      break;
    } catch {
    }
  }
  if (!rootInstalled) {
    console.warn(`
  \u26A0\uFE0F  Could not install dependencies automatically.`);
    console.warn(`  Run: cd ${projectName} && npm install`);
  }
  const dashDir = path.join(targetDir, "dashboard");
  if (await fs.pathExists(dashDir)) {
    console.log(`
\u{1F4E6} Installing dashboard dependencies...
`);
    let dashInstalled = false;
    for (const pm of ["pnpm", "npm"]) {
      try {
        execSync(`${pm} install`, { cwd: dashDir, stdio: "inherit" });
        console.log(`
  \u2705 Dashboard dependencies installed (via ${pm})`);
        dashInstalled = true;
        break;
      } catch {
      }
    }
    if (!dashInstalled) {
      console.warn(`
  \u26A0\uFE0F  Could not install dashboard dependencies.`);
      console.warn(`  Run: cd ${projectName}/dashboard && npm install`);
    }
  }
  console.log(`
\u26A1 Initializing Convex...
`);
  if (!isConvexLoggedIn()) {
    console.warn(`  \u26A0\uFE0F  Not logged in to Convex`);
    console.warn(`  Run: npx convex login`);
    console.warn(`  Then run: cd ${projectName} && npx convex dev
`);
    console.log(`
\u{1F389} AgentForge project "${projectName}" created successfully!

Next steps:
  cd ${projectName}

  # Login to Convex (required)
  npx convex login

  # Start the Convex backend
  npx convex dev

  # In another terminal, launch the dashboard
  agentforge dashboard

  # Or chat with your agent from the CLI
  agentforge chat

  # Install skills to extend agent capabilities
  agentforge skills list --registry
  agentforge skills install web-search

  # Check system status
  agentforge status

Documentation: https://github.com/Agentic-Engineering-Agency/agentforge
`);
    return;
  }
  let convexReady = false;
  try {
    execSync("npx convex dev --once", {
      cwd: targetDir,
      stdio: "inherit"
    });
    console.log(`
  \u2705 Convex initialized`);
    convexReady = true;
  } catch {
    console.warn(
      `
  \u26A0\uFE0F  Convex initialization skipped. Run "cd ${projectName} && npx convex dev" to set up your backend.`
    );
  }
  if (!convexReady) {
    console.log(`
\u26A0\uFE0F  Project "${projectName}" created with warnings.

Your project files are ready, but Convex could not be initialized automatically.
This is usually because the TypeScript typecheck failed or Convex auth is required.

Fix the errors above, then run:
  cd ${projectName}
  npx convex dev
`);
    process.exit(1);
  }
  console.log(`
\u{1F389} AgentForge project "${projectName}" created successfully!

Next steps:
  cd ${projectName}

  # Start the Convex backend
  npx convex dev

  # In another terminal, launch the dashboard
  agentforge dashboard

  # Or chat with your agent from the CLI
  agentforge chat

  # Install skills to extend agent capabilities
  agentforge skills list --registry
  agentforge skills install web-search

  # Check system status
  agentforge status

Documentation: https://github.com/Agentic-Engineering-Agency/agentforge
`);
}

// src/commands/run.ts
import { spawn } from "child_process";
import path2 from "path";
import fs2 from "fs-extra";
async function runProject(options) {
  const projectDir = process.cwd();
  const pkgPath = path2.join(projectDir, "package.json");
  if (!await fs2.pathExists(pkgPath)) {
    console.error(
      "Error: No package.json found. Are you in an AgentForge project directory?"
    );
    process.exit(1);
  }
  const convexDir = path2.join(projectDir, "convex");
  if (!await fs2.pathExists(convexDir)) {
    console.error(
      "Error: No convex/ directory found. Are you in an AgentForge project directory?"
    );
    process.exit(1);
  }
  console.log(`
\u{1F680} Starting AgentForge development server...
`);
  console.log(`  Convex dev server starting on port ${options.port}...`);
  if (options.sandbox === "docker") {
    console.log(`  \u{1F433} Docker sandbox enabled \u2014 agent tools will execute in isolated containers`);
    console.log(`     Image: ${process.env["DOCKER_IMAGE"] ?? "node:22-slim (default)"}`);
    console.log(`     Host:  ${process.env["DOCKER_HOST"] ?? "/var/run/docker.sock (default)"}`);
  } else if (options.sandbox === "e2b") {
    console.log(`  \u2601\uFE0F  E2B sandbox enabled \u2014 agent tools will execute in cloud sandboxes`);
  } else if (options.sandbox === "none") {
    console.log(`  \u26A0\uFE0F  No sandbox \u2014 agent tools will execute directly on the host (unsafe)`);
  } else {
    console.log(`  \u{1F4E6} Local sandbox enabled (default)`);
  }
  const sandboxEnv = {
    ...process.env,
    AGENTFORGE_SANDBOX_PROVIDER: options.sandbox
  };
  const convexProcess = spawn("npx", ["convex", "dev"], {
    cwd: projectDir,
    stdio: "inherit",
    shell: true,
    env: sandboxEnv
  });
  convexProcess.on("error", (err) => {
    console.error(`Failed to start Convex dev server: ${err.message}`);
    process.exit(1);
  });
  convexProcess.on("close", (code) => {
    if (code !== 0) {
      console.error(`Convex dev server exited with code ${code}`);
    }
  });
  const shutdown = () => {
    console.log("\n\n\u{1F44B} Shutting down AgentForge dev server...");
    convexProcess.kill("SIGTERM");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// src/commands/upgrade.ts
import path3 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { readFileSync as readFileSync2, existsSync, readdirSync, statSync, copyFileSync, mkdirSync } from "fs";
import readline from "readline";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path3.dirname(__filename2);
function resolveTemplateDir() {
  const searchDirs = [
    path3.resolve(__dirname2, "..", "..", "default"),
    // dist/default (built)
    path3.resolve(__dirname2, "..", "..", "..", "templates", "default"),
    // packages/cli/templates/default (dev)
    path3.resolve(__dirname2, "..", "..", "..", "..", "templates", "default")
    // fallback
  ];
  for (const dir of searchDirs) {
    if (existsSync(dir)) {
      return dir;
    }
  }
  throw new Error("Template directory not found");
}
function walkDir(dir, basePath = dir, skipPatterns = ["_generated"]) {
  const files = [];
  if (!existsSync(dir)) {
    return files;
  }
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path3.join(dir, entry);
    const stat2 = statSync(fullPath);
    if (stat2.isDirectory()) {
      if (skipPatterns.some((pattern) => entry.includes(pattern))) {
        continue;
      }
      files.push(...walkDir(fullPath, basePath, skipPatterns));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}
function getRelativePath(fullPath, basePath) {
  return path3.relative(basePath, fullPath);
}
function compareFiles(templatePath, userPath) {
  if (!existsSync(userPath)) {
    return "new";
  }
  const templateContent = readFileSync2(templatePath, "utf-8");
  const userContent = readFileSync2(userPath, "utf-8");
  if (templateContent === userContent) {
    return "identical";
  }
  return "modified";
}
function printDiffTable(diffs) {
  if (diffs.length === 0) {
    console.log("\n  \u2705 All files are up to date!\n");
    return;
  }
  console.log("\n  Files to update:\n");
  console.log("  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
  console.log("  \u2502 File                                       \u2502 Status   \u2502");
  console.log("  \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
  for (const diff of diffs) {
    const filename = diff.relativePath.padEnd(43).slice(0, 43);
    let status;
    let statusColor;
    if (diff.changeType === "new") {
      status = "NEW      ";
      statusColor = "\x1B[32m";
    } else {
      status = "MODIFIED ";
      statusColor = "\x1B[33m";
    }
    console.log(`  \u2502 ${filename} \u2502 ${statusColor}${status}\x1B[0m \u2502`);
  }
  console.log("  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n");
}
function promptConfirmation() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve4) => {
    rl.question("  Apply these updates? [y/N] ", (answer) => {
      rl.close();
      resolve4(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}
function backupFiles(files, projectDir) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = path3.join(projectDir, "convex", `.backup-${timestamp}`);
  mkdirSync(backupDir, { recursive: true });
  for (const file of files) {
    const userPath = path3.join(projectDir, "convex", file.relativePath);
    if (existsSync(userPath)) {
      const backupPath = path3.join(backupDir, file.relativePath);
      mkdirSync(path3.dirname(backupPath), { recursive: true });
      copyFileSync(userPath, backupPath);
    }
  }
  return backupDir;
}
function applyUpdates(files, templateDir, projectDir) {
  for (const file of files) {
    const templatePath = path3.join(templateDir, "convex", file.relativePath);
    const userPath = path3.join(projectDir, "convex", file.relativePath);
    mkdirSync(path3.dirname(userPath), { recursive: true });
    copyFileSync(templatePath, userPath);
  }
}
async function upgradeProject(options) {
  const projectDir = process.cwd();
  const convexDir = path3.join(projectDir, "convex");
  if (!existsSync(convexDir)) {
    console.error("  Error: No convex/ directory found. Are you in an AgentForge project?");
    process.exit(1);
  }
  console.log("\n\u{1F504} Checking for Convex template updates...\n");
  let templateDir;
  try {
    templateDir = resolveTemplateDir();
  } catch (err) {
    console.error("  Error: Template directory not found");
    process.exit(1);
  }
  const templateConvexDir = path3.join(templateDir, "convex");
  if (!existsSync(templateConvexDir)) {
    console.error("  Error: Template convex/ directory not found");
    process.exit(1);
  }
  const templateFiles = walkDir(templateConvexDir);
  const diffs = [];
  for (const templatePath of templateFiles) {
    const relativePath = getRelativePath(templatePath, templateConvexDir);
    if (options.only && !relativePath.includes(options.only)) {
      continue;
    }
    const userPath = path3.join(convexDir, relativePath);
    const changeType = compareFiles(templatePath, userPath);
    if (changeType !== "identical") {
      diffs.push({ relativePath, changeType });
    }
  }
  printDiffTable(diffs);
  if (options.dryRun) {
    console.log("  \u{1F50D} Dry run complete \u2014 no files modified\n");
    return;
  }
  if (diffs.length === 0) {
    return;
  }
  let shouldApply = options.yes;
  if (!shouldApply) {
    shouldApply = await promptConfirmation();
  }
  if (!shouldApply) {
    console.log("  \u274C Upgrade cancelled\n");
    return;
  }
  console.log("  \u{1F4E6} Backing up files...");
  const backupDir = backupFiles(diffs, projectDir);
  console.log(`  \u2705 Backup created at ${backupDir}
`);
  console.log("  \u{1F504} Applying updates...");
  applyUpdates(diffs, templateDir, projectDir);
  console.log(`  \u2705 Updated ${diffs.length} file(s)
`);
  console.log(`\u{1F389} Upgrade complete!
`);
  console.log(`  ${diffs.length} file(s) updated`);
  console.log(`  Backup: ${backupDir}
`);
}

// src/lib/convex-client.ts
import fs3 from "fs-extra";
import path4 from "path";
function safeCwd() {
  try {
    return process.cwd();
  } catch {
    return null;
  }
}
function getConvexUrl() {
  const cwd = safeCwd();
  if (!cwd) {
    throw new Error(
      "Current directory does not exist or is not accessible.\nPlease navigate to a valid AgentForge project directory and try again."
    );
  }
  const envFiles = [".env.local", ".env", ".env.production"];
  for (const envFile of envFiles) {
    const envPath = path4.join(cwd, envFile);
    if (fs3.existsSync(envPath)) {
      const content = fs3.readFileSync(envPath, "utf-8");
      const match = content.match(/CONVEX_URL\s*=\s*(.+)/);
      if (match) {
        return match[1].trim().replace(/["']/g, "");
      }
    }
  }
  const convexEnv = path4.join(cwd, ".convex", "deployment.json");
  if (fs3.existsSync(convexEnv)) {
    try {
      const data = JSON.parse(fs3.readFileSync(convexEnv, "utf-8"));
      if (data.url) return data.url;
    } catch {
    }
  }
  throw new Error(
    "CONVEX_URL not found. Run `npx convex dev` first, or set CONVEX_URL in your .env file."
  );
}
async function createClient() {
  const { ConvexHttpClient } = await import("convex/browser");
  const url = getConvexUrl();
  return new ConvexHttpClient(url);
}
async function safeCall(fn, errorMessage) {
  try {
    return await fn();
  } catch (error4) {
    if (error4.message?.includes("CONVEX_URL not found")) {
      console.error("\n\u274C Not connected to Convex.");
      console.error("   Run `npx convex dev` in your project directory first.\n");
    } else if (error4.message?.includes("Current directory does not exist")) {
      console.error(`
\u274C ${error4.message}
`);
    } else if (error4.message?.includes("fetch failed") || error4.message?.includes("ECONNREFUSED")) {
      console.error("\n\u274C Cannot reach Convex deployment.");
      console.error("   Make sure `npx convex dev` is running.\n");
    } else {
      console.error(`
\u274C ${errorMessage}`);
      console.error(`   ${error4.message}
`);
    }
    process.exit(1);
  }
}

// src/lib/display.ts
var colors = {
  reset: "\x1B[0m",
  bold: "\x1B[1m",
  dim: "\x1B[2m",
  red: "\x1B[31m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  blue: "\x1B[34m",
  magenta: "\x1B[35m",
  cyan: "\x1B[36m",
  white: "\x1B[37m",
  gray: "\x1B[90m"
};
function success(msg) {
  console.log(`${colors.green}\u2714${colors.reset} ${msg}`);
}
function error(msg) {
  console.error(`${colors.red}\u2716${colors.reset} ${msg}`);
}
function warn(msg) {
  console.log(`${colors.yellow}\u26A0${colors.reset} ${msg}`);
}
function info(msg) {
  console.log(`${colors.blue}\u2139${colors.reset} ${msg}`);
}
function header(title) {
  console.log(`
${colors.bold}${colors.cyan}${title}${colors.reset}
`);
}
function dim(msg) {
  console.log(`${colors.dim}${msg}${colors.reset}`);
}
function table(data, columns) {
  if (data.length === 0) {
    dim("  (no items)");
    return;
  }
  const cols = columns ?? Object.keys(data[0]);
  const widths = {};
  for (const col of cols) {
    widths[col] = Math.max(
      col.length,
      ...data.map((row) => String(row[col] ?? "").length)
    );
  }
  const headerRow = cols.map((c) => c.toUpperCase().padEnd(widths[c])).join("  ");
  console.log(`  ${colors.bold}${headerRow}${colors.reset}`);
  console.log(`  ${cols.map((c) => "\u2500".repeat(widths[c])).join("\u2500\u2500")}`);
  for (const row of data) {
    const line = cols.map((c) => String(row[c] ?? "").padEnd(widths[c])).join("  ");
    console.log(`  ${line}`);
  }
  console.log();
}
function details(data) {
  const maxKey = Math.max(...Object.keys(data).map((k) => k.length));
  for (const [key, value] of Object.entries(data)) {
    const label = `${colors.dim}${key.padEnd(maxKey)}${colors.reset}`;
    console.log(`  ${label}  ${value}`);
  }
  console.log();
}
function formatDate(ts) {
  return new Date(ts).toLocaleString();
}
function truncate(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "\u2026";
}

// src/commands/agents.ts
import readline2 from "readline";
function prompt(question) {
  const rl = readline2.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve4) => rl.question(question, (ans) => {
    rl.close();
    resolve4(ans.trim());
  }));
}
function registerAgentsCommand(program2) {
  const agents = program2.command("agents").description("Manage agents");
  agents.command("list").description("List all agents").option("--active", "Show only active agents").option("--json", "Output as JSON").action(async (opts) => {
    const client = await createClient();
    const result = await safeCall(
      () => client.query("agents:list", {}),
      "Failed to list agents"
    );
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    header("Agents");
    if (!result || result.length === 0) {
      info("No agents found. Create one with: agentforge agents create");
      return;
    }
    const filtered = opts.active ? result.filter((a) => a.isActive) : result;
    table(
      filtered.map((a) => ({
        ID: a.id,
        Name: a.name,
        Model: a.model,
        Provider: a.provider || "openai",
        Active: a.isActive ? "\u2714" : "\u2716",
        Created: formatDate(a.createdAt)
      }))
    );
  });
  agents.command("create").description("Create a new agent (interactive)").option("--name <name>", "Agent name").option("--model <model>", "Model identifier (e.g., openai:gpt-4o-mini)").option("--instructions <text>", "System instructions").option("--description <text>", "Agent description").option("--provider <provider>", "Provider (openai, anthropic, etc.)").action(async (opts) => {
    const name = opts.name || await prompt("Agent name: ");
    const model = opts.model || await prompt("Model (e.g., openai:gpt-4o-mini): ");
    const instructions = opts.instructions || await prompt("Instructions: ");
    const description = opts.description || await prompt("Description (optional): ");
    const provider = opts.provider || await prompt("Provider (openai, anthropic, etc.) [default: openai]: ") || "openai";
    if (!name || !model || !instructions) {
      error("Name, model, and instructions are required.");
      process.exit(1);
    }
    let agentProvider = provider;
    let agentModel = model || "gpt-4o-mini";
    if (agentModel.includes(":")) {
      const [p, m] = agentModel.split(":");
      agentProvider = p;
      agentModel = m;
    }
    const agentId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const client = await createClient();
    await safeCall(
      () => client.mutation("agents:create", {
        id: agentId,
        name,
        description: description || void 0,
        instructions,
        model: agentModel,
        provider: agentProvider
      }),
      "Failed to create agent"
    );
    success(`Agent "${name}" created with ID: ${agentId}`);
  });
  agents.command("inspect").argument("<id>", "Agent ID").description("Show detailed agent information").action(async (id) => {
    const client = await createClient();
    const agent = await safeCall(
      () => client.query("agents:get", { id }),
      "Failed to fetch agent"
    );
    if (!agent) {
      error(`Agent "${id}" not found.`);
      process.exit(1);
    }
    header(`Agent: ${agent.name}`);
    const a = agent;
    details({
      "ID": a.id,
      "Name": a.name,
      "Model": a.model,
      "Provider": a.provider || "openai",
      "Active": a.isActive ? "Yes" : "No",
      "Temperature": a.temperature ?? "default",
      "Max Tokens": a.maxTokens ?? "default",
      "Created": formatDate(a.createdAt),
      "Updated": formatDate(a.updatedAt)
    });
    if (a.description) info(`Description: ${a.description}`);
    console.log(`  Instructions:
  ${a.instructions.split("\n").join("\n  ")}
`);
  });
  agents.command("edit").argument("<id>", "Agent ID").option("--name <name>", "New name").option("--model <model>", "New model").option("--description <text>", "New description").option("--provider <provider>", "New provider").option("--active <true|false>", "Set active status").option("--instructions <text>", "New instructions").description("Edit an agent").action(async (id, opts) => {
    const client = await createClient();
    const agent = await safeCall(
      () => client.query("agents:get", { id }),
      "Failed to fetch agent"
    );
    if (!agent) {
      error(`Agent "${id}" not found.`);
      process.exit(1);
    }
    const updates = {};
    if (opts.name) updates.name = opts.name;
    if (opts.description) updates.description = opts.description;
    if (opts.provider) updates.provider = opts.provider;
    if (opts.active !== void 0) updates.isActive = opts.active === "true" || opts.active === true;
    if (opts.model) {
      let agentProvider = "openai";
      let agentModel = opts.model;
      if (agentModel.includes(":")) {
        const [p, m] = agentModel.split(":");
        agentProvider = p;
        agentModel = m;
      }
      updates.model = agentModel;
      updates.provider = agentProvider;
    }
    if (opts.instructions) updates.instructions = opts.instructions;
    if (Object.keys(updates).length === 0) {
      const a = agent;
      const name = await prompt(`Name [${a.name}]: `);
      const description = await prompt(`Description [${a.description || "none"}]: `);
      const model = await prompt(`Model [${a.model}]: `);
      const provider = await prompt(`Provider [${a.provider || "openai"}]: `);
      const active = await prompt(`Active [${a.isActive ? "true" : "false"}]: `);
      const instr = await prompt(`Instructions [keep current]: `);
      if (name) updates.name = name;
      if (description) updates.description = description;
      if (provider) updates.provider = provider;
      if (active) updates.isActive = active === "true" || active === "1";
      if (model) {
        let agentProvider = "openai";
        let agentModel = model;
        if (agentModel.includes(":")) {
          const [p, m] = agentModel.split(":");
          agentProvider = p;
          agentModel = m;
        }
        updates.model = agentModel;
        updates.provider = agentProvider;
      }
      if (instr) updates.instructions = instr;
    }
    if (Object.keys(updates).length === 0) {
      info("No changes made.");
      return;
    }
    await safeCall(
      () => client.mutation("agents:update", { id, ...updates }),
      "Failed to update agent"
    );
    success(`Agent "${id}" updated.`);
  });
  agents.command("delete").argument("<id>", "Agent ID").option("-f, --force", "Skip confirmation").description("Delete an agent").action(async (id, opts) => {
    if (!opts.force) {
      const confirm = await prompt(`Delete agent "${id}"? (y/N): `);
      if (confirm.toLowerCase() !== "y") {
        info("Cancelled.");
        return;
      }
    }
    const client = await createClient();
    const agent = await safeCall(
      () => client.query("agents:get", { id }),
      "Failed to fetch agent"
    );
    if (!agent) {
      error(`Agent "${id}" not found.`);
      process.exit(1);
    }
    await safeCall(
      () => client.mutation("agents:remove", { id }),
      "Failed to delete agent"
    );
    success(`Agent "${id}" deleted.`);
  });
  agents.command("enable").argument("<id>", "Agent ID").description("Enable an agent").action(async (id) => {
    const client = await createClient();
    const agent = await safeCall(() => client.query("agents:get", { id }), "Failed to fetch agent");
    if (!agent) {
      error(`Agent "${id}" not found.`);
      process.exit(1);
    }
    await safeCall(() => client.mutation("agents:update", { id, isActive: true }), "Failed");
    success(`Agent "${id}" enabled.`);
  });
  agents.command("disable").argument("<id>", "Agent ID").description("Disable an agent").action(async (id) => {
    const client = await createClient();
    const agent = await safeCall(() => client.query("agents:get", { id }), "Failed to fetch agent");
    if (!agent) {
      error(`Agent "${id}" not found.`);
      process.exit(1);
    }
    await safeCall(() => client.mutation("agents:update", { id, isActive: false }), "Failed");
    success(`Agent "${id}" disabled.`);
  });
}

// src/commands/chat.ts
import readline3 from "readline";
var MAX_MESSAGE_LENGTH = 1e4;
var DEFAULT_PORT = 3001;
function validateMessage(msg) {
  if (!msg) return { valid: false, error: "Message is required" };
  const trimmed = msg.trim();
  if (trimmed.length === 0) return { valid: false, error: "Message cannot be empty" };
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` };
  }
  return { valid: true };
}
function parseSseLine(line, onChunk, onError, stream, buffered) {
  if (!line.startsWith("data: ")) return;
  const data = line.slice(6);
  if (data === "[DONE]") return;
  try {
    const parsed = JSON.parse(data);
    const content = parsed.choices?.[0]?.delta?.content;
    if (content) {
      if (stream) {
        onChunk(content);
      } else {
        buffered.value += content;
      }
    }
    const errorMsg = parsed.error;
    if (errorMsg && onError) {
      onError(String(errorMsg));
    }
  } catch {
  }
}
async function chatViaHttp(agentId, message, port, onChunk, onError, stream = true) {
  const response = await fetch(`http://localhost:${port}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: agentId,
      messages: [{ role: "user", content: message }],
      stream: true
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error("No response body");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const buffered = { value: "" };
  let sseBuffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });
    const lines = sseBuffer.split("\n");
    sseBuffer = lines.pop() ?? "";
    for (const line of lines) {
      parseSseLine(line, onChunk, onError, stream, buffered);
    }
  }
  parseSseLine(sseBuffer, onChunk, onError, stream, buffered);
  if (!stream && buffered.value) {
    onChunk(buffered.value);
  }
}
function registerChatCommand(program2) {
  program2.command("chat").argument("[agent-id]", "Agent ID to chat with").option("-s, --session <id>", "Resume an existing session (deprecated, use --thread)").option("-m, --message <text>", "Send a single message and exit (non-interactive)").option("--thread <id>", "Continue existing thread (stored in Convex)").option("-p, --port <n>", "Runtime HTTP port", String(DEFAULT_PORT)).option("--no-stream", "Disable streaming (wait for full response)").description("Start an interactive chat session with an agent").action(async (agentId, opts) => {
    const port = parseInt(opts.port, 10);
    const client = await createClient();
    let runtimeRunning = false;
    try {
      const healthResponse = await fetch(`http://localhost:${port}/health`);
      runtimeRunning = healthResponse.ok;
    } catch {
      runtimeRunning = false;
    }
    if (!runtimeRunning) {
      error("AgentForge daemon is not running.");
      info("Start it first: agentforge start");
      process.exit(1);
    }
    if (!agentId) {
      const agents = await safeCall(() => client.query("agents:list", {}), "Failed to list agents");
      if (!agents || agents.length === 0) {
        error("No agents found. Create one first: agentforge agents create");
        process.exit(1);
      }
      header("Available Agents");
      agents.forEach((a2, i) => {
        console.log(`  ${colors.cyan}${i + 1}.${colors.reset} ${a2.name} ${colors.dim}(${a2.id})${colors.reset}`);
      });
      console.log();
      const rl2 = readline3.createInterface({ input: process.stdin, output: process.stdout });
      const choice = await new Promise((r) => rl2.question("Select agent (number or ID): ", (a2) => {
        rl2.close();
        r(a2.trim());
      }));
      const idx = parseInt(choice, 10) - 1;
      agentId = idx >= 0 && idx < agents.length ? agents[idx].id : choice;
    }
    const agent = await safeCall(() => client.query("agents:get", { id: agentId }), "Failed to fetch agent");
    if (!agent) {
      error(`Agent "${agentId}" not found.`);
      process.exit(1);
    }
    const a = agent;
    if (opts.message) {
      const validation = validateMessage(opts.message);
      if (!validation.valid) {
        error(validation.error || "Invalid message");
        process.exit(1);
      }
      const input = opts.message.trim();
      try {
        let threadId2 = opts.thread || opts.session;
        if (!threadId2) {
          threadId2 = await safeCall(
            () => client.mutation("threads:createThread", { agentId: a.id }),
            "Failed to create thread"
          );
        }
        await safeCall(() => client.mutation("messages:add", { threadId: threadId2, role: "user", content: input }), "Failed to save message");
      } catch {
      }
      try {
        let fullResponse = "";
        await chatViaHttp(
          a.id,
          input,
          port,
          (chunk) => {
            process.stdout.write(chunk);
            fullResponse += chunk;
          },
          (errorMsg) => {
            console.log(`
${colors.yellow}[Error: ${errorMsg}]${colors.reset}`);
          },
          opts.stream !== false
        );
        console.log();
        process.exit(0);
      } catch (err) {
        error(`Chat failed: ${err instanceof Error ? err.message : String(err)}`);
        info("Make sure the daemon is running: agentforge start");
        process.exit(1);
      }
    }
    header(`Chat with ${a.name}`);
    dim(`  Model: ${a.model} | Provider: ${a.provider || "openai"}`);
    dim(`  Runtime: http://localhost:${port}`);
    dim(`  Type "exit" or "quit" to end. "/new" for new thread.`);
    console.log();
    let threadId = opts.thread || opts.session;
    if (!threadId) {
      threadId = await safeCall(
        () => client.mutation("threads:createThread", { agentId: a.id }),
        "Failed to create thread"
      );
    }
    const history = [];
    const isTTY = process.stdin.isTTY ?? false;
    const rl = readline3.createInterface({
      input: process.stdin,
      output: isTTY ? process.stdout : void 0,
      terminal: isTTY,
      prompt: isTTY ? `${colors.green}You${colors.reset} > ` : void 0
    });
    if (isTTY) rl.prompt();
    rl.on("line", async (line) => {
      const input = line.trim();
      if (!input) {
        if (isTTY) rl.prompt();
        return;
      }
      if (input.length > MAX_MESSAGE_LENGTH) {
        error(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`);
        if (isTTY) rl.prompt();
        return;
      }
      if (input === "exit" || input === "quit") {
        success("Session ended. Goodbye!");
        process.exit(0);
      }
      if (input === "/new") {
        threadId = await safeCall(() => client.mutation("threads:createThread", { agentId: a.id }), "Failed");
        history.length = 0;
        info("New thread started.");
        if (isTTY) rl.prompt();
        return;
      }
      if (input === "/history") {
        history.forEach((m) => {
          const prefix = m.role === "user" ? `${colors.green}You${colors.reset}` : `${colors.cyan}${a.name}${colors.reset}`;
          console.log(`  ${prefix}: ${m.content}`);
        });
        if (history.length === 0) dim("  (no messages yet)");
        console.log();
        if (isTTY) rl.prompt();
        return;
      }
      history.push({ role: "user", content: input });
      try {
        await safeCall(() => client.mutation("messages:add", { threadId, role: "user", content: input }), "Failed to save");
      } catch {
      }
      if (isTTY) {
        process.stdout.write(`${colors.cyan}${a.name}${colors.reset} > `);
      }
      try {
        let fullResponse = "";
        await chatViaHttp(
          a.id,
          input,
          port,
          (chunk) => {
            process.stdout.write(chunk);
            fullResponse += chunk;
          },
          (errorMsg) => {
            console.log(`
${colors.yellow}[Error: ${errorMsg}]${colors.reset}`);
          },
          opts.stream !== false
        );
        console.log();
        history.push({ role: "assistant", content: fullResponse });
        try {
          await safeCall(() => client.mutation("messages:add", { threadId, role: "assistant", content: fullResponse }), "Failed to save");
        } catch {
        }
      } catch (err) {
        console.log(`${colors.yellow}[Chat failed: ${err instanceof Error ? err.message : String(err)}]${colors.reset}`);
        console.log(`${colors.yellow}[Check that the daemon is running: agentforge start]${colors.reset}`);
      }
      console.log();
      if (isTTY) rl.prompt();
    });
    rl.on("close", () => {
      if (isTTY) {
        console.log();
        info("Session ended.");
      }
      process.exit(0);
    });
  });
}

// src/commands/sessions.ts
import readline4 from "readline";
function registerSessionsCommand(program2) {
  const sessions = program2.command("sessions").description("Manage sessions");
  sessions.command("list").option("--status <status>", "Filter by status (active, ended)").option("--json", "Output as JSON").description("List all sessions").action(async (opts) => {
    const client = await createClient();
    const result = await safeCall(() => client.query("sessions:list", {}), "Failed to list sessions");
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    header("Sessions");
    const items = result || [];
    if (items.length === 0) {
      info("No sessions found.");
      return;
    }
    const filtered = opts.status ? items.filter((s) => s.status === opts.status) : items;
    table(filtered.map((s) => ({
      ID: s._id || "N/A",
      Session: s.sessionId,
      Agent: s.agentId,
      Status: s.status,
      Started: formatDate(s.startedAt),
      "Last Activity": formatDate(s.lastActivityAt)
    })));
  });
  sessions.command("inspect").argument("<id>", "Session ID").description("Show session details").action(async (id) => {
    const client = await createClient();
    const session = await safeCall(() => client.query("sessions:get", { sessionId: id }), "Failed to fetch session");
    if (!session) {
      error(`Session "${id}" not found.`);
      process.exit(1);
    }
    const s = session;
    header(`Session: ${s.sessionId}`);
    details({ ID: s._id, "Session ID": s.sessionId, Agent: s.agentId, Status: s.status, Started: formatDate(s.startedAt), "Last Activity": formatDate(s.lastActivityAt) });
  });
  sessions.command("end").argument("<id>", "Session ID").description("End an active session").action(async (id) => {
    const client = await createClient();
    await safeCall(() => client.mutation("sessions:updateStatus", { sessionId: id, status: "completed" }), "Failed to end session");
    success(`Session "${id}" ended.`);
  });
  sessions.command("delete").argument("<id>", "Session ID").option("-f, --force", "Skip confirmation").description("Delete a session").action(async (id, opts) => {
    const rl = readline4.createInterface({ input: process.stdin, output: process.stdout });
    const confirmPrompt = (question) => new Promise((resolve4) => rl.question(question, (ans) => {
      rl.close();
      resolve4(ans.trim());
    }));
    if (!opts.force) {
      const confirm = await confirmPrompt(`Delete session "${id}"? (y/N): `);
      if (confirm.toLowerCase() !== "y") {
        info("Cancelled.");
        return;
      }
    }
    const client = await createClient();
    const session = await safeCall(() => client.query("sessions:get", { sessionId: id }), "Failed to fetch session");
    if (!session) {
      error(`Session "${id}" not found.`);
      process.exit(1);
    }
    await safeCall(() => client.mutation("sessions:remove", { sessionId: id }), "Failed to delete session");
    success(`Session "${id}" deleted.`);
  });
}
function registerThreadsCommand(program2) {
  const threads = program2.command("threads").description("Manage conversation threads");
  threads.command("list").option("--agent <id>", "Filter by agent ID").option("--json", "Output as JSON").description("List all threads").action(async (opts) => {
    const client = await createClient();
    const args = opts.agent ? { agentId: opts.agent } : {};
    const result = await safeCall(() => client.query("threads:listThreads", args), "Failed to list threads");
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    header("Threads");
    const items = result || [];
    if (items.length === 0) {
      info("No threads found.");
      return;
    }
    table(items.map((t) => ({
      ID: t._id?.slice(-8) || "N/A",
      Name: t.name || "Unnamed",
      Agent: t.agentId,
      Created: formatDate(t.createdAt)
    })));
  });
  threads.command("inspect").argument("<id>", "Thread ID").description("Show thread messages").action(async (id) => {
    const client = await createClient();
    const messages = await safeCall(() => client.query("messages:list", { threadId: id, paginationOpts: { cursor: null, numItems: 50 } }), "Failed to fetch messages");
    header(`Thread: ${id}`);
    const items = messages?.page || [];
    if (items.length === 0) {
      info("No messages in this thread.");
      return;
    }
    items.forEach((m) => {
      const role = m.role === "user" ? "\x1B[32mUser\x1B[0m" : m.role === "assistant" ? "\x1B[36mAssistant\x1B[0m" : `\x1B[33m${m.role}\x1B[0m`;
      console.log(`  ${role}: ${m.content}`);
    });
    console.log();
  });
  threads.command("delete").argument("<id>", "Thread ID").description("Delete a thread and its messages").action(async (id) => {
    const client = await createClient();
    await safeCall(() => client.mutation("threads:deleteThread", { id }), "Failed to delete thread");
    success(`Thread "${id}" deleted.`);
  });
  threads.command("rename").argument("<id>", "Thread ID").argument("<name>", "New name").description("Rename a thread").action(async (id, name) => {
    const client = await createClient();
    await safeCall(() => client.mutation("threads:rename", { id, name }), "Failed to rename thread");
    success(`Thread renamed to "${name}"`);
  });
}

// src/commands/skills.ts
import fs4 from "fs-extra";
import path5 from "path";
import readline5 from "readline";
import { execSync as execSync2 } from "child_process";
var SKILLS_DIR_NAME = "skills";
var SKILLS_LOCK_FILE = "skills.lock.json";
var WORKSPACE_DIR_NAME = "workspace";
var BUILTIN_REGISTRY = [
  {
    name: "web-search",
    description: "Search the web for information using DuckDuckGo. Provides structured search results with titles, URLs, and snippets.",
    version: "1.0.0",
    tags: ["web", "search", "research"],
    author: "AgentForge",
    source: "builtin"
  },
  {
    name: "file-manager",
    description: "Advanced file management operations including batch rename, find-and-replace across files, directory comparison, and file organization.",
    version: "1.0.0",
    tags: ["files", "utility", "management"],
    author: "AgentForge",
    source: "builtin"
  },
  {
    name: "code-review",
    description: "Systematic code review following best practices. Checks for bugs, security vulnerabilities, style issues, and suggests improvements.",
    version: "1.0.0",
    tags: ["development", "review", "quality"],
    author: "AgentForge",
    source: "builtin"
  },
  {
    name: "data-analyst",
    description: "Analyze CSV, JSON, and tabular data. Generate summaries, statistics, and insights from structured datasets.",
    version: "1.0.0",
    tags: ["data", "analysis", "csv", "json"],
    author: "AgentForge",
    source: "builtin"
  },
  {
    name: "api-tester",
    description: "Test REST APIs with structured request/response validation. Supports GET, POST, PUT, DELETE with headers and body.",
    version: "1.0.0",
    tags: ["api", "testing", "http", "rest"],
    author: "AgentForge",
    source: "builtin"
  },
  {
    name: "git-workflow",
    description: "Git workflow automation including conventional commits, branch management, PR descriptions, and changelog generation.",
    version: "1.0.0",
    tags: ["git", "workflow", "development"],
    author: "AgentForge",
    source: "builtin"
  },
  {
    name: "browser-automation",
    description: "Browser automation using Playwright. Navigate web pages, click elements, type text, extract content, take screenshots, and run JavaScript. Supports Docker sandbox mode for secure execution.",
    version: "1.0.0",
    tags: ["web", "browser", "automation", "scraping"],
    author: "AgentForge",
    source: "builtin"
  }
];
function prompt2(q) {
  const rl = readline5.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => {
    rl.close();
    r(a.trim());
  }));
}
function resolveSkillsDir() {
  const cwd = process.cwd();
  const workspaceSkillsDir = path5.join(cwd, WORKSPACE_DIR_NAME, SKILLS_DIR_NAME);
  if (fs4.existsSync(workspaceSkillsDir)) {
    return workspaceSkillsDir;
  }
  return path5.join(cwd, SKILLS_DIR_NAME);
}
function readSkillsLock(skillsDir) {
  const lockPath = path5.join(path5.dirname(skillsDir), SKILLS_LOCK_FILE);
  if (fs4.existsSync(lockPath)) {
    try {
      return JSON.parse(fs4.readFileSync(lockPath, "utf-8"));
    } catch {
    }
  }
  return { version: 1, skills: {} };
}
function writeSkillsLock(skillsDir, lock) {
  const lockPath = path5.join(path5.dirname(skillsDir), SKILLS_LOCK_FILE);
  fs4.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
}
function parseSkillMd(content) {
  try {
    const matter = __require("gray-matter");
    const parsed = matter(content);
    return {
      data: parsed.data,
      content: parsed.content
    };
  } catch {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!fmMatch) {
      return { data: { name: "", description: "", version: "1.0.0" }, content };
    }
    const frontmatter = fmMatch[1];
    const body = fmMatch[2];
    const data = {};
    for (const line of frontmatter.split("\n")) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const value = match[2].trim();
        data[match[1]] = value;
      }
    }
    return {
      data,
      content: body
    };
  }
}
function readSkillMetadata(skillDir) {
  const skillMdPath = path5.join(skillDir, "SKILL.md");
  if (!fs4.existsSync(skillMdPath)) return null;
  const content = fs4.readFileSync(skillMdPath, "utf-8");
  const { data } = parseSkillMd(content);
  return {
    name: data.name || path5.basename(skillDir),
    description: data.description || "",
    version: data.version || "1.0.0",
    tags: data.tags || [],
    author: data.author || "Unknown"
  };
}
function findInRegistry(name) {
  return BUILTIN_REGISTRY.find((s) => s.name === name);
}
function generateBuiltinSkill(name) {
  const generators = {
    "web-search": generateWebSearchSkill,
    "file-manager": generateFileManagerSkill,
    "code-review": generateCodeReviewSkill,
    "data-analyst": generateDataAnalystSkill,
    "api-tester": generateApiTesterSkill,
    "git-workflow": generateGitWorkflowSkill,
    "browser-automation": generateBrowserAutomationSkill
  };
  const generator = generators[name];
  return generator ? generator() : null;
}
function generateWebSearchSkill() {
  const files = /* @__PURE__ */ new Map();
  files.set("SKILL.md", `---
name: web-search
description: Search the web for information using DuckDuckGo and return structured results
version: 1.0.0
tags:
  - web
  - search
  - research
---

# Web Search

You are a web research assistant. When the user asks you to search for information:

1. Use the workspace sandbox to execute the search script at \`scripts/search.ts\`
2. Parse the results and present them in a clear, organized format
3. Include source URLs for all information
4. Summarize key findings at the top

## How to Search

Run the search script with the user's query:

\`\`\`bash
npx tsx scripts/search.ts "user query here"
\`\`\`

The script returns JSON with structured results including title, URL, and snippet.

## Result Format

Present results as:
- **Title** \u2014 Brief description ([Source](url))
- Group related results together
- Highlight the most relevant findings first

## Guidelines

- Always cite sources with URLs
- If results are insufficient, suggest refined queries
- Cross-reference multiple results for accuracy
- Note when information may be outdated
`);
  files.set("scripts/search.ts", `#!/usr/bin/env npx tsx
/**
 * Web Search Script \u2014 Uses DuckDuckGo Instant Answer API
 *
 * Usage: npx tsx scripts/search.ts "your query"
 */

const query = process.argv[2];
if (!query) {
  console.error('Usage: npx tsx scripts/search.ts "query"');
  process.exit(1);
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function search(q: string): Promise<SearchResult[]> {
  const url = \`https://api.duckduckgo.com/?q=\${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1\`;
  const res = await fetch(url);
  const data = await res.json();

  const results: SearchResult[] = [];

  // Abstract (main answer)
  if (data.Abstract) {
    results.push({
      title: data.Heading || q,
      url: data.AbstractURL || '',
      snippet: data.Abstract,
    });
  }

  // Related topics
  if (data.RelatedTopics) {
    for (const topic of data.RelatedTopics) {
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 80),
          url: topic.FirstURL,
          snippet: topic.Text,
        });
      }
      // Subtopics
      if (topic.Topics) {
        for (const sub of topic.Topics) {
          if (sub.Text && sub.FirstURL) {
            results.push({
              title: sub.Text.split(' - ')[0] || sub.Text.slice(0, 80),
              url: sub.FirstURL,
              snippet: sub.Text,
            });
          }
        }
      }
    }
  }

  return results.slice(0, 10);
}

search(query)
  .then((results) => console.log(JSON.stringify({ query, results, count: results.length }, null, 2)))
  .catch((err) => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  });
`);
  files.set("references/search-tips.md", `# Search Tips

## Effective Queries
- Use specific keywords rather than full sentences
- Include domain-specific terms for technical searches
- Use quotes for exact phrase matching (in the query string)
- Add "site:example.com" to limit to specific domains

## Result Evaluation
- Check the date of sources when available
- Cross-reference claims across multiple results
- Prefer authoritative sources (.edu, .gov, established publications)
- Note when results are from forums vs. official documentation
`);
  return files;
}
function generateFileManagerSkill() {
  const files = /* @__PURE__ */ new Map();
  files.set("SKILL.md", `---
name: file-manager
description: Advanced file management operations including batch rename, find-and-replace, and directory organization
version: 1.0.0
tags:
  - files
  - utility
  - management
---

# File Manager

You are a file management assistant. Help users organize, search, and manipulate files in the workspace.

## Capabilities

1. **List & Search** \u2014 Find files by name, extension, or content
2. **Batch Rename** \u2014 Rename multiple files using patterns
3. **Find & Replace** \u2014 Search and replace text across files
4. **Organize** \u2014 Sort files into directories by type, date, or custom rules
5. **Compare** \u2014 Show differences between files or directories

## How to Use

Use the workspace filesystem tools to perform operations:

- \`mastra_workspace_list_files\` \u2014 List directory contents as a tree
- \`mastra_workspace_read_file\` \u2014 Read file contents
- \`mastra_workspace_write_file\` \u2014 Create or overwrite files
- \`mastra_workspace_edit_file\` \u2014 Find and replace in files
- \`mastra_workspace_delete\` \u2014 Remove files or directories
- \`mastra_workspace_file_stat\` \u2014 Get file metadata (size, dates)
- \`mastra_workspace_mkdir\` \u2014 Create directories

For complex operations, use \`mastra_workspace_execute_command\` with the scripts in this skill.

## Scripts

- \`scripts/batch-rename.ts\` \u2014 Batch rename files with pattern support
- \`scripts/find-replace.ts\` \u2014 Find and replace across multiple files
- \`scripts/organize.ts\` \u2014 Organize files by extension into directories

## Guidelines

- Always confirm destructive operations (delete, overwrite) with the user
- Show a preview of changes before executing batch operations
- Create backups when performing bulk modifications
- Report the number of files affected after each operation
`);
  files.set("scripts/batch-rename.ts", `#!/usr/bin/env npx tsx
/**
 * Batch Rename Script
 *
 * Usage: npx tsx scripts/batch-rename.ts <directory> <find-pattern> <replace-pattern>
 * Example: npx tsx scripts/batch-rename.ts ./docs "report-" "2026-report-"
 */

import { readdirSync, renameSync } from 'fs';
import { join, basename } from 'path';

const [dir, findPattern, replacePattern] = process.argv.slice(2);
if (!dir || !findPattern || !replacePattern) {
  console.error('Usage: npx tsx scripts/batch-rename.ts <dir> <find> <replace>');
  process.exit(1);
}

const files = readdirSync(dir);
const renames: Array<{ from: string; to: string }> = [];

for (const file of files) {
  if (file.includes(findPattern)) {
    const newName = file.replace(findPattern, replacePattern);
    renames.push({ from: file, to: newName });
  }
}

if (renames.length === 0) {
  console.log(JSON.stringify({ message: 'No files matched the pattern', count: 0 }));
  process.exit(0);
}

for (const { from, to } of renames) {
  renameSync(join(dir, from), join(dir, to));
}

console.log(JSON.stringify({ renames, count: renames.length }));
`);
  files.set("scripts/find-replace.ts", `#!/usr/bin/env npx tsx
/**
 * Find and Replace Script
 *
 * Usage: npx tsx scripts/find-replace.ts <directory> <find-text> <replace-text> [--ext .ts,.js]
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, extname } from 'path';

const args = process.argv.slice(2);
const dir = args[0];
const findText = args[1];
const replaceText = args[2];
const extFilter = args.includes('--ext') ? args[args.indexOf('--ext') + 1]?.split(',') : null;

if (!dir || !findText || replaceText === undefined) {
  console.error('Usage: npx tsx scripts/find-replace.ts <dir> <find> <replace> [--ext .ts,.js]');
  process.exit(1);
}

interface Change { file: string; count: number; }
const changes: Change[] = [];

function processDir(dirPath: string) {
  for (const entry of readdirSync(dirPath)) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
      processDir(fullPath);
    } else if (stat.isFile()) {
      if (extFilter && !extFilter.includes(extname(entry))) continue;
      const content = readFileSync(fullPath, 'utf-8');
      const count = (content.match(new RegExp(findText.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'g')) || []).length;
      if (count > 0) {
        const newContent = content.replaceAll(findText, replaceText);
        writeFileSync(fullPath, newContent);
        changes.push({ file: fullPath, count });
      }
    }
  }
}

processDir(dir);
console.log(JSON.stringify({ changes, totalFiles: changes.length, totalReplacements: changes.reduce((s, c) => s + c.count, 0) }));
`);
  return files;
}
function generateCodeReviewSkill() {
  const files = /* @__PURE__ */ new Map();
  files.set("SKILL.md", `---
name: code-review
description: Systematic code review following best practices for quality, security, and style
version: 1.0.0
tags:
  - development
  - review
  - quality
---

# Code Review

You are a code reviewer. When reviewing code, follow this systematic process:

## Review Process

1. **Critical Issues** \u2014 Security vulnerabilities, memory leaks, logic bugs, missing error handling
2. **Code Quality** \u2014 Functions over 50 lines, code duplication, confusing names, missing types
3. **Style Guide** \u2014 Check references/style-guide.md for naming and organization conventions
4. **Performance** \u2014 Unnecessary re-renders, N+1 queries, missing memoization, large bundle imports
5. **Testing** \u2014 Missing test coverage, edge cases not handled, brittle assertions

## Feedback Format

Provide feedback in this structure:

**Summary**: One sentence overview of the code quality

**Critical Issues**: List with file paths and line numbers
- \`file.ts:42\` \u2014 Description of the issue

**Suggestions**: Improvements that would help
- Description of suggestion with code example

**Positive Notes**: What the code does well

## What to Look Out For

- Unused variables and imports
- Missing error handling (try/catch, null checks)
- Security vulnerabilities (SQL injection, XSS, secrets in code)
- Performance issues (unnecessary loops, missing indexes)
- TypeScript: any types, missing return types, loose generics
- React: missing keys, stale closures, missing deps in useEffect

## Scripts

- \`scripts/lint.ts\` \u2014 Run linting checks on a file or directory
`);
  files.set("references/style-guide.md", `# Code Style Guide

## TypeScript Conventions
- Use \`const\` by default, \`let\` only when reassignment is needed
- Prefer \`interface\` over \`type\` for object shapes
- Always specify return types for exported functions
- Use \`unknown\` instead of \`any\` where possible
- Prefer \`readonly\` for properties that shouldn't change

## Naming Conventions
- **Files**: kebab-case (\`my-component.tsx\`)
- **Components**: PascalCase (\`MyComponent\`)
- **Functions**: camelCase (\`getUserById\`)
- **Constants**: UPPER_SNAKE_CASE (\`MAX_RETRIES\`)
- **Types/Interfaces**: PascalCase (\`UserProfile\`)

## File Organization
- One component per file
- Co-locate tests with source files (\`*.test.ts\`)
- Group by feature, not by type
- Keep files under 300 lines

## Error Handling
- Always handle promise rejections
- Use typed errors with error codes
- Log errors with context (user ID, request ID)
- Never swallow errors silently
`);
  files.set("scripts/lint.ts", `#!/usr/bin/env npx tsx
/**
 * Simple Lint Script \u2014 Checks for common issues
 *
 * Usage: npx tsx scripts/lint.ts <file-or-directory>
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const target = process.argv[2];
if (!target) {
  console.error('Usage: npx tsx scripts/lint.ts <file-or-directory>');
  process.exit(1);
}

interface LintIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning';
  message: string;
}

const issues: LintIssue[] = [];

function lintFile(filePath: string) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\\n');

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    // Check for console.log
    if (line.includes('console.log') && !filePath.includes('test')) {
      issues.push({ file: filePath, line: lineNum, severity: 'warning', message: 'console.log found \u2014 remove before production' });
    }
    // Check for debugger
    if (line.trim() === 'debugger' || line.trim() === 'debugger;') {
      issues.push({ file: filePath, line: lineNum, severity: 'error', message: 'debugger statement found' });
    }
    // Check for any type
    if (line.includes(': any') || line.includes('<any>')) {
      issues.push({ file: filePath, line: lineNum, severity: 'warning', message: 'Use of "any" type \u2014 prefer "unknown" or specific type' });
    }
    // Check for var usage
    if (/\\bvar\\s+/.test(line)) {
      issues.push({ file: filePath, line: lineNum, severity: 'error', message: 'Use "const" or "let" instead of "var"' });
    }
    // Check for TODO/FIXME
    if (/\\/\\/\\s*(TODO|FIXME|HACK|XXX)/.test(line)) {
      issues.push({ file: filePath, line: lineNum, severity: 'warning', message: 'Unresolved TODO/FIXME comment' });
    }
  });
}

function processPath(p: string) {
  const stat = statSync(p);
  if (stat.isFile() && ['.ts', '.tsx', '.js', '.jsx'].includes(extname(p))) {
    lintFile(p);
  } else if (stat.isDirectory()) {
    for (const entry of readdirSync(p)) {
      if (!entry.startsWith('.') && entry !== 'node_modules' && entry !== 'dist') {
        processPath(join(p, entry));
      }
    }
  }
}

processPath(target);
console.log(JSON.stringify({ issues, total: issues.length, errors: issues.filter(i => i.severity === 'error').length, warnings: issues.filter(i => i.severity === 'warning').length }));
`);
  return files;
}
function generateDataAnalystSkill() {
  const files = /* @__PURE__ */ new Map();
  files.set("SKILL.md", `---
name: data-analyst
description: Analyze CSV, JSON, and tabular data to generate summaries, statistics, and insights
version: 1.0.0
tags:
  - data
  - analysis
  - csv
  - json
---

# Data Analyst

You are a data analysis assistant. Help users understand and extract insights from structured data.

## Capabilities

1. **Load Data** \u2014 Read CSV, JSON, and TSV files from the workspace
2. **Summarize** \u2014 Generate column statistics (min, max, mean, median, mode)
3. **Filter & Query** \u2014 Filter rows by conditions, select columns
4. **Aggregate** \u2014 Group by columns and compute aggregates
5. **Detect Anomalies** \u2014 Find outliers and missing values

## How to Analyze

1. First, read the data file using workspace filesystem tools
2. Use \`scripts/analyze.ts\` for statistical analysis
3. Present findings in a clear table format
4. Suggest follow-up analyses based on initial findings

## Scripts

- \`scripts/analyze.ts\` \u2014 Compute statistics on CSV/JSON data

## Output Format

Present analysis results as:
- **Dataset Overview**: Row count, column count, column types
- **Key Statistics**: Per-column min, max, mean, median
- **Missing Data**: Columns with null/empty values and their percentages
- **Insights**: Notable patterns, correlations, or anomalies

## Guidelines

- Always show a sample of the data (first 5 rows) before analysis
- Handle missing values gracefully \u2014 report them, don't crash
- Use appropriate precision for numbers (2 decimal places for percentages)
- Suggest visualizations when patterns would be clearer in chart form
`);
  files.set("scripts/analyze.ts", `#!/usr/bin/env npx tsx
/**
 * Data Analysis Script \u2014 Basic statistics for CSV/JSON data
 *
 * Usage: npx tsx scripts/analyze.ts <file.csv|file.json>
 */

import { readFileSync } from 'fs';
import { extname } from 'path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: npx tsx scripts/analyze.ts <file.csv|file.json>');
  process.exit(1);
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

const content = readFileSync(filePath, 'utf-8');
const ext = extname(filePath).toLowerCase();
let data: Record<string, string>[];

if (ext === '.json') {
  const parsed = JSON.parse(content);
  data = Array.isArray(parsed) ? parsed : [parsed];
} else {
  data = parseCSV(content);
}

const columns = Object.keys(data[0] || {});
const stats: Record<string, any> = {};

for (const col of columns) {
  const values = data.map(row => row[col]).filter(v => v !== '' && v !== null && v !== undefined);
  const numValues = values.map(Number).filter(n => !isNaN(n));

  stats[col] = {
    total: data.length,
    nonNull: values.length,
    missing: data.length - values.length,
    missingPct: ((data.length - values.length) / data.length * 100).toFixed(1) + '%',
    unique: new Set(values).size,
  };

  if (numValues.length > 0) {
    numValues.sort((a, b) => a - b);
    stats[col].type = 'numeric';
    stats[col].min = Math.min(...numValues);
    stats[col].max = Math.max(...numValues);
    stats[col].mean = +(numValues.reduce((s, n) => s + n, 0) / numValues.length).toFixed(2);
    stats[col].median = numValues.length % 2 === 0
      ? +((numValues[numValues.length / 2 - 1] + numValues[numValues.length / 2]) / 2).toFixed(2)
      : numValues[Math.floor(numValues.length / 2)];
  } else {
    stats[col].type = 'string';
    stats[col].sample = values.slice(0, 3);
  }
}

console.log(JSON.stringify({
  rows: data.length,
  columns: columns.length,
  columnNames: columns,
  stats,
  sample: data.slice(0, 5),
}, null, 2));
`);
  return files;
}
function generateApiTesterSkill() {
  const files = /* @__PURE__ */ new Map();
  files.set("SKILL.md", `---
name: api-tester
description: Test REST APIs with structured request/response validation
version: 1.0.0
tags:
  - api
  - testing
  - http
  - rest
---

# API Tester

You are an API testing assistant. Help users test and validate REST API endpoints.

## Capabilities

1. **Send Requests** \u2014 GET, POST, PUT, PATCH, DELETE with headers and body
2. **Validate Responses** \u2014 Check status codes, response structure, and timing
3. **Chain Requests** \u2014 Use output from one request as input to another
4. **Generate Reports** \u2014 Summarize test results with pass/fail status

## How to Test

Use \`scripts/request.ts\` to make HTTP requests:

\`\`\`bash
npx tsx scripts/request.ts GET https://api.example.com/users
npx tsx scripts/request.ts POST https://api.example.com/users --body '{"name":"test"}'
\`\`\`

## Report Format

For each API test, report:
- **Endpoint**: METHOD URL
- **Status**: HTTP status code (with pass/fail indicator)
- **Response Time**: Duration in milliseconds
- **Response Body**: Formatted JSON (truncated if large)
- **Headers**: Key response headers

## Guidelines

- Always show the full request details (method, URL, headers, body)
- Time every request and flag slow responses (>2s)
- Validate JSON response structure when a schema is provided
- Never send real credentials \u2014 use placeholders and warn the user
- Group related tests together (e.g., CRUD operations on one resource)
`);
  files.set("scripts/request.ts", `#!/usr/bin/env npx tsx
/**
 * HTTP Request Script \u2014 Make API requests from the command line
 *
 * Usage: npx tsx scripts/request.ts <METHOD> <URL> [--header "Key: Value"] [--body '{"key":"value"}']
 */

const args = process.argv.slice(2);
const method = args[0]?.toUpperCase() || 'GET';
const url = args[1];

if (!url) {
  console.error('Usage: npx tsx scripts/request.ts <METHOD> <URL> [--header "K: V"] [--body JSON]');
  process.exit(1);
}

const headers: Record<string, string> = { 'Content-Type': 'application/json' };
let body: string | undefined;

for (let i = 2; i < args.length; i++) {
  if (args[i] === '--header' && args[i + 1]) {
    const [key, ...valueParts] = args[++i].split(':');
    headers[key.trim()] = valueParts.join(':').trim();
  }
  if (args[i] === '--body' && args[i + 1]) {
    body = args[++i];
  }
}

async function makeRequest() {
  const start = Date.now();
  const res = await fetch(url, {
    method,
    headers,
    ...(body && method !== 'GET' ? { body } : {}),
  });
  const elapsed = Date.now() - start;
  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => { responseHeaders[k] = v; });

  let responseBody: any;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('json')) {
    responseBody = await res.json();
  } else {
    responseBody = await res.text();
  }

  console.log(JSON.stringify({
    request: { method, url, headers, body: body ? JSON.parse(body) : undefined },
    response: {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
      body: responseBody,
      timeMs: elapsed,
    },
  }, null, 2));
}

makeRequest().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
`);
  return files;
}
function generateGitWorkflowSkill() {
  const files = /* @__PURE__ */ new Map();
  files.set("SKILL.md", `---
name: git-workflow
description: Git workflow automation including conventional commits, branch management, and changelog generation
version: 1.0.0
tags:
  - git
  - workflow
  - development
---

# Git Workflow

You are a Git workflow assistant. Help users follow best practices for version control.

## Capabilities

1. **Conventional Commits** \u2014 Generate commit messages following the Conventional Commits spec
2. **Branch Management** \u2014 Create, switch, and clean up branches following naming conventions
3. **PR Descriptions** \u2014 Generate pull request descriptions from commit history
4. **Changelog** \u2014 Generate changelogs from commit history

## Conventional Commit Format

\`\`\`
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
\`\`\`

### Types
- \`feat\`: New feature (MINOR version bump)
- \`fix\`: Bug fix (PATCH version bump)
- \`docs\`: Documentation changes
- \`style\`: Code style changes (formatting, semicolons)
- \`refactor\`: Code refactoring (no feature/fix)
- \`perf\`: Performance improvements
- \`test\`: Adding or updating tests
- \`chore\`: Build process, tooling, dependencies

## Branch Naming

- \`feat/<ticket>-<description>\` \u2014 New features
- \`fix/<ticket>-<description>\` \u2014 Bug fixes
- \`chore/<description>\` \u2014 Maintenance tasks
- \`release/<version>\` \u2014 Release branches

## Scripts

- \`scripts/changelog.ts\` \u2014 Generate changelog from git log

## Guidelines

- One logical change per commit
- Write commit messages in imperative mood ("Add feature" not "Added feature")
- Reference issue/ticket numbers in commits
- Keep PR descriptions focused on the "what" and "why"
- Squash fix-up commits before merging
`);
  files.set("references/commit-examples.md", `# Commit Message Examples

## Good Examples
\`\`\`
feat(auth): add OAuth2 login with Google provider
fix(api): handle null response from payment gateway
docs(readme): add deployment instructions for Cloudflare
refactor(db): extract query builder into separate module
perf(search): add index on user_email column
test(auth): add integration tests for JWT refresh flow
chore(deps): upgrade @mastra/core to 1.4.0
\`\`\`

## Bad Examples
\`\`\`
fixed stuff
update
WIP
asdf
changes
\`\`\`
`);
  files.set("scripts/changelog.ts", `#!/usr/bin/env npx tsx
/**
 * Changelog Generator \u2014 Generate changelog from git log
 *
 * Usage: npx tsx scripts/changelog.ts [--since v1.0.0] [--until HEAD]
 */

import { execSync } from 'child_process';

const args = process.argv.slice(2);
let since = '';
let until = 'HEAD';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--since' && args[i + 1]) since = args[++i];
  if (args[i] === '--until' && args[i + 1]) until = args[++i];
}

const range = since ? \`\${since}..\${until}\` : until;
const log = execSync(\`git log \${range} --pretty=format:"%H|%s|%an|%ai" 2>/dev/null || echo ""\`, { encoding: 'utf-8' });

interface Commit {
  hash: string;
  message: string;
  author: string;
  date: string;
  type: string;
  scope: string;
  description: string;
}

const commits: Commit[] = log.trim().split('\\n').filter(Boolean).map(line => {
  const [hash, message, author, date] = line.split('|');
  const match = message.match(/^(\\w+)(?:\\(([^)]+)\\))?:\\s*(.+)$/);
  return {
    hash: hash.slice(0, 7),
    message,
    author,
    date: date.split(' ')[0],
    type: match?.[1] || 'other',
    scope: match?.[2] || '',
    description: match?.[3] || message,
  };
});

const grouped: Record<string, Commit[]> = {};
for (const c of commits) {
  if (!grouped[c.type]) grouped[c.type] = [];
  grouped[c.type].push(c);
}

const typeLabels: Record<string, string> = {
  feat: 'Features',
  fix: 'Bug Fixes',
  docs: 'Documentation',
  refactor: 'Refactoring',
  perf: 'Performance',
  test: 'Tests',
  chore: 'Chores',
};

let changelog = '# Changelog\\n\\n';
for (const [type, label] of Object.entries(typeLabels)) {
  if (grouped[type]?.length) {
    changelog += \`## \${label}\\n\\n\`;
    for (const c of grouped[type]) {
      const scope = c.scope ? \`**\${c.scope}**: \` : '';
      changelog += \`- \${scope}\${c.description} (\${c.hash})\\n\`;
    }
    changelog += '\\n';
  }
}

console.log(JSON.stringify({ changelog, totalCommits: commits.length, types: Object.keys(grouped) }));
`);
  return files;
}
function generateBrowserAutomationSkill() {
  const files = /* @__PURE__ */ new Map();
  files.set("SKILL.md", `---
name: browser-automation
description: Browser automation using Playwright. Navigate web pages, interact with elements, extract content, take screenshots, and run JavaScript.
version: 1.0.0
tags:
  - web
  - browser
  - automation
  - scraping
---

# Browser Automation

You are a browser automation assistant. Help users interact with web pages programmatically.

## Capabilities

1. **Navigate** \u2014 Go to any URL and wait for the page to load
2. **Click** \u2014 Click elements by CSS selector
3. **Type** \u2014 Fill text into input fields
4. **Screenshot** \u2014 Capture the current page as an image
5. **Extract Text** \u2014 Get readable text content from pages or specific elements
6. **Snapshot** \u2014 Get the accessibility tree for understanding page structure
7. **Evaluate** \u2014 Run arbitrary JavaScript on the page
8. **Wait** \u2014 Wait for elements to appear or for a specific duration
9. **Scroll** \u2014 Scroll the page up or down
10. **Select** \u2014 Choose options from dropdown menus
11. **Hover** \u2014 Hover over elements to trigger menus or tooltips
12. **Navigation** \u2014 Go back, forward, or reload the page

## How to Use

### Setup

\`\`\`typescript
import { createBrowserTool, MCPServer } from '@agentforge-ai/core';

const server = new MCPServer({ name: 'my-tools' });
const { tool, shutdown } = createBrowserTool({ headless: true });
server.registerTool(tool);
\`\`\`

### Docker Sandbox Mode

For secure, isolated execution:

\`\`\`typescript
const { tool, shutdown } = createBrowserTool({
  sandboxMode: true,
  headless: true,
});
\`\`\`

## Agent Instructions

1. Navigate to the target URL first
2. Wait for key elements before interacting
3. Use snapshot to understand page structure
4. Use extractText to get readable content
5. Use click and type for form interactions
6. Take screenshots for visual verification
7. Always close sessions when done

## Guidelines

- Prefer \`#id\` selectors over class-based selectors
- Use \`wait\` before clicking or typing on dynamic pages
- Use \`extractText\` with a selector for specific content
- Take screenshots before and after critical actions
- Close sessions to free resources
`);
  files.set("references/selectors.md", `# CSS Selector Guide for Browser Automation

## Recommended Selectors (most to least reliable)

1. \`#id\` \u2014 Element with a specific ID
2. \`[data-testid="value"]\` \u2014 Test ID attributes
3. \`[aria-label="value"]\` \u2014 Accessibility labels
4. \`button:has-text("Click me")\` \u2014 Playwright text selectors
5. \`.class-name\` \u2014 CSS class selectors
6. \`tag.class\` \u2014 Tag + class combination

## Examples

\`\`\`
#login-button           \u2192 Click the login button
input[name="email"]      \u2192 Type into email field
.nav-menu a:first-child \u2192 Click first nav link
form button[type=submit] \u2192 Submit a form
\`\`\`

## Tips

- Avoid fragile selectors like \`div > div > span:nth-child(3)\`
- Use Playwright's text selectors: \`text=Submit\`
- For dynamic content, wait for the element first
- Use \`snapshot\` action to discover available selectors
`);
  files.set("scripts/scrape.ts", `#!/usr/bin/env npx tsx
/**
 * Example: Scrape a web page and extract its text content
 *
 * Usage: npx tsx scripts/scrape.ts <url>
 */

const url = process.argv[2];
if (!url) {
  console.error('Usage: npx tsx scripts/scrape.ts <url>');
  process.exit(1);
}

console.log(JSON.stringify({
  instruction: 'Use the browser tool to scrape this URL',
  url,
  steps: [
    { action: 'navigate', url },
    { action: 'wait', timeMs: 2000 },
    { action: 'extractText' },
    { action: 'screenshot', fullPage: true },
    { action: 'close' },
  ],
}));
`);
  return files;
}
function registerSkillsCommand(program2) {
  const skills = program2.command("skills").description("Manage agent skills (Mastra Workspace Skills)");
  skills.command("list").option("--json", "Output as JSON").option("--registry", "Show available skills from the registry").description("List installed skills or browse the registry").action(async (opts) => {
    if (opts.registry) {
      header("AgentForge Skills Registry");
      if (opts.json) {
        console.log(JSON.stringify(BUILTIN_REGISTRY, null, 2));
        return;
      }
      table(BUILTIN_REGISTRY.map((s) => ({
        Name: s.name,
        Description: truncate(s.description, 60),
        Version: s.version,
        Tags: s.tags.join(", ")
      })));
      info(`Install with: ${colors.cyan}agentforge skills install <name>${colors.reset}`);
      return;
    }
    const skillsDir = resolveSkillsDir();
    header("Installed Skills");
    if (!fs4.existsSync(skillsDir)) {
      info("No skills directory found. Install a skill with:");
      dim(`  agentforge skills install <name>`);
      dim(`  agentforge skills list --registry   # browse available skills`);
      return;
    }
    const dirs = fs4.readdirSync(skillsDir).filter((d) => {
      const fullPath = path5.join(skillsDir, d);
      return fs4.statSync(fullPath).isDirectory() && fs4.existsSync(path5.join(fullPath, "SKILL.md"));
    });
    if (dirs.length === 0) {
      info("No skills installed. Browse available skills with:");
      dim(`  agentforge skills list --registry`);
      return;
    }
    const lock = readSkillsLock(skillsDir);
    const skillData = dirs.map((d) => {
      const meta = readSkillMetadata(path5.join(skillsDir, d));
      const lockEntry = lock.skills[d];
      return {
        Name: meta?.name || d,
        Description: truncate(meta?.description || "", 50),
        Version: meta?.version || "?",
        Tags: (meta?.tags || []).join(", "),
        Source: lockEntry?.source || "local",
        Installed: lockEntry?.installedAt ? new Date(lockEntry.installedAt).toLocaleDateString() : "\u2014"
      };
    });
    if (opts.json) {
      console.log(JSON.stringify(skillData, null, 2));
      return;
    }
    table(skillData);
    dim(`  Skills directory: ${skillsDir}`);
    info("Skills are auto-discovered by the Mastra Workspace.");
  });
  skills.command("install").argument("<name>", "Skill name from registry, GitHub URL, or local path").option("--from <source>", "Source: registry (default), github, local", "registry").description("Install a skill into the workspace").action(async (name, opts) => {
    const skillsDir = resolveSkillsDir();
    const targetDir = path5.join(skillsDir, name.split("/").pop().replace(/\.git$/, ""));
    if (fs4.existsSync(targetDir) && fs4.existsSync(path5.join(targetDir, "SKILL.md"))) {
      warn(`Skill "${name}" is already installed at ${targetDir}`);
      const overwrite = await prompt2("Overwrite? (y/N): ");
      if (overwrite.toLowerCase() !== "y") {
        info("Installation cancelled.");
        return;
      }
      fs4.removeSync(targetDir);
    }
    fs4.mkdirSync(skillsDir, { recursive: true });
    let source = opts.from;
    let installedName = name;
    if (opts.from === "local" || fs4.existsSync(name)) {
      source = "local";
      const sourcePath = path5.resolve(name);
      if (!fs4.existsSync(sourcePath)) {
        error(`Local path not found: ${sourcePath}`);
        process.exit(1);
      }
      if (!fs4.existsSync(path5.join(sourcePath, "SKILL.md"))) {
        error(`No SKILL.md found in ${sourcePath}. Not a valid skill directory.`);
        process.exit(1);
      }
      installedName = path5.basename(sourcePath);
      const dest = path5.join(skillsDir, installedName);
      fs4.copySync(sourcePath, dest);
      success(`Skill "${installedName}" installed from local path.`);
    } else if (opts.from === "github" || name.includes("github.com") || name.includes("/")) {
      source = "github";
      const repoUrl = name.includes("github.com") ? name : `https://github.com/${name}`;
      installedName = name.split("/").pop().replace(/\.git$/, "");
      const dest = path5.join(skillsDir, installedName);
      info(`Cloning skill from ${repoUrl}...`);
      try {
        execSync2(`git clone --depth 1 ${repoUrl} ${dest} 2>&1`, { encoding: "utf-8" });
        fs4.removeSync(path5.join(dest, ".git"));
        if (!fs4.existsSync(path5.join(dest, "SKILL.md"))) {
          error(`Cloned repo does not contain a SKILL.md. Not a valid skill.`);
          fs4.removeSync(dest);
          process.exit(1);
        }
        success(`Skill "${installedName}" installed from GitHub.`);
      } catch (err) {
        error(`Failed to clone: ${err.message}`);
        process.exit(1);
      }
    } else {
      source = "builtin";
      const entry = findInRegistry(name);
      if (!entry) {
        error(`Skill "${name}" not found in the registry.`);
        info("Available skills:");
        BUILTIN_REGISTRY.forEach((s) => {
          dim(`  ${colors.cyan}${s.name}${colors.reset} \u2014 ${s.description}`);
        });
        info(`
Or install from GitHub: ${colors.cyan}agentforge skills install owner/repo --from github${colors.reset}`);
        process.exit(1);
      }
      installedName = entry.name;
      const files = generateBuiltinSkill(entry.name);
      if (!files) {
        error(`No content generator for skill "${entry.name}".`);
        process.exit(1);
      }
      const dest = path5.join(skillsDir, installedName);
      fs4.mkdirSync(dest, { recursive: true });
      for (const [filePath, content] of files) {
        const fullPath = path5.join(dest, filePath);
        fs4.mkdirSync(path5.dirname(fullPath), { recursive: true });
        fs4.writeFileSync(fullPath, content);
      }
      success(`Skill "${installedName}" installed from AgentForge registry.`);
    }
    const lock = readSkillsLock(skillsDir);
    const meta = readSkillMetadata(path5.join(skillsDir, installedName));
    lock.skills[installedName] = {
      name: installedName,
      version: meta?.version || "1.0.0",
      source,
      installedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    writeSkillsLock(skillsDir, lock);
    if (meta) {
      console.log();
      details({
        Name: meta.name,
        Description: meta.description,
        Version: meta.version,
        Tags: (meta.tags || []).join(", ") || "\u2014",
        Path: path5.join(skillsDir, installedName)
      });
    }
    info("The skill is now available to agents via the Mastra Workspace.");
    dim("  Skills in the workspace/skills/ directory are auto-discovered.");
    try {
      const client = await createClient();
      await safeCall(
        () => client.mutation("skills:create", {
          name: installedName,
          displayName: meta?.name || installedName,
          description: meta?.description || "",
          category: (meta?.tags || [])[0] || "custom",
          version: meta?.version || "1.0.0",
          author: meta?.author || "Unknown",
          code: `// Skill: ${installedName}
// This skill uses the Agent Skills Specification (SKILL.md format)
// See: workspace/skills/${installedName}/SKILL.md`
        }),
        "Failed to sync skill to Convex"
      );
      dim("  Skill synced to Convex database.");
    } catch {
      dim("  Convex not connected \u2014 skill installed locally only.");
    }
  });
  skills.command("remove").argument("<name>", "Skill name to remove").option("--force", "Skip confirmation prompt", false).description("Remove an installed skill").action(async (name, opts) => {
    const skillsDir = resolveSkillsDir();
    const skillDir = path5.join(skillsDir, name);
    if (!fs4.existsSync(skillDir)) {
      error(`Skill "${name}" not found in ${skillsDir}`);
      info("List installed skills with: agentforge skills list");
      process.exit(1);
    }
    if (!opts.force) {
      const confirm = await prompt2(`Remove skill "${name}" and delete all files? (y/N): `);
      if (confirm.toLowerCase() !== "y") {
        info("Removal cancelled.");
        return;
      }
    }
    fs4.removeSync(skillDir);
    success(`Skill "${name}" removed from disk.`);
    const lock = readSkillsLock(skillsDir);
    delete lock.skills[name];
    writeSkillsLock(skillsDir, lock);
    try {
      const client = await createClient();
      const skills2 = await client.query("skills:list", {});
      const skill = skills2.find((s) => s.name === name);
      if (skill) {
        await client.mutation("skills:remove", { id: skill._id });
        dim("  Skill removed from Convex database.");
      }
    } catch {
    }
    info("Skill removed. Agents will no longer discover it.");
  });
  skills.command("search").argument("<query>", "Search query").description("Search for skills in the registry").action(async (query) => {
    header("Skill Search Results");
    const q = query.toLowerCase();
    const matches = BUILTIN_REGISTRY.filter(
      (e) => e.name.includes(q) || e.description.toLowerCase().includes(q) || e.tags.some((t) => t.includes(q))
    );
    if (matches.length === 0) {
      info(`No skills matching "${query}".`);
      info("Browse all skills: agentforge skills list --registry");
      return;
    }
    table(matches.map((e) => ({
      Name: e.name,
      Description: truncate(e.description, 60),
      Tags: e.tags.join(", "),
      Version: e.version
    })));
    info(`Install with: ${colors.cyan}agentforge skills install <name>${colors.reset}`);
  });
  skills.command("create").description("Create a new skill (interactive)").option("--name <name>", "Skill name (kebab-case)").option("--description <desc>", "Skill description").option("--tags <tags>", "Comma-separated tags").action(async (opts) => {
    const name = opts.name || await prompt2("Skill name (kebab-case): ");
    const description = opts.description || await prompt2("Description: ");
    const tagsInput = opts.tags || await prompt2("Tags (comma-separated, e.g. web,search): ");
    const tags = tagsInput ? tagsInput.split(",").map((t) => t.trim()).filter(Boolean) : [];
    if (!name) {
      error("Skill name is required.");
      process.exit(1);
    }
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      error("Skill name must be kebab-case (lowercase letters, numbers, hyphens).");
      process.exit(1);
    }
    const skillsDir = resolveSkillsDir();
    const skillDir = path5.join(skillsDir, name);
    if (fs4.existsSync(skillDir)) {
      error(`Skill "${name}" already exists at ${skillDir}`);
      process.exit(1);
    }
    fs4.mkdirSync(path5.join(skillDir, "references"), { recursive: true });
    fs4.mkdirSync(path5.join(skillDir, "scripts"), { recursive: true });
    fs4.mkdirSync(path5.join(skillDir, "assets"), { recursive: true });
    const tagsYaml = tags.length > 0 ? `tags:
${tags.map((t) => `  - ${t}`).join("\n")}` : "tags: []";
    fs4.writeFileSync(path5.join(skillDir, "SKILL.md"), `---
name: ${name}
description: ${description}
version: 1.0.0
${tagsYaml}
---

# ${name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}

${description}

## Instructions

<!-- Add instructions for how the agent should use this skill -->

1. Step one
2. Step two
3. Step three

## References

See \`references/\` for supporting documentation.

## Scripts

See \`scripts/\` for executable scripts the agent can run.

## Guidelines

- Guideline one
- Guideline two
`);
    fs4.writeFileSync(
      path5.join(skillDir, "references", "README.md"),
      `# References for ${name}

Add supporting documentation here.
`
    );
    fs4.writeFileSync(
      path5.join(skillDir, "scripts", "example.ts"),
      `#!/usr/bin/env npx tsx
/**
 * Example script for ${name}
 */
console.log('Hello from ${name}!');
`
    );
    const lock = readSkillsLock(skillsDir);
    lock.skills[name] = {
      name,
      version: "1.0.0",
      source: "local",
      installedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    writeSkillsLock(skillsDir, lock);
    success(`Skill "${name}" created at ${skillDir}/`);
    info("Files created:");
    dim(`  ${skillDir}/SKILL.md`);
    dim(`  ${skillDir}/references/README.md`);
    dim(`  ${skillDir}/scripts/example.ts`);
    dim(`  ${skillDir}/assets/`);
    console.log();
    info(`Edit ${colors.cyan}SKILL.md${colors.reset} to add instructions for your agent.`);
    info("The skill will be auto-discovered by the Mastra Workspace.");
  });
  skills.command("show <name>").description("Show full SKILL.md content for installed skill").action(async (name) => {
    const skillsDir = resolveSkillsDir();
    const skillDir = path5.join(skillsDir, name);
    const skillMdPath = path5.join(skillDir, "SKILL.md");
    if (!fs4.existsSync(skillMdPath)) {
      error(`Skill "${name}" not found or SKILL.md missing.`);
      info("Install a skill first: agentforge skills install <name>");
      process.exit(1);
    }
    const content = fs4.readFileSync(skillMdPath, "utf-8");
    header(`SKILL.md: ${name}`);
    console.log(content);
  });
  skills.command("refs <name>").description("List reference files for a skill").action(async (name) => {
    const skillsDir = resolveSkillsDir();
    const skillDir = path5.join(skillsDir, name);
    const refsDir = path5.join(skillDir, "references");
    if (!fs4.existsSync(skillDir)) {
      error(`Skill "${name}" not found.`);
      process.exit(1);
    }
    if (!fs4.existsSync(refsDir)) {
      warn(`No references/ directory for skill "${name}".`);
      dim(`Path: ${refsDir}`);
      return;
    }
    header(`References: ${name}`);
    dim(`Path: ${refsDir}`);
    console.log();
    const files = fs4.readdirSync(refsDir);
    if (files.length === 0) {
      info("References directory is empty.");
      return;
    }
    for (const file of files) {
      const filePath = path5.join(refsDir, file);
      const stat2 = fs4.statSync(filePath);
      if (stat2.isFile()) {
        const content = fs4.readFileSync(filePath, "utf-8");
        console.log(`${colors.cyan}\u{1F4C4} ${file}${colors.reset}`);
        console.log("\u2500".repeat(60));
        dim(content.trim().split("\n").slice(0, 20).map((l) => `  ${l}`).join("\n"));
        if (content.trim().split("\n").length > 20) {
          dim("  ...");
        }
        console.log();
      }
    }
  });
  skills.command("info").argument("<name>", "Skill name").description("Show detailed information about a skill").action(async (name) => {
    const skillsDir = resolveSkillsDir();
    const skillDir = path5.join(skillsDir, name);
    if (fs4.existsSync(skillDir) && fs4.existsSync(path5.join(skillDir, "SKILL.md"))) {
      const meta = readSkillMetadata(skillDir);
      const lock = readSkillsLock(skillsDir);
      const lockEntry = lock.skills[name];
      header(`Skill: ${meta?.name || name}`);
      details({
        Name: meta?.name || name,
        Description: meta?.description || "\u2014",
        Version: meta?.version || "\u2014",
        Tags: (meta?.tags || []).join(", ") || "\u2014",
        Author: meta?.author || "\u2014",
        Source: lockEntry?.source || "local",
        "Installed At": lockEntry?.installedAt || "\u2014",
        Path: skillDir
      });
      dim("  Files:");
      const listFiles = (dir, prefix = "") => {
        const entries = fs4.readdirSync(dir);
        for (const entry2 of entries) {
          const fullPath = path5.join(dir, entry2);
          const stat2 = fs4.statSync(fullPath);
          if (stat2.isDirectory()) {
            dim(`  ${prefix}${entry2}/`);
            listFiles(fullPath, prefix + "  ");
          } else {
            dim(`  ${prefix}${entry2}`);
          }
        }
      };
      listFiles(skillDir, "  ");
      console.log();
      const content = fs4.readFileSync(path5.join(skillDir, "SKILL.md"), "utf-8");
      const { content: body } = parseSkillMd(content);
      info("Instructions preview:");
      dim(body.trim().split("\n").slice(0, 10).map((l) => `  ${l}`).join("\n"));
      if (body.trim().split("\n").length > 10) {
        dim("  ...");
      }
      return;
    }
    const entry = findInRegistry(name);
    if (entry) {
      header(`Registry Skill: ${entry.name}`);
      details({
        Name: entry.name,
        Description: entry.description,
        Version: entry.version,
        Tags: entry.tags.join(", "),
        Author: entry.author,
        Source: entry.source,
        Status: "Not installed"
      });
      info(`Install with: ${colors.cyan}agentforge skills install ${entry.name}${colors.reset}`);
      return;
    }
    error(`Skill "${name}" not found (installed or in registry).`);
  });
  skills.command("bundled").description("List bundled skills (lightweight built-in capabilities)").action(async () => {
    const { BUNDLED_SKILLS } = await import("@agentforge-ai/core");
    header("Bundled Skills");
    table(
      BUNDLED_SKILLS.map((s) => ({
        Name: s.name,
        Description: truncate(s.description, 60),
        Category: s.category
      }))
    );
    info(`Run a bundled skill: ${colors.cyan}agentforge skills run <name> --args '{"key":"value"}'${colors.reset}`);
  });
  skills.command("run").argument("<name>", "Bundled skill name (e.g., calculator, datetime, web-search)").option("--args <json>", "Arguments as JSON string").description("Run a bundled skill directly from the CLI").action(async (name, opts) => {
    const { bundledSkillRegistry } = await import("@agentforge-ai/core");
    if (!bundledSkillRegistry.has(name)) {
      error(`Bundled skill "${name}" not found.`);
      info("Available bundled skills:");
      const skills2 = bundledSkillRegistry.list();
      for (const s of skills2) {
        dim(`  - ${s.name}: ${s.description}`);
      }
      process.exit(1);
    }
    let args = {};
    if (opts.args) {
      try {
        args = JSON.parse(opts.args);
      } catch {
        error("Invalid JSON in --args");
        process.exit(1);
      }
    }
    header(`Running bundled skill: ${name}`);
    info("Arguments:");
    if (Object.keys(args).length > 0) {
      for (const [key, value] of Object.entries(args)) {
        dim(`  ${key}: ${JSON.stringify(value)}`);
      }
    } else {
      dim("  (no arguments)");
    }
    console.log();
    const startTime = Date.now();
    try {
      const result = await bundledSkillRegistry.execute(name, args);
      const elapsed = Date.now() - startTime;
      success("Result:");
      console.log(result);
      console.log();
      dim(`Completed in ${elapsed}ms`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      error(`Skill execution failed: ${errMsg}`);
      process.exit(1);
    }
  });
  program2.command("install").argument("<name>", "Skill name to install").option("--from <source>", "Source: registry (default), github, local", "registry").description("Install a skill (alias for: agentforge skills install)").action(async (name, opts) => {
    const skillsCmd = skills.commands.find((c) => c.name() === "install");
    if (skillsCmd) {
      await skillsCmd.parseAsync([name, ...opts.from !== "registry" ? ["--from", opts.from] : []], { from: "user" });
    }
  });
}

// src/commands/skill.ts
import fs5 from "fs-extra";
import path6 from "path";
import os2 from "os";
import { execFileSync } from "child_process";
function getGlobalSkillsDir() {
  return path6.join(os2.homedir(), ".agentforge", "skills");
}
function parseSkillMd2(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    return { name: "", description: "", version: "1.0.0" };
  }
  const frontmatter = fmMatch[1];
  const data = {};
  for (const line of frontmatter.split("\n")) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      data[match[1]] = match[2].trim();
    }
  }
  return {
    name: data["name"] || "",
    description: data["description"] || "",
    version: data["version"] || "1.0.0"
  };
}
async function installSkillFromPath(sourcePath, skillsDir) {
  if (!await fs5.pathExists(sourcePath)) {
    throw new Error(`Source path not found: ${sourcePath}`);
  }
  const skillMdPath = path6.join(sourcePath, "SKILL.md");
  if (!await fs5.pathExists(skillMdPath)) {
    throw new Error(`No SKILL.md found in ${sourcePath}. Not a valid skill directory.`);
  }
  const skillName = path6.basename(sourcePath);
  const destPath = path6.join(skillsDir, skillName);
  await fs5.mkdirp(skillsDir);
  await fs5.copy(sourcePath, destPath, { overwrite: true });
  return destPath;
}
async function listInstalledSkills(skillsDir) {
  if (!await fs5.pathExists(skillsDir)) {
    return [];
  }
  const entries = await fs5.readdir(skillsDir);
  const skills = [];
  for (const entry of entries) {
    const entryPath = path6.join(skillsDir, entry);
    const stat2 = await fs5.stat(entryPath);
    if (!stat2.isDirectory()) continue;
    const skillMdPath = path6.join(entryPath, "SKILL.md");
    if (!await fs5.pathExists(skillMdPath)) continue;
    const content = await fs5.readFile(skillMdPath, "utf-8");
    const meta = parseSkillMd2(content);
    skills.push({
      name: meta.name || entry,
      version: meta.version,
      description: meta.description
    });
  }
  return skills;
}
async function removeSkill(name, skillsDir) {
  const skillDir = path6.join(skillsDir, name);
  if (!await fs5.pathExists(skillDir)) {
    throw new Error(`Skill "${name}" not found in ${skillsDir}`);
  }
  await fs5.remove(skillDir);
}
function getGitHubUrl(nameOrUrl) {
  if (nameOrUrl.startsWith("https://") || nameOrUrl.startsWith("http://")) {
    return nameOrUrl;
  }
  return `https://github.com/${nameOrUrl}`;
}
function getConvexUrl2() {
  return process.env["CONVEX_URL"] || process.env["NEXT_PUBLIC_CONVEX_URL"];
}
function registerSkillCommand(program2) {
  const skillCmd = program2.command("skill").description("Manage global skills installed in ~/.agentforge/skills/");
  skillCmd.command("install").argument("<name>", "Local path or GitHub owner/repo to install from").description("Install a skill to ~/.agentforge/skills/").action(async (name) => {
    const skillsDir = getGlobalSkillsDir();
    const isLocalPath = await fs5.pathExists(name);
    if (isLocalPath) {
      const sourcePath = path6.resolve(name);
      try {
        const installedPath = await installSkillFromPath(sourcePath, skillsDir);
        const skillName = path6.basename(installedPath);
        success(`Skill "${skillName}" installed from local path.`);
        info(`Location: ${installedPath}`);
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    } else {
      const repoUrl = getGitHubUrl(name);
      const repoName = name.split("/").pop().replace(/\.git$/, "");
      const destPath = path6.join(skillsDir, repoName);
      await fs5.mkdirp(skillsDir);
      info(`Cloning skill from ${repoUrl}...`);
      try {
        execFileSync("git", ["clone", "--depth", "1", repoUrl, destPath], {
          encoding: "utf-8",
          stdio: "pipe"
        });
        await fs5.remove(path6.join(destPath, ".git"));
        const skillMdPath = path6.join(destPath, "SKILL.md");
        if (!await fs5.pathExists(skillMdPath)) {
          error("Cloned repo does not contain a SKILL.md. Not a valid skill.");
          await fs5.remove(destPath);
          process.exit(1);
        }
        success(`Skill "${repoName}" installed from GitHub.`);
        info(`Location: ${destPath}`);
      } catch (err) {
        error(`Failed to clone: ${err.message}`);
        process.exit(1);
      }
    }
  });
  skillCmd.command("list").description("List skills installed in ~/.agentforge/skills/").option("--json", "Output as JSON").action(async (opts) => {
    const skillsDir = getGlobalSkillsDir();
    header("Global Skills");
    let skills;
    try {
      skills = await listInstalledSkills(skillsDir);
    } catch {
      skills = [];
    }
    if (skills.length === 0) {
      info("No global skills installed.");
      dim(
        `  Install a skill with: ${colors.cyan}agentforge skill install <path-or-owner/repo>${colors.reset}`
      );
      return;
    }
    if (opts.json) {
      console.log(JSON.stringify(skills, null, 2));
      return;
    }
    table(
      skills.map((s) => ({
        Name: s.name,
        Version: s.version,
        Description: truncate(s.description, 60)
      }))
    );
    dim(`  Skills directory: ${skillsDir}`);
  });
  skillCmd.command("remove").argument("<name>", "Skill name to remove").description("Remove a skill from ~/.agentforge/skills/").action(async (name) => {
    const skillsDir = getGlobalSkillsDir();
    try {
      await removeSkill(name, skillsDir);
      success(`Skill "${name}" removed.`);
    } catch (err) {
      error(err.message);
      info("List installed skills with: agentforge skill list");
      process.exit(1);
    }
  });
  skillCmd.command("search <query>").description("Search the skill marketplace").option("-c, --category <category>", "Filter by category").action(async (query, options) => {
    const { searchSkills: searchMarketplace } = await import("@agentforge-ai/core");
    const convexUrl = getConvexUrl2();
    if (!convexUrl) {
      error("No CONVEX_URL configured. Set CONVEX_URL environment variable.");
      return;
    }
    try {
      info(`Searching marketplace for "${query}"...`);
      const skills = await searchMarketplace(query, convexUrl, options.category);
      if (skills.length === 0) {
        info("No skills found matching your query.");
        return;
      }
      header(`Found ${skills.length} skill(s)`);
      table(
        skills.map((s) => ({
          Name: s.name,
          Version: s.version,
          Category: s.category,
          Downloads: s.downloads.toString(),
          Description: truncate(s.description, 50)
        }))
      );
    } catch (err) {
      error(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  skillCmd.command("publish").description("Publish a skill to the marketplace").option("-d, --dir <directory>", "Skill directory (default: current directory)", ".").action(async (options) => {
    const fsExtra = await import("fs-extra");
    const pathMod = await import("path");
    const { parseSkillManifest, publishSkill: publishToMarketplace } = await import("@agentforge-ai/core");
    const convexUrl = getConvexUrl2();
    if (!convexUrl) {
      error("No CONVEX_URL configured. Set CONVEX_URL environment variable.");
      return;
    }
    const skillDir = pathMod.resolve(options.dir);
    const skillMdPath = pathMod.join(skillDir, "SKILL.md");
    if (!await fsExtra.pathExists(skillMdPath)) {
      error("No SKILL.md found in the specified directory.");
      return;
    }
    try {
      const skillMdContent = await fsExtra.readFile(skillMdPath, "utf-8");
      const manifest = parseSkillManifest(skillMdContent);
      let readmeContent;
      const readmePath = pathMod.join(skillDir, "README.md");
      if (await fsExtra.pathExists(readmePath)) {
        readmeContent = await fsExtra.readFile(readmePath, "utf-8");
      }
      const meta = manifest.metadata ?? {};
      info(`Publishing "${manifest.name}" v${manifest.version}...`);
      await publishToMarketplace(
        {
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          author: meta.author ?? "unknown",
          category: meta["category"] ?? "general",
          tags: meta.tags ?? [],
          skillMdContent,
          readmeContent,
          repositoryUrl: meta.repository
        },
        convexUrl
      );
      success(`Skill "${manifest.name}" published successfully!`);
    } catch (err) {
      error(`Publish failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  skillCmd.command("featured").description("Show featured skills from the marketplace").action(async () => {
    const { fetchFeaturedSkills } = await import("@agentforge-ai/core");
    const convexUrl = getConvexUrl2();
    if (!convexUrl) {
      error("No CONVEX_URL configured. Set CONVEX_URL environment variable.");
      return;
    }
    try {
      const skills = await fetchFeaturedSkills(convexUrl);
      if (skills.length === 0) {
        info("No featured skills available.");
        return;
      }
      header("Featured Skills");
      table(
        skills.map((s) => ({
          Name: s.name,
          Version: s.version,
          Category: s.category,
          Downloads: s.downloads.toString(),
          Description: truncate(s.description, 60)
        }))
      );
    } catch (err) {
      error(`Failed to fetch featured skills: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}

// src/commands/cron.ts
import readline6 from "readline";
function prompt3(q) {
  const rl = readline6.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => {
    rl.close();
    r(a.trim());
  }));
}
function registerCronCommand(program2) {
  const cron = program2.command("cron").description("Manage cron jobs");
  cron.command("list").option("--json", "Output as JSON").description("List all cron jobs").action(async (opts) => {
    const client = await createClient();
    const result = await safeCall(() => client.query("cronJobs:list", {}), "Failed to list cron jobs");
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    header("Cron Jobs");
    const items = result || [];
    if (items.length === 0) {
      info("No cron jobs. Create one with: agentforge cron create");
      return;
    }
    table(items.map((c) => ({
      ID: c._id?.slice(-8) || "N/A",
      Name: c.name,
      Schedule: c.schedule,
      Agent: c.agentId,
      Enabled: c.isEnabled ? "\u2714" : "\u2716",
      "Last Run": c.lastRun ? formatDate(c.lastRun) : "Never",
      "Next Run": c.nextRun ? formatDate(c.nextRun) : "N/A"
    })));
  });
  cron.command("create").description("Create a new cron job (interactive)").option("--name <name>", "Job name").option("--schedule <cron>", "Cron expression").option("--agent <id>", "Agent ID").option("--action <action>", "Action to execute").action(async (opts) => {
    const name = opts.name || await prompt3("Job name: ");
    const schedule = opts.schedule || await prompt3('Cron schedule (e.g., "0 */5 * * * *" for every 5 min): ');
    const agentId = opts.agent || await prompt3("Agent ID: ");
    const action = opts.action || await prompt3("Action (message to send to agent): ");
    if (!name || !schedule || !agentId || !action) {
      error("All fields are required.");
      process.exit(1);
    }
    const client = await createClient();
    await safeCall(
      () => client.mutation("cronJobs:create", { name, schedule, agentId, prompt: action }),
      "Failed to create cron job"
    );
    success(`Cron job "${name}" created.`);
  });
  cron.command("delete").argument("<id>", "Cron job ID").description("Delete a cron job").action(async (id) => {
    const client = await createClient();
    await safeCall(() => client.mutation("cronJobs:remove", { id }), "Failed to delete");
    success(`Cron job "${id}" deleted.`);
  });
  cron.command("enable").argument("<id>", "Cron job ID").description("Enable a cron job").action(async (id) => {
    const client = await createClient();
    await safeCall(() => client.mutation("cronJobs:update", { id, isEnabled: true }), "Failed");
    success(`Cron job "${id}" enabled.`);
  });
  cron.command("disable").argument("<id>", "Cron job ID").description("Disable a cron job").action(async (id) => {
    const client = await createClient();
    await safeCall(() => client.mutation("cronJobs:update", { id, isEnabled: false }), "Failed");
    success(`Cron job "${id}" disabled.`);
  });
}

// src/commands/mcp.ts
import { MCPExecutor } from "@agentforge-ai/core";
import readline7 from "readline";
function mutationRef(name) {
  return name;
}
function queryRef(name) {
  return name;
}
function prompt4(q) {
  const rl = readline7.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => {
    rl.close();
    r(a.trim());
  }));
}
function registerMcpCommand(program2) {
  const mcp = program2.command("mcp").description("Manage MCP connections");
  mcp.command("list").option("--json", "Output as JSON").description("List all MCP connections").action(async (opts) => {
    const client = await createClient();
    const result = await safeCall(() => client.query(queryRef("mcpConnections:list"), {}), "Failed to list connections");
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    header("MCP Connections");
    const items = result || [];
    if (items.length === 0) {
      info("No connections. Add one with: agentforge mcp add");
      return;
    }
    table(items.map((c) => ({
      ID: c._id?.slice(-8) || "N/A",
      Name: c.name,
      Type: c.protocol,
      Endpoint: c.serverUrl,
      Connected: c.isConnected ? "\u2714" : "\u2716",
      Enabled: c.isEnabled ? "\u2714" : "\u2716"
    })));
  });
  mcp.command("add").description("Add a new MCP connection (interactive)").option("--name <name>", "Connection name").option("--type <type>", "Connection type (stdio, sse, http)").option("--endpoint <url>", "Endpoint URL or command").action(async (opts) => {
    const name = opts.name || await prompt4("Connection name: ");
    const type = opts.type || await prompt4("Type (stdio/sse/http): ");
    const endpoint = opts.endpoint || await prompt4("Endpoint (URL or command): ");
    if (!name || !type || !endpoint) {
      error("All fields required.");
      process.exit(1);
    }
    const client = await createClient();
    await safeCall(
      () => client.mutation(mutationRef("mcpConnections:create"), {
        name,
        serverUrl: endpoint,
        protocol: type
      }),
      "Failed to add connection"
    );
    success(`MCP connection "${name}" added.`);
  });
  mcp.command("remove").argument("<id>", "Connection ID").description("Remove an MCP connection").action(async (id) => {
    const client = await createClient();
    await safeCall(() => client.mutation(mutationRef("mcpConnections:remove"), { id }), "Failed");
    success(`Connection "${id}" removed.`);
  });
  mcp.command("test").argument("<id>", "Connection ID").description("Test an MCP connection").action(async (id) => {
    info(`Testing connection "${id}"...`);
    const client = await createClient();
    const conns = await safeCall(() => client.query(queryRef("mcpConnections:list"), {}), "Failed");
    const conn = conns.find((c) => c._id === id || c._id?.endsWith(id));
    if (!conn) {
      error(`Connection "${id}" not found.`);
      process.exit(1);
    }
    if (conn.protocol === "http" || conn.protocol === "sse") {
      try {
        const res = await fetch(conn.serverUrl, { method: "HEAD", signal: AbortSignal.timeout(5e3) });
        if (res.ok) {
          success(`Connection "${conn.name}" is reachable (HTTP ${res.status}).`);
          await client.mutation(mutationRef("mcpConnections:updateStatus"), { id: conn._id, isConnected: true });
        } else {
          error(`Connection "${conn.name}" returned HTTP ${res.status}.`);
        }
      } catch (e) {
        error(`Connection "${conn.name}" failed: ${e.message}`);
      }
    } else {
      info(`Connection type "${conn.protocol}" \u2014 manual verification required.`);
      info(`Endpoint: ${conn.serverUrl}`);
    }
  });
  mcp.command("enable").argument("<id>", "Connection ID").description("Enable a connection").action(async (id) => {
    const client = await createClient();
    await safeCall(() => client.mutation(mutationRef("mcpConnections:update"), { id, isEnabled: true }), "Failed");
    success(`Connection "${id}" enabled.`);
  });
  mcp.command("disable").argument("<id>", "Connection ID").description("Disable a connection").action(async (id) => {
    const client = await createClient();
    await safeCall(() => client.mutation(mutationRef("mcpConnections:update"), { id, isEnabled: false }), "Failed");
    success(`Connection "${id}" disabled.`);
  });
  mcp.command("list-tools").argument("<connection-name>", "Connection name").description("List available tools from an MCP server").action(async (connectionName) => {
    const client = await createClient();
    const conns = await safeCall(() => client.query("mcpConnections:list", {}), "Failed to list connections");
    const conn = conns.find((c) => c.name === connectionName || c._id?.endsWith(connectionName));
    if (!conn) {
      error(`Connection "${connectionName}" not found.`);
      process.exit(1);
    }
    if (!conn.isEnabled) {
      error(`Connection "${connectionName}" is disabled.`);
      process.exit(1);
    }
    const config = await safeCall(
      () => client.action("mcpConnections:executeToolCall", {
        id: conn._id,
        toolName: "",
        toolArgs: {}
      }),
      "Failed to get connection config"
    );
    const executor = new MCPExecutor();
    try {
      const [command, ...args] = config.connection.serverUrl.split(" ");
      await executor.connect({
        id: conn._id,
        command,
        args,
        env: config.connection.credentials
      });
      const tools = await executor.listTools();
      header(`Available tools from "${connectionName}":`);
      table(tools.map((t) => ({
        Name: t.name,
        Description: t.description || "N/A"
      })));
      await executor.disconnect();
    } catch (e) {
      error(`Failed to list tools: ${e.message}`);
      process.exit(1);
    }
  });
  mcp.command("run").argument("<connection-name>", "Connection name").argument("<tool-name>", "Tool name to execute").option("--args <json>", "Tool arguments as JSON string", "{}").description("Execute a tool on an MCP server").action(async (connectionName, toolName, opts) => {
    const client = await createClient();
    const conns = await safeCall(() => client.query("mcpConnections:list", {}), "Failed to list connections");
    const conn = conns.find((c) => c.name === connectionName || c._id?.endsWith(connectionName));
    if (!conn) {
      error(`Connection "${connectionName}" not found.`);
      process.exit(1);
    }
    if (!conn.isEnabled) {
      error(`Connection "${connectionName}" is disabled.`);
      process.exit(1);
    }
    let toolArgs;
    try {
      toolArgs = JSON.parse(opts.args);
    } catch {
      error("Invalid JSON in --args");
      process.exit(1);
    }
    const config = await safeCall(
      () => client.action("mcpConnections:executeToolCall", {
        id: conn._id,
        toolName,
        toolArgs
      }),
      "Failed to get connection config"
    );
    const executor = new MCPExecutor();
    try {
      const [command, ...args] = config.connection.serverUrl.split(" ");
      await executor.connect({
        id: conn._id,
        command,
        args,
        env: config.connection.credentials
      });
      const result = await executor.executeTool(toolName, toolArgs);
      success(`Tool "${toolName}" executed successfully:`);
      console.log(JSON.stringify(result, null, 2));
      await executor.disconnect();
    } catch (e) {
      error(`Failed to execute tool: ${e.message}`);
      process.exit(1);
    }
  });
}

// src/commands/files.ts
import fs6 from "fs-extra";
import path7 from "path";
function registerFilesCommand(program2) {
  const files = program2.command("files").description("Manage files");
  files.command("list").argument("[folder]", "Folder ID to list files from").option("--json", "Output as JSON").description("List files").action(async (folder, opts) => {
    const client = await createClient();
    const args = folder ? { folderId: folder } : {};
    const result = await safeCall(() => client.query("files:list", args), "Failed to list files");
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    header("Files");
    const items = result || [];
    if (items.length === 0) {
      info("No files. Upload one with: agentforge files upload <path>");
      return;
    }
    table(items.map((f) => ({
      ID: f._id?.slice(-8) || "N/A",
      Name: f.name,
      Type: f.mimeType,
      Size: formatSize(f.size),
      Folder: f.folderId || "root",
      Uploaded: formatDate(f.uploadedAt)
    })));
  });
  files.command("upload").argument("<filepath>", "Path to file to upload").option("--folder <id>", "Folder ID to upload to").option("--project <id>", "Project ID to associate with").description("Upload a file").action(async (filepath, opts) => {
    const absPath = path7.resolve(filepath);
    if (!fs6.existsSync(absPath)) {
      error(`File not found: ${absPath}`);
      process.exit(1);
    }
    const stat2 = fs6.statSync(absPath);
    const name = path7.basename(absPath);
    const ext = path7.extname(absPath).toLowerCase();
    const mimeTypes = {
      ".txt": "text/plain",
      ".md": "text/markdown",
      ".json": "application/json",
      ".js": "text/javascript",
      ".ts": "text/typescript",
      ".py": "text/x-python",
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".csv": "text/csv",
      ".html": "text/html",
      ".xml": "text/xml"
    };
    const mimeType = mimeTypes[ext] || "application/octet-stream";
    const client = await createClient();
    try {
      info("Generating upload URL...");
      const uploadUrl = await safeCall(
        () => client.mutation("files:generateUploadUrl", {}),
        "Failed to generate upload URL"
      );
      info("Uploading file content...");
      const fileBuffer = fs6.readFileSync(absPath);
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": mimeType },
        body: fileBuffer
      });
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }
      const { storageId } = await uploadResponse.json();
      info("Saving file metadata...");
      const fileId = await safeCall(
        () => client.mutation("files:confirmUpload", {
          storageId,
          name,
          originalName: name,
          mimeType,
          size: stat2.size,
          folderId: opts.folder ? opts.folder : void 0,
          projectId: opts.project ? opts.project : void 0
        }),
        "Failed to save file metadata"
      );
      success(`File "${name}" uploaded successfully (${formatSize(stat2.size)}, ${mimeType}).`);
      info(`File ID: ${fileId}`);
    } catch (err) {
      error(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
  files.command("download").argument("<id>", "File ID").option("--output <path>", "Output file path").description("Download a file").action(async (id, opts) => {
    const client = await createClient();
    try {
      const file = await safeCall(
        () => client.query("files:get", { id }),
        "Failed to get file metadata"
      );
      if (!file) {
        error(`File not found: ${id}`);
        process.exit(1);
      }
      info("Getting file URL...");
      if (!file.url) {
        error("File URL not available. This file may not have been properly uploaded.");
        process.exit(1);
      }
      const fileUrl = file.url;
      info("Downloading file content...");
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const outputPath = opts.output || path7.join(process.cwd(), file.originalName || file.name);
      await fs6.writeFile(outputPath, buffer);
      success(`File downloaded to: ${outputPath} (${formatSize(buffer.length)})`);
    } catch (err) {
      error(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
  files.command("delete").argument("<id>", "File ID").description("Delete a file").action(async (id) => {
    const client = await createClient();
    await safeCall(() => client.mutation("files:remove", { id }), "Failed to delete file");
    success(`File "${id}" deleted.`);
  });
  const folders = program2.command("folders").description("Manage folders");
  folders.command("list").option("--json", "Output as JSON").description("List all folders").action(async (opts) => {
    const client = await createClient();
    const result = await safeCall(() => client.query("folders:list", {}), "Failed to list folders");
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    header("Folders");
    const items = result || [];
    if (items.length === 0) {
      info("No folders. Create one with: agentforge folders create <name>");
      return;
    }
    table(items.map((f) => ({
      ID: f._id?.slice(-8) || "N/A",
      Name: f.name,
      Parent: f.parentId || "root",
      Created: formatDate(f.createdAt)
    })));
  });
  folders.command("create").argument("<name>", "Folder name").option("--parent <id>", "Parent folder ID").description("Create a folder").action(async (name, opts) => {
    const client = await createClient();
    await safeCall(
      () => client.mutation("folders:create", { name, parentId: opts.parent }),
      "Failed to create folder"
    );
    success(`Folder "${name}" created.`);
  });
  folders.command("delete").argument("<id>", "Folder ID").description("Delete a folder").action(async (id) => {
    const client = await createClient();
    await safeCall(() => client.mutation("folders:remove", { id }), "Failed to delete folder");
    success(`Folder "${id}" deleted.`);
  });
}
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// src/commands/projects.ts
import readline8 from "readline";
function prompt5(q) {
  const rl = readline8.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => {
    rl.close();
    r(a.trim());
  }));
}
function registerProjectsCommand(program2) {
  const projects = program2.command("projects").description("Manage projects and workspaces");
  projects.command("list").option("--json", "Output as JSON").description("List all projects").action(async (opts) => {
    const client = await createClient();
    const result = await safeCall(() => client.query("projects:list", {}), "Failed to list projects");
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    header("Projects");
    const items = result || [];
    if (items.length === 0) {
      info("No projects. Create one with: agentforge projects create <name>");
      return;
    }
    table(items.map((p) => ({
      ID: p._id?.slice(-8) || "N/A",
      Name: p.name,
      Description: (p.description || "").slice(0, 40),
      Created: formatDate(p.createdAt)
    })));
  });
  projects.command("create").argument("<name>", "Project name").option("-d, --description <desc>", "Project description").description("Create a new project").action(async (name, opts) => {
    const description = opts.description || await prompt5("Description (optional): ");
    const client = await createClient();
    await safeCall(
      () => client.mutation("projects:create", { name, description: description || void 0 }),
      "Failed to create project"
    );
    success(`Project "${name}" created.`);
  });
  projects.command("inspect").argument("<id>", "Project ID").description("Show project details").action(async (id) => {
    const client = await createClient();
    const projects2 = await safeCall(() => client.query("projects:list", {}), "Failed");
    const project = projects2.find((p) => p._id === id || p._id?.endsWith(id));
    if (!project) {
      error(`Project "${id}" not found.`);
      process.exit(1);
    }
    header(`Project: ${project.name}`);
    details({
      ID: project._id,
      Name: project.name,
      Description: project.description || "N/A",
      Created: formatDate(project.createdAt),
      Updated: formatDate(project.updatedAt)
    });
  });
  projects.command("delete").argument("<id>", "Project ID").option("-f, --force", "Skip confirmation").description("Delete a project").action(async (id, opts) => {
    if (!opts.force) {
      const confirm = await prompt5(`Delete project "${id}"? (y/N): `);
      if (confirm.toLowerCase() !== "y") {
        info("Cancelled.");
        return;
      }
    }
    const client = await createClient();
    await safeCall(() => client.mutation("projects:remove", { id }), "Failed");
    success(`Project "${id}" deleted.`);
  });
  projects.command("switch").argument("<id>", "Project ID to switch to").description("Set the active project").action(async (id) => {
    const client = await createClient();
    const projects2 = await safeCall(() => client.query("projects:list", {}), "Failed");
    const project = projects2.find((p) => p._id === id || p._id?.endsWith(id));
    if (!project) {
      error(`Project "${id}" not found.`);
      process.exit(1);
    }
    await safeCall(
      () => client.mutation("settings:set", { userId: "cli", key: "activeProject", value: project._id }),
      "Failed to switch project"
    );
    success(`Switched to project "${project.name}".`);
  });
}

// src/commands/config.ts
import fs7 from "fs-extra";
import path8 from "path";
import readline9 from "readline";
function prompt6(q) {
  const rl = readline9.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => {
    rl.close();
    r(a.trim());
  }));
}
function registerConfigCommand(program2) {
  const config = program2.command("config").description("Manage configuration");
  config.command("show").description("Show current configuration").action(async () => {
    header("Configuration");
    const cwd = process.cwd();
    const envFiles = [".env", ".env.local", ".env.production"];
    for (const envFile of envFiles) {
      const envPath = path8.join(cwd, envFile);
      if (fs7.existsSync(envPath)) {
        console.log(`  ${colors.cyan}${envFile}${colors.reset}`);
        const content = fs7.readFileSync(envPath, "utf-8");
        content.split("\n").forEach((line) => {
          if (line.trim() && !line.startsWith("#")) {
            const [key, ...rest] = line.split("=");
            const value = rest.join("=").trim();
            const masked = key.toLowerCase().includes("key") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("token") ? value.slice(0, 4) + "****" + value.slice(-4) : value;
            console.log(`    ${colors.dim}${key.trim()}${colors.reset} = ${masked}`);
          }
        });
        console.log();
      }
    }
    const convexDir = path8.join(cwd, ".convex");
    if (fs7.existsSync(convexDir)) {
      info("Convex: Configured");
    } else {
      info("Convex: Not configured (run `npx convex dev`)");
    }
    const skillsDir = path8.join(cwd, "skills");
    if (fs7.existsSync(skillsDir)) {
      const skills = fs7.readdirSync(skillsDir).filter((d) => fs7.statSync(path8.join(skillsDir, d)).isDirectory());
      info(`Skills: ${skills.length} installed (${skills.join(", ")})`);
    } else {
      info("Skills: None installed");
    }
  });
  config.command("set").argument("<key>", "Configuration key").argument("<value>", "Configuration value").option("--env <file>", "Environment file to update", ".env.local").description("Set a configuration value").action(async (key, value, opts) => {
    const envPath = path8.join(process.cwd(), opts.env);
    let content = "";
    if (fs7.existsSync(envPath)) {
      content = fs7.readFileSync(envPath, "utf-8");
    }
    const lines = content.split("\n");
    const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (idx >= 0) {
      lines[idx] = `${key}=${value}`;
    } else {
      lines.push(`${key}=${value}`);
    }
    fs7.writeFileSync(envPath, lines.join("\n"));
    success(`Set ${key} in ${opts.env}`);
  });
  config.command("get").argument("<key>", "Configuration key").description("Get a configuration value").action(async (key) => {
    const cwd = process.cwd();
    const envFiles = [".env.local", ".env", ".env.production"];
    for (const envFile of envFiles) {
      const envPath = path8.join(cwd, envFile);
      if (fs7.existsSync(envPath)) {
        const content = fs7.readFileSync(envPath, "utf-8");
        const match = content.match(new RegExp(`^${key}=(.+)$`, "m"));
        if (match) {
          console.log(match[1].trim());
          return;
        }
      }
    }
    error(`Key "${key}" not found in any .env file.`);
  });
  config.command("init").description("Initialize configuration for a new project").action(async () => {
    header("Project Configuration");
    const convexUrl = await prompt6("Convex URL (from `npx convex dev`): ");
    const provider = await prompt6("LLM Provider (openai/openrouter/anthropic/google): ") || "openai";
    const apiKey = await prompt6(`${provider.toUpperCase()} API Key: `);
    const envContent = [
      `# AgentForge Configuration`,
      `CONVEX_URL=${convexUrl}`,
      ``,
      `# LLM Provider`,
      `LLM_PROVIDER=${provider}`
    ];
    if (provider === "openai") envContent.push(`OPENAI_API_KEY=${apiKey}`);
    else if (provider === "openrouter") envContent.push(`OPENROUTER_API_KEY=${apiKey}`);
    else if (provider === "anthropic") envContent.push(`ANTHROPIC_API_KEY=${apiKey}`);
    else if (provider === "google") envContent.push(`GOOGLE_API_KEY=${apiKey}`);
    fs7.writeFileSync(path8.join(process.cwd(), ".env.local"), envContent.join("\n") + "\n");
    success("Configuration saved to .env.local");
    info("Run `npx convex dev` to start the Convex backend.");
  });
  config.command("provider").argument("<provider>", "LLM provider to configure (openai, openrouter, anthropic, google, xai)").description("Configure an LLM provider").action(async (provider) => {
    const keyNames = {
      openai: "OPENAI_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      google: "GOOGLE_API_KEY",
      xai: "XAI_API_KEY"
    };
    const keyName = keyNames[provider.toLowerCase()];
    if (!keyName) {
      error(`Unknown provider "${provider}". Supported: ${Object.keys(keyNames).join(", ")}`);
      process.exit(1);
    }
    const apiKey = await prompt6(`${keyName}: `);
    if (!apiKey) {
      error("API key is required.");
      process.exit(1);
    }
    const envPath = path8.join(process.cwd(), ".env.local");
    let content = "";
    if (fs7.existsSync(envPath)) content = fs7.readFileSync(envPath, "utf-8");
    const lines = content.split("\n");
    const idx = lines.findIndex((l) => l.startsWith(`${keyName}=`));
    if (idx >= 0) lines[idx] = `${keyName}=${apiKey}`;
    else lines.push(`${keyName}=${apiKey}`);
    const provIdx = lines.findIndex((l) => l.startsWith("LLM_PROVIDER="));
    if (provIdx >= 0) lines[provIdx] = `LLM_PROVIDER=${provider}`;
    else lines.push(`LLM_PROVIDER=${provider}`);
    fs7.writeFileSync(envPath, lines.join("\n"));
    success(`Provider "${provider}" configured.`);
  });
}

// src/commands/vault.ts
import readline10 from "readline";
function prompt7(q) {
  const rl = readline10.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => {
    rl.close();
    r(a.trim());
  }));
}
function promptSecret(q) {
  return new Promise((resolve4) => {
    const rl = readline10.createInterface({ input: process.stdin, output: process.stdout });
    if (process.stdin.isTTY) {
      process.stdout.write(q);
      let input = "";
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf-8");
      const onData = (char) => {
        if (char === "\n" || char === "\r") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener("data", onData);
          console.log();
          rl.close();
          resolve4(input);
        } else if (char === "") {
          process.exit();
        } else if (char === "\x7F") {
          input = input.slice(0, -1);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(q + "*".repeat(input.length));
        } else {
          input += char;
          process.stdout.write("*");
        }
      };
      process.stdin.on("data", onData);
    } else {
      rl.question(q, (ans) => {
        rl.close();
        resolve4(ans.trim());
      });
    }
  });
}
function registerVaultCommand(program2) {
  const vault = program2.command("vault").description("Manage secrets securely");
  vault.command("list").option("--json", "Output as JSON").description("List all stored secrets (values hidden)").action(async (opts) => {
    const client = await createClient();
    const result = await safeCall(() => client.query("vault:list", {}), "Failed to list secrets");
    if (opts.json) {
      const safe = (result || []).map((s) => ({ ...s, encryptedValue: void 0 }));
      console.log(JSON.stringify(safe, null, 2));
      return;
    }
    header("Vault \u2014 Stored Secrets");
    const items = result || [];
    if (items.length === 0) {
      info("No secrets stored. Add one with: agentforge vault set <name> <value>");
      return;
    }
    table(items.map((s) => ({
      Name: s.name,
      Category: s.category || "general",
      Provider: s.provider || "N/A",
      "Last Updated": s.updatedAt ? formatDate(s.updatedAt) : "Never",
      Created: formatDate(s.createdAt)
    })));
  });
  vault.command("set").argument("<name>", "Secret name (e.g., OPENAI_API_KEY)").argument("[value]", "Secret value (omit for secure prompt)").option("--category <cat>", "Category (api_key, token, secret, credential)", "api_key").option("--provider <provider>", "Provider name (openai, anthropic, etc.)").description("Store a secret securely").action(async (name, value, opts) => {
    if (!value) {
      value = await promptSecret(`Enter value for ${name}: `);
    }
    if (!value) {
      error("Value is required.");
      process.exit(1);
    }
    const client = await createClient();
    await safeCall(
      () => client.mutation("vault:store", {
        name,
        value,
        category: opts.category,
        provider: opts.provider
      }),
      "Failed to store secret"
    );
    success(`Secret "${name}" stored securely.`);
  });
  vault.command("get").argument("<name>", "Secret name").option("--reveal", "Show the actual value (use with caution)").description("Retrieve a secret").action(async (name, opts) => {
    const client = await createClient();
    const result = await safeCall(() => client.query("vault:list", {}), "Failed");
    const secret = (result || []).find((s) => s.name === name);
    if (!secret) {
      error(`Secret "${name}" not found.`);
      process.exit(1);
    }
    if (opts.reveal) {
      info(`${name} = ${secret.maskedValue || "****"}`);
      dim("  Note: Full decryption is only available server-side for security.");
    } else {
      info(`${name} = ${secret.maskedValue || "****"}`);
      dim("  Use --reveal to attempt to show more details.");
    }
  });
  vault.command("delete").argument("<name>", "Secret name").option("-f, --force", "Skip confirmation").description("Delete a secret").action(async (name, opts) => {
    if (!opts.force) {
      const confirm = await prompt7(`Delete secret "${name}"? This cannot be undone. (y/N): `);
      if (confirm.toLowerCase() !== "y") {
        info("Cancelled.");
        return;
      }
    }
    const client = await createClient();
    const result = await safeCall(() => client.query("vault:list", {}), "Failed");
    const secret = (result || []).find((s) => s.name === name);
    if (!secret) {
      error(`Secret "${name}" not found.`);
      process.exit(1);
    }
    await safeCall(() => client.mutation("vault:remove", { id: secret._id }), "Failed");
    success(`Secret "${name}" deleted.`);
  });
  vault.command("rotate").argument("<name>", "Secret name").description("Rotate a secret (set a new value)").action(async (name) => {
    const client = await createClient();
    const result = await safeCall(() => client.query("vault:list", {}), "Failed");
    const secret = (result || []).find((s) => s.name === name);
    if (!secret) {
      error(`Secret "${name}" not found.`);
      process.exit(1);
    }
    const newValue = await promptSecret(`Enter new value for ${name}: `);
    if (!newValue) {
      error("Value is required.");
      process.exit(1);
    }
    await safeCall(
      () => client.mutation("vault:update", { id: secret._id, value: newValue }),
      "Failed to rotate secret"
    );
    success(`Secret "${name}" rotated.`);
  });
}

// src/commands/keys.ts
function safeCall2(fn, msg) {
  return fn().catch((e) => {
    error(`${msg}: ${e.message}`);
    process.exit(1);
  });
}
function formatDate4(ts) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function maskKey(key) {
  if (key.length <= 12) return key.substring(0, 4) + "****";
  return key.substring(0, 8) + "..." + key.substring(key.length - 4);
}
function promptSecret2(question) {
  return new Promise((resolve4) => {
    const readline17 = __require("readline");
    if (process.stdin.isTTY) {
      process.stdout.write(question);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
      let input = "";
      const onData = (char) => {
        if (char === "\n" || char === "\r" || char === "") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve4(input);
        } else if (char === "") {
          process.exit(0);
        } else if (char === "\x7F" || char === "\b") {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          input += char;
          process.stdout.write("*");
        }
      };
      process.stdin.on("data", onData);
    } else {
      const rl = readline17.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(question, (ans) => {
        rl.close();
        resolve4(ans.trim());
      });
    }
  });
}
var PROVIDERS = [
  { id: "openai", name: "OpenAI", prefix: "sk-" },
  { id: "anthropic", name: "Anthropic", prefix: "sk-ant-" },
  { id: "openrouter", name: "OpenRouter", prefix: "sk-or-" },
  { id: "google", name: "Google AI", prefix: "AIza" },
  { id: "xai", name: "xAI", prefix: "xai-" },
  { id: "groq", name: "Groq", prefix: "gsk_" },
  { id: "together", name: "Together AI", prefix: "" },
  { id: "perplexity", name: "Perplexity", prefix: "pplx-" }
];
function registerKeysCommand(program2) {
  const keys = program2.command("keys").description("Manage AI provider API keys");
  keys.command("list").option("--provider <provider>", "Filter by provider").option("--json", "Output as JSON").description("List all configured API keys").action(async (opts) => {
    const client = await createClient();
    const result = await safeCall2(
      () => client.query("apiKeys:list", opts.provider ? { provider: opts.provider } : {}),
      "Failed to list API keys"
    );
    const items = result || [];
    if (opts.json) {
      const safe = items.map((k) => ({ ...k, encryptedKey: maskKey(k.encryptedKey) }));
      console.log(JSON.stringify(safe, null, 2));
      return;
    }
    header("API Keys");
    if (items.length === 0) {
      info("No API keys configured.");
      dim("  Add one with: agentforge keys add <provider> [key]");
      dim("");
      dim("  Supported providers:");
      PROVIDERS.forEach((p) => dim(`    ${p.id.padEnd(12)} ${p.name}`));
      return;
    }
    table(items.map((k) => ({
      Provider: k.provider,
      Name: k.keyName,
      Key: maskKey(k.encryptedKey),
      Active: k.isActive ? "\u2713" : "\u2717",
      Created: formatDate4(k.createdAt),
      "Last Used": k.lastUsedAt ? formatDate4(k.lastUsedAt) : "Never"
    })));
  });
  keys.command("add").argument("<provider>", `Provider (${PROVIDERS.map((p) => p.id).join(", ")})`).argument("[key]", "API key value (omit for secure prompt)").option("--name <name>", "Key display name").description("Add an AI provider API key").action(async (provider, key, opts) => {
    const providerInfo = PROVIDERS.find((p) => p.id === provider);
    if (!providerInfo) {
      error(`Unknown provider "${provider}". Supported: ${PROVIDERS.map((p) => p.id).join(", ")}`);
      process.exit(1);
    }
    if (!key) {
      key = await promptSecret2(`Enter ${providerInfo.name} API key: `);
    }
    if (!key) {
      error("API key is required.");
      process.exit(1);
    }
    if (providerInfo.prefix && !key.startsWith(providerInfo.prefix)) {
      info(`Warning: ${providerInfo.name} keys typically start with "${providerInfo.prefix}".`);
    }
    const keyName = opts.name || `${providerInfo.name} Key`;
    const client = await createClient();
    await safeCall2(
      () => client.action("apiKeys:create", {
        provider,
        keyName,
        encryptedKey: key
      }),
      "Failed to store API key"
    );
    success(`${providerInfo.name} API key "${keyName}" stored successfully.`);
  });
  keys.command("remove").argument("<provider>", "Provider name").option("-f, --force", "Skip confirmation").description("Remove an API key").action(async (provider, opts) => {
    const client = await createClient();
    const result = await safeCall2(
      () => client.query("apiKeys:list", { provider }),
      "Failed to list keys"
    );
    const items = result || [];
    if (items.length === 0) {
      error(`No API keys found for "${provider}".`);
      process.exit(1);
    }
    const target = items[0];
    if (!opts.force) {
      const readline17 = __require("readline");
      const rl = readline17.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise((resolve4) => {
        rl.question(`Delete "${target.keyName}" for ${provider}? (y/N): `, (ans) => {
          rl.close();
          resolve4(ans.trim());
        });
      });
      if (answer.toLowerCase() !== "y") {
        info("Cancelled.");
        return;
      }
    }
    await safeCall2(
      () => client.mutation("apiKeys:remove", { id: target._id }),
      "Failed to remove API key"
    );
    success(`API key "${target.keyName}" removed.`);
  });
  keys.command("test").argument("<provider>", "Provider to test").description("Test an API key by making a simple request").action(async (provider) => {
    const client = await createClient();
    const result = await safeCall2(
      () => client.query("apiKeys:getActiveForProvider", { provider }),
      "Failed to get key"
    );
    if (!result) {
      error(`No active API key for "${provider}". Add one with: agentforge keys add ${provider}`);
      process.exit(1);
    }
    const key = result.encryptedKey;
    info(`Testing ${provider} API key...`);
    try {
      let ok = false;
      if (provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
        ok = res.ok;
      } else if (provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
          body: JSON.stringify({ model: "claude-3-haiku-20240307", max_tokens: 1, messages: [{ role: "user", content: "hi" }] })
        });
        ok = res.ok;
      } else if (provider === "openrouter") {
        const res = await fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${key}` } });
        ok = res.ok;
      } else if (provider === "google") {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        ok = res.ok;
      } else if (provider === "groq") {
        const res = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
        ok = res.ok;
      } else {
        info(`No test endpoint configured for "${provider}". Key is stored.`);
        return;
      }
      if (ok) {
        success(`${provider} API key is valid and working.`);
        await safeCall2(
          () => client.mutation("apiKeys:updateLastUsed", { id: result._id }),
          "Failed to update last used"
        );
      } else {
        error(`${provider} API key returned an error. Check that the key is valid.`);
      }
    } catch (e) {
      error(`Connection failed: ${e.message}`);
    }
  });
}

// src/commands/status.ts
import { spawn as spawn2 } from "child_process";
import path9 from "path";
import fs8 from "fs-extra";
import readline11 from "readline";
function registerStatusCommand(program2) {
  program2.command("status").description("Show system health and connection status").action(async () => {
    header("AgentForge Status");
    const cwd = process.cwd();
    const checks = {};
    checks["Project Root"] = fs8.existsSync(path9.join(cwd, "package.json")) ? "\u2714 Found" : "\u2716 Not found";
    checks["Convex Dir"] = fs8.existsSync(path9.join(cwd, "convex")) ? "\u2714 Found" : "\u2716 Not found";
    checks["Skills Dir"] = fs8.existsSync(path9.join(cwd, "skills")) ? "\u2714 Found" : "\u2716 Not configured";
    checks["Dashboard Dir"] = fs8.existsSync(path9.join(cwd, "dashboard")) ? "\u2714 Found" : "\u2716 Not found";
    checks["Env Config"] = fs8.existsSync(path9.join(cwd, ".env.local")) || fs8.existsSync(path9.join(cwd, ".env")) ? "\u2714 Found" : "\u2716 Not found";
    try {
      const client = await createClient();
      const agents = await client.query("agents:list", {});
      checks["Convex Connection"] = `\u2714 Connected (${agents?.length || 0} agents)`;
    } catch {
      checks["Convex Connection"] = "\u2716 Not connected (run `npx convex dev`)";
    }
    try {
      const healthResponse = await fetch("http://localhost:3001/health", {
        signal: AbortSignal.timeout(1e3)
      });
      if (healthResponse.ok) {
        const health = await healthResponse.json();
        checks["Runtime Daemon"] = `\u2714 Running on :3001 (${health.agents} agent${health.agents !== 1 ? "s" : ""})`;
      } else {
        checks["Runtime Daemon"] = "\u2717 Not responding";
      }
    } catch {
      checks["Runtime Daemon"] = "\u2717 Not running (run `agentforge start`)";
    }
    let providerStatus = "Not configured";
    let storedKeysCount = 0;
    const envFiles = [".env.local", ".env"];
    for (const envFile of envFiles) {
      const envPath = path9.join(cwd, envFile);
      if (fs8.existsSync(envPath)) {
        const content = fs8.readFileSync(envPath, "utf-8");
        const match = content.match(/LLM_PROVIDER=(.+)/);
        if (match) {
          providerStatus = match[1].trim();
          break;
        }
        if (content.includes("OPENAI_API_KEY=")) {
          providerStatus = "openai";
          break;
        }
        if (content.includes("OPENROUTER_API_KEY=")) {
          providerStatus = "openrouter";
          break;
        }
      }
    }
    try {
      const client = await createClient();
      const keys = await client.query("apiKeys:list", {}) || [];
      const activeKeys = keys.filter((k) => k.isActive);
      storedKeysCount = activeKeys.length;
      if (storedKeysCount > 0) {
        const providers = [...new Set(activeKeys.map((k) => k.provider))];
        providerStatus = `Configured (${storedKeysCount} key${storedKeysCount > 1 ? "s" : ""}: ${providers.join(", ")})`;
      }
    } catch {
    }
    checks["LLM Provider"] = storedKeysCount > 0 || providerStatus !== "Not configured" ? `\u2714 ${providerStatus}` : "\u2716 Not configured";
    details(checks);
  });
  program2.command("dashboard").description("Launch the web dashboard").option("-p, --port <port>", "Port for the dashboard", "3000").option("-d, --dir <path>", "Project directory (defaults to current directory)").option("--install", "Install dashboard dependencies before starting").action(async (opts) => {
    let cwd;
    try {
      cwd = opts.dir ? path9.resolve(opts.dir) : process.cwd();
    } catch {
      error("Cannot determine the current directory.");
      console.log();
      info("Your shell's working directory may no longer exist.");
      info("Run the command from inside your project directory:");
      console.log();
      console.log("  cd /path/to/your/agentforge-project");
      console.log("  agentforge dashboard");
      console.log();
      info("Or specify the directory explicitly:");
      console.log("  agentforge dashboard --dir /path/to/your/agentforge-project");
      process.exit(1);
    }
    const searchPaths = [
      path9.join(cwd, "dashboard"),
      // 1. Bundled in project (agentforge create)
      path9.join(cwd, "packages", "web"),
      // 2. Monorepo structure
      path9.join(cwd, "node_modules", "@agentforge-ai", "web")
      // 3. Installed as dependency
    ];
    let dashDir = "";
    for (const p of searchPaths) {
      if (fs8.existsSync(path9.join(p, "package.json"))) {
        dashDir = p;
        break;
      }
    }
    if (!dashDir) {
      error("Dashboard not found!");
      console.log();
      info("The dashboard should be in your project's ./dashboard/ directory.");
      info("If you created this project with an older version of AgentForge,");
      info("you can add it manually:");
      console.log();
      console.log(`  ${colors.cyan}# Option 1: Recreate the project${colors.reset}`);
      console.log(`  agentforge create my-project`);
      console.log();
      console.log(`  ${colors.cyan}# Option 2: Clone the dashboard from the repo${colors.reset}`);
      console.log(`  git clone https://github.com/Agentic-Engineering-Agency/agentforge /tmp/af`);
      console.log(`  cp -r /tmp/af/packages/web ./dashboard`);
      console.log(`  cd dashboard && pnpm install`);
      console.log();
      return;
    }
    const nodeModulesExists = fs8.existsSync(path9.join(dashDir, "node_modules"));
    if (!nodeModulesExists || opts.install) {
      header("AgentForge Dashboard \u2014 Installing Dependencies");
      info(`Installing in ${path9.relative(cwd, dashDir) || "."}...`);
      console.log();
      const installChild = spawn2("pnpm", ["install"], {
        cwd: dashDir,
        stdio: "inherit",
        shell: true
      });
      await new Promise((resolve4, reject) => {
        installChild.on("close", (code) => {
          if (code === 0) resolve4();
          else reject(new Error(`pnpm install exited with code ${code}`));
        });
        installChild.on("error", reject);
      });
      console.log();
      success("Dependencies installed.");
      console.log();
    }
    const envPath = path9.join(cwd, ".env.local");
    if (fs8.existsSync(envPath)) {
      const envContent = fs8.readFileSync(envPath, "utf-8");
      const convexUrlMatch = envContent.match(/CONVEX_URL=(.+)/);
      if (convexUrlMatch) {
        const dashEnvPath = path9.join(dashDir, ".env.local");
        const dashEnvContent = `VITE_CONVEX_URL=${convexUrlMatch[1].trim()}
`;
        fs8.writeFileSync(dashEnvPath, dashEnvContent);
      }
    }
    header("AgentForge Dashboard");
    info(`Starting dashboard on port ${opts.port}...`);
    info(`Open ${colors.cyan}http://localhost:${opts.port}${colors.reset} in your browser.`);
    console.log();
    const child = spawn2("pnpm", ["dev", "--port", opts.port], {
      cwd: dashDir,
      stdio: "inherit",
      shell: true
    });
    child.on("error", (err) => {
      error(`Failed to start dashboard: ${err.message}`);
    });
  });
  program2.command("logs").description("Show recent activity logs").option("-n, --lines <count>", "Number of log entries", "20").option("--agent <id>", "Filter by agent ID").option("--json", "Output as JSON").action(async (opts) => {
    const client = await createClient();
    const args = {
      paginationOpts: { cursor: null, numItems: parseInt(opts.lines) }
    };
    if (opts.agent) args.agentId = opts.agent;
    const result = await safeCall(
      () => client.query("usage:list", args),
      "Failed to fetch logs"
    );
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    header("Activity Logs");
    const items = result?.page || [];
    if (items.length === 0) {
      info("No activity logs found.");
      return;
    }
    items.forEach((log) => {
      const time = new Date(log.timestamp || log.createdAt).toLocaleString();
      const agent = log.agentId || "system";
      const action = log.action || log.type || "unknown";
      const tokens = log.tokensUsed ? `${log.tokensUsed} tokens` : "";
      console.log(`  ${colors.dim}${time}${colors.reset}  ${colors.cyan}${agent}${colors.reset}  ${action}  ${tokens}`);
    });
    console.log();
  });
  program2.command("heartbeat").description("Check and resume pending agent tasks").option("--agent <id>", "Check specific agent").action(async (opts) => {
    const client = await createClient();
    header("Heartbeat Check");
    const args = {};
    if (opts.agent) args.agentId = opts.agent;
    const result = await safeCall(
      () => client.query("heartbeat:listActive", args),
      "Failed to check heartbeat"
    );
    const items = result || [];
    if (items.length === 0) {
      success("All tasks complete. No pending work.");
      return;
    }
    info(`Found ${items.length} active heartbeat(s):`);
    items.forEach((task, i) => {
      console.log(`  ${colors.yellow}${i + 1}.${colors.reset} [${task.agentId}] ${task.currentTask || "No current task"}`);
      console.log(`     ${colors.dim}Status: ${task.status} | Pending: ${(task.pendingTasks || []).length} task(s)${colors.reset}`);
    });
    console.log();
    const rl = readline11.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((r) => rl.question("Reset stalled heartbeats? (y/N): ", (a) => {
      rl.close();
      r(a.trim());
    }));
    if (answer.toLowerCase() === "y") {
      for (const task of items) {
        info(`Resetting heartbeat for agent "${task.agentId}"...`);
        await safeCall(
          () => client.mutation("heartbeat:updateStatus", { agentId: task.agentId, status: "active", currentTask: void 0 }),
          "Failed to reset heartbeat"
        );
      }
      success("All heartbeats reset.");
    }
  });
}

// src/commands/models.ts
var PROVIDERS2 = ["openai", "anthropic", "openrouter", "mistral", "google", "groq", "xai"];
function registerModelsCommand(program2) {
  const models = program2.command("models").description("Manage AI model lists");
  models.command("list").option("--provider <provider>", "Filter by provider").option("--refresh", "Force-refresh cached models from provider API").option("--json", "Output as JSON").description("List available AI models (fetched from provider APIs)").action(async (opts) => {
    const client = await createClient();
    const providers = opts.provider ? [opts.provider] : PROVIDERS2;
    const allModels = {};
    for (const provider of providers) {
      const cached = await client.action("modelFetcher:getModelsForProvider", { provider }).catch(() => null);
      if (cached && !opts.refresh) {
        allModels[provider] = Array.isArray(cached) ? cached : cached.models ?? cached;
      } else {
        info(`Fetching ${provider} models...`);
        const result = await client.action("modelFetcher:refreshAllModels", { provider, apiKey: "" }).catch(() => null);
        if (result) allModels[provider] = result;
      }
    }
    if (opts.json) {
      console.log(JSON.stringify(allModels, null, 2));
      return;
    }
    header("Available Models");
    for (const [provider, list] of Object.entries(allModels)) {
      if (!list?.length) {
        dim(`  ${provider}: no models cached (add API key first)`);
        continue;
      }
      info(`${provider} (${list.length} models):`);
      list.slice(0, 10).forEach((m) => dim(`  ${m.displayName ?? m.id ?? m} ${m.isFromAPI ? "(live)" : "(static)"}`));
      if (list.length > 10) dim(`  ... and ${list.length - 10} more`);
    }
  });
  models.command("refresh").argument("[provider]", "Provider to refresh (default: all)").description("Refresh model list from provider API").action(async (provider) => {
    const client = await createClient();
    const providers = provider ? [provider] : PROVIDERS2;
    for (const p of providers) {
      await client.action("modelFetcher:refreshAllModels", { provider: p, apiKey: "" }).catch(() => {
      });
      success(`Refreshed ${p} models`);
    }
  });
}

// src/commands/workspace.ts
import { mkdir, readdir } from "fs/promises";
import { existsSync as existsSync2 } from "fs";
import { resolve, join } from "path";
import { createWorkspace } from "@agentforge-ai/core";
function registerWorkspaceCommand(program2) {
  const ws = program2.command("workspace").description("Manage agent workspace and skills");
  ws.command("init").option("--dir <dir>", "Project directory", ".").description("Initialize workspace directories (workspace/ and skills/)").action(async (opts) => {
    const base = resolve(opts.dir);
    const workspaceDir = join(base, "workspace");
    const skillsDir = join(base, "skills");
    await mkdir(workspaceDir, { recursive: true });
    await mkdir(skillsDir, { recursive: true });
    success(`Workspace initialized:`);
    info(`  workspace/  \u2014 agent file storage`);
    info(`  skills/     \u2014 SKILL.md skills (agentskills.io format)`);
    dim(`
Place SKILL.md folders in skills/ for agents to discover them.`);
  });
  ws.command("status").option("--dir <dir>", "Project directory", ".").description("Show workspace status and discovered skills").action(async (opts) => {
    const base = resolve(opts.dir);
    const workspaceDir = join(base, "workspace");
    const skillsDir = join(base, "skills");
    header("Workspace Status");
    if (existsSync2(workspaceDir)) {
      const files = await readdir(workspaceDir).catch(() => []);
      info(`Filesystem: ${workspaceDir}`);
      dim(`  ${files.length} item(s)`);
    } else {
      info(`Filesystem: not initialized`);
      dim(`  Run: agentforge workspace init`);
    }
    if (existsSync2(skillsDir)) {
      const entries = await readdir(skillsDir, { withFileTypes: true }).catch(() => []);
      const skills = entries.filter((e) => e.isDirectory());
      info(`
Skills: ${skillsDir}`);
      if (skills.length === 0) {
        dim(`  No skills installed.`);
        dim(`  Run: agentforge skills create <name>`);
      } else {
        for (const skill of skills) {
          const skillMd = join(skillsDir, skill.name, "SKILL.md");
          dim(`  \u2713 ${skill.name}${existsSync2(skillMd) ? "" : " (missing SKILL.md)"}`);
        }
      }
    } else {
      info(`
Skills: not initialized`);
    }
  });
  ws.command("config").option("--storage <type>", "Storage backend: local, s3, r2").option("--bucket <name>", "Bucket name (for S3/R2)").option("--endpoint <url>", "S3-compatible endpoint URL (required for R2)").option("--region <region>", 'AWS region or "auto" for R2').option("--key <key>", "Access key ID").option("--secret <secret>", "Secret access key").description("Configure workspace storage backend").action(async (opts) => {
    const { storage, bucket, endpoint, region, key, secret } = opts;
    if (!storage) {
      error("Storage type is required. Use --storage <local|s3|r2>");
      info("\nExamples:");
      dim("  agentforge workspace config --storage local");
      dim("  agentforge workspace config --storage r2 --bucket my-bucket --endpoint https://example.com --key KEY --secret SECRET");
      dim("  agentforge workspace config --storage s3 --bucket my-bucket --region us-east-1 --key KEY --secret SECRET");
      return;
    }
    if (!["local", "s3", "r2"].includes(storage)) {
      error(`Invalid storage type: ${storage}`);
      info("Valid options: local, s3, r2");
      return;
    }
    if (storage === "s3" || storage === "r2") {
      if (!bucket) {
        error("--bucket <name> is required for S3/R2 storage");
        return;
      }
      if (!key || !secret) {
        error("--key and --secret are required for S3/R2 storage");
        return;
      }
      if (storage === "r2" && !endpoint) {
        warn("R2 typically requires --endpoint URL");
        info("Example: --endpoint https://<accountid>.r2.cloudflarestorage.com");
      }
    }
    process.env.AGENTFORGE_STORAGE = storage;
    header(`Workspace Storage Configured`);
    info(`Storage type: ${storage}`);
    if (storage === "local") {
      info(`Base path: ./workspace (default)`);
      dim(`
To customize base path, set AGENTFORGE_BASE_PATH environment variable.`);
    } else {
      info(`Bucket: ${bucket}`);
      if (region) info(`Region: ${region}`);
      if (endpoint) info(`Endpoint: ${endpoint}`);
      dim(`
Configuration saved to AGENTFORGE_STORAGE environment variable.`);
      dim(`Credentials should be stored in environment variables for production use.`);
    }
  });
  ws.command("test").option("--storage <type>", "Storage backend to test").option("--bucket <name>", "Bucket name (for S3/R2)").option("--endpoint <url>", "S3-compatible endpoint URL").option("--region <region>", "AWS region").option("--key <key>", "Access key ID").option("--secret <secret>", "Secret access key").option("--base-path <path>", "Base path for local storage", "/tmp/agentforge-workspace-test").description("Test workspace storage by writing and reading a file").action(async (opts) => {
    header("Workspace Storage Test");
    const storage = opts.storage ?? process.env.AGENTFORGE_STORAGE ?? "local";
    const config = { storage };
    if (storage === "local") {
      config.basePath = opts.basePath;
    } else {
      config.bucket = opts.bucket;
      config.region = opts.region ?? (storage === "r2" ? "auto" : "us-east-1");
      config.endpoint = opts.endpoint;
      config.accessKeyId = opts.key;
      config.secretAccessKey = opts.secret;
    }
    try {
      info(`Creating ${storage} workspace...`);
      const workspace = createWorkspace(config);
      const fs17 = workspace.filesystem ?? workspace;
      const testPath = `agentforge-test-${Date.now()}.txt`;
      const testContent = `AgentForge workspace test at ${(/* @__PURE__ */ new Date()).toISOString()}`;
      info(`Writing test file: ${testPath}`);
      await fs17.write(testPath, testContent);
      info(`Reading test file...`);
      const readContent = await fs17.read(testPath);
      if (readContent === testContent) {
        success(`\u2713 Storage test passed!`);
        info(`Written and read: "${testContent}"`);
        info(`Cleaning up test file...`);
        await fs17.delete(testPath);
        success(`\u2713 Test file deleted`);
        info(`
\u2713 ${storage.toUpperCase()} storage is working correctly.`);
      } else {
        error(`\u2717 Content mismatch!`);
        error(`Expected: ${testContent}`);
        error(`Got: ${readContent}`);
      }
    } catch (err) {
      error(`\u2717 Storage test failed!`);
      error(err.message);
      if (storage !== "local") {
        info(`
Troubleshooting:`);
        dim(`\u2022 Verify bucket name and credentials are correct`);
        dim(`\u2022 For R2, check that endpoint URL is correct`);
        dim(`\u2022 For S3, check that region is correct`);
        dim(`\u2022 Ensure your access key has write permissions`);
      }
    }
  });
}

// src/commands/tokens.ts
import readline12 from "readline";
import { randomBytes } from "crypto";
function prompt8(question) {
  const rl = readline12.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve4) => rl.question(question, (ans) => {
    rl.close();
    resolve4(ans.trim());
  }));
}
function registerTokensCommand(program2) {
  const tokens = program2.command("tokens").description("Manage API access tokens (for /v1/chat/completions)");
  tokens.command("generate").option("--name <name>", "Token name (required)").description("Generate a new API access token (shown once only)").action(async (opts) => {
    if (!opts.name) {
      error("--name is required");
      process.exit(1);
    }
    const client = await createClient();
    const result = await client.mutation("apiAccessTokens:generate", {
      name: opts.name
    });
    success(`Token "${opts.name}" created.`);
    info(`
  Token: ${result.token}`);
    info(`
  \u26A0\uFE0F  This token will NOT be shown again. Store it securely.`);
    dim(`
Use it as: Authorization: Bearer ${result.token}`);
  });
  tokens.command("list").option("--json", "Output as JSON").description("List all API access tokens").action(async (opts) => {
    const client = await createClient();
    const items = await client.query("apiAccessTokens:list", {});
    if (opts.json) {
      console.log(JSON.stringify(items, null, 2));
      return;
    }
    header("API Access Tokens");
    if (!items.length) {
      dim('No tokens. Create one: agentforge tokens generate --name "my-app"');
      return;
    }
    table(items.map((t) => {
      const maskedToken = t.token ? `${t.token.slice(0, 8)}...${t.token.slice(-4)}` : "...";
      return {
        Name: t.name,
        Token: maskedToken,
        Status: t.isActive ? "Active" : "Revoked",
        Created: new Date(t.createdAt).toLocaleDateString(),
        Expires: t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : "Never"
      };
    }));
  });
  tokens.command("revoke <id>").description("Revoke an API access token").action(async (id) => {
    const client = await createClient();
    try {
      await client.mutation("apiAccessTokens:revoke", { id });
      success(`Token ${id} revoked.`);
    } catch (err) {
      error(`Failed to revoke token: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
  tokens.command("create").option("--name <name>", "Token name (required)").option("--expires <date>", "Expiration date (YYYY-MM-DD format)").description("Create a new API access token").action(async (opts) => {
    if (!opts.name) {
      error("--name is required");
      process.exit(1);
    }
    const client = await createClient();
    let expiresAt;
    if (opts.expires) {
      expiresAt = new Date(opts.expires).getTime();
      if (isNaN(expiresAt)) {
        error(`Invalid date format: ${opts.expires}. Use YYYY-MM-DD format.`);
        process.exit(1);
      }
    }
    try {
      const token = "agf_" + randomBytes(16).toString("hex");
      const result = await client.mutation("apiAccessTokens:generate", {
        name: opts.name,
        expiresAt
      });
      success(`Token created: ${result.token}`);
      info(`Name: ${opts.name} | Expires: ${opts.expires || "Never"} | Status: Active`);
      info(`
  \u26A0\uFE0F  This token will NOT be shown again. Store it securely.`);
    } catch (err) {
      error(`Failed to create token: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
  tokens.command("delete <nameOrId>").option("-f, --force", "Skip confirmation").description("Delete an API access token").action(async (nameOrId, opts) => {
    const client = await createClient();
    const tokens2 = await client.query("apiAccessTokens:list", {});
    const token = tokens2.find(
      (t) => t.name === nameOrId || t._id.toString().endsWith(nameOrId) || t.token?.endsWith(nameOrId)
    );
    if (!token) {
      error(`Token "${nameOrId}" not found.`);
      process.exit(1);
    }
    if (!opts.force) {
      const confirm = await prompt8(`Delete token "${token.name}"? (y/N): `);
      if (confirm.toLowerCase() !== "y") {
        info("Cancelled.");
        return;
      }
    }
    try {
      await client.mutation("apiAccessTokens:remove", { id: token._id });
      success(`Token "${token.name}" deleted.`);
    } catch (err) {
      error(`Failed to delete token: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
}

// src/commands/channel-telegram.ts
import fs9 from "fs-extra";
import path10 from "path";
import readline13 from "readline";
function prompt9(q) {
  const rl = readline13.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => {
    rl.close();
    r(a.trim());
  }));
}
function readEnvValue(key) {
  const cwd = process.cwd();
  const envFiles = [".env.local", ".env", ".env.production"];
  for (const envFile of envFiles) {
    const envPath = path10.join(cwd, envFile);
    if (fs9.existsSync(envPath)) {
      const content = fs9.readFileSync(envPath, "utf-8");
      const match = content.match(new RegExp(`^${key}=(.+)$`, "m"));
      if (match) return match[1].trim().replace(/["']/g, "");
    }
  }
  return void 0;
}
function writeEnvValue(key, value, envFile = ".env.local") {
  const envPath = path10.join(process.cwd(), envFile);
  let content = "";
  if (fs9.existsSync(envPath)) {
    content = fs9.readFileSync(envPath, "utf-8");
  }
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (idx >= 0) {
    lines[idx] = `${key}=${value}`;
  } else {
    lines.push(`${key}=${value}`);
  }
  fs9.writeFileSync(envPath, lines.join("\n"));
}
function registerChannelTelegramCommand(program2) {
  const channel = program2.command("channel:telegram").description("Manage the Telegram messaging channel");
  channel.command("start").description("Start the Telegram bot and begin routing messages to an agent").option("-a, --agent <id>", "Agent ID to route messages to").option("-t, --token <token>", "Telegram Bot Token (overrides .env)").option("--webhook-url <url>", "Use webhook mode with this URL").option("--webhook-secret <secret>", "Webhook verification secret").option("--bot-username <username>", "Bot username for @mention detection").option("--polling-interval <ms>", "Polling interval in milliseconds", "1000").option("--log-level <level>", "Log level: debug, info, warn, error", "info").option("--group-mention-only", "Only respond to @mentions in groups", true).action(async (opts) => {
    header("Telegram Channel");
    const botToken = opts.token || readEnvValue("TELEGRAM_BOT_TOKEN") || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      error("Telegram Bot Token not found.");
      info("Set it with: agentforge channel:telegram configure");
      info("Or pass it with: --token <bot-token>");
      info("Or set TELEGRAM_BOT_TOKEN in your .env.local file");
      process.exit(1);
    }
    const convexUrl = readEnvValue("CONVEX_URL") || process.env.CONVEX_URL;
    if (!convexUrl) {
      error("CONVEX_URL not found. Run `npx convex dev` first.");
      process.exit(1);
    }
    let agentId = opts.agent;
    if (!agentId) {
      agentId = readEnvValue("AGENTFORGE_AGENT_ID") || process.env.AGENTFORGE_AGENT_ID;
    }
    if (!agentId) {
      info("No agent specified. Fetching available agents...");
      const client = await createClient();
      const agents = await safeCall(
        () => client.query("agents:list", {}),
        "Failed to list agents"
      );
      if (!agents || agents.length === 0) {
        error("No agents found. Create one first: agentforge agents create");
        process.exit(1);
      }
      console.log();
      agents.forEach((a, i) => {
        console.log(
          `  ${colors.cyan}${i + 1}.${colors.reset} ${a.name} ${colors.dim}(${a.id})${colors.reset} \u2014 ${a.model}`
        );
      });
      console.log();
      const choice = await prompt9("Select agent (number or ID): ");
      const idx = parseInt(choice) - 1;
      agentId = idx >= 0 && idx < agents.length ? agents[idx].id : choice;
    }
    info(`Agent:    ${agentId}`);
    info(`Convex:   ${convexUrl}`);
    info(`Mode:     ${opts.webhookUrl ? "Webhook" : "Long-polling"}`);
    info(`Log:      ${opts.logLevel}`);
    console.log();
    let TelegramChannel;
    try {
      const corePkg = "@agentforge-ai/core/channels/telegram";
      const mod = await import(
        /* @vite-ignore */
        corePkg
      );
      TelegramChannel = mod.TelegramChannel;
    } catch (importError) {
      error("Could not import @agentforge-ai/core. Using built-in Telegram runner.");
      dim(`  Error: ${importError.message}`);
      console.log();
      await runMinimalTelegramBot({
        botToken,
        agentId,
        convexUrl,
        logLevel: opts.logLevel,
        pollingIntervalMs: parseInt(opts.pollingInterval)
      });
      return;
    }
    try {
      const channel2 = new TelegramChannel({
        botToken,
        agentId,
        convexUrl,
        useWebhook: !!opts.webhookUrl,
        webhookUrl: opts.webhookUrl,
        webhookSecret: opts.webhookSecret,
        botUsername: opts.botUsername,
        groupMentionOnly: opts.groupMentionOnly,
        pollingIntervalMs: parseInt(opts.pollingInterval),
        logLevel: opts.logLevel
      });
      await channel2.start();
      success("Telegram bot is running!");
      dim("  Press Ctrl+C to stop.");
      await new Promise(() => {
      });
    } catch (startError) {
      error(`Failed to start Telegram bot: ${startError.message}`);
      process.exit(1);
    }
  });
  channel.command("configure").description("Configure the Telegram bot token and settings").action(async () => {
    header("Configure Telegram Channel");
    const currentToken = readEnvValue("TELEGRAM_BOT_TOKEN");
    if (currentToken) {
      const masked = currentToken.slice(0, 6) + "****" + currentToken.slice(-4);
      info(`Current token: ${masked}`);
    }
    console.log();
    info("To get a bot token:");
    dim("  1. Open Telegram and search for @BotFather");
    dim("  2. Send /newbot and follow the instructions");
    dim("  3. Copy the token provided");
    console.log();
    const token = await prompt9("Telegram Bot Token: ");
    if (!token) {
      error("Bot token is required.");
      process.exit(1);
    }
    info("Validating token...");
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await response.json();
      if (!data.ok) {
        error("Invalid bot token. Please check and try again.");
        process.exit(1);
      }
      success(`Bot verified: @${data.result?.username} (${data.result?.first_name})`);
      if (data.result?.username) {
        writeEnvValue("TELEGRAM_BOT_USERNAME", data.result.username);
      }
    } catch (fetchError) {
      warn(`Could not validate token (network error): ${fetchError.message}`);
      info("Saving token anyway. You can validate later with: agentforge channel:telegram status");
    }
    writeEnvValue("TELEGRAM_BOT_TOKEN", token);
    success("Token saved to .env.local");
    console.log();
    const defaultAgent = await prompt9("Default agent ID (optional, press Enter to skip): ");
    if (defaultAgent) {
      writeEnvValue("AGENTFORGE_AGENT_ID", defaultAgent);
      success(`Default agent set to: ${defaultAgent}`);
    }
    console.log();
    success("Configuration complete!");
    info("Start the bot with: agentforge channel:telegram start");
  });
  channel.command("status").description("Check the Telegram bot configuration and connectivity").action(async () => {
    header("Telegram Channel Status");
    const token = readEnvValue("TELEGRAM_BOT_TOKEN");
    const agentId = readEnvValue("AGENTFORGE_AGENT_ID");
    const convexUrl = readEnvValue("CONVEX_URL");
    const botUsername = readEnvValue("TELEGRAM_BOT_USERNAME");
    const statusData = {
      "Bot Token": token ? `${token.slice(0, 6)}****${token.slice(-4)}` : `${colors.red}Not configured${colors.reset}`,
      "Bot Username": botUsername ? `@${botUsername}` : `${colors.dim}Unknown${colors.reset}`,
      "Default Agent": agentId || `${colors.dim}Not set${colors.reset}`,
      "Convex URL": convexUrl || `${colors.red}Not configured${colors.reset}`
    };
    details(statusData);
    if (token) {
      info("Checking bot connectivity...");
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await response.json();
        if (data.ok) {
          success(`Bot online: @${data.result?.username} (ID: ${data.result?.id})`);
        } else {
          error("Bot token is invalid or expired.");
        }
      } catch {
        warn("Could not reach Telegram API (network error).");
      }
    }
    if (convexUrl) {
      info("Checking Convex connectivity...");
      try {
        const client = await createClient();
        const agents = await client.query("agents:list", {});
        success(`Convex connected. ${agents.length} agents available.`);
      } catch {
        warn("Could not reach Convex deployment.");
      }
    }
  });
}
async function runMinimalTelegramBot(config) {
  const { botToken, agentId, convexUrl } = config;
  const apiBase = `https://api.telegram.org/bot${botToken}`;
  const convexBase = convexUrl.replace(/\/$/, "");
  const threadMap = /* @__PURE__ */ new Map();
  let lastUpdateId = 0;
  info("Verifying bot token...");
  const meRes = await fetch(`${apiBase}/getMe`);
  const meData = await meRes.json();
  if (!meData.ok) {
    error("Invalid bot token.");
    process.exit(1);
  }
  success(`Bot connected: @${meData.result?.username}`);
  await fetch(`${apiBase}/deleteWebhook`, { method: "POST" });
  info("Polling for messages...");
  dim("  Press Ctrl+C to stop.");
  console.log();
  process.on("SIGINT", () => {
    console.log("\nStopping...");
    process.exit(0);
  });
  async function convexMutation(fn, args) {
    const res = await fetch(`${convexBase}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fn, args })
    });
    const data = await res.json();
    if (data.status === "error") throw new Error(data.errorMessage);
    return data.value;
  }
  async function convexAction(fn, args) {
    const res = await fetch(`${convexBase}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fn, args })
    });
    const data = await res.json();
    if (data.status === "error") throw new Error(data.errorMessage);
    return data.value;
  }
  async function sendTelegramMessage(chatId, text) {
    await fetch(`${apiBase}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  }
  async function sendTyping(chatId) {
    await fetch(`${apiBase}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" })
    }).catch(() => {
    });
  }
  async function getOrCreateThread(chatId, senderName) {
    const cached = threadMap.get(chatId);
    if (cached) return cached;
    const threadId = await convexMutation("chat:createThread", {
      agentId,
      name: senderName ? `Telegram: ${senderName}` : `Telegram Chat ${chatId}`,
      userId: `telegram:${chatId}`
    });
    threadMap.set(chatId, threadId);
    return threadId;
  }
  while (true) {
    try {
      const res = await fetch(`${apiBase}/getUpdates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offset: lastUpdateId + 1,
          timeout: 30,
          allowed_updates: ["message"]
        })
      });
      const data = await res.json();
      if (!data.ok || !data.result) continue;
      for (const update of data.result) {
        lastUpdateId = update.update_id;
        const msg = update.message;
        if (!msg?.text) continue;
        const chatId = String(msg.chat.id);
        const senderName = msg.from?.first_name || "User";
        const text = msg.text.trim();
        if (text === "/start") {
          threadMap.delete(chatId);
          await sendTelegramMessage(chatId, `\u{1F44B} Welcome! I'm powered by AgentForge.

Send me a message and I'll respond using AI.

Commands:
/new \u2014 Start a new conversation
/help \u2014 Show help`);
          continue;
        }
        if (text === "/new") {
          threadMap.delete(chatId);
          await sendTelegramMessage(chatId, "\u{1F504} New conversation started. Send me a message!");
          continue;
        }
        if (text === "/help") {
          await sendTelegramMessage(chatId, "\u{1F916} AgentForge Telegram Bot\n\nJust send me a message and I'll respond using AI.\n\nCommands:\n/start \u2014 Reset and show welcome\n/new \u2014 Start a fresh conversation\n/help \u2014 Show this help");
          continue;
        }
        console.log(`[${senderName}] ${text}`);
        await sendTyping(chatId);
        try {
          const threadId = await getOrCreateThread(chatId, senderName);
          const result = await convexAction("chat:sendMessage", {
            agentId,
            threadId,
            content: text,
            userId: `telegram:${msg.from?.id || chatId}`
          });
          if (result?.response) {
            const response = result.response;
            if (response.length <= 4096) {
              await sendTelegramMessage(chatId, response);
            } else {
              const chunks = response.match(/.{1,4096}/gs) || [];
              for (const chunk of chunks) {
                await sendTelegramMessage(chatId, chunk);
              }
            }
            console.log(`[Agent] ${response.substring(0, 100)}${response.length > 100 ? "..." : ""}`);
          } else {
            await sendTelegramMessage(chatId, "\u{1F914} I couldn't generate a response. Please try again.");
          }
        } catch (routeError) {
          console.error(`Error: ${routeError.message}`);
          await sendTelegramMessage(chatId, "\u26A0\uFE0F Sorry, I encountered an error. Please try again.");
        }
      }
    } catch (pollError) {
      if (pollError.message?.includes("ECONNREFUSED") || pollError.message?.includes("fetch failed")) {
        warn("Network error. Retrying in 5s...");
        await new Promise((r) => setTimeout(r, 5e3));
      } else {
        console.error(`Poll error: ${pollError.message}`);
        await new Promise((r) => setTimeout(r, 1e3));
      }
    }
  }
}

// src/commands/channel-whatsapp.ts
import fs10 from "fs-extra";
import path11 from "path";
import readline14 from "readline";
function prompt10(q) {
  const rl = readline14.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => {
    rl.close();
    r(a.trim());
  }));
}
function readEnvValue2(key) {
  const cwd = process.cwd();
  const envFiles = [".env.local", ".env", ".env.production"];
  for (const envFile of envFiles) {
    const envPath = path11.join(cwd, envFile);
    if (fs10.existsSync(envPath)) {
      const content = fs10.readFileSync(envPath, "utf-8");
      const match = content.match(new RegExp(`^${key}=(.+)$`, "m"));
      if (match) return match[1].trim().replace(/["']/g, "");
    }
  }
  return void 0;
}
function writeEnvValue2(key, value, envFile = ".env.local") {
  const envPath = path11.join(process.cwd(), envFile);
  let content = "";
  if (fs10.existsSync(envPath)) {
    content = fs10.readFileSync(envPath, "utf-8");
  }
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (idx >= 0) {
    lines[idx] = `${key}=${value}`;
  } else {
    lines.push(`${key}=${value}`);
  }
  fs10.writeFileSync(envPath, lines.join("\n"));
}
function registerChannelWhatsAppCommand(program2) {
  const channel = program2.command("channel:whatsapp").description("Manage the WhatsApp messaging channel");
  channel.command("start").description("Start the WhatsApp webhook server and begin routing messages to an agent").option("-a, --agent <id>", "Agent ID to route messages to").option("--access-token <token>", "WhatsApp Cloud API access token (overrides .env)").option("--phone-number-id <id>", "WhatsApp Business Phone Number ID (overrides .env)").option("--verify-token <token>", "Webhook verify token (overrides .env)").option("--webhook-port <port>", "Port for the webhook server", "3001").option("--webhook-path <path>", "Path for the webhook endpoint", "/webhook/whatsapp").option("--api-version <version>", "WhatsApp Cloud API version", "v21.0").option("--log-level <level>", "Log level: debug, info, warn, error", "info").action(async (opts) => {
    header("WhatsApp Channel");
    const accessToken = opts.accessToken || readEnvValue2("WHATSAPP_ACCESS_TOKEN") || process.env.WHATSAPP_ACCESS_TOKEN;
    if (!accessToken) {
      error("WhatsApp Access Token not found.");
      info("Set it with: agentforge channel:whatsapp configure");
      info("Or pass it with: --access-token <token>");
      info("Or set WHATSAPP_ACCESS_TOKEN in your .env.local file");
      process.exit(1);
    }
    const phoneNumberId = opts.phoneNumberId || readEnvValue2("WHATSAPP_PHONE_NUMBER_ID") || process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!phoneNumberId) {
      error("WhatsApp Phone Number ID not found.");
      info("Set it with: agentforge channel:whatsapp configure");
      info("Or pass it with: --phone-number-id <id>");
      info("Or set WHATSAPP_PHONE_NUMBER_ID in your .env.local file");
      process.exit(1);
    }
    const verifyToken = opts.verifyToken || readEnvValue2("WHATSAPP_VERIFY_TOKEN") || process.env.WHATSAPP_VERIFY_TOKEN;
    if (!verifyToken) {
      error("WhatsApp Verify Token not found.");
      info("Set it with: agentforge channel:whatsapp configure");
      info("Or pass it with: --verify-token <token>");
      info("Or set WHATSAPP_VERIFY_TOKEN in your .env.local file");
      process.exit(1);
    }
    const convexUrl = readEnvValue2("CONVEX_URL") || process.env.CONVEX_URL;
    if (!convexUrl) {
      error("CONVEX_URL not found. Run `npx convex dev` first.");
      process.exit(1);
    }
    let agentId = opts.agent;
    if (!agentId) {
      agentId = readEnvValue2("AGENTFORGE_AGENT_ID") || process.env.AGENTFORGE_AGENT_ID;
    }
    if (!agentId) {
      info("No agent specified. Fetching available agents...");
      const client = await createClient();
      const agents = await safeCall(
        () => client.query("agents:list", {}),
        "Failed to list agents"
      );
      if (!agents || agents.length === 0) {
        error("No agents found. Create one first: agentforge agents create");
        process.exit(1);
      }
      console.log();
      agents.forEach((a, i) => {
        console.log(
          `  ${colors.cyan}${i + 1}.${colors.reset} ${a.name} ${colors.dim}(${a.id})${colors.reset} \u2014 ${a.model}`
        );
      });
      console.log();
      const choice = await prompt10("Select agent (number or ID): ");
      const idx = parseInt(choice) - 1;
      agentId = idx >= 0 && idx < agents.length ? agents[idx].id : choice;
    }
    const webhookPort = parseInt(opts.webhookPort);
    const webhookPath = opts.webhookPath;
    info(`Agent:       ${agentId}`);
    info(`Convex:      ${convexUrl}`);
    info(`Webhook:     http://localhost:${webhookPort}${webhookPath}`);
    info(`API Version: ${opts.apiVersion}`);
    info(`Log:         ${opts.logLevel}`);
    console.log();
    let WhatsAppChannel;
    try {
      const corePkg = "@agentforge-ai/core/channels/whatsapp";
      const mod = await import(
        /* @vite-ignore */
        corePkg
      );
      WhatsAppChannel = mod.WhatsAppChannel;
    } catch (importError) {
      error("Could not import @agentforge-ai/core. Using built-in WhatsApp runner.");
      dim(`  Error: ${importError.message}`);
      console.log();
      await runMinimalWhatsAppBot({
        accessToken,
        phoneNumberId,
        verifyToken,
        agentId,
        convexUrl,
        webhookPort,
        webhookPath,
        logLevel: opts.logLevel
      });
      return;
    }
    try {
      const channel2 = new WhatsAppChannel({
        accessToken,
        phoneNumberId,
        verifyToken,
        agentId,
        convexUrl,
        webhookPort,
        webhookPath,
        apiVersion: opts.apiVersion,
        logLevel: opts.logLevel
      });
      await channel2.start();
      success("WhatsApp webhook server is running!");
      dim(`  Webhook URL: http://localhost:${webhookPort}${webhookPath}`);
      dim("  Configure this URL in your Meta App Dashboard.");
      dim("  Press Ctrl+C to stop.");
      await new Promise(() => {
      });
    } catch (startError) {
      error(`Failed to start WhatsApp channel: ${startError.message}`);
      process.exit(1);
    }
  });
  channel.command("configure").description("Configure the WhatsApp Cloud API credentials").action(async () => {
    header("Configure WhatsApp Channel");
    console.log();
    info("To set up WhatsApp Cloud API:");
    dim("  1. Go to https://developers.facebook.com/apps/");
    dim("  2. Create or select a Meta App with WhatsApp product");
    dim("  3. Go to WhatsApp > API Setup");
    dim("  4. Copy the Access Token, Phone Number ID, and set a Verify Token");
    console.log();
    const currentToken = readEnvValue2("WHATSAPP_ACCESS_TOKEN");
    if (currentToken) {
      const masked = currentToken.slice(0, 10) + "****" + currentToken.slice(-4);
      info(`Current access token: ${masked}`);
    }
    const accessToken = await prompt10("WhatsApp Access Token: ");
    if (!accessToken) {
      error("Access token is required.");
      process.exit(1);
    }
    info("Validating access token...");
    try {
      const response = await fetch("https://graph.facebook.com/v21.0/me", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      if (data.error) {
        warn(`Token validation warning: ${data.error.message}`);
        info("Saving token anyway. You can validate later with: agentforge channel:whatsapp status");
      } else {
        success(`Token verified: ${data.name || data.id}`);
      }
    } catch (fetchError) {
      warn(`Could not validate token (network error): ${fetchError.message}`);
      info("Saving token anyway.");
    }
    writeEnvValue2("WHATSAPP_ACCESS_TOKEN", accessToken);
    success("Access token saved to .env.local");
    console.log();
    const currentPhoneId = readEnvValue2("WHATSAPP_PHONE_NUMBER_ID");
    if (currentPhoneId) {
      info(`Current Phone Number ID: ${currentPhoneId}`);
    }
    const phoneNumberId = await prompt10("WhatsApp Phone Number ID: ");
    if (!phoneNumberId) {
      error("Phone Number ID is required.");
      process.exit(1);
    }
    info("Validating phone number...");
    try {
      const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      if (data.error) {
        warn(`Phone number validation warning: ${data.error.message}`);
      } else {
        success(`Phone number verified: ${data.display_phone_number} (${data.verified_name})`);
      }
    } catch {
      warn("Could not validate phone number (network error).");
    }
    writeEnvValue2("WHATSAPP_PHONE_NUMBER_ID", phoneNumberId);
    success("Phone Number ID saved to .env.local");
    console.log();
    const currentVerifyToken = readEnvValue2("WHATSAPP_VERIFY_TOKEN");
    if (currentVerifyToken) {
      info(`Current verify token: ${currentVerifyToken.slice(0, 6)}****`);
    }
    let verifyToken = await prompt10("Webhook Verify Token (press Enter to auto-generate): ");
    if (!verifyToken) {
      verifyToken = `agentforge_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      info(`Generated verify token: ${verifyToken}`);
    }
    writeEnvValue2("WHATSAPP_VERIFY_TOKEN", verifyToken);
    success("Verify token saved to .env.local");
    console.log();
    const defaultAgent = await prompt10("Default agent ID (optional, press Enter to skip): ");
    if (defaultAgent) {
      writeEnvValue2("AGENTFORGE_AGENT_ID", defaultAgent);
      success(`Default agent set to: ${defaultAgent}`);
    }
    console.log();
    success("Configuration complete!");
    info("Start the webhook server with: agentforge channel:whatsapp start");
    console.log();
    info("Next steps:");
    dim("  1. Start the webhook server: agentforge channel:whatsapp start");
    dim("  2. Expose the webhook URL (e.g., with ngrok or cloudflared)");
    dim("  3. Configure the webhook URL in your Meta App Dashboard");
    dim('  4. Subscribe to "messages" webhook field');
  });
  channel.command("status").description("Check the WhatsApp channel configuration and connectivity").action(async () => {
    header("WhatsApp Channel Status");
    const accessToken = readEnvValue2("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = readEnvValue2("WHATSAPP_PHONE_NUMBER_ID");
    const verifyToken = readEnvValue2("WHATSAPP_VERIFY_TOKEN");
    const agentId = readEnvValue2("AGENTFORGE_AGENT_ID");
    const convexUrl = readEnvValue2("CONVEX_URL");
    const statusData = {
      "Access Token": accessToken ? `${accessToken.slice(0, 10)}****${accessToken.slice(-4)}` : `${colors.red}Not configured${colors.reset}`,
      "Phone Number ID": phoneNumberId || `${colors.red}Not configured${colors.reset}`,
      "Verify Token": verifyToken ? `${verifyToken.slice(0, 6)}****` : `${colors.red}Not configured${colors.reset}`,
      "Default Agent": agentId || `${colors.dim}Not set${colors.reset}`,
      "Convex URL": convexUrl || `${colors.red}Not configured${colors.reset}`
    };
    details(statusData);
    if (accessToken && phoneNumberId) {
      info("Checking WhatsApp Cloud API connectivity...");
      try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await response.json();
        if (data.error) {
          error(`API error: ${data.error.message}`);
        } else {
          success(`WhatsApp Business: ${data.verified_name || data.display_phone_number} (ID: ${data.id})`);
        }
      } catch {
        warn("Could not reach WhatsApp Cloud API (network error).");
      }
    }
    if (convexUrl) {
      info("Checking Convex connectivity...");
      try {
        const client = await createClient();
        const agents = await client.query("agents:list", {});
        success(`Convex connected. ${agents.length} agents available.`);
      } catch {
        warn("Could not reach Convex deployment.");
      }
    }
  });
}
async function runMinimalWhatsAppBot(config) {
  const { accessToken, phoneNumberId, verifyToken, agentId, convexUrl, webhookPort, webhookPath } = config;
  const apiBase = `https://graph.facebook.com/v21.0`;
  const convexBase = convexUrl.replace(/\/$/, "");
  const threadMap = /* @__PURE__ */ new Map();
  info("Verifying WhatsApp access token...");
  try {
    const res = await fetch(`${apiBase}/${phoneNumberId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();
    if (data.error) {
      error(`API error: ${data.error.message}`);
      process.exit(1);
    }
    success(`WhatsApp Business: ${data.verified_name || data.display_phone_number}`);
  } catch (fetchError) {
    warn(`Could not verify token: ${fetchError.message}`);
    info("Continuing anyway...");
  }
  async function convexMutation(fn, args) {
    const res = await fetch(`${convexBase}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fn, args })
    });
    const data = await res.json();
    if (data.status === "error") throw new Error(data.errorMessage);
    return data.value;
  }
  async function convexAction(fn, args) {
    const res = await fetch(`${convexBase}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fn, args })
    });
    const data = await res.json();
    if (data.status === "error") throw new Error(data.errorMessage);
    return data.value;
  }
  async function sendWhatsAppMessage(to, text) {
    await fetch(`${apiBase}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text }
      })
    });
  }
  async function markAsRead(messageId) {
    await fetch(`${apiBase}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId
      })
    }).catch(() => {
    });
  }
  async function getOrCreateThread(phoneNumber, senderName) {
    const cached = threadMap.get(phoneNumber);
    if (cached) return cached;
    const threadId = await convexMutation("chat:createThread", {
      agentId,
      name: senderName ? `WhatsApp: ${senderName}` : `WhatsApp +${phoneNumber}`,
      userId: `whatsapp:${phoneNumber}`
    });
    threadMap.set(phoneNumber, threadId);
    return threadId;
  }
  const http = await import("http");
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${webhookPort}`);
    if (url.pathname !== webhookPath) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token === verifyToken) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(challenge);
      } else {
        res.writeHead(403);
        res.end("Forbidden");
      }
      return;
    }
    if (req.method === "POST") {
      try {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());
        res.writeHead(200);
        res.end("OK");
        if (body.object !== "whatsapp_business_account") return;
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field !== "messages") continue;
            const contacts = change.value.contacts || [];
            const messages = change.value.messages || [];
            for (const msg of messages) {
              if (msg.type !== "text" || !msg.text?.body) continue;
              const from = msg.from;
              const text = msg.text.body.trim();
              const contact = contacts.find((c) => c.wa_id === from);
              const senderName = contact?.profile?.name || from;
              console.log(`[${senderName}] ${text}`);
              await markAsRead(msg.id);
              try {
                const threadId = await getOrCreateThread(from, senderName);
                const result = await convexAction("chat:sendMessage", {
                  agentId,
                  threadId,
                  content: text,
                  userId: `whatsapp:${from}`
                });
                if (result?.response) {
                  const response = result.response;
                  if (response.length <= 4096) {
                    await sendWhatsAppMessage(from, response);
                  } else {
                    const chunks2 = response.match(/.{1,4096}/gs) || [];
                    for (const chunk of chunks2) {
                      await sendWhatsAppMessage(from, chunk);
                    }
                  }
                  console.log(`[Agent] ${response.substring(0, 100)}${response.length > 100 ? "..." : ""}`);
                } else {
                  await sendWhatsAppMessage(from, "\u{1F914} I couldn't generate a response. Please try again.");
                }
              } catch (routeError) {
                console.error(`Error: ${routeError.message}`);
                await sendWhatsAppMessage(from, "\u26A0\uFE0F Sorry, I encountered an error. Please try again.");
              }
            }
          }
        }
      } catch (parseError) {
        console.error(`Parse error: ${parseError.message}`);
        if (!res.headersSent) {
          res.writeHead(400);
          res.end("Bad Request");
        }
      }
      return;
    }
    res.writeHead(405);
    res.end("Method Not Allowed");
  });
  process.on("SIGINT", () => {
    console.log("\nStopping...");
    server.close();
    process.exit(0);
  });
  server.listen(webhookPort, () => {
    success(`Webhook server listening on port ${webhookPort}`);
    info(`Webhook URL: http://localhost:${webhookPort}${webhookPath}`);
    console.log();
    info("Next steps:");
    dim("  1. Expose this URL publicly (e.g., ngrok http " + webhookPort + ")");
    dim("  2. Configure the webhook URL in your Meta App Dashboard");
    dim('  3. Subscribe to "messages" webhook field');
    dim("  Press Ctrl+C to stop.");
  });
  await new Promise(() => {
  });
}

// src/commands/channel-slack.ts
import fs11 from "fs-extra";
import path12 from "path";
import readline15 from "readline";
function prompt11(q) {
  const rl = readline15.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => {
    rl.close();
    r(a.trim());
  }));
}
function readEnvValue3(key) {
  const cwd = process.cwd();
  const envFiles = [".env.local", ".env", ".env.production"];
  for (const envFile of envFiles) {
    const envPath = path12.join(cwd, envFile);
    if (fs11.existsSync(envPath)) {
      const content = fs11.readFileSync(envPath, "utf-8");
      const match = content.match(new RegExp(`^${key}=(.+)$`, "m"));
      if (match) return match[1].trim().replace(/["']/g, "");
    }
  }
  return void 0;
}
function writeEnvValue3(key, value, envFile = ".env.local") {
  const envPath = path12.join(process.cwd(), envFile);
  let content = "";
  if (fs11.existsSync(envPath)) {
    content = fs11.readFileSync(envPath, "utf-8");
  }
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (idx >= 0) {
    lines[idx] = `${key}=${value}`;
  } else {
    lines.push(`${key}=${value}`);
  }
  fs11.writeFileSync(envPath, lines.join("\n"));
}
function registerChannelSlackCommand(program2) {
  const channel = program2.command("channel:slack").description("Manage the Slack messaging channel");
  channel.command("start").description("Start the Slack bot and begin routing messages to an agent").option("-a, --agent <id>", "Agent ID to route messages to").option("--bot-token <token>", "Slack bot token (xoxb-...) (overrides .env)").option("--app-token <token>", "Slack app-level token (xapp-...) for socket mode (overrides .env)").option("--signing-secret <secret>", "Slack signing secret (overrides .env)").option("--socket-mode", "Enable socket mode (default: true)", true).option("--log-level <level>", "Log level: debug, info, warn, error", "info").action(async (opts) => {
    header("Slack Channel");
    const botToken = opts.botToken || readEnvValue3("SLACK_BOT_TOKEN") || process.env.SLACK_BOT_TOKEN;
    if (!botToken) {
      error("Slack Bot Token not found.");
      info("Set it with: agentforge channel:slack configure");
      info("Or pass it with: --bot-token <token>");
      info("Or set SLACK_BOT_TOKEN in your .env.local file");
      process.exit(1);
    }
    const appToken = opts.appToken || readEnvValue3("SLACK_APP_TOKEN") || process.env.SLACK_APP_TOKEN;
    if (opts.socketMode && !appToken) {
      error("Slack App Token not found (required for socket mode).");
      info("Set it with: agentforge channel:slack configure");
      info("Or pass it with: --app-token <token>");
      info("Or set SLACK_APP_TOKEN in your .env.local file");
      info("Or disable socket mode with: --no-socket-mode");
      process.exit(1);
    }
    const signingSecret = opts.signingSecret || readEnvValue3("SLACK_SIGNING_SECRET") || process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      error("Slack Signing Secret not found.");
      info("Set it with: agentforge channel:slack configure");
      info("Or pass it with: --signing-secret <secret>");
      info("Or set SLACK_SIGNING_SECRET in your .env.local file");
      process.exit(1);
    }
    const convexUrl = readEnvValue3("CONVEX_URL") || process.env.CONVEX_URL;
    if (!convexUrl) {
      error("CONVEX_URL not found. Run `npx convex dev` first.");
      process.exit(1);
    }
    let agentId = opts.agent;
    if (!agentId) {
      agentId = readEnvValue3("AGENTFORGE_AGENT_ID") || process.env.AGENTFORGE_AGENT_ID;
    }
    if (!agentId) {
      info("No agent specified. Fetching available agents...");
      const client = await createClient();
      const agents = await safeCall(
        () => client.query("agents:list", {}),
        "Failed to list agents"
      );
      if (!agents || agents.length === 0) {
        error("No agents found. Create one first: agentforge agents create");
        process.exit(1);
      }
      console.log();
      agents.forEach((a, i) => {
        console.log(
          `  ${colors.cyan}${i + 1}.${colors.reset} ${a.name} ${colors.dim}(${a.id})${colors.reset} \u2014 ${a.model}`
        );
      });
      console.log();
      const choice = await prompt11("Select agent (number or ID): ");
      const idx = parseInt(choice) - 1;
      agentId = idx >= 0 && idx < agents.length ? agents[idx].id : choice;
    }
    info(`Agent:       ${agentId}`);
    info(`Convex:      ${convexUrl}`);
    info(`Mode:        ${opts.socketMode ? "Socket Mode" : "Events API"}`);
    info(`Log:         ${opts.logLevel}`);
    console.log();
    let startSlackChannel;
    try {
      const slackPkg = "@agentforge-ai/core";
      const mod = await import(
        /* @vite-ignore */
        slackPkg
      );
      startSlackChannel = mod.startSlackChannel;
    } catch (importError) {
      error("Could not import @agentforge-ai/core. Using built-in Slack runner.");
      dim(`  Error: ${importError.message}`);
      console.log();
      await runMinimalSlackBot({
        botToken,
        appToken: appToken || "",
        signingSecret,
        agentId,
        convexUrl,
        socketMode: opts.socketMode,
        logLevel: opts.logLevel
      });
      return;
    }
    try {
      await startSlackChannel({
        botToken,
        appToken,
        signingSecret,
        agentId,
        convexUrl,
        socketMode: opts.socketMode,
        logLevel: opts.logLevel
      });
      success("Slack bot is running!");
      dim("  Press Ctrl+C to stop.");
      await new Promise(() => {
      });
    } catch (startError) {
      error(`Failed to start Slack bot: ${startError.message}`);
      process.exit(1);
    }
  });
  channel.command("configure").description("Configure the Slack bot credentials and settings").action(async () => {
    header("Configure Slack Channel");
    console.log();
    info("To set up a Slack app:");
    dim("  1. Go to https://api.slack.com/apps and create a new app");
    dim("  2. Enable Socket Mode under Settings > Socket Mode");
    dim("  3. Add bot scopes: chat:write, im:history, im:read, channels:history");
    dim("  4. Install the app to your workspace");
    dim("  5. Copy the Bot Token, App-Level Token, and Signing Secret");
    console.log();
    const currentBotToken = readEnvValue3("SLACK_BOT_TOKEN");
    if (currentBotToken) {
      const masked = currentBotToken.slice(0, 8) + "****" + currentBotToken.slice(-4);
      info(`Current bot token: ${masked}`);
    }
    const botToken = await prompt11("Slack Bot Token (xoxb-...): ");
    if (!botToken) {
      error("Bot token is required.");
      process.exit(1);
    }
    if (!botToken.startsWith("xoxb-")) {
      warn('Bot token should start with "xoxb-". Please verify this is correct.');
    }
    info("Validating bot token...");
    try {
      const response = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (!data.ok) {
        warn(`Token validation warning: ${data.error}`);
        info("Saving token anyway. You can validate later with: agentforge channel:slack status");
      } else {
        success(`Bot verified: @${data.user} in workspace "${data.team}"`);
      }
    } catch (fetchError) {
      warn(`Could not validate token (network error): ${fetchError.message}`);
      info("Saving token anyway.");
    }
    writeEnvValue3("SLACK_BOT_TOKEN", botToken);
    success("Bot token saved to .env.local");
    console.log();
    const currentAppToken = readEnvValue3("SLACK_APP_TOKEN");
    if (currentAppToken) {
      const masked = currentAppToken.slice(0, 8) + "****" + currentAppToken.slice(-4);
      info(`Current app token: ${masked}`);
    }
    const appToken = await prompt11("Slack App-Level Token (xapp-..., for socket mode): ");
    if (!appToken) {
      warn("App-level token not provided. Socket mode will not be available.");
    } else {
      if (!appToken.startsWith("xapp-")) {
        warn('App token should start with "xapp-". Please verify this is correct.');
      }
      writeEnvValue3("SLACK_APP_TOKEN", appToken);
      success("App token saved to .env.local");
    }
    console.log();
    const currentSigningSecret = readEnvValue3("SLACK_SIGNING_SECRET");
    if (currentSigningSecret) {
      info(`Current signing secret: ${currentSigningSecret.slice(0, 6)}****`);
    }
    const signingSecret = await prompt11("Slack Signing Secret: ");
    if (!signingSecret) {
      error("Signing secret is required.");
      process.exit(1);
    }
    if (signingSecret.length < 20) {
      warn("Signing secret looks too short. Please verify this is correct.");
    }
    writeEnvValue3("SLACK_SIGNING_SECRET", signingSecret);
    success("Signing secret saved to .env.local");
    console.log();
    const defaultAgent = await prompt11("Default agent ID (optional, press Enter to skip): ");
    if (defaultAgent) {
      writeEnvValue3("AGENTFORGE_AGENT_ID", defaultAgent);
      success(`Default agent set to: ${defaultAgent}`);
    }
    console.log();
    success("Configuration complete!");
    info("Start the bot with: agentforge channel:slack start");
  });
  channel.command("status").description("Check the Slack bot configuration and connectivity").action(async () => {
    header("Slack Channel Status");
    const botToken = readEnvValue3("SLACK_BOT_TOKEN");
    const appToken = readEnvValue3("SLACK_APP_TOKEN");
    const signingSecret = readEnvValue3("SLACK_SIGNING_SECRET");
    const agentId = readEnvValue3("AGENTFORGE_AGENT_ID");
    const convexUrl = readEnvValue3("CONVEX_URL");
    const statusData = {
      "Bot Token": botToken ? `${botToken.slice(0, 8)}****${botToken.slice(-4)}` : `${colors.red}Not configured${colors.reset}`,
      "App Token": appToken ? `${appToken.slice(0, 8)}****${appToken.slice(-4)}` : `${colors.dim}Not set${colors.reset}`,
      "Signing Secret": signingSecret ? `${signingSecret.slice(0, 6)}****` : `${colors.red}Not configured${colors.reset}`,
      "Default Agent": agentId || `${colors.dim}Not set${colors.reset}`,
      "Convex URL": convexUrl || `${colors.red}Not configured${colors.reset}`
    };
    details(statusData);
    if (botToken) {
      info("Checking Slack API connectivity...");
      try {
        const response = await fetch("https://slack.com/api/auth.test", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${botToken}`,
            "Content-Type": "application/json"
          }
        });
        const data = await response.json();
        if (data.ok) {
          success(`Slack API connected: @${data.user} in workspace "${data.team}" (${data.team_id})`);
        } else {
          error(`Slack API error: ${data.error}`);
        }
      } catch {
        warn("Could not reach Slack API (network error).");
      }
    }
    if (convexUrl) {
      info("Checking Convex connectivity...");
      try {
        const client = await createClient();
        const agents = await client.query("agents:list", {});
        success(`Convex connected. ${agents.length} agents available.`);
      } catch {
        warn("Could not reach Convex deployment.");
      }
    }
  });
}
async function runMinimalSlackBot(config) {
  const { botToken, appToken, signingSecret, agentId, convexUrl } = config;
  const convexBase = convexUrl.replace(/\/$/, "");
  const threadMap = /* @__PURE__ */ new Map();
  info("Verifying Slack bot token...");
  try {
    const res = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json"
      }
    });
    const data = await res.json();
    if (!data.ok) {
      error(`Slack auth error: ${data.error}`);
      process.exit(1);
    }
    success(`Slack bot connected: @${data.user} in "${data.team}"`);
  } catch (fetchError) {
    warn(`Could not verify bot token: ${fetchError.message}`);
    info("Continuing anyway...");
  }
  async function convexMutation(fn, args) {
    const res = await fetch(`${convexBase}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fn, args })
    });
    const data = await res.json();
    if (data.status === "error") throw new Error(data.errorMessage);
    return data.value;
  }
  async function convexAction(fn, args) {
    const res = await fetch(`${convexBase}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fn, args })
    });
    const data = await res.json();
    if (data.status === "error") throw new Error(data.errorMessage);
    return data.value;
  }
  async function sendSlackMessage(channel, text, threadTs) {
    const body = { channel, text };
    if (threadTs) body.thread_ts = threadTs;
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  }
  async function getOrCreateThread(channelThreadKey, senderName) {
    const cached = threadMap.get(channelThreadKey);
    if (cached) return cached;
    const threadId = await convexMutation("chat:createThread", {
      agentId,
      name: senderName ? `Slack: ${senderName}` : `Slack ${channelThreadKey}`,
      userId: `slack:${channelThreadKey}`
    });
    threadMap.set(channelThreadKey, threadId);
    return threadId;
  }
  async function handleSlackMessage(event) {
    if (event.bot_id || event.subtype) return;
    const channelId = event.channel;
    const userId = event.user;
    const text = (event.text || "").trim();
    const threadTs = event.thread_ts || event.ts;
    if (!text) return;
    const threadKey = `${channelId}:${userId}`;
    console.log(`[Slack:${channelId}] ${text}`);
    try {
      const convexThreadId = await getOrCreateThread(threadKey, `slack:${userId}`);
      const result = await convexAction("chat:sendMessage", {
        agentId,
        threadId: convexThreadId,
        content: text,
        userId: `slack:${userId}`
      });
      if (result?.response) {
        const response = result.response;
        if (response.length <= 4e3) {
          await sendSlackMessage(channelId, response, threadTs);
        } else {
          const chunks = response.match(/.{1,4000}/gs) || [];
          for (const chunk of chunks) {
            await sendSlackMessage(channelId, chunk, threadTs);
          }
        }
        console.log(`[Agent] ${response.substring(0, 100)}${response.length > 100 ? "..." : ""}`);
      } else {
        await sendSlackMessage(channelId, "I couldn't generate a response. Please try again.", threadTs);
      }
    } catch (routeError) {
      console.error(`Error: ${routeError.message}`);
      await sendSlackMessage(channelId, "Sorry, I encountered an error. Please try again.", threadTs);
    }
  }
  if (appToken && config.socketMode !== false) {
    info("Starting in Socket Mode...");
    try {
      const wsUrlRes = await fetch("https://slack.com/api/apps.connections.open", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${appToken}`,
          "Content-Type": "application/json"
        }
      });
      const wsData = await wsUrlRes.json();
      if (!wsData.ok || !wsData.url) {
        throw new Error(`Could not open WebSocket connection: ${wsData.error}`);
      }
      const { default: WebSocket } = await import("ws");
      const ws = new WebSocket(wsData.url);
      ws.on("open", () => {
        success("Socket Mode connected!");
        dim("  Listening for messages. Press Ctrl+C to stop.");
        console.log();
      });
      ws.on("message", async (data) => {
        try {
          const payload = JSON.parse(data.toString());
          if (payload.envelope_id) {
            ws.send(JSON.stringify({ envelope_id: payload.envelope_id }));
          }
          if (payload.type === "events_api" && payload.payload?.event) {
            const event = payload.payload.event;
            if (event.type === "message") {
              await handleSlackMessage(event);
            }
          }
          if (payload.type === "slash_commands" && payload.payload) {
            const slashPayload = payload.payload;
            const command = slashPayload.command;
            const channelId = slashPayload.channel_id;
            const userId = slashPayload.user_id;
            const text = slashPayload.text || "";
            if (command === "/start" || command === "/new") {
              const key = `${channelId}:${userId}`;
              threadMap.delete(key);
              await sendSlackMessage(channelId, "New conversation started! Send me a message.");
            } else if (command === "/help") {
              await sendSlackMessage(channelId, "AgentForge Slack Bot\n\nJust send me a message and I'll respond using AI.\n\nCommands:\n/start \u2014 Reset and start fresh\n/new \u2014 Start a fresh conversation\n/help \u2014 Show this help\n/ask <question> \u2014 Ask a question");
            } else if (command === "/ask") {
              await handleSlackMessage({ channel: channelId, user: userId, text, ts: Date.now().toString() });
            }
          }
        } catch (parseError) {
          console.error(`Error processing message: ${parseError.message}`);
        }
      });
      ws.on("close", (code) => {
        warn(`Socket Mode disconnected (code: ${code}). Reconnecting in 5s...`);
        setTimeout(() => runMinimalSlackBot(config), 5e3);
      });
      ws.on("error", (err) => {
        console.error(`WebSocket error: ${err.message}`);
      });
      process.on("SIGINT", () => {
        console.log("\nStopping...");
        ws.close();
        process.exit(0);
      });
      await new Promise(() => {
      });
    } catch (socketError) {
      warn(`Socket Mode failed: ${socketError.message}`);
      info("Falling back to HTTP Events API server...");
    }
  }
  info("Starting HTTP server for Events API...");
  const port = 3002;
  const path_ = "/slack/events";
  const http = await import("http");
  const { createHmac, timingSafeEqual } = await import("crypto");
  function verifySlackSignature(body, timestamp, signature) {
    const sigBaseString = `v0:${timestamp}:${body}`;
    const hmac = createHmac("sha256", signingSecret);
    hmac.update(sigBaseString);
    const computedSig = `v0=${hmac.digest("hex")}`;
    try {
      return timingSafeEqual(Buffer.from(computedSig), Buffer.from(signature));
    } catch {
      return false;
    }
  }
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    if (url.pathname !== path_) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end("Method Not Allowed");
      return;
    }
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks).toString();
      const timestamp = req.headers["x-slack-request-timestamp"];
      const signature = req.headers["x-slack-signature"];
      if (timestamp && signature && signingSecret) {
        const now = Math.floor(Date.now() / 1e3);
        if (Math.abs(now - parseInt(timestamp)) > 300) {
          res.writeHead(403);
          res.end("Request too old");
          return;
        }
        if (!verifySlackSignature(rawBody, timestamp, signature)) {
          res.writeHead(403);
          res.end("Invalid signature");
          return;
        }
      }
      const body = JSON.parse(rawBody);
      if (body.type === "url_verification") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ challenge: body.challenge }));
        return;
      }
      res.writeHead(200);
      res.end("OK");
      if (body.type === "event_callback" && body.event?.type === "message") {
        await handleSlackMessage(body.event);
      }
    } catch (parseError) {
      console.error(`Parse error: ${parseError.message}`);
      if (!res.headersSent) {
        res.writeHead(400);
        res.end("Bad Request");
      }
    }
  });
  process.on("SIGINT", () => {
    console.log("\nStopping...");
    server.close();
    process.exit(0);
  });
  server.listen(port, () => {
    success(`Events API server listening on port ${port}`);
    info(`Events API URL: http://localhost:${port}${path_}`);
    console.log();
    info("Next steps:");
    dim("  1. Expose this URL publicly (e.g., ngrok http " + port + ")");
    dim("  2. Configure the Events API URL in your Slack app settings");
    dim('  3. Subscribe to the "message.im" and "message.channels" events');
    dim("  Press Ctrl+C to stop.");
  });
  await new Promise(() => {
  });
}

// src/commands/channel-discord.ts
import fs12 from "fs-extra";
import path13 from "path";
import readline16 from "readline";
function prompt12(q) {
  const rl = readline16.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => {
    rl.close();
    r(a.trim());
  }));
}
function readEnvValue4(key) {
  const cwd = process.cwd();
  const envFiles = [".env.local", ".env", ".env.production"];
  for (const envFile of envFiles) {
    const envPath = path13.join(cwd, envFile);
    if (fs12.existsSync(envPath)) {
      const content = fs12.readFileSync(envPath, "utf-8");
      const match = content.match(new RegExp(`^${key}=(.+)$`, "m"));
      if (match) return match[1].trim().replace(/["']/g, "");
    }
  }
  return void 0;
}
function writeEnvValue4(key, value, envFile = ".env.local") {
  const envPath = path13.join(process.cwd(), envFile);
  let content = "";
  if (fs12.existsSync(envPath)) {
    content = fs12.readFileSync(envPath, "utf-8");
  }
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (idx >= 0) {
    lines[idx] = `${key}=${value}`;
  } else {
    lines.push(`${key}=${value}`);
  }
  fs12.writeFileSync(envPath, lines.join("\n"));
}
function registerChannelDiscordCommand(program2) {
  const channel = program2.command("channel:discord").description("Manage the Discord messaging channel");
  channel.command("start").description("Start the Discord bot and begin routing messages to an agent").option("-a, --agent <id>", "Agent ID to route messages to").option("-t, --token <token>", "Discord Bot Token (overrides .env)").option("--client-id <id>", "Discord Client ID (for slash commands)").option("--guild-id <id>", "Discord Guild ID for guild-specific commands").option("--mention-only", "Only respond to @mentions in servers", false).option("--no-dms", "Disable DM responses").option("--log-level <level>", "Log level: debug, info, warn, error", "info").action(async (opts) => {
    header("Discord Channel");
    const botToken = opts.token || readEnvValue4("DISCORD_BOT_TOKEN") || process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      error("Discord Bot Token not found.");
      info("Set it with: agentforge channel:discord configure");
      info("Or pass it with: --token <bot-token>");
      info("Or set DISCORD_BOT_TOKEN in your .env.local file");
      process.exit(1);
    }
    if (!botToken.startsWith("Bot ")) {
      warn('Bot token should start with "Bot ". Attempting to continue...');
    }
    const convexUrl = readEnvValue4("CONVEX_URL") || process.env.CONVEX_URL;
    if (!convexUrl) {
      error("CONVEX_URL not found. Run `npx convex dev` first.");
      process.exit(1);
    }
    let agentId = opts.agent;
    if (!agentId) {
      agentId = readEnvValue4("AGENTFORGE_AGENT_ID") || process.env.AGENTFORGE_AGENT_ID;
    }
    if (!agentId) {
      info("No agent specified. Fetching available agents...");
      const client = await createClient();
      const agents = await safeCall(
        () => client.query("agents:list", {}),
        "Failed to list agents"
      );
      if (!agents || agents.length === 0) {
        error("No agents found. Create one first: agentforge agents create");
        process.exit(1);
      }
      console.log();
      agents.forEach((a, i) => {
        console.log(
          `  ${colors.cyan}${i + 1}.${colors.reset} ${a.name} ${colors.dim}(${a.id})${colors.reset} \u2014 ${a.model}`
        );
      });
      console.log();
      const choice = await prompt12("Select agent (number or ID): ");
      const idx = parseInt(choice) - 1;
      agentId = idx >= 0 && idx < agents.length ? agents[idx].id : choice;
    }
    info(`Agent:       ${agentId}`);
    info(`Convex:      ${convexUrl}`);
    info(`Mention Only:${opts.mentionOnly ? " Yes" : " No"}`);
    info(`DMs:         ${opts.dms ? " Disabled" : " Enabled"}`);
    info(`Log:         ${opts.logLevel}`);
    console.log();
    let startDiscordChannel;
    try {
      const discordPkg = "@agentforge-ai/core";
      const mod = await import(
        /* @vite-ignore */
        discordPkg
      );
      startDiscordChannel = mod.startDiscordChannel;
    } catch (importError) {
      error("Could not import @agentforge-ai/core. Using built-in Discord runner.");
      dim(`  Error: ${importError.message}`);
      console.log();
      await runMinimalDiscordBot({
        botToken,
        clientId: opts.clientId || readEnvValue4("DISCORD_CLIENT_ID") || "",
        guildId: opts.guildId || readEnvValue4("DISCORD_GUILD_ID") || "",
        agentId,
        convexUrl,
        mentionOnly: opts.mentionOnly,
        respondToDMs: !opts.noDms,
        logLevel: opts.logLevel
      });
      return;
    }
    try {
      await startDiscordChannel({
        botToken,
        clientId: opts.clientId,
        guildId: opts.guildId,
        agentId,
        convexUrl,
        mentionOnly: opts.mentionOnly,
        respondToDMs: !opts.noDms,
        logLevel: opts.logLevel
      });
      success("Discord bot is running!");
      dim("  Press Ctrl+C to stop.");
      await new Promise(() => {
      });
    } catch (startError) {
      error(`Failed to start Discord bot: ${startError.message}`);
      process.exit(1);
    }
  });
  channel.command("configure").description("Configure the Discord bot credentials and settings").action(async () => {
    header("Configure Discord Channel");
    console.log();
    info("To set up a Discord bot:");
    dim("  1. Go to https://discord.com/developers/applications and create a new application");
    dim('  2. Create a bot user under the "Bot" section');
    dim('  3. Enable "MESSAGE CONTENT INTENT" under Privileged Gateway Intents');
    dim("  4. Copy the bot token");
    dim("  5. (Optional) Copy the Client ID for slash commands");
    console.log();
    const currentBotToken = readEnvValue4("DISCORD_BOT_TOKEN");
    if (currentBotToken) {
      const masked = currentBotToken.slice(0, 10) + "****" + currentBotToken.slice(-4);
      info(`Current bot token: ${masked}`);
    }
    const botToken = await prompt12("Discord Bot Token: ");
    if (!botToken) {
      error("Bot token is required.");
      process.exit(1);
    }
    info("Validating bot token...");
    try {
      const response = await fetch("https://discord.com/api/v10/users/@me", {
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json"
        }
      });
      if (response.ok) {
        const data = await response.json();
        success(`Bot verified: ${data.username} (${data.id})`);
      } else if (response.status === 401) {
        error("Invalid bot token. Please check and try again.");
        process.exit(1);
      } else {
        warn(`Token validation returned status ${response.status}. Saving anyway.`);
      }
    } catch (fetchError) {
      warn(`Could not validate token (network error): ${fetchError.message}`);
      info("Saving token anyway.");
    }
    const formattedToken = botToken.startsWith("Bot ") ? botToken : `Bot ${botToken}`;
    writeEnvValue4("DISCORD_BOT_TOKEN", formattedToken);
    success("Bot token saved to .env.local");
    console.log();
    const currentClientId = readEnvValue4("DISCORD_CLIENT_ID");
    if (currentClientId) {
      info(`Current client ID: ${currentClientId}`);
    }
    const clientId = await prompt12("Discord Client ID (optional, for slash commands, press Enter to skip): ");
    if (clientId) {
      writeEnvValue4("DISCORD_CLIENT_ID", clientId);
      success("Client ID saved to .env.local");
    }
    console.log();
    const guildId = await prompt12("Discord Guild ID (optional, for guild-specific commands, press Enter to skip): ");
    if (guildId) {
      writeEnvValue4("DISCORD_GUILD_ID", guildId);
      success("Guild ID saved to .env.local");
    }
    console.log();
    const defaultAgent = await prompt12("Default agent ID (optional, press Enter to skip): ");
    if (defaultAgent) {
      writeEnvValue4("AGENTFORGE_AGENT_ID", defaultAgent);
      success(`Default agent set to: ${defaultAgent}`);
    }
    console.log();
    success("Configuration complete!");
    info("Start the bot with: agentforge channel:discord start");
  });
  channel.command("status").description("Check the Discord bot configuration and connectivity").action(async () => {
    header("Discord Channel Status");
    const botToken = readEnvValue4("DISCORD_BOT_TOKEN");
    const clientId = readEnvValue4("DISCORD_CLIENT_ID");
    const guildId = readEnvValue4("DISCORD_GUILD_ID");
    const agentId = readEnvValue4("AGENTFORGE_AGENT_ID");
    const convexUrl = readEnvValue4("CONVEX_URL");
    const statusData = {
      "Bot Token": botToken ? `${botToken.slice(0, 10)}****${botToken.slice(-4)}` : `${colors.red}Not configured${colors.reset}`,
      "Client ID": clientId || `${colors.dim}Not set${colors.reset}`,
      "Guild ID": guildId || `${colors.dim}Not set${colors.reset}`,
      "Default Agent": agentId || `${colors.dim}Not set${colors.reset}`,
      "Convex URL": convexUrl || `${colors.red}Not configured${colors.reset}`
    };
    details(statusData);
    if (botToken) {
      info("Checking Discord API connectivity...");
      try {
        const response = await fetch("https://discord.com/api/v10/users/@me", {
          headers: {
            Authorization: botToken.startsWith("Bot ") ? botToken : `Bot ${botToken}`,
            "Content-Type": "application/json"
          }
        });
        if (response.ok) {
          const data = await response.json();
          success(`Discord API connected: ${data.username}${data.discriminator !== "0" ? `#${data.discriminator}` : ""} (${data.id})`);
        } else if (response.status === 401) {
          error("Invalid bot token.");
        } else {
          error(`Discord API error: ${response.status}`);
        }
      } catch {
        warn("Could not reach Discord API (network error).");
      }
    }
    if (convexUrl) {
      info("Checking Convex connectivity...");
      try {
        const client = await createClient();
        const agents = await client.query("agents:list", {});
        success(`Convex connected. ${agents.length} agents available.`);
      } catch {
        warn("Could not reach Convex deployment.");
      }
    }
  });
}
async function runMinimalDiscordBot(config) {
  const { botToken, agentId, convexUrl, mentionOnly, respondToDMs } = config;
  const convexBase = convexUrl.replace(/\/$/, "");
  const threadMap = /* @__PURE__ */ new Map();
  info("Verifying Discord bot token...");
  try {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
      headers: {
        Authorization: botToken.startsWith("Bot ") ? botToken : `Bot ${botToken}`,
        "Content-Type": "application/json"
      }
    });
    const data = await res.json();
    if (data.error) {
      error(`Discord auth error: ${data.error}`);
      process.exit(1);
    }
    success(`Discord bot connected: ${data.username} (${data.id})`);
  } catch (fetchError) {
    warn(`Could not verify bot token: ${fetchError.message}`);
    info("Continuing anyway...");
  }
  async function convexMutation(fn, args) {
    const res = await fetch(`${convexBase}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fn, args })
    });
    const data = await res.json();
    if (data.status === "error") throw new Error(data.errorMessage);
    return data.value;
  }
  async function convexAction(fn, args) {
    const res = await fetch(`${convexBase}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fn, args })
    });
    const data = await res.json();
    if (data.status === "error") throw new Error(data.errorMessage);
    return data.value;
  }
  async function sendDiscordMessage(channelId, text) {
    const messages = text.match(/.{1,1900}/gs) || [""];
    for (const msg of messages) {
      await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
          Authorization: botToken.startsWith("Bot ") ? botToken : `Bot ${botToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ content: msg })
      });
    }
  }
  async function getOrCreateThread(channelThreadKey, senderName) {
    const cached = threadMap.get(channelThreadKey);
    if (cached) return cached;
    const threadId = await convexMutation("chat:createThread", {
      agentId,
      name: senderName ? `Discord: ${senderName}` : `Discord ${channelThreadKey}`,
      userId: `discord:${channelThreadKey}`
    });
    threadMap.set(channelThreadKey, threadId);
    return threadId;
  }
  async function handleDiscordMessage(message) {
    if (message.author.bot) return;
    if (mentionOnly && message.guild) {
      const botMentioned = message.mentions?.users?.some((u) => u.bot === true);
      if (!botMentioned) {
        return;
      }
      if (message.content) {
        const mentionRegex = /<@!?[\d]+>/g;
        message.content = message.content.replace(mentionRegex, "").trim();
      }
    }
    if (!respondToDMs && !message.guild) {
      return;
    }
    const channelId = message.channel_id;
    const userId = message.author.id;
    const username = message.author.username;
    const content = (message.content || "").trim();
    if (!content) return;
    const threadKey = `${channelId}:${userId}`;
    console.log(`[Discord:${channelId}] ${username}: ${content}`);
    try {
      const convexThreadId = await getOrCreateThread(threadKey, username);
      const result = await convexAction("chat:sendMessage", {
        agentId,
        threadId: convexThreadId,
        content,
        userId: `discord:${userId}`
      });
      if (result?.response) {
        const response = result.response;
        await sendDiscordMessage(channelId, response);
        console.log(`[Agent] ${response.substring(0, 100)}${response.length > 100 ? "..." : ""}`);
      } else {
        await sendDiscordMessage(channelId, "I couldn't generate a response. Please try again.");
      }
    } catch (routeError) {
      console.error(`Error: ${routeError.message}`);
      await sendDiscordMessage(channelId, "Sorry, I encountered an error. Please try again.");
    }
  }
  info("Starting Discord bot polling mode...");
  info("Note: For production use, install discord.js for full WebSocket support.");
  dim("  npm install discord.js");
  warn("Polling mode has limitations. Consider installing discord.js for full features.");
  info("Starting minimal HTTP-based bot (limited functionality)...");
  error("Discord bot requires discord.js package for full functionality.");
  info("Install it with: npm install discord.js");
  info("Then restart: agentforge channel:discord start");
  process.exit(1);
}

// src/commands/sandbox.ts
import fs13 from "fs-extra";
import path14 from "path";
import { execSync as execSync3 } from "child_process";
function registerSandboxCommand(program2) {
  const sandboxCmd = program2.command("sandbox").description("Run code in an isolated Docker sandbox");
  sandboxCmd.command("run-file").argument("<file>", "Path to the JavaScript/TypeScript file to execute").option("-i, --image <image>", "Docker image to use (default: node:22-slim)", "node:22-slim").option("-t, --timeout <ms>", "Execution timeout in milliseconds (default: 30000)", "30000").action(async (file, options) => {
    await runSandbox(file, options);
  });
  sandboxCmd.command("run").argument("<agent-id>", "Agent ID to run in sandbox").requiredOption("-m, --message <text>", "Message to send to the agent").action(async (agentId, options) => {
    await runAgentInSandbox(agentId, options);
  });
  sandboxCmd.argument("<file>", "Path to the JavaScript/TypeScript file to execute").option("-i, --image <image>", "Docker image to use (default: node:22-slim)", "node:22-slim").option("-t, --timeout <ms>", "Execution timeout in milliseconds (default: 30000)", "30000").action(async (file, options) => {
    await runSandbox(file, options);
  });
}
async function runSandbox(file, options) {
  header("Sandbox");
  const filePath = path14.resolve(file);
  if (!await fs13.pathExists(filePath)) {
    error(`File not found: ${file}`);
    process.exit(1);
  }
  const imageName = options.image || "node:22-slim";
  const timeoutMs = parseInt(String(options.timeout), 10) || 3e4;
  info(`Running file in isolated Docker sandbox`);
  dim(`File: ${filePath}`);
  dim(`Image: ${imageName}`);
  dim(`Timeout: ${timeoutMs}ms`);
  let SandboxManager;
  try {
    const coreModule = await import("@agentforge-ai/core");
    SandboxManager = coreModule.DockerSandboxManager;
  } catch (err) {
    error("Failed to load sandbox module. Make sure @agentforge-ai/core is installed.");
    process.exit(1);
  }
  const manager = new SandboxManager({
    provider: "docker",
    dockerConfig: {
      image: imageName,
      timeout: timeoutMs / 1e3
    }
  });
  let sandbox;
  try {
    await manager.initialize();
    sandbox = await manager.create({
      scope: "agent",
      workspaceAccess: "none"
    });
    success("Sandbox started");
    const containerId = sandbox.getContainerId();
    if (containerId) {
      dim(`Container ID: ${containerId}`);
    }
    const fileContent = await fs13.readFile(filePath, "utf-8");
    const fileName = path14.basename(filePath);
    await sandbox.writeFile(`/workspace/${fileName}`, fileContent);
    dim(`File written to sandbox: /workspace/${fileName}`);
    info("Executing file...");
    const result = await sandbox.exec(`node /workspace/${fileName}`, {
      timeout: timeoutMs
    });
    if (result.stdout) {
      console.log("\n" + result.stdout);
    }
    if (result.stderr) {
      console.error("\n" + result.stderr);
    }
    if (result.exitCode === 0) {
      success("Execution completed successfully");
    } else {
      error(`Execution failed with exit code ${result.exitCode}`);
      process.exit(result.exitCode);
    }
  } catch (err) {
    error(`Sandbox execution failed: ${err instanceof Error ? err.message : String(err)}`);
    await manager.shutdown();
    process.exit(1);
  } finally {
    if (sandbox) {
      await manager.destroy(sandbox);
      success("Sandbox destroyed");
    }
    await manager.shutdown();
  }
}
async function runAgentInSandbox(agentId, options) {
  header("Sandbox Agent Execution");
  let dockerVersion;
  try {
    dockerVersion = execSync3("docker --version", { encoding: "utf-8" }).trim();
    dim(`Docker: ${dockerVersion}`);
  } catch (err) {
    error("Docker is not installed or not accessible. Please install Docker first.");
    process.exit(1);
  }
  const client = await createClient();
  const agent = await safeCall(
    () => client.query("agents:get", { id: agentId }),
    `Agent "${agentId}" not found`
  );
  if (!agent) {
    process.exit(1);
  }
  const a = agent;
  const sandboxImage = a.sandboxImage || "node:20-alpine";
  info(`Running agent in Docker sandbox`);
  dim(`Agent: ${a.name}`);
  dim(`Image: ${sandboxImage}`);
  dim(`Message: ${options.message.substring(0, 100)}${options.message.length > 100 ? "..." : ""}`);
  info("Checking Docker image...");
  try {
    execSync3(`docker pull ${sandboxImage}`, { stdio: "inherit" });
  } catch (err) {
    error(`Failed to pull Docker image: ${sandboxImage}`);
    process.exit(1);
  }
  info("Executing agent in Docker container...");
  try {
    const execScript = `
const https = require('https');

// Simple script to execute agent via Convex HTTP API
// This is a simplified version - the full implementation would use the Convex SDK

console.log('Executing agent in isolated sandbox environment...');
console.log('Agent ID: ${agentId}');
console.log('Message: ${options.message.replace(/'/g, "\\'")}');
console.log('\\n\u26A0\uFE0F  Full sandbox execution requires Convex client in container');
console.log('For now, this demonstrates the Docker container spawning.');
`;
    const dockerCommand = `docker run --rm -i ${sandboxImage} node -e "${execScript.replace(/\n/g, "\\n")}"`;
    const result = execSync3(dockerCommand, { encoding: "utf-8", stdio: "inherit" });
    success("Sandbox execution completed");
  } catch (err) {
    error(`Sandbox execution failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// src/commands/research.ts
import fs14 from "fs-extra";
import path15 from "path";
function registerResearchCommand(program2) {
  program2.command("research").description("Deep Research Mode \u2014 parallel multi-agent research").argument("<topic>", "Research topic or question").option("-d, --depth <depth>", "Research depth: shallow, standard, or deep", "standard").option("-p, --provider <provider>", "LLM provider (default: openai)", "openai").option("-m, --model <model>", "Model to use (default: gpt-4o-mini)", "gpt-4o-mini").option("-k, --key <key>", "API key (default: from environment)").action(async (topic, options) => {
    await runResearch(topic, options);
  });
}
async function runResearch(topic, options) {
  header("Research");
  const depth = options.depth || "standard";
  const provider = options.provider || "openai";
  const model = options.model || "gpt-4o-mini";
  let apiKey = options.key;
  if (!apiKey) {
    const envVar = `${provider.toUpperCase()}_API_KEY`;
    apiKey = process.env[envVar] || "";
    if (!apiKey) {
      error(`API key not found. Set ${envVar} environment variable or use --key option.`);
      process.exit(1);
    }
  }
  info(`Starting Deep Research Mode`);
  dim(`Topic: ${topic}`);
  dim(`Depth: ${depth}`);
  dim(`Provider: ${provider}`);
  dim(`Model: ${model}`);
  let ResearchOrchestrator;
  try {
    const researchModule = await import("@agentforge-ai/core");
    ResearchOrchestrator = researchModule.ResearchOrchestrator;
  } catch (err) {
    error("Failed to load ResearchOrchestrator. Make sure @agentforge-ai/core is installed.");
    process.exit(1);
  }
  const agentCount = depth === "shallow" ? 3 : depth === "standard" ? 5 : 10;
  dim(`Spawning ${agentCount} parallel research agents...`);
  const orchestrator = new ResearchOrchestrator({ topic, depth });
  try {
    info("Running research workflow...");
    dim("  Step 1: Planning \u2014 generating research questions...");
    const report = await orchestrator.run({
      providerId: provider,
      modelId: model,
      apiKey
    });
    success("Research complete!");
    dim(`  Generated ${report.questions.length} research questions`);
    dim(`  Collected ${report.findings.length} findings`);
    dim(`  Synthesized comprehensive report`);
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const filename = `research-${timestamp}.md`;
    const filepath = path15.resolve(filename);
    const reportContent = formatReport(report);
    await fs14.writeFile(filepath, reportContent, "utf-8");
    console.log("\n" + reportContent);
    success(`Report saved to: ${filename}`);
  } catch (err) {
    error(`Research failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
function formatReport(report) {
  const lines = [];
  lines.push(`# Research Report: ${report.topic}`);
  lines.push("");
  lines.push(`**Depth:** ${report.depth}  |  **Date:** ${new Date(report.timestamp).toLocaleString()}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Research Questions");
  lines.push("");
  for (const q of report.questions) {
    lines.push(`${q.id}. ${q.question}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Synthesis");
  lines.push("");
  lines.push(report.synthesis);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Individual Findings");
  lines.push("");
  for (const finding of report.findings) {
    lines.push(`### ${finding.question}`);
    lines.push("");
    lines.push(finding.answer);
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

// src/commands/start.ts
import fs15 from "fs-extra";
import path16 from "path";
import net from "net";
import { fileURLToPath as fileURLToPath3 } from "url";
import { dirname, resolve as resolve2 } from "path";
import { createStandardAgent, initStorage } from "@agentforge-ai/runtime";
var __filename3 = fileURLToPath3(import.meta.url);
var __dirname3 = dirname(__filename3);
function registerStartCommand(program2) {
  program2.command("start").description("Start the AgentForge daemon with channel adapters").option("-p, --port <n>", "HTTP channel port (default: 3001)", "3001").option("--discord", "Enable Discord channel (requires DISCORD_BOT_TOKEN)").option("--telegram", "Enable Telegram channel (requires TELEGRAM_BOT_TOKEN)").option("--no-http", "Disable HTTP channel").option("--agent <id>", "Load specific agent only (repeatable)", (val, prev) => [...prev, val], []).option("--dev", "Dev mode: verbose logging, no process.exit on error").action(async (opts) => {
    header("AgentForge Daemon");
    const cwd = process.cwd();
    const port = parseInt(opts.port, 10);
    const agentsFilter = opts.agent;
    const pkgPath = path16.join(cwd, "package.json");
    if (!fs15.existsSync(pkgPath)) {
      error("Not an AgentForge project directory.");
      info("Run this command from inside an AgentForge project.");
      process.exit(1);
    }
    let convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      const envPath = path16.join(cwd, ".env.local");
      if (fs15.existsSync(envPath)) {
        const envContent = fs15.readFileSync(envPath, "utf-8");
        const match = envContent.match(/CONVEX_URL=(.+)/);
        if (match) convexUrl = match[1].trim();
      }
    }
    if (!convexUrl) {
      error("CONVEX_URL not found. Make sure you have run: npx convex dev");
      process.exit(1);
    }
    info(`Connected to Convex: ${convexUrl}`);
    const client = await createClient();
    let agents = [];
    try {
      const result = await safeCall(
        () => client.query("agents:list", {}),
        "Failed to fetch agents from Convex"
      );
      agents = result || [];
    } catch (err) {
      error(`Failed to fetch agents: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
    if (agentsFilter.length > 0) {
      agents = agents.filter((a) => agentsFilter.includes(a.id));
      if (agents.length === 0) {
        error(`No agents found matching: ${agentsFilter.join(", ")}`);
        process.exit(1);
      }
    }
    if (agents.length === 0) {
      error("No agents found in Convex.");
      info("Create an agent first: agentforge agents create");
      process.exit(1);
    }
    success(`Loaded ${agents.length} agent config(s): ${agents.map((a) => a.name).join(", ")}`);
    const envLocalPath = path16.join(cwd, ".env.local");
    if (fs15.existsSync(envLocalPath)) {
      const envContent = fs15.readFileSync(envLocalPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
    const adminKey = process.env.CONVEX_DEPLOY_KEY;
    if (convexUrl && adminKey) {
      try {
        initStorage(convexUrl, adminKey);
        if (opts.dev) info("Convex memory storage initialized.");
      } catch (_) {
      }
    }
    const mastraAgents = [];
    for (const agentConfig of agents) {
      try {
        const modelStr = agentConfig.provider && agentConfig.model ? `${agentConfig.provider}:${agentConfig.model}` : agentConfig.model || "openai:gpt-4o-mini";
        const agent = createStandardAgent({
          id: agentConfig.id ?? agentConfig._id,
          name: agentConfig.name ?? "Agent",
          instructions: agentConfig.instructions ?? "You are a helpful assistant.",
          model: modelStr,
          disableMemory: !adminKey
          // disable memory if no admin key
        });
        agent.id = agentConfig.id ?? agentConfig._id;
        agent.model = modelStr;
        mastraAgents.push(agent);
        if (opts.dev) info(`  Agent "${agentConfig.name}" \u2192 ${modelStr}`);
      } catch (err) {
        error(`Failed to create agent "${agentConfig.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (mastraAgents.length === 0) {
      error("No agents could be instantiated. Check your API keys in .env.local");
      process.exit(1);
    }
    success(`${mastraAgents.length} agent(s) ready.`);
    const portInUse = await isPortInUse(port);
    if (portInUse) {
      error(`Port ${port} is already in use.`);
      info("Another process may be running. Use --port to use a different port.");
      process.exit(1);
    }
    const shutdownFns = [];
    if (!opts.noHttp) {
      info(`Starting HTTP channel on port ${port}...`);
      const httpModulePath = resolve2(__dirname3, "./lib/http-channel.js");
      try {
        const { startHttpChannel } = await import(httpModulePath);
        const close = await startHttpChannel(port, mastraAgents, convexUrl, opts.dev);
        shutdownFns.push(close);
      } catch (err) {
        error(`Failed to start HTTP channel: ${err instanceof Error ? err.message : String(err)}`);
        if (!opts.dev) process.exit(1);
      }
    }
    if (opts.discord) {
      const discordToken = process.env.DISCORD_BOT_TOKEN;
      if (!discordToken) {
        error("DISCORD_BOT_TOKEN not set. Set it in .env.local");
        process.exit(1);
      }
      info("Discord channel not yet implemented.");
    }
    if (opts.telegram) {
      const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!telegramToken) {
        error("TELEGRAM_BOT_TOKEN not set. Set it in .env.local");
        process.exit(1);
      }
      info("Telegram channel not yet implemented.");
    }
    success("AgentForge daemon started!");
    dim(`  HTTP: http://localhost:${port}`);
    dim("  Press Ctrl+C to stop");
    console.log();
    await keepAlive();
    await Promise.allSettled(shutdownFns.map((fn) => fn()));
  });
}
async function isPortInUse(port) {
  return new Promise((resolve4) => {
    const server = net.createServer();
    server.once("error", (err) => {
      resolve4(err.code === "EADDRINUSE" || err.code === "EACCES");
    });
    server.once("listening", () => {
      server.close();
      resolve4(false);
    });
    server.listen(port);
  });
}
async function keepAlive() {
  return new Promise((resolve4) => {
    const shutdown = () => {
      console.log();
      info("Shutting down AgentForge daemon...");
      resolve4();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}

// src/commands/deploy.ts
import fs16 from "fs-extra";
import path17 from "path";
import { execSync as execSync4 } from "child_process";
async function deployProject(options) {
  const projectDir = process.cwd();
  const pkgPath = path17.join(projectDir, "package.json");
  if (!await fs16.pathExists(pkgPath)) {
    console.error("Error: No package.json found. Are you in an AgentForge project directory?");
    process.exit(1);
  }
  const convexDir = path17.join(projectDir, "convex");
  if (!await fs16.pathExists(convexDir)) {
    console.error("Error: No convex/ directory found. Are you in an AgentForge project directory?");
    process.exit(1);
  }
  header("AgentForge Deploy");
  dim("Deploys Convex schema and functions to production");
  if (options.rollback) {
    console.log("\n\u{1F504} Rolling back to previous Convex deployment...\n");
    try {
      execSync4("npx convex deploy --rollback", {
        cwd: projectDir,
        stdio: "inherit"
      });
      console.log("\n  \u2705 Rollback completed successfully.");
    } catch {
      console.error("\n  \u274C Rollback failed.");
      process.exit(1);
    }
    return;
  }
  const envPath = path17.resolve(projectDir, options.env);
  const envExists = await fs16.pathExists(envPath);
  if (options.dryRun) {
    console.log("\n\u{1F50D} Dry run \u2014 previewing deployment plan:\n");
    console.log(`  Project directory: ${projectDir}`);
    console.log(`  Convex directory:  ${convexDir}`);
    console.log(`  Environment file:  ${envExists ? envPath : "(not found)"}`);
    console.log("\n  \u2139\uFE0F  No changes were made (dry run).\n");
    return;
  }
  if (!options.force) {
    console.log("\n\u{1F680} Ready to deploy Convex backend to production.\n");
    console.log(`  Project: ${projectDir}`);
    console.log(`  Env file: ${envPath}`);
    console.log("\n  Use --force to skip this confirmation.\n");
  }
  console.log("\u{1F4E6} Deploying Convex backend...\n");
  try {
    execSync4("npx convex deploy", {
      cwd: projectDir,
      stdio: "inherit"
    });
    console.log("\n  \u2705 Deployment completed successfully!");
    console.log('  Use "agentforge deploy --rollback" to revert if needed.\n');
  } catch {
    console.error("\n  \u274C Deployment failed.");
    console.error("  Check the Convex dashboard for details.");
    process.exit(1);
  }
}
function registerDeployCommand(program2) {
  program2.command("deploy").description("Deploy Convex schema and functions to production").option("--env <path>", "Path to environment file", ".env.production").option("--dry-run", "Preview deployment without executing", false).option("--rollback", "Rollback to previous deployment", false).option("--force", "Skip confirmation prompts", false).action(async (options) => {
    await deployProject(options);
  });
}

// src/commands/workflows.ts
function registerWorkflowsCommand(program2) {
  const workflowsCmd = program2.command("workflows").description("Multi-agent workflow commands");
  workflowsCmd.command("create").description("Create a new workflow").option("--name <name>", "Workflow name").option("--agent <id>", "Agent ID to assign").option("--trigger <type>", "Trigger type (manual, cron, webhook)", "manual").option("--schedule <cron>", "Cron schedule (for cron trigger)").action(async (opts) => {
    const name = opts.name;
    const agent = opts.agent;
    const trigger = opts.trigger || "manual";
    const schedule = opts.schedule;
    if (!name) {
      error("--name is required");
      process.exit(1);
    }
    if (!agent) {
      error("--agent is required");
      process.exit(1);
    }
    if (trigger === "cron" && !schedule) {
      error("--schedule is required for cron triggers");
      process.exit(1);
    }
    const client = await createClient();
    let triggersData = { type: trigger };
    if (trigger === "cron" && schedule) {
      triggersData.schedule = schedule;
    }
    await safeCall(
      () => client.mutation("workflows:create", {
        name,
        triggers: JSON.stringify(triggersData),
        steps: JSON.stringify([{ agentId: agent, name: "Step 1" }])
      }),
      "Failed to create workflow"
    );
    success(`Workflow "${name}" created`);
  });
  workflowsCmd.command("list").option("-p, --project <projectId>", "Filter by project ID").option("--active", "Show only active workflows").option("--inactive", "Show only inactive workflows").description("List workflow definitions").action(async (opts) => {
    const client = await createClient();
    const args = {};
    if (opts.project) args.projectId = opts.project;
    if (opts.active) args.isActive = true;
    if (opts.inactive) args.isActive = false;
    const workflows = await safeCall(
      () => client.query("workflows:list", args),
      "Failed to fetch workflows"
    );
    if (!workflows || workflows.length === 0) {
      info("No workflows found");
      return;
    }
    header("Workflows");
    workflows.forEach((w) => {
      const statusColor = w.isActive ? colors.green : colors.dim;
      console.log(`  ${statusColor}\u25CF${colors.reset} ${w.name} ${colors.dim}(${w._id})${colors.reset}`);
      if (w.description) {
        console.log(`    ${dim(w.description)}`);
      }
      console.log();
    });
  });
  workflowsCmd.command("runs").option("-w, --workflow <workflowId>", "Filter by workflow ID").option("-s, --status <status>", "Filter by status (pending, running, completed, failed)").option("-p, --project <projectId>", "Filter by project ID").description("List workflow runs").action(async (opts) => {
    const client = await createClient();
    const args = {};
    if (opts.workflow) args.workflowId = opts.workflow;
    if (opts.status) args.status = opts.status;
    if (opts.project) args.projectId = opts.project;
    const runs = await safeCall(
      () => client.query("workflows:listRuns", args),
      "Failed to fetch workflow runs"
    );
    if (!runs || runs.length === 0) {
      info("No workflow runs found");
      return;
    }
    header("Workflow Runs");
    runs.forEach((r) => {
      const statusColors = {
        pending: colors.yellow,
        running: colors.blue,
        completed: colors.green,
        failed: colors.red,
        suspended: colors.dim
      };
      const statusColor = statusColors[r.status] || colors.dim;
      console.log(`  ${statusColor}\u25CF${colors.reset} ${r.workflowId} ${statusColor}(${r.status})${colors.reset}`);
      console.log(`    ${dim(`Run ID: ${r._id}`)}`);
      if (r.input) {
        console.log(`    ${dim(`Input: "${r.input.substring(0, 60)}${r.input.length > 60 ? "..." : ""}"`)}`);
      }
      console.log();
    });
  });
  workflowsCmd.command("run").argument("<workflowId>", "Workflow definition ID to run").option("-i, --input <text>", "Initial input for the workflow").description("Execute a workflow").action(async (workflowId, opts) => {
    const client = await createClient();
    header(`Running Workflow: ${workflowId}`);
    try {
      const runId = await safeCall(
        () => client.mutation("workflows:createRun", {
          workflowId,
          input: opts.input
        }),
        "Failed to create workflow run"
      );
      success(`Created run: ${colors.cyan}${runId}${colors.reset}`);
      dim("Executing workflow steps...");
      const result = await safeCall(
        () => client.action("workflowEngine:executeWorkflow", { runId }),
        "Failed to execute workflow"
      );
      if (result && result.success) {
        success("Workflow completed successfully");
        if (result.output) {
          console.log();
          dim("Output:");
          console.log(`  ${result.output}`);
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      error(`Workflow execution failed: ${errMsg}`);
      process.exit(1);
    }
  });
  workflowsCmd.command("steps").argument("<runId>", "Workflow run ID").description("Show steps for a workflow run").action(async (runId) => {
    const client = await createClient();
    const steps = await safeCall(
      () => client.query("workflows:getRunSteps", { runId }),
      "Failed to fetch workflow steps"
    );
    if (!steps || steps.length === 0) {
      info("No steps found for this run");
      return;
    }
    header(`Workflow Steps: ${runId}`);
    steps.forEach((s, i) => {
      const statusColors = {
        pending: colors.yellow,
        running: colors.blue,
        completed: colors.green,
        failed: colors.red,
        skipped: colors.dim,
        suspended: colors.dim
      };
      const statusColor = statusColors[s.status] || colors.dim;
      console.log(`  ${i + 1}. ${s.name} ${statusColor}(${s.status})${colors.reset}`);
      if (s.input) {
        console.log(`     ${dim(`Input: "${s.input.substring(0, 50)}${s.input.length > 50 ? "..." : ""}"`)}`);
      }
      if (s.output) {
        console.log(`     ${dim(`Output: "${s.output.substring(0, 50)}${s.output.length > 50 ? "..." : ""}"`)}`);
      }
      if (s.error) {
        console.log(`     ${colors.red}Error: ${s.error}${colors.reset}`);
      }
      console.log();
    });
  });
}

// src/index.ts
import { readFileSync as readFileSync3 } from "fs";
import { fileURLToPath as fileURLToPath4 } from "url";
import { dirname as dirname2, resolve as resolve3 } from "path";
var __filename4 = fileURLToPath4(import.meta.url);
var __dirname4 = dirname2(__filename4);
var pkg = JSON.parse(readFileSync3(resolve3(__dirname4, "..", "package.json"), "utf-8"));
var program = new Command();
program.name("agentforge").description("AgentForge \u2014 NanoClaw: A minimalist agent framework powered by Mastra + Convex").version(pkg.version);
program.command("create").argument("<project-name>", "Name of the project to create").description("Create a new AgentForge project").option("-t, --template <template>", "Project template to use", "default").action(async (projectName, options) => {
  await createProject(projectName, options);
});
program.command("run").description("Start the local development environment").option("-p, --port <port>", "Port for the dev server", "3000").option("-s, --sandbox <type>", "Sandbox provider for agent execution (local, docker, e2b, none)", "local").action(async (options) => {
  await runProject(options);
});
registerDeployCommand(program);
program.command("upgrade").description("Sync convex/ directory with latest AgentForge template").option("-y, --yes", "Skip confirmation prompt", false).option("--dry-run", "Preview changes without applying", false).option("--only <file>", "Only upgrade specific file").action(async (options) => {
  await upgradeProject(options);
});
registerStartCommand(program);
registerModelsCommand(program);
registerWorkspaceCommand(program);
registerTokensCommand(program);
registerAgentsCommand(program);
registerChatCommand(program);
registerSessionsCommand(program);
registerThreadsCommand(program);
registerSkillsCommand(program);
registerSkillCommand(program);
registerCronCommand(program);
registerMcpCommand(program);
registerFilesCommand(program);
registerProjectsCommand(program);
registerConfigCommand(program);
registerVaultCommand(program);
registerKeysCommand(program);
registerChannelTelegramCommand(program);
registerChannelWhatsAppCommand(program);
registerChannelSlackCommand(program);
registerChannelDiscordCommand(program);
registerSandboxCommand(program);
registerResearchCommand(program);
registerWorkflowsCommand(program);
registerStatusCommand(program);
program.parse();
//# sourceMappingURL=index.js.map