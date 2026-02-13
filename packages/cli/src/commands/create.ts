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
  const templateDir = path.resolve(
    __dirname,
    '..', // from dist/commands to dist
    'templates',
    options.template
  );

  if (!(await fs.pathExists(templateDir))) {
    console.error(`Error: Template "${options.template}" not found.`);
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

  console.log(`  ✅ Project scaffolded at ./${projectName}`);

  // Install dependencies
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

  console.log(`
🎉 AgentForge project "${projectName}" created successfully!

Next steps:
  cd ${projectName}
  agentforge run

Documentation: https://github.com/Agentic-Engineering-Agency/agentforge
`);
}
