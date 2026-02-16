import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Plus, Bot, User, Shield, ShieldAlert, Lock, AlertTriangle, Paperclip, Mic, Settings2 } from 'lucide-react';

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
  { pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, category: "token", provider: "jwt", name: "JWT Token" },
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
    censored = censored.replace(secret.match, `[🔒 ${secret.name}: ${maskSecret(secret.match)}]`);
  }
  return censored;
}

// ============================================================
// Mock data (replace with Convex queries)
// ============================================================
const mockSessions = [
  { id: 'ses_1', name: 'Main Session' },
  { id: 'ses_2', name: 'Customer Support' },
  { id: 'ses_3', name: 'Code Review' },
];

const mockAgents = [
  { id: 'agent_1', name: 'GPT-4.1 Mini', provider: 'openai' },
  { id: 'agent_2', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'agent_3', name: 'Grok 2', provider: 'xai' },
  { id: 'agent_4', name: 'Gemini Pro', provider: 'google' },
];

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant' | 'system';
  timestamp: string;
  isRedacted?: boolean;
  secretsCaptured?: Array<{ name: string; masked: string }>;
}

// ============================================================
// Chat Page Component
// ============================================================
export const Route = createFileRoute('/chat')({ component: ChatPageComponent });

function ChatPageComponent() {
  const [sessions] = useState(mockSessions);
  const [agents] = useState(mockAgents);
  const [currentSessionId, setCurrentSessionId] = useState(mockSessions[0]?.id || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentAgentId, setCurrentAgentId] = useState(mockAgents[0]?.id || null);
  const [secretWarning, setSecretWarning] = useState<DetectedSecret[] | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [vaultNotification, setVaultNotification] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  useEffect(() => {
    if (currentSessionId) {
      setMessages([]);
      setIsTyping(true);
      setTimeout(() => {
        const agent = agents.find(a => a.id === currentAgentId);
        setMessages([{
          id: 'msg_welcome',
          text: `Hello! I'm ${agent?.name || 'your agent'}. How can I help you today?`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }]);
        setIsTyping(false);
      }, 500);
    }
  }, [currentSessionId]);

  // Real-time secret detection as user types
  const inputHasSecrets = input.length > 8 ? detectSecrets(input) : [];

  const handleSendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentSessionId) return;

    const detectedSecrets = detectSecrets(input);

    if (detectedSecrets.length > 0) {
      // Show warning before sending
      setSecretWarning(detectedSecrets);
      setPendingMessage(input);
      return;
    }

    // No secrets detected, send normally
    sendMessageToChat(input);
  }, [input, currentSessionId, currentAgentId]);

  const sendMessageToChat = (text: string, secrets?: DetectedSecret[]) => {
    let displayText = text;
    let secretsCaptured: Array<{ name: string; masked: string }> = [];
    let isRedacted = false;

    if (secrets && secrets.length > 0) {
      // Censor the message and auto-store secrets
      displayText = censorText(text, secrets);
      isRedacted = true;
      secretsCaptured = secrets.map(s => ({ name: s.name, masked: maskSecret(s.match) }));

      // In production: call vault.censorMessage mutation here
      // const result = await censorMessage({ text, userId, autoStore: true });

      // Show vault notification
      setVaultNotification(
        `${secrets.length} secret${secrets.length > 1 ? 's' : ''} detected and securely stored in the Vault.`
      );
      setTimeout(() => setVaultNotification(null), 5000);
    }

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      text: displayText,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRedacted,
      secretsCaptured: secretsCaptured.length > 0 ? secretsCaptured : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate agent response
    setTimeout(() => {
      const agent = agents.find(a => a.id === currentAgentId);
      let responseText: string;

      if (isRedacted) {
        responseText = `I noticed you shared ${secretsCaptured.length} secret${secretsCaptured.length > 1 ? 's' : ''}. They've been automatically encrypted and stored in your Secure Vault. The original values are never stored in chat history.\n\nHow else can I help you?`;
      } else {
        responseText = `I understand your request. Let me work on that for you.\n\n*This is a simulated response from ${agent?.name || 'the agent'}.*`;
      }

      const assistantResponse: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        text: responseText,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, assistantResponse]);
      setIsTyping(false);
    }, 1500);
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

  const handleNewSession = () => {
    const newSessionId = `ses_${Date.now()}`;
    setCurrentSessionId(newSessionId);
    setMessages([]);
  };

  const currentAgent = agents.find(a => a.id === currentAgentId);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <header className="flex items-center justify-between p-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <select
              value={currentSessionId || ''}
              onChange={(e) => setCurrentSessionId(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>{session.name}</option>
              ))}
            </select>
            <button onClick={handleNewSession} className="p-2 rounded-lg hover:bg-card border border-border" title="New Session">
              <Plus className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-lg">
              <div className={`w-2 h-2 rounded-full ${currentAgent?.provider === 'openai' ? 'bg-green-500' : currentAgent?.provider === 'anthropic' ? 'bg-orange-500' : currentAgent?.provider === 'xai' ? 'bg-purple-500' : 'bg-blue-500'}`} />
              <select
                value={currentAgentId || ''}
                onChange={(e) => setCurrentAgentId(e.target.value)}
                className="bg-transparent text-sm text-foreground focus:outline-none"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </div>
            <button className="p-2 rounded-lg hover:bg-card border border-border" title="Chat Settings">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </header>

        {/* Vault Notification Banner */}
        {vaultNotification && (
          <div className="mx-4 mt-3 flex items-center gap-2 px-4 py-2.5 bg-green-900/30 border border-green-700/50 rounded-lg text-green-400 text-sm animate-in fade-in slide-in-from-top-2">
            <Shield className="w-4 h-4 flex-shrink-0" />
            <span>{vaultNotification}</span>
            <button onClick={() => setVaultNotification(null)} className="ml-auto text-green-400/60 hover:text-green-400">&times;</button>
          </div>
        )}

        {/* Messages Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex items-end gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[75%] ${msg.sender === 'user' ? '' : ''}`}>
                  <div className={`px-4 py-2.5 rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : msg.sender === 'system'
                      ? 'bg-yellow-900/30 border border-yellow-700/50 text-yellow-200'
                      : 'bg-card border border-border rounded-bl-md'
                  }`}>
                    {msg.isRedacted && (
                      <div className="flex items-center gap-1.5 mb-1.5 text-xs opacity-75">
                        <Lock className="w-3 h-3" />
                        <span>Secrets redacted &amp; stored in Vault</span>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  </div>
                  {msg.secretsCaptured && msg.secretsCaptured.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {msg.secretsCaptured.map((s, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/30 border border-green-700/40 rounded-full text-xs text-green-400">
                          <Lock className="w-2.5 h-2.5" />
                          {s.name}: {s.masked}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className={`text-xs mt-1 px-1 ${msg.sender === 'user' ? 'text-right text-muted-foreground' : 'text-muted-foreground'}`}>
                    {msg.timestamp}
                  </p>
                </div>
                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex items-end gap-2.5 justify-start">
                <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-card border border-border">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
                  <h3 className="font-semibold text-foreground">Secrets Detected</h3>
                  <p className="text-sm text-muted-foreground">Your message contains sensitive information</p>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  The following secrets were detected in your message. They will be <strong className="text-foreground">automatically encrypted</strong> and stored in the Secure Vault. The original values will <strong className="text-foreground">never appear in chat history</strong>.
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
                <strong>{inputHasSecrets.length} secret{inputHasSecrets.length > 1 ? 's' : ''}</strong> detected ({inputHasSecrets.map(s => s.name).join(', ')}). Will be auto-redacted on send.
              </span>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex items-center gap-2">
            <button type="button" className="p-2.5 rounded-lg hover:bg-background border border-border" title="Attach file">
              <Paperclip className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className={`w-full bg-background border rounded-lg pl-4 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  inputHasSecrets.length > 0 ? 'border-yellow-600/50' : 'border-border'
                }`}
              />
            </div>
            <button type="button" className="p-2.5 rounded-lg hover:bg-background border border-border" title="Voice input">
              <Mic className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </footer>
      </div>
    </DashboardLayout>
  );
}
