import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "../components/DashboardLayout";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  Send,
  Plus,
  Bot,
  User,
  Shield,
  ShieldAlert,
  Lock,
  AlertTriangle,
  Paperclip,
  Mic,
  Settings2,
  Loader2,
  MessageSquare,
  Trash2,
} from "lucide-react";

// ============================================================
// SECRET DETECTION ENGINE (client-side mirror of vault patterns)
// ============================================================
const SECRET_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, category: "api_key", provider: "openai", name: "OpenAI API Key" },
  { pattern: /sk-ant-[a-zA-Z0-9-]{20,}/g, category: "api_key", provider: "anthropic", name: "Anthropic API Key" },
  { pattern: /sk-or-[a-zA-Z0-9]{20,}/g, category: "api_key", provider: "openrouter", name: "OpenRouter API Key" },
  { pattern: /AIza[a-zA-Z0-9_-]{35}/g, category: "api_key", provider: "google", name: "Google API Key" },
  { pattern: /xai-[a-zA-Z0-9]{20,}/g, category: "api_key", provider: "xai", name: "xAI API Key" },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, category: "token", provider: "github", name: "GitHub Token" },
  { pattern: /gho_[a-zA-Z0-9]{36}/g, category: "token", provider: "github", name: "GitHub OAuth" },
  { pattern: /glpat-[a-zA-Z0-9_-]{20,}/g, category: "token", provider: "gitlab", name: "GitLab Token" },
  { pattern: /xoxb-[a-zA-Z0-9-]+/g, category: "token", provider: "slack", name: "Slack Bot Token" },
  { pattern: /xoxp-[a-zA-Z0-9-]+/g, category: "token", provider: "slack", name: "Slack User Token" },
  { pattern: /AKIA[A-Z0-9]{16}/g, category: "credential", provider: "aws", name: "AWS Access Key" },
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/g, category: "api_key", provider: "stripe", name: "Stripe Live Key" },
  { pattern: /sk_test_[a-zA-Z0-9]{24,}/g, category: "api_key", provider: "stripe", name: "Stripe Test Key" },
  { pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g, category: "api_key", provider: "sendgrid", name: "SendGrid Key" },
];

interface DetectedSecret {
  match: string;
  category: string;
  provider: string;
  name: string;
}

function detectSecrets(text: string): DetectedSecret[] {
  const detected: DetectedSecret[] = [];
  for (const { pattern, category, provider, name } of SECRET_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      detected.push({ match: match[0], category, provider, name });
    }
  }
  return detected;
}

function maskSecret(value: string): string {
  if (value.length <= 12) return value.substring(0, 3) + "..." + value.substring(value.length - 3);
  return value.substring(0, 6) + "..." + value.substring(value.length - 4);
}

function censorText(text: string, secrets: DetectedSecret[]): string {
  let censored = text;
  for (const secret of secrets) {
    censored = censored.replace(secret.match, `[${secret.name}: ${maskSecret(secret.match)}]`);
  }
  return censored;
}

// ============================================================
// Chat Page Component
// ============================================================
export const Route = createFileRoute("/chat")({ component: ChatPageComponent });

function ChatPageComponent() {
  // ── Convex queries ──────────────────────────────────────────
  const agents = useQuery(api.agents.listActive, {}) ?? [];
  const threads = useQuery(api.chat.listThreads, {}) ?? [];

  // ── Convex mutations & actions ──────────────────────────────
  const createThread = useMutation(api.chat.createThread);
  const sendMessageAction = useAction(api.chat.sendMessage);

  // ── Local state ─────────────────────────────────────────────
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [secretWarning, setSecretWarning] = useState<DetectedSecret[] | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [vaultNotification, setVaultNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Subscribe to messages for the current thread ────────────
  // This is the real-time subscription — messages update automatically
  // when new ones are inserted by the Convex action.
  const messages = useQuery(
    api.chat.getThreadMessages,
    currentThreadId ? { threadId: currentThreadId as any } : "skip"
  ) ?? [];

  // ── Auto-select first agent ─────────────────────────────────
  useEffect(() => {
    if (agents.length > 0 && !currentAgentId) {
      setCurrentAgentId(agents[0].id);
    }
  }, [agents, currentAgentId]);

  // ── Auto-select first thread or none ────────────────────────
  useEffect(() => {
    if (threads.length > 0 && !currentThreadId) {
      setCurrentThreadId(threads[0]._id);
    }
  }, [threads, currentThreadId]);

  // ── Auto-scroll to bottom ───────────────────────────────────
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // ── Secret detection as user types ──────────────────────────
  const inputHasSecrets = input.length > 8 ? detectSecrets(input) : [];

  // ── Create new thread ───────────────────────────────────────
  const handleNewThread = useCallback(async () => {
    if (!currentAgentId) {
      setError("Please select an agent first.");
      return;
    }
    try {
      const agent = agents.find((a) => a.id === currentAgentId);
      const threadId = await createThread({
        agentId: currentAgentId,
        name: `Chat with ${agent?.name || "Agent"}`,
      });
      setCurrentThreadId(threadId);
      setError(null);
    } catch (e) {
      setError(`Failed to create thread: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [currentAgentId, agents, createThread]);

  // ── Send message ────────────────────────────────────────────
  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || !currentAgentId) return;

      // Check for secrets
      const detectedSecrets = detectSecrets(input);
      if (detectedSecrets.length > 0) {
        setSecretWarning(detectedSecrets);
        setPendingMessage(input);
        return;
      }

      await sendMessageToChat(input);
    },
    [input, currentAgentId, currentThreadId]
  );

  const sendMessageToChat = async (text: string, secrets?: DetectedSecret[]) => {
    if (!currentAgentId) return;

    let messageText = text;
    if (secrets && secrets.length > 0) {
      messageText = censorText(text, secrets);
      setVaultNotification(
        `${secrets.length} secret${secrets.length > 1 ? "s" : ""} detected and redacted.`
      );
      setTimeout(() => setVaultNotification(null), 5000);
    }

    setInput("");
    setIsGenerating(true);
    setError(null);

    try {
      // If no thread exists, create one first
      let threadId = currentThreadId;
      if (!threadId) {
        const agent = agents.find((a) => a.id === currentAgentId);
        threadId = await createThread({
          agentId: currentAgentId,
          name: `Chat with ${agent?.name || "Agent"}`,
        });
        setCurrentThreadId(threadId);
      }

      // Call the Convex action — this stores user message, calls LLM,
      // and stores assistant response. The useQuery subscription above
      // will automatically pick up both new messages in real-time.
      await sendMessageAction({
        agentId: currentAgentId,
        threadId: threadId as any,
        content: messageText,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Failed to send message: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmSendWithSecrets = () => {
    if (pendingMessage && secretWarning) {
      sendMessageToChat(pendingMessage, secretWarning);
    }
    setSecretWarning(null);
    setPendingMessage(null);
  };

  const handleCancelSendWithSecrets = () => {
    setSecretWarning(null);
    setPendingMessage(null);
    inputRef.current?.focus();
  };

  // ── Derived state ───────────────────────────────────────────
  const currentAgent = agents.find((a) => a.id === currentAgentId);
  const hasAgents = agents.length > 0;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <header className="flex items-center justify-between p-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            {/* Thread selector */}
            <select
              value={currentThreadId || ""}
              onChange={(e) => setCurrentThreadId(e.target.value || null)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {threads.length === 0 && (
                <option value="">No threads yet</option>
              )}
              {threads.map((thread) => (
                <option key={thread._id} value={thread._id}>
                  {thread.name || "Untitled Thread"}
                </option>
              ))}
            </select>
            <button
              onClick={handleNewThread}
              className="p-2 rounded-lg hover:bg-card border border-border"
              title="New Thread"
            >
              <Plus className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            {/* Agent selector */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-lg">
              <div
                className={`w-2 h-2 rounded-full ${
                  currentAgent?.provider === "openai"
                    ? "bg-green-500"
                    : currentAgent?.provider === "anthropic"
                    ? "bg-orange-500"
                    : currentAgent?.provider === "openrouter"
                    ? "bg-purple-500"
                    : "bg-blue-500"
                }`}
              />
              <select
                value={currentAgentId || ""}
                onChange={(e) => setCurrentAgentId(e.target.value || null)}
                className="bg-transparent text-sm text-foreground focus:outline-none"
              >
                {agents.length === 0 && (
                  <option value="">No agents configured</option>
                )}
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.provider}/{agent.model})
                  </option>
                ))}
              </select>
            </div>
            <button
              className="p-2 rounded-lg hover:bg-card border border-border"
              title="Chat Settings"
            >
              <Settings2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </header>

        {/* Vault Notification Banner */}
        {vaultNotification && (
          <div className="mx-4 mt-3 flex items-center gap-2 px-4 py-2.5 bg-green-900/30 border border-green-700/50 rounded-lg text-green-400 text-sm animate-in fade-in slide-in-from-top-2">
            <Shield className="w-4 h-4 flex-shrink-0" />
            <span>{vaultNotification}</span>
            <button
              onClick={() => setVaultNotification(null)}
              className="ml-auto text-green-400/60 hover:text-green-400"
            >
              &times;
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mt-3 flex items-center gap-2 px-4 py-2.5 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400/60 hover:text-red-400"
            >
              &times;
            </button>
          </div>
        )}

        {/* No Agents Warning */}
        {!hasAgents && (
          <div className="mx-4 mt-3 flex items-center gap-2 px-4 py-2.5 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-yellow-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              No agents configured. Go to the{" "}
              <a href="/agents" className="underline font-medium">
                Agents
              </a>{" "}
              page to create one, or the chat will use a default assistant.
            </span>
          </div>
        )}

        {/* Messages Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Empty state */}
            {messages.length === 0 && !isGenerating && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {currentThreadId ? "No messages yet" : "Start a new conversation"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {currentThreadId
                    ? "Send a message to start chatting with your agent."
                    : "Select a thread from the dropdown or create a new one to begin."}
                </p>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg) => (
              <div
                key={msg._id}
                className={`flex items-end gap-2.5 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[75%]`}>
                  <div
                    className={`px-4 py-2.5 rounded-2xl ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : msg.role === "system"
                        ? "bg-yellow-900/30 border border-yellow-700/50 text-yellow-200"
                        : "bg-card border border-border rounded-bl-md"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <p
                    className={`text-xs mt-1 px-1 ${
                      msg.role === "user"
                        ? "text-right text-muted-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isGenerating && (
              <div className="flex items-end gap-2.5 justify-start">
                <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-card border border-border">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {currentAgent?.name || "Agent"} is thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Secret Warning Modal */}
        {secretWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md m-4 overflow-hidden">
              <div className="p-4 bg-yellow-900/30 border-b border-yellow-700/50 flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 text-yellow-500" />
                <div>
                  <h3 className="font-semibold text-foreground">
                    Secrets Detected
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Your message contains sensitive information
                  </p>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  The following secrets were detected in your message. They will
                  be{" "}
                  <strong className="text-foreground">
                    automatically redacted
                  </strong>{" "}
                  before being sent. The original values will{" "}
                  <strong className="text-foreground">
                    never appear in chat history
                  </strong>
                  .
                </p>
                <div className="space-y-2">
                  {secretWarning.map((secret, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 bg-background rounded-lg border border-border"
                    >
                      <Lock className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {secret.name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {maskSecret(secret.match)}
                        </p>
                      </div>
                      <span className="ml-auto text-xs px-2 py-0.5 bg-yellow-900/30 text-yellow-400 rounded-full">
                        {secret.category}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <button
                  onClick={handleCancelSendWithSecrets}
                  className="px-4 py-2 text-sm rounded-lg bg-muted text-muted-foreground hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSendWithSecrets}
                  className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Redact &amp; Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <footer className="p-3 border-t border-border bg-card/50">
          {/* Secret detection warning bar */}
          {inputHasSecrets.length > 0 && (
            <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-yellow-900/20 border border-yellow-700/40 rounded-lg text-yellow-400 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                <strong>
                  {inputHasSecrets.length} secret
                  {inputHasSecrets.length > 1 ? "s" : ""}
                </strong>{" "}
                detected ({inputHasSecrets.map((s) => s.name).join(", ")}). Will
                be auto-redacted on send.
              </span>
            </div>
          )}
          <form
            onSubmit={handleSendMessage}
            className="max-w-3xl mx-auto flex items-center gap-2"
          >
            <button
              type="button"
              className="p-2.5 rounded-lg hover:bg-background border border-border"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isGenerating
                    ? "Waiting for response..."
                    : "Type your message..."
                }
                disabled={isGenerating}
                className={`w-full bg-background border rounded-lg pl-4 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${
                  inputHasSecrets.length > 0
                    ? "border-yellow-600/50"
                    : "border-border"
                }`}
              />
            </div>
            <button
              type="button"
              className="p-2.5 rounded-lg hover:bg-background border border-border"
              title="Voice input"
            >
              <Mic className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              type="submit"
              disabled={!input.trim() || isGenerating}
              className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </footer>
      </div>
    </DashboardLayout>
  );
}
