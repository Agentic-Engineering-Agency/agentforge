
import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo } from 'react';
import { Bot, Plus, Edit, Trash2, Search, Settings, Zap, X, ChevronDown, Star } from 'lucide-react';

// MOCK DATA (to be replaced by Convex)
const initialAgents = [
  {
    id: 'agent-1',
    name: 'Research Assistant',
    description: 'An agent specialized in gathering and summarizing information from the web.',
    instructions: 'You are a research assistant. Your goal is to find the most relevant and up-to-date information on any given topic. Use search tools and summarize your findings clearly.',
    model: 'gpt-4.1-mini',
    provider: 'OpenAI',
    temperature: 0.7,
    maxTokens: 4096,
    status: 'active',
  },
  {
    id: 'agent-2',
    name: 'Code Generator',
    description: 'Generates code in various programming languages based on user requirements.',
    instructions: 'You are a senior software engineer. Write clean, efficient, and well-documented code. Always ask for clarification if the requirements are ambiguous.',
    model: 'gemini-2.5-flash',
    provider: 'Google',
    temperature: 0.5,
    maxTokens: 8192,
    status: 'inactive',
  },
  {
    id: 'agent-3',
    name: 'Creative Writer',
    description: 'A creative partner for brainstorming and writing stories, scripts, and more.',
    instructions: 'You are a creative writer. Help users brainstorm ideas, develop characters, and write compelling narratives. Be imaginative and inspiring.',
    model: 'grok-4',
    provider: 'xAI',
    temperature: 0.9,
    maxTokens: 2048,
    status: 'active',
  },
];

// CONVEX PLACEHOLDERS
// import { useQuery, useMutation } from 'convex/react';
// import { api } from '../../convex/_generated/api';

export const Route = createFileRoute('/agents')({ component: AgentsPage });

function AgentsPage() {
  // const agents = useQuery(api.agents.list) || [];
  // const createAgent = useMutation(api.agents.create);
  // const updateAgent = useMutation(api.agents.update);
  // const deleteAgent = useMutation(api.agents.delete);

  const [agents, setAgents] = useState(initialAgents);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);

  const filteredAgents = useMemo(() =>
    agents.filter(agent =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [agents, searchQuery]
  );

  const openModal = (agent = null) => {
    setEditingAgent(agent);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingAgent(null);
    setIsModalOpen(false);
  };

  const handleSaveAgent = (agentData: any) => {
    if (editingAgent) {
      // updateAgent({ id: editingAgent.id, ...agentData });
      setAgents(agents.map(a => a.id === editingAgent.id ? { ...a, ...agentData } : a));
    } else {
      // createAgent(agentData);
      setAgents([...agents, { id: `agent-${Date.now()}`, status: 'active', ...agentData }]);
    }
    closeModal();
  };

  const handleDeleteAgent = (agentId: string) => {
    if (window.confirm('Are you sure you want to delete this agent?')) {
      // deleteAgent({ id: agentId });
      setAgents(agents.filter(a => a.id !== agentId));
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 bg-background text-foreground">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold flex items-center"><Bot className="mr-2" /> Agents</h1>
          <button onClick={() => openModal()} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Create Agent
          </button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {filteredAgents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map(agent => (
              <AgentCard key={agent.id} agent={agent} onEdit={openModal} onDelete={handleDeleteAgent} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
            <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No agents found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create a new agent to get started.</p>
          </div>
        )}
      </div>
      {isModalOpen && <AgentModal agent={editingAgent} onSave={handleSaveAgent} onClose={closeModal} />}
    </DashboardLayout>
  );
}

function AgentCard({ agent, onEdit, onDelete }: { agent: any; onEdit: (agent: any) => void; onDelete: (id: string) => void }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between hover:shadow-lg transition-shadow">
      <div>
        <div className="flex justify-between items-start">
          <div className="flex items-center mb-2">
            <Bot className="h-8 w-8 text-primary mr-3" />
            <div>
              <h2 className="text-lg font-bold">{agent.name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full ${agent.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {agent.status}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => onEdit(agent)} className="text-muted-foreground hover:text-foreground"><Edit className="h-4 w-4" /></button>
            <button onClick={() => onDelete(agent.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4 h-10 overflow-hidden">{agent.description}</p>
        <div className="flex items-center text-xs text-muted-foreground space-x-4 mb-4">
          <div className="flex items-center"><Settings className="h-3 w-3 mr-1" /> {agent.model}</div>
          <div className="flex items-center"><Zap className="h-3 w-3 mr-1" /> {agent.provider}</div>
        </div>
      </div>
      <button className="w-full bg-background border border-border text-center py-2 rounded-lg hover:bg-primary/10 text-sm">View Details</button>
    </div>
  );
}

function AgentModal({ agent, onSave, onClose }: { agent: any; onSave: (data: any) => void; onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: agent?.name || '',
    description: agent?.description || '',
    instructions: agent?.instructions || '',
    model: agent?.model || 'gpt-4.1-mini',
    provider: agent?.provider || 'OpenAI',
    temperature: agent?.temperature || 0.7,
    maxTokens: agent?.maxTokens || 4096,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const providers = ['OpenAI', 'Anthropic', 'OpenRouter', 'Google', 'xAI'];
  const models: Record<string, string[]> = {
    OpenAI: ['gpt-4.1-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    Google: ['gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'],
    Anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    OpenRouter: ['openrouter/auto'],
    xAI: ['grok-4', 'grok-4-314b'],
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-lg font-bold">{agent ? 'Edit Agent' : 'Create Agent'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input type="text" name="description" value={formData.description} onChange={handleChange} className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Instructions</label>
            <textarea name="instructions" value={formData.instructions} onChange={handleChange} rows={6} className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Provider</label>
              <select name="provider" value={formData.provider} onChange={handleChange} className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary">
                {providers.map((p: string) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Model</label>
              <select name="model" value={formData.model} onChange={handleChange} className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary">
                {(models[formData.provider] || []).map((m: string) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Temperature: {formData.temperature}</label>
              <input type="range" min="0" max="1" step="0.1" value={formData.temperature} onChange={handleSliderChange} className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Tokens</label>
              <input type="number" name="maxTokens" value={formData.maxTokens} onChange={handleChange} className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
        </form>
        <div className="flex justify-end p-4 border-t border-border">
          <button onClick={onClose} className="bg-background border border-border px-4 py-2 rounded-lg mr-2 hover:bg-primary/10">Cancel</button>
          <button onClick={handleSubmit} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90">Save Agent</button>
        </div>
      </div>
    </div>
  );
}
