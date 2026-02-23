import React, { useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  MessageSquare, LayoutDashboard, Radio, Server, Activity, Clock,
  Bot, Sparkles, Network, Settings, Bug, FileText, Menu, X,
  ChevronLeft, ChevronRight, User, Heart, FolderKanban, Folder,
} from "lucide-react";

const navItems = [
  {
    section: "Chat",
    items: [
      { href: "/chat", label: "Chat", icon: MessageSquare },
    ],
  },
  {
    section: "Control",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/sessions", label: "Sessions", icon: Activity },
      { href: "/usage", label: "Usage", icon: Clock },
      { href: "/observability", label: "Observability", icon: Activity },
      { href: "/cron", label: "Cron Jobs", icon: Clock },
    ],
  },
  {
    section: "Agent",
    items: [
      { href: "/agents", label: "Agents", icon: Bot },
      { href: "/skills", label: "Skills", icon: Sparkles },
      { href: "/connections", label: "Connections", icon: Network },
    ],
  },
  {
    section: "Workspace",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/files", label: "Files", icon: Folder },
    ],
  },
  {
    section: "Settings",
    items: [
      { href: "/settings", label: "Config", icon: Settings },
    ],
  },
];

const HealthStatus = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // In production, poll the Convex backend heartbeat
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="relative flex h-2 w-2">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
            isOnline ? "bg-green-400" : "bg-red-400"
          } opacity-75`}
        ></span>
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isOnline ? "bg-green-500" : "bg-red-500"
          }`}
        ></span>
      </span>
      {isOnline ? "Online" : "Offline"}
    </div>
  );
};

const Breadcrumb = () => {
  const { location } = useRouterState();
  const pathnames = location.pathname.split("/").filter((x) => x);

  if (pathnames.length === 0) {
    return <span className="text-sm font-medium">Overview</span>;
  }

  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
        <li className="inline-flex items-center">
          <Link
            to="/"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <LayoutDashboard className="w-4 h-4 me-2.5" />
            Home
          </Link>
        </li>
        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join("/")}`;
          const isLast = index === pathnames.length - 1;
          return (
            <li key={to}>
              <div className="flex items-center">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <Link
                  to={to}
                  className={`ms-1 text-sm font-medium ${
                    isLast
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  } md:ms-2`}
                >
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { location } = useRouterState();

  const NavLink = ({ item }: { item: any }) => {
    const isActive = location.pathname === item.href;
    return (
      <Link
        to={item.href}
        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <item.icon className="w-5 h-5 mr-3" />
        <span>{item.label}</span>
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between h-16 px-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold">
          <Bot className="w-7 h-7 text-primary" />
          <span>AgentForge</span>
        </Link>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-4 overflow-y-auto">
        {navItems.map((section) => (
          <div key={section.section}>
            <h3 className="px-3 mb-2 text-xs font-semibold tracking-wider text-muted-foreground/80 uppercase">
              {section.section}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
        <HealthStatus />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:block bg-card border-r border-border transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "w-64" : "w-0 overflow-hidden"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 flex md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black/60"
            aria-hidden="true"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          <div className="relative flex flex-col flex-1 w-full max-w-xs bg-card">
            <div className="absolute top-0 right-0 pt-2 -mr-12">
              <button
                type="button"
                className="flex items-center justify-center w-10 h-10 ml-1 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between h-16 px-4 bg-card border-b border-border md:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden p-2 rounded-md md:block hover:bg-muted"
            >
              {isSidebarOpen ? (
                <ChevronLeft className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-md md:hidden hover:bg-muted"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Breadcrumb />
          </div>
          <div className="flex items-center gap-4">
            <HealthStatus />
            <div className="p-2 rounded-full bg-muted">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 overflow-y-auto md:p-6">{children}</main>
      </div>
    </div>
  );
}
