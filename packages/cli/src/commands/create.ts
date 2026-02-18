import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Install root dependencies
  console.log(`\n📦 Installing dependencies...\n`);
  try {
    execSync('pnpm install', {
      cwd: targetDir,
      stdio: 'inherit',
    });
    console.log(`\n  ✅ Dependencies installed`);
  } catch {
    console.warn(
      `\n  ⚠️  Could not install dependencies. Run "cd ${projectName} && pnpm install" manually.`
    );
  }

  // Install dashboard dependencies
  const dashDir = path.join(targetDir, 'dashboard');
  if (await fs.pathExists(dashDir)) {
    console.log(`\n📦 Installing dashboard dependencies...\n`);
    try {
      execSync('pnpm install', {
        cwd: dashDir,
        stdio: 'inherit',
      });
      console.log(`\n  ✅ Dashboard dependencies installed`);
    } catch {
      console.warn(
        `\n  ⚠️  Could not install dashboard dependencies. Run "cd ${projectName}/dashboard && pnpm install" manually.`
      );
    }
  }

  // Initialize Convex
  console.log(`\n⚡ Initializing Convex...\n`);
  try {
    execSync('npx convex dev --once', {
      cwd: targetDir,
      stdio: 'inherit',
    });
    console.log(`\n  ✅ Convex initialized`);
  } catch {
    console.warn(
      `\n  ⚠️  Convex initialization skipped. Run "npx convex dev" to set up your backend.`
    );
  }

  console.log(`
🎉 AgentForge project "${projectName}" created successfully!

Next steps:
  cd ${projectName}

  # Start the Convex backend
  npx convex dev

  # In another terminal, launch the dashboard
  agentforge dashboard

  # Or chat with your agent from the CLI
  agentforge chat

  # Check system status
  agentforge status

Documentation: https://github.com/Agentic-Engineering-Agency/agentforge
`);
}
