import { internalMutation } from "../_generated/server";

const SEED_SKILLS = [
  {
    name: "browser-automation",
    version: "1.0.0",
    description: "Automate web browsers with Playwright for scraping, testing, and interaction",
    author: "agentforge-team",
    category: "automation",
    tags: ["browser", "playwright", "scraping", "testing"],
    featured: true,
    skillMdContent: `---\nname: browser-automation\ndescription: Automate web browsers with Playwright\nversion: 1.0.0\nmetadata:\n  author: agentforge-team\n  tags:\n    - browser\n    - playwright\n---\n# Browser Automation\nAutomate web scraping, form filling, and UI testing using Playwright.`,
  },
  {
    name: "git-operations",
    version: "1.0.0",
    description: "Git workflow automation for commits, branches, PRs, and repository management",
    author: "agentforge-team",
    category: "developer-tools",
    tags: ["git", "github", "version-control", "automation"],
    featured: true,
    skillMdContent: `---\nname: git-operations\ndescription: Git workflow automation\nversion: 1.0.0\nmetadata:\n  author: agentforge-team\n  tags:\n    - git\n    - github\n---\n# Git Operations\nAutomate git workflows including commits, branch management, and pull requests.`,
  },
  {
    name: "slack-notifier",
    version: "1.0.0",
    description: "Send Slack messages, notifications, and alerts to channels and users",
    author: "agentforge-team",
    category: "communication",
    tags: ["slack", "notifications", "messaging", "alerts"],
    featured: true,
    skillMdContent: `---\nname: slack-notifier\ndescription: Send Slack notifications\nversion: 1.0.0\nmetadata:\n  author: agentforge-team\n  tags:\n    - slack\n    - notifications\n---\n# Slack Notifier\nSend messages and notifications to Slack channels and users.`,
  },
  {
    name: "data-extractor",
    version: "1.0.0",
    description: "Extract and transform data from CSV, JSON, XML, and other structured formats",
    author: "agentforge-team",
    category: "data",
    tags: ["csv", "json", "data", "transform", "parsing"],
    featured: false,
    skillMdContent: `---\nname: data-extractor\ndescription: CSV/JSON data processing\nversion: 1.0.0\nmetadata:\n  author: agentforge-team\n  tags:\n    - data\n    - csv\n    - json\n---\n# Data Extractor\nExtract and transform data from CSV, JSON, and other formats.`,
  },
  {
    name: "email-sender",
    version: "1.0.0",
    description: "Send emails via SMTP with templates, attachments, and HTML support",
    author: "agentforge-team",
    category: "communication",
    tags: ["email", "smtp", "notifications", "templates"],
    featured: false,
    skillMdContent: `---\nname: email-sender\ndescription: Send emails via SMTP\nversion: 1.0.0\nmetadata:\n  author: agentforge-team\n  tags:\n    - email\n    - smtp\n---\n# Email Sender\nSend emails with templates and attachments via SMTP.`,
  },
  {
    name: "web-researcher",
    version: "1.0.0",
    description: "Search the web, extract content from URLs, and summarize findings",
    author: "agentforge-team",
    category: "research",
    tags: ["web", "search", "summarize", "research", "scraping"],
    featured: true,
    skillMdContent: `---\nname: web-researcher\ndescription: Search and summarize web content\nversion: 1.0.0\nmetadata:\n  author: agentforge-team\n  tags:\n    - web\n    - search\n    - research\n---\n# Web Researcher\nSearch the web, extract content, and produce structured summaries.`,
  },
];

export const seedMarketplace = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existing = await ctx.db.query("skillMarketplace").first();
    if (existing) {
      return { seeded: false, message: "Marketplace already has data" };
    }

    const now = Date.now();
    for (const skill of SEED_SKILLS) {
      await ctx.db.insert("skillMarketplace", {
        ...skill,
        downloads: Math.floor(Math.random() * 500),
        readmeContent: undefined,
        repositoryUrl: `https://github.com/agentforge-ai/${skill.name}`,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { seeded: true, count: SEED_SKILLS.length };
  },
});
