import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Send, Plus, Bot, User, Shield, ShieldAlert, Lock, AlertTriangle, Paperclip, Mic, Settings2, X, MessageSquare } from 'lucide-react';

// ============================================================
// SECRET DETECTION ENGINE
// ============================================================
const SECRET_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, category: "api_key", provider: "openai", name: "OpenAI API Key" },
  { pattern: /sk-ant-[a-zA-Z0-9-]{20,}/g, category: "api_key", provider: "anthropic", name: "Anthropic API Key" },
  { pattern: /sk-or-[a-zA-Z0-9]{20,}/g, category: "api_key", provider: "openrouter", name: "OpenRouter API Key" },
  { pattern: /AIza[a-zA-Z0-9_-]{35}/g, category: "api_key", provider: "google", name: "Google API Key" },
  { pattern: /xai-[a-zA-Z0-9]{20,}/g, category: "api_key", provider: "xai", name: "xAI API Key" },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, category: "token", provider: "github", name: "GitHub Token" },
  { pattern: /AKIA[A-Z0-9]{16}/g, category: "credential", provider: "aws", name: "AWS Access Key" },
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/g, category: "api_key", provider: "stripe", name: "Stripe Live Key" },
  { pattern: /sk_test_[a-zA-Z0-9]{24,}/g, category: "api_key", provider: "stripe", name: "Stripe Test Key" },
];

interface DetectedSecret { match: string; category: string; provider: string; name: string; }

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
    censored = censored.replace(secret.match, `[REDACTED: ${secret.name}]`);
  }
  return censored;
}

export const Route = createFileRoute('/chat')({ component: ChatPageComponent });

function ChatPageComponent() {
  const agents = useQuery(api.agents.list, {}) ?? [];
  const threads = useQuery(api.threads.list, {}) ?? [];
  const createThread = useMutation(api.threads.create);
  const addMessage = useMutation(api.messages.add);
  const storeSecret = useMutation(api.vault.store);

  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [secretWarning, setSecretWarning] = useState<DetectedSecret[] | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load messages for current thread
  const messages = useQuery(api.messages.list, currentThreadId ? { threadId: currentThreadId as any } : "skip") ?? [];

  // Auto-select first agent
  useEffect(() => {
    if (agents.length > 0 && !currentAgentId) {
      setCurrentAgentId(agents[0].id);
    }
  }, [agents, currentAgentId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const inputHasSecrets = input ? detectSecrets(input) : [];

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const secrets = detectSecrets(input);
    if (secrets.length > 0) {
      setSecretWarning(secrets);
      setPendingMessage(input);
      return;
    }

    await sendMessage(input);
  };

  const sendMessage = async (text: string) => {
    let threadId = currentThreadId;
    if (!threadId && currentAgentId) {
      threadId = await createThread({ agentId: currentAgentId, name: `Chat ${new Date().toLocaleString()}` }) as any;
      setCurrentThreadId(threadId);
    }
    if (!threadId) return;

    await addMessage({ threadId: threadId as any, role: 'user', content: text });
    setInput('');
    setIsTyping(true);

    // Simulate agent response (will be replaced by Mastra integration)
    setTimeout(async () => {
      await addMessage({ threadId: threadId as any, role: 'assistant', content: 'This response will be powered by your configured AI provider once Mastra integration is active. For now, messages are stored in Convex.' });
      setIsTyping(false);
    }, 1500);
  };

  const handleConfirmSendWithSecrets = async () => {
    if (!pendingMessage || !secretWarning) return;
    // Store secrets in vault
    for (const secret of secretWarning) {
      await storeSecret({ name: secret.name, category: secret.category, provider: secret.provider, value: secret.match });
    }
    const censored = censorText(pendingMessage, secretWarning);
    await sendMessage(censored);
    setSecretWarning(null);
    setPendingMessage(null);
  };

  const handleCancelSendWithSecrets = () => {
    setSecretWarning(null);
    setPendingMessage(null);
  };

  const handleNewChat = async () => {
    setCurrentThreadId(null);
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-8rem)] bg-background rounded-lg border border-border overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border bg-card flex flex-col">
          <div className="p-3 border-b border-border">
            <button onClick={handleNewChat} className="w-full bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> New Chat
            </button>
          </div>
          <div className="p-3 border-b border-border">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Agent</label>
            <select value={currentAgentId || ''} onChange={(e) => setCurrentAgentId(e.target.value)} className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm">
              {agents.length === 0 ? (
                <option value="">No agents — create one first</option>
              ) : (
                agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)
              )}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {threads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">No conversations yet</div>
            ) : (
              threads.map((t: any) => (
                <button key={t._id} onClick={() => setCurrentThreadId(t._id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${currentThreadId === t._id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>
                  <MessageSquare className="w-3.5 h-3.5 inline mr-2" />
                  {t.name || `Thread ${t._id.slice(-6)}`}
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          <main className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 && !currentThreadId ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bot className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h2 className="text-xl font-semibold mb-2">Start a conversation</h2>
                <p className="text-muted-foreground max-w-md">Select an agent and type a message to begin. Your conversations are stored in Convex and synced in real-time.</p>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((msg: any) => (
                  <div key={msg._id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role !== 'user' && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card border border-border rounded-bl-md'}`}>
                      {msg.content}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {isTyping && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="w-4 h-4 text-primary" /></div>
                    <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex space-x-1"><div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" /><div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.15s]" /><div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.3s]" /></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </main>

          {/* Secret Warning Modal */}
          {secretWarning && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md m-4 overflow-hidden">
                <div className="p-4 bg-yellow-900/30 border-b border-yellow-700/50 flex items-center gap-3">
                  <ShieldAlert className="w-6 h-6 text-yellow-500" />
                  <div>
                    <h3 className="font-semibold text-foreground">Secrets Detected</h3>
                    <p className="text-sm text-muted-foreground">Your message contains sensitive information</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    The following secrets were detected. They will be <strong className="text-foreground">automatically encrypted</strong> and stored in the Secure Vault. The original values will <strong className="text-foreground">never appear in chat history</strong>.
                  </p>
                  <div className="space-y-2">
                    {secretWarning.map((secret, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-background rounded-lg border border-border">
                        <Lock className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{secret.name}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">{maskSecret(secret.match)}</p>
                        </div>
                        <span className="ml-auto text-xs px-2 py-0.5 bg-yellow-900/30 text-yellow-400 rounded-full">{secret.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-4 border-t border-border flex justify-end gap-2">
                  <button onClick={handleCancelSendWithSecrets} className="px-4 py-2 text-sm rounded-lg bg-muted text-muted-foreground hover:bg-muted/80">Cancel</button>
                  <button onClick={handleConfirmSendWithSecrets} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Redact &amp; Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <footer className="p-3 border-t border-border bg-card/50">
            {inputHasSecrets.length > 0 && (
              <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-yellow-900/20 border border-yellow-700/40 rounded-lg text-yellow-400 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span><strong>{inputHasSecrets.length} secret{inputHasSecrets.length > 1 ? 's' : ''}</strong> detected. Will be auto-redacted on send.</span>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex items-center gap-2">
              <div className="flex-1 relative">
                <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={agents.length === 0 ? "Create an agent first..." : "Type your message..."} disabled={agents.length === 0} className={`w-full bg-background border rounded-lg pl-4 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${inputHasSecrets.length > 0 ? 'border-yellow-600/50' : 'border-border'}`} />
              </div>
              <button type="submit" disabled={!input.trim() || agents.length === 0} className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </footer>
        </div>
      </div>
    </DashboardLayout>
  );
}
