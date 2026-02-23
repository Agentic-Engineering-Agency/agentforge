import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Bot, Plus, Edit, Trash2, Search, X, Star } from 'lucide-react';

export const Route = createFileRoute('/agents')({ component: AgentsPage });

const providers = ['openai', 'anthropic', 'openrouter', 'google', 'xai'];
const modelsByProvider: Record<string, string[]> = {
  openai: ['gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
  google: ['gemini-2.5-flash', 'gemini-1.5-pro'],
  anthropic: ['claude-3.5-sonnet', 'claude-3-haiku'],
  openrouter: ['openrouter/auto'],
  xai: ['grok-4', 'grok-3'],
};

function AgentsPage() {
  const agents = useQuery(api.agents.list, {}) ?? [];
  const createAgent = useMutation(api.agents.create);
  const updateAgent = useMutation(api.agents.update);
  const removeAgent = useMutation(api.agents.remove);
  const toggleActive = useMutation(api.agents.toggleActive);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);

  const filtered = useMemo(() => {
    if (!searchQuery) return agents;
    const q = searchQuery.toLowerCase();
    return agents.filter((a: any) => a.name.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q));
  }, [agents, searchQuery]);

  const handleSave = async (formData: any) => {
    if (editingAgent) {
      await updateAgent({ id: editingAgent.id, ...formData });
    } else {
      const agentId = `agent-${Date.now()}`;
      await createAgent({ id: agentId, ...formData });
    }
    setIsModalOpen(false);
    setEditingAgent(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      await removeAgent({ id });
    }
  };

  const handleToggle = async (id: string) => {
    await toggleActive({ id });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Agents</h1>
            <p className="text-muted-foreground">Create and manage your AI agents.</p>
          </div>
          <button onClick={() => { setEditingAgent(null); setIsModalOpen(true); }} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Agent
          </button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search agents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full" />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-lg">
            <Bot className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">{agents.length === 0 ? 'No agents yet' : 'No matching agents'}</h3>
            <p className="text-muted-foreground mb-4">{agents.length === 0 ? 'Create your first agent to get started.' : 'Try a different search term.'}</p>
            {agents.length === 0 && (
              <button onClick={() => { setEditingAgent(null); setIsModalOpen(true); }} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90">
                <Plus className="w-4 h-4 inline mr-2" />Create Agent
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((agent: any) => (
              <div key={agent._id} className="bg-card border border-border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{agent.name}</h3>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${agent.isActive ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                    {agent.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{agent.description || 'No description'}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                  <span className="bg-muted px-2 py-0.5 rounded">{agent.provider}</span>
                  <span className="bg-muted px-2 py-0.5 rounded">{agent.model}</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <button onClick={() => handleToggle(agent.id)} className="text-xs text-muted-foreground hover:text-foreground">
                    {agent.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingAgent(agent); setIsModalOpen(true); }} className="p-1.5 rounded hover:bg-muted"><Edit className="w-4 h-4 text-muted-foreground" /></button>
                    <button onClick={() => handleDelete(agent.id)} className="p-1.5 rounded hover:bg-destructive/10"><Trash2 className="w-4 h-4 text-destructive" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isModalOpen && <AgentModal agent={editingAgent} onSave={handleSave} onClose={() => { setIsModalOpen(false); setEditingAgent(null); }} />}
      </div>
    </DashboardLayout>
  );
}

function AgentModal({ agent, onSave, onClose }: { agent: any; onSave: (data: any) => void; onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: agent?.name || '',
    description: agent?.description || '',
    instructions: agent?.instructions || '',
    model: agent?.model || 'gpt-4.1-mini',
    provider: agent?.provider || 'openai',
    temperature: agent?.temperature ?? 0.7,
    maxTokens: agent?.maxTokens ?? 4096,
  });

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'maxTokens' ? parseInt(value) || 0 : value }));
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    onSave({ ...formData, temperature: parseFloat(String(formData.temperature)) });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
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
            <input type="text" name="description" value={formData.description} onChange={handleChange} className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Instructions</label>
            <textarea name="instructions" value={formData.instructions} onChange={handleChange} rows={6} className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Provider</label>
              <select name="provider" value={formData.provider} onChange={(e) => { handleChange(e); setFormData(prev => ({ ...prev, provider: e.target.value, model: (modelsByProvider[e.target.value] || [])[0] || '' })); }} className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary">
                {providers.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Model</label>
              <select name="model" value={formData.model} onChange={handleChange} className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary">
                {(modelsByProvider[formData.provider] || []).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Temperature: {formData.temperature}</label>
              <input type="range" min="0" max="1" step="0.1" value={formData.temperature} onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))} className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Tokens</label>
              <input type="number" name="maxTokens" value={formData.maxTokens} onChange={handleChange} className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
        </form>
        <div className="flex justify-end p-4 border-t border-border gap-2">
          <button onClick={onClose} className="bg-background border border-border px-4 py-2 rounded-lg hover:bg-muted">Cancel</button>
          <button onClick={handleSubmit} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90">Save Agent</button>
        </div>
      </div>
    </div>
  );
}
