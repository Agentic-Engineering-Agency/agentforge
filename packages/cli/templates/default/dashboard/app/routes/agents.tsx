import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Bot, Plus, Edit, Trash2, Search, X, Star, Loader2 } from 'lucide-react';

export const Route = createFileRoute('/agents')({ component: AgentsPage });

const providers = ['openai', 'anthropic', 'google', 'xai', 'mistral', 'deepseek', 'openrouter', 'groq', 'together', 'perplexity'];

// Static fallback models — used when no API key is configured or the live fetch fails
const FALLBACK_MODELS: Record<string, string[]> = {
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'o3', 'o4-mini'],
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  xai: ['grok-3', 'grok-3-mini', 'grok-2'],
  mistral: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  openrouter: ['openrouter/auto', 'openai/gpt-4o', 'anthropic/claude-sonnet-4-6', 'google/gemini-2.5-flash'],
  groq: ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b', 'qwen-qwq-32b'],
  together: ['meta-llama/Llama-4-Scout-17B-16E-Instruct', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct-Turbo'],
  perplexity: ['sonar-pro', 'sonar', 'sonar-reasoning-pro'],
};

/**
 * Returns static model list for a provider.
 * Live model fetching removed in v0.12 — models are managed by the runtime daemon.
 */
function useProviderModels(provider: string) {
  const [models, setModels] = useState<string[]>(FALLBACK_MODELS[provider] ?? []);
  const [loading] = useState(false);

  useEffect(() => {
    setModels(FALLBACK_MODELS[provider] ?? []);
    if (!provider) return;
    // Static models only — live fetch was removed in SPEC-022.
    // The runtime daemon resolves provider models at startup via agentforge.config.ts.
    if (false) {
      // dead code preserved for diff readability
      if (false) {
          setModels(FALLBACK_MODELS[provider] ?? []);
        }
      })
      .catch(() => { if (!cancelled) setModels(FALLBACK_MODELS[provider] ?? []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [provider]); // eslint-disable-line react-hooks/exhaustive-deps

  return { models, loading };
}

// Validation constraints
const VALIDATION = {
  name: { maxLength: 100 },
  description: { maxLength: 500 },
  instructions: { maxLength: 10000 },
  temperature: { min: 0.0, max: 2.0, step: 0.1 },
  maxTokens: { min: 1, max: 32000 },
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
  const [confirmingDeletingId, setConfirmingDeletingId] = useState<string | null>(null);

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

  const handleDeleteClick = (id: string) => {
    if (confirmingDeletingId === id) {
      // Second click - actually delete
      removeAgent({ id });
      setConfirmingDeletingId(null);
    } else {
      // First click - show confirm state
      setConfirmingDeletingId(id);
    }
  };

  const handleToggle = async (id: string) => {
    await toggleActive({ id });
  };

  // Reset confirm state when clicking elsewhere or after a delay
  const handleCardInteraction = () => {
    if (confirmingDeletingId) {
      setConfirmingDeletingId(null);
    }
  };

  return (
    <DashboardLayout onClickOutside={handleCardInteraction}>
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
                    <button
                      onClick={() => handleDeleteClick(agent.id)}
                      className={`p-1.5 rounded transition-colors ${
                        confirmingDeletingId === agent.id
                          ? 'bg-destructive text-destructive-foreground'
                          : 'hover:bg-destructive/10'
                      }`}
                      title={confirmingDeletingId === agent.id ? 'Click to confirm delete' : 'Delete agent'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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

  const { models: modelsForProvider, loading: modelsLoading } = useProviderModels(formData.provider);

  // Auto-select first available model when switching provider
  useEffect(() => {
    if (modelsForProvider.length > 0 && !modelsForProvider.includes(formData.model)) {
      setFormData(prev => ({ ...prev, model: modelsForProvider[0] }));
    }
  }, [modelsForProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
    setFormData(prev => ({ ...prev, [name]: name === 'maxTokens' ? parseInt(value) || 0 : value }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (formData.name.length > VALIDATION.name.maxLength) {
      newErrors.name = `Name must be ${VALIDATION.name.maxLength} characters or less`;
    }
    if (formData.description.length > VALIDATION.description.maxLength) {
      newErrors.description = `Description must be ${VALIDATION.description.maxLength} characters or less`;
    }
    if (formData.instructions.length > VALIDATION.instructions.maxLength) {
      newErrors.instructions = `Instructions must be ${VALIDATION.instructions.maxLength} characters or less`;
    }
    if (formData.temperature < VALIDATION.temperature.min || formData.temperature > VALIDATION.temperature.max) {
      newErrors.temperature = `Temperature must be between ${VALIDATION.temperature.min} and ${VALIDATION.temperature.max}`;
    }
    if (formData.maxTokens < VALIDATION.maxTokens.min || formData.maxTokens > VALIDATION.maxTokens.max) {
      newErrors.maxTokens = `Max tokens must be between ${VALIDATION.maxTokens.min} and ${VALIDATION.maxTokens.max}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (validateForm()) {
      onSave({ ...formData, temperature: parseFloat(String(formData.temperature)) });
    }
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
            <label className="block text-sm font-medium mb-1">Name {formData.name.length}/{VALIDATION.name.maxLength}</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              maxLength={VALIDATION.name.maxLength}
              className={`w-full bg-background border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${errors.name ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-primary'}`}
              required
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description {formData.description.length}/{VALIDATION.description.maxLength}</label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              maxLength={VALIDATION.description.maxLength}
              className={`w-full bg-background border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${errors.description ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-primary'}`}
            />
            {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Instructions {formData.instructions.length}/{VALIDATION.instructions.maxLength}</label>
            <textarea
              name="instructions"
              value={formData.instructions}
              onChange={handleChange}
              rows={6}
              maxLength={VALIDATION.instructions.maxLength}
              className={`w-full bg-background border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${errors.instructions ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-primary'}`}
              required
            />
            {errors.instructions && <p className="text-xs text-destructive mt-1">{errors.instructions}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Provider</label>
              <select name="provider" value={formData.provider} onChange={(e) => { handleChange(e); setFormData(prev => ({ ...prev, provider: e.target.value, model: '' })); }} className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary">
                {providers.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                Model {modelsLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              </label>
              <select name="model" value={formData.model} onChange={handleChange} disabled={modelsLoading} className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50">
                {modelsLoading
                  ? <option value="">Loading models…</option>
                  : modelsForProvider.map(m => <option key={m} value={m}>{m}</option>)
                }
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Temperature: {formData.temperature} ({VALIDATION.temperature.min}-{VALIDATION.temperature.max})</label>
              <input
                type="range"
                min={VALIDATION.temperature.min}
                max={VALIDATION.temperature.max}
                step={VALIDATION.temperature.step}
                value={formData.temperature}
                onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer"
              />
              {errors.temperature && <p className="text-xs text-destructive mt-1">{errors.temperature}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Tokens ({VALIDATION.maxTokens.min}-{VALIDATION.maxTokens.max})</label>
              <input
                type="number"
                name="maxTokens"
                value={formData.maxTokens}
                onChange={handleChange}
                min={VALIDATION.maxTokens.min}
                max={VALIDATION.maxTokens.max}
                className={`w-full bg-background border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${errors.maxTokens ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-primary'}`}
              />
              {errors.maxTokens && <p className="text-xs text-destructive mt-1">{errors.maxTokens}</p>}
            </div>
          </div>
        </form>
        <div className="flex justify-end p-4 border-t border-border gap-2">
          <button type="button" onClick={onClose} className="bg-background border border-border px-4 py-2 rounded-lg hover:bg-muted">Cancel</button>
          <button type="submit" onClick={handleSubmit} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90">Save Agent</button>
        </div>
      </div>
    </div>
  );
}
