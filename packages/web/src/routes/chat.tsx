import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '~/components/DashboardLayout';
import { useState, useEffect, useRef } from 'react';
import { Send, Plus, Bot, User, RefreshCw } from 'lucide-react';

// Mock data for selectors - replace with Convex queries
const mockSessions = [
  { id: 'ses_1', name: 'Session with GPT-4' },
  { id: 'ses_2', name: 'Customer Support Chat' },
  { id: 'ses_3', name: 'Code Debugging' },
];

const mockAgents = [
  { id: 'agent_1', name: 'GPT-4 Turbo' },
  { id: 'agent_2', name: 'Claude 3 Opus' },
  { id: 'agent_3', name: 'Code Llama 70B' },
];

// Uncomment these when Convex is wired up
// import { useQuery, useMutation } from 'convex/react';
// import { api } from '../../convex/_generated/api';

export const Route = createFileRoute('/chat')({ component: ChatPageComponent });

function ChatPageComponent() {
  // const sessions = useQuery(api.sessions.list) ?? [];
  // const agents = useQuery(api.agents.list) ?? [];
  // const messagesData = useQuery(api.messages.listBySession, currentSessionId ? { sessionId: currentSessionId } : 'skip');
  // const sendMessage = useMutation(api.messages.create);
  // const createSession = useMutation(api.sessions.create);

  const [sessions] = useState(mockSessions);
  const [agents] = useState(mockAgents);
  const [currentSessionId, setCurrentSessionId] = useState(mockSessions[0]?.id || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentAgentId, setCurrentAgentId] = useState(mockAgents[0]?.id || null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (currentSessionId) {
      setMessages([]);
      setIsTyping(true);
      setTimeout(() => {
        setMessages([
          {
            id: 'msg_1',
            text: 'Hello! How can I assist you in this session?',
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setIsTyping(false);
      }, 500);
    }
  }, [currentSessionId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentSessionId) return;

    const userMessage = {
      id: `msg_${Date.now()}`,
      text: input,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // sendMessage({ sessionId: currentSessionId, text: input, agentId: currentAgentId });

    setTimeout(() => {
      const assistantResponse = {
        id: `msg_${Date.now() + 1}`,
        text: `This is a simulated response to: "${userMessage.text}"`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleNewSession = () => {
    const newSessionId = `ses_${Date.now()}`;
    // createSession({ agentId: currentAgentId, name: `New Session ${sessions.length + 1}` })
    //   .then(newId => setCurrentSessionId(newId));
    alert(`New session created (simulation). ID: ${newSessionId}`);
    setCurrentSessionId(newSessionId);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-background">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-4">
            <select
              value={currentSessionId || ''}
              onChange={(e) => setCurrentSessionId(e.target.value)}
              className="bg-card border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>{session.name}</option>
              ))}
            </select>
            <button onClick={handleNewSession} className="p-2 rounded-md hover:bg-card">
              <Plus className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Agent:</span>
            <select
              value={currentAgentId || ''}
              onChange={(e) => setCurrentAgentId(e.target.value)}
              className="bg-card border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'assistant' && <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center"><Bot className="w-5 h-5 text-muted-foreground" /></div>}
                <div className={`max-w-lg px-4 py-3 rounded-xl ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
                  <p className="text-sm">{msg.text}</p>
                  <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{msg.timestamp}</p>
                </div>
                {msg.sender === 'user' && <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center"><User className="w-5 h-5 text-muted-foreground" /></div>}
              </div>
            ))}
            {isTyping && (
              <div className="flex items-end gap-2 justify-start">
                <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center"><Bot className="w-5 h-5 text-muted-foreground" /></div>
                <div className="max-w-lg px-4 py-3 rounded-xl bg-card flex items-center">
                    <div className="typing-indicator">
                        <span></span><span></span><span></span>
                    </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <footer className="p-4 border-t border-border">
          <form onSubmit={handleSendMessage} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="w-full bg-card border border-border rounded-md pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted-foreground">
              <Send className="w-5 h-5" />
            </button>
          </form>
        </footer>
      </div>
    </DashboardLayout>
  );
}
