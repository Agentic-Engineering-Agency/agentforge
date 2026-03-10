const DEFAULT_DAEMON_URL = "http://localhost:3001";

declare global {
  interface Window {
    __AGENTFORGE_DAEMON_URL__?: string;
  }
}

export function getDaemonUrl(): string {
  return (
    window.__AGENTFORGE_DAEMON_URL__ ??
    import.meta.env.VITE_AGENTFORGE_DAEMON_URL ??
    DEFAULT_DAEMON_URL
  );
}

export function initRuntimeConfig(): void {
  window.__AGENTFORGE_DAEMON_URL__ = getDaemonUrl();
}
