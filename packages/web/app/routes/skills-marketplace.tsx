import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "../components/DashboardLayout";
import { useState, useMemo } from "react";
import {
  Search,
  Download,
  Star,
  Filter,
  Package,
  ArrowRight,
  ExternalLink,
  Tag,
} from "lucide-react";

export const Route = createFileRoute("/skills-marketplace")({
  component: SkillsMarketplace,
});

// Types
interface MarketplaceSkill {
  _id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  tags: string[];
  downloads: number;
  featured: boolean;
  repositoryUrl?: string;
}

// Mock data for initial UI (will be replaced with Convex queries)
const MOCK_SKILLS: MarketplaceSkill[] = [
  {
    _id: "1",
    name: "browser-automation",
    version: "1.0.0",
    description: "Automate web browsers with Playwright for scraping, testing, and interaction",
    author: "agentforge-team",
    category: "automation",
    tags: ["browser", "playwright", "scraping"],
    downloads: 342,
    featured: true,
    repositoryUrl: "https://github.com/agentforge-ai/browser-automation",
  },
  {
    _id: "2",
    name: "git-operations",
    version: "1.0.0",
    description: "Git workflow automation for commits, branches, PRs, and repository management",
    author: "agentforge-team",
    category: "developer-tools",
    tags: ["git", "github", "version-control"],
    downloads: 289,
    featured: true,
    repositoryUrl: "https://github.com/agentforge-ai/git-operations",
  },
  {
    _id: "3",
    name: "slack-notifier",
    version: "1.0.0",
    description: "Send Slack messages, notifications, and alerts to channels and users",
    author: "agentforge-team",
    category: "communication",
    tags: ["slack", "notifications", "messaging"],
    downloads: 215,
    featured: true,
  },
  {
    _id: "4",
    name: "data-extractor",
    version: "1.0.0",
    description: "Extract and transform data from CSV, JSON, XML, and other structured formats",
    author: "agentforge-team",
    category: "data",
    tags: ["csv", "json", "data", "transform"],
    downloads: 178,
    featured: false,
  },
  {
    _id: "5",
    name: "email-sender",
    version: "1.0.0",
    description: "Send emails via SMTP with templates, attachments, and HTML support",
    author: "agentforge-team",
    category: "communication",
    tags: ["email", "smtp", "notifications"],
    downloads: 134,
    featured: false,
  },
  {
    _id: "6",
    name: "web-researcher",
    version: "1.0.0",
    description: "Search the web, extract content from URLs, and summarize findings",
    author: "agentforge-team",
    category: "research",
    tags: ["web", "search", "summarize"],
    downloads: 267,
    featured: true,
  },
];

const CATEGORIES = ["all", "automation", "developer-tools", "communication", "data", "research"];

function SkillsMarketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [installingSkill, setInstallingSkill] = useState<string | null>(null);

  // TODO: Replace with Convex queries
  // const allSkills = useQuery(api.skillMarketplace.listSkills, {});
  // const featuredSkills = useQuery(api.skillMarketplace.getFeaturedSkills);
  const allSkills = MOCK_SKILLS;

  const filteredSkills = useMemo(() => {
    return allSkills.filter((skill) => {
      const matchesSearch =
        !searchQuery ||
        skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory =
        selectedCategory === "all" || skill.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allSkills, searchQuery, selectedCategory]);

  const featuredSkills = useMemo(
    () => allSkills.filter((s) => s.featured),
    [allSkills],
  );

  const handleInstall = async (skillName: string) => {
    setInstallingSkill(skillName);
    // TODO: Call marketplace install
    setTimeout(() => setInstallingSkill(null), 2000);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Skill Marketplace</h1>
          <p className="text-muted-foreground">
            Discover and install community skills for your agents
          </p>
        </div>

        {/* Search + Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {cat === "all" ? "All" : cat.replace("-", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Featured Section */}
        {searchQuery === "" && selectedCategory === "all" && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-yellow-500" />
              <h2 className="text-lg font-semibold">Featured</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredSkills.map((skill) => (
                <SkillCard
                  key={skill._id}
                  skill={skill}
                  onInstall={handleInstall}
                  installing={installingSkill === skill.name}
                />
              ))}
            </div>
          </div>
        )}

        {/* All / Filtered Skills */}
        <div>
          <h2 className="text-lg font-semibold mb-3">
            {searchQuery || selectedCategory !== "all"
              ? `Results (${filteredSkills.length})`
              : "All Skills"}
          </h2>
          {filteredSkills.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No skills found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSkills.map((skill) => (
                <SkillCard
                  key={skill._id}
                  skill={skill}
                  onInstall={handleInstall}
                  installing={installingSkill === skill.name}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function SkillCard({
  skill,
  onInstall,
  installing,
}: {
  skill: MarketplaceSkill;
  onInstall: (name: string) => void;
  installing: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{skill.name}</h3>
            <span className="text-xs text-muted-foreground">v{skill.version}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">by {skill.author}</p>
        </div>
        {skill.featured && (
          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
        )}
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
        {skill.description}
      </p>

      <div className="flex flex-wrap gap-1 mb-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
          <Filter className="h-3 w-3" />
          {skill.category}
        </span>
        {skill.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground"
          >
            <Tag className="h-3 w-3" />
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Download className="h-3 w-3" />
          {skill.downloads.toLocaleString()} downloads
        </div>
        <div className="flex items-center gap-2">
          {skill.repositoryUrl && (
            <a
              href={skill.repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={() => onInstall(skill.name)}
            disabled={installing}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {installing ? (
              "Installing..."
            ) : (
              <>
                Install <ArrowRight className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
