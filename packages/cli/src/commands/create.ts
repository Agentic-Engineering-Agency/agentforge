import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import { execSync } from 'node:child_process';
import os from 'node:os';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Checks if the user is logged in to Convex by verifying the access token
 */
function isConvexLoggedIn(): boolean {
  try {
    const configPath = path.join(os.homedir(), '.convex', 'config.json');
    if (!fs.existsSync(configPath)) {
      return false;
    }
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return !!config.accessToken && config.accessToken.length > 0;
  } catch {
    return false;
  }
}

/**
 * Options for the create command.
 */
export interface CreateOptions {
  /** The project template to use. */
  template: string;
}

/**
 * Creates a new AgentForge project from a template.
 *
 * @param projectName - The name of the project to create.
 * @param options - Options for the create command.
 */
export async function createProject(
  projectName: string,
  options: CreateOptions
): Promise<void> {
  const targetDir = path.resolve(process.cwd(), projectName);

  // Check if directory already exists
  if (await fs.pathExists(targetDir)) {
    console.error(`Error: Directory "${projectName}" already exists.`);
    process.exit(1);
  }

  console.log(`\n🔨 Creating AgentForge project: ${projectName}\n`);

  // Resolve template directory
  // tsup publicDir copies templates/ contents into dist/, so dist/default/ exists
  // When running from dist/index.js, __dirname is dist/, so we check:
  //   1. dist/<template> (built bundle — tsup publicDir)
  //   2. ../templates/<template> (development — running from src/)
  //   3. ../../templates/<template> (fallback)
  const searchDirs = [
    path.resolve(__dirname, options.template),                        // dist/default (built)
    path.resolve(__dirname, '..', 'templates', options.template),     // packages/cli/templates/default (dev)
    path.resolve(__dirname, '..', '..', 'templates', options.template), // fallback
  ];

  let templateDir = '';
  for (const dir of searchDirs) {
    if (await fs.pathExists(dir)) {
      templateDir = dir;
      break;
    }
  }

  if (!templateDir) {
    console.error(`Error: Template "${options.template}" not found.`);
    console.error(`Searched in:`);
    searchDirs.forEach(d => console.error(`  - ${d}`));
    process.exit(1);
  }

  // Copy template to target directory
  await fs.copy(templateDir, targetDir);

  // Update package.json with project name
  const pkgPath = path.join(targetDir, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    pkg.name = projectName;
    await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  }

  // Update dashboard package.json name
  const dashPkgPath = path.join(targetDir, 'dashboard', 'package.json');
  if (await fs.pathExists(dashPkgPath)) {
    const dashPkg = await fs.readJson(dashPkgPath);
    dashPkg.name = `${projectName}-dashboard`;
    await fs.writeJson(dashPkgPath, dashPkg, { spaces: 2 });
  }

  console.log(`  ✅ Project scaffolded at ./${projectName}`);

  // Install root dependencies (pnpm preferred, npm fallback)
  console.log(`\n📦 Installing dependencies...\n`);
  let rootInstalled = false;
  for (const pm of ['pnpm', 'npm']) {
    try {
      execSync(`${pm} install`, { cwd: targetDir, stdio: 'inherit' });
      console.log(`\n  ✅ Dependencies installed (via ${pm})`);
      rootInstalled = true;
      break;
    } catch {
      // try next package manager
    }
  }
  if (!rootInstalled) {
    console.warn(`\n  ⚠️  Could not install dependencies automatically.`);
    console.warn(`  Run: cd ${projectName} && npm install`);
  }

  // Install dashboard dependencies
  const dashDir = path.join(targetDir, 'dashboard');
  if (await fs.pathExists(dashDir)) {
    console.log(`\n📦 Installing dashboard dependencies...\n`);
    let dashInstalled = false;
    for (const pm of ['pnpm', 'npm']) {
      try {
        execSync(`${pm} install`, { cwd: dashDir, stdio: 'inherit' });
        console.log(`\n  ✅ Dashboard dependencies installed (via ${pm})`);
        dashInstalled = true;
        break;
      } catch {
        // try next
      }
    }
    if (!dashInstalled) {
      console.warn(`\n  ⚠️  Could not install dashboard dependencies.`);
      console.warn(`  Run: cd ${projectName}/dashboard && npm install`);
    }
  }

  // Initialize Convex
  console.log(`\n⚡ Initializing Convex...\n`);

  // Check if user is logged in to Convex
  if (!isConvexLoggedIn()) {
    console.warn(`  ⚠️  Not logged in to Convex`);
    console.warn(`  Run: npx convex login`);
    console.warn(`  Then run: cd ${projectName} && npx convex dev\n`);
    console.log(`
🎉 AgentForge project "${projectName}" created successfully!

Next steps:
  cd ${projectName}

  # Login to Convex (required)
  npx convex login

  # Start the Convex backend
  npx convex dev

  # Set required encryption secret (one-time per deployment)
  npx convex env set AGENTFORGE_KEY_SALT "$(openssl rand -base64 32)"

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
    execSync('npx convex dev --once', {
      cwd: targetDir,
      stdio: 'inherit',
    });
    console.log(`\n  ✅ Convex initialized`);
    convexReady = true;
  } catch {
    console.warn(
      `\n  ⚠️  Convex initialization skipped. Run "cd ${projectName} && npx convex dev" to set up your backend.`
    );
  }

  // Auto-set AGENTFORGE_KEY_SALT in the Convex deployment so API key encryption
  // works out of the box. Without this, `agentforge keys add` fails immediately.
  if (convexReady) {
    const salt = randomBytes(32).toString('base64');
    try {
      execSync(`npx convex env set AGENTFORGE_KEY_SALT "${salt}"`, {
        cwd: targetDir,
        stdio: 'inherit',
      });
      console.log(`\n  ✅ Encryption secret set (AGENTFORGE_KEY_SALT)`);
    } catch {
      console.warn(`\n  ⚠️  Could not auto-set AGENTFORGE_KEY_SALT.`);
      console.warn(`  Run manually: npx convex env set AGENTFORGE_KEY_SALT "${salt}"`);
    }
  }

  if (!convexReady) {
    console.log(`
⚠️  Project "${projectName}" created with warnings.

Your project files are ready, but Convex could not be initialized automatically.
This is usually because the TypeScript typecheck failed or Convex auth is required.

Fix the errors above, then run:
  cd ${projectName}
  npx convex dev
`);
    process.exit(1);
  }

  console.log(`
🎉 AgentForge project "${projectName}" created successfully!

Next steps:
  cd ${projectName}

  # Start the Convex backend
  npx convex dev

  # Set required encryption secret (one-time per deployment)
  npx convex env set AGENTFORGE_KEY_SALT "$(openssl rand -base64 32)"

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
