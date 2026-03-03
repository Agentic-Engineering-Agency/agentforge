import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import { Bot, Plus, Edit, Trash2, Search, Settings, Zap, X, ChevronDown, ChevronUp, HardDrive, Container } from 'lucide-react';
import { LLM_PROVIDERS, getModelsByProvider } from '../../../../convex/llmProviders';
import { useAction, useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import * as Switch from '@radix-ui/react-switch';
import * as Select from '@radix-ui/react-select';

interface FailoverModel {
  provider: string;
  model: string;
}

interface WorkspaceStorage {
  type: 'local' | 's3' | 'r2';
  basePath?: string;
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  model: string;
  provider: string;
  temperature: number;
  maxTokens: number;
  status: string;
  sandboxEnabled?: boolean;
  sandboxImage?: string;
  workspaceStorage?: WorkspaceStorage;
  failoverModels?: FailoverModel[];
}

// MOCK DATA (to be replaced by Convex)
const initialAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'Research Assistant',
    description: 'An agent specialized in gathering and summarizing information from the web.',
    instructions: 'You are a research assistant. Your goal is to find the most relevant and up-to-date information on any given topic. Use search tools and summarize your findings clearly.',
    model: 'gpt-4.1-mini',
    provider: 'openai',
    temperature: 0.7,
    maxTokens: 4096,
    status: 'active',
    sandboxEnabled: false,
    workspaceStorage: { type: 'local' },
    failoverModels: [],
  },
  {
    id: 'agent-2',
    name: 'Code Generator',
    description: 'Generates code in various programming languages based on user requirements.',
    instructions: 'You are a senior software engineer. Write clean, efficient, and well-documented code. Always ask for clarification if the requirements are ambiguous.',
    model: 'gemini-2.5-flash',
    provider: 'google',
    temperature: 0.5,
    maxTokens: 8192,
    status: 'inactive',
    sandboxEnabled: true,
    sandboxImage: 'node:20',
    workspaceStorage: { type: 'local' },
    failoverModels: [{ provider: 'openai', model: 'gpt-4.1-mini' }],
  },
  {
    id: 'agent-3',
    name: 'Creative Writer',
    description: 'A creative partner for brainstorming and writing stories, scripts, and more.',
    instructions: 'You are a creative writer. Help users brainstorm ideas, develop characters, and write compelling narratives. Be imaginative and inspiring.',
    model: 'grok-3',
    provider: 'xai',
    temperature: 0.9,
    maxTokens: 2048,
    status: 'active',
    sandboxEnabled: false,
    workspaceStorage: { type: 'local' },
    failoverModels: [],
  },
];

export const Route = createFileRoute('/agents')({ component: AgentsPage });

function useProviderModels(provider: string) {
  const fetchModels = useAction(api.modelFetcher.getModelsForProvider);
  const staticModels = getModelsByProvider(provider);
  const [models, setModels] = useState(staticModels);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!provider) return;
    setLoading(true);
    fetchModels({ provider })
      .then(live => setModels(live.length > 0 ? (live as any as import('../../../../convex/llmProviders').LLMModel[]) : staticModels))
      .catch(() => setModels(staticModels))
      .finally(() => setLoading(false));
  }, [provider]);

  return { models, loading };
}

function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const filteredAgents = useMemo(() =>
    agents.filter(agent =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [agents, searchQuery]
  );

  const openModal = (agent: Agent | null = null) => {
    setEditingAgent(agent);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingAgent(null);
    setIsModalOpen(false);
  };

  const handleSaveAgent = (agentData: Omit<Agent, 'id' | 'status'>) => {
    if (editingAgent) {
      setAgents(agents.map(a => a.id === editingAgent.id ? { ...a, ...agentData } : a));
    } else {
      setAgents([...agents, { id: `agent-${Date.now()}`, status: 'active', ...agentData }]);
    }
    closeModal();
  };

  const handleDeleteAgent = (agentId: string) => {
    if (window.confirm('Are you sure you want to delete this agent?')) {
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

interface AgentCardProps {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (id: string) => void;
}

function AgentCard({ agent, onEdit, onDelete }: AgentCardProps) {
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

interface AgentModalProps {
  agent: Agent | null;
  onSave: (data: Omit<Agent, 'id' | 'status'>) => void;
  onClose: () => void;
}

function AgentModal({ agent, onSave, onClose }: AgentModalProps) {
  const [formData, setFormData] = useState({
    name: agent?.name || '',
    description: agent?.description || '',
    instructions: agent?.instructions || '',
    model: agent?.model || 'gpt-4.1-mini',
    provider: agent?.provider || 'openai',
    temperature: agent?.temperature || 0.7,
    maxTokens: agent?.maxTokens || 4096,
    sandboxEnabled: agent?.sandboxEnabled || false,
    sandboxImage: agent?.sandboxImage || 'node:20',
    storageType: (agent?.workspaceStorage?.type || 'local') as 'local' | 's3' | 'r2',
    storageBucket: agent?.workspaceStorage?.bucket || '',
    storageEndpoint: agent?.workspaceStorage?.endpoint || '',
    storageAccessKeyId: agent?.workspaceStorage?.accessKeyId || '',
    storageSecretAccessKey: agent?.workspaceStorage?.secretAccessKey || '',
    failoverModels: agent?.failoverModels || [],
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Build workspace storage object based on type
    const workspaceStorage: WorkspaceStorage = { type: formData.storageType };
    if (formData.storageType === 's3' || formData.storageType === 'r2') {
      if (formData.storageBucket) workspaceStorage.bucket = formData.storageBucket;
      if (formData.storageEndpoint) workspaceStorage.endpoint = formData.storageEndpoint;
      if (formData.storageAccessKeyId) workspaceStorage.accessKeyId = formData.storageAccessKeyId;
      if (formData.storageSecretAccessKey) workspaceStorage.secretAccessKey = formData.storageSecretAccessKey;
    }

    const agentData = {
      name: formData.name,
      description: formData.description,
      instructions: formData.instructions,
      model: formData.model,
      provider: formData.provider,
      temperature: formData.temperature,
      maxTokens: formData.maxTokens,
      sandboxEnabled: formData.sandboxEnabled,
      sandboxImage: formData.sandboxEnabled ? formData.sandboxImage : undefined,
      workspaceStorage: formData.storageType !== 'local' ? workspaceStorage : undefined,
      failoverModels: formData.failoverModels.length > 0 ? formData.failoverModels : undefined,
    };

    onSave(agentData);
  };

  const addFailoverModel = () => {
    setFormData(prev => ({
      ...prev,
      failoverModels: [...prev.failoverModels, { provider: 'openai', model: 'gpt-4.1-mini' }],
    }));
  };

  const removeFailoverModel = (index: number) => {
    setFormData(prev => ({
      ...prev,
      failoverModels: prev.failoverModels.filter((_, i) => i !== index),
    }));
  };

  const updateFailoverModel = (index: number, field: 'provider' | 'model', value: string) => {
    setFormData(prev => ({
      ...prev,
      failoverModels: prev.failoverModels.map((fm, i) =>
        i === index ? { ...fm, [field]: value } : fm
      ),
    }));
  };

  const providers = LLM_PROVIDERS;
  const { models: modelsForProvider, loading: modelsLoading } = useProviderModels(formData.provider);

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
              <select name="provider" value={formData.provider} onChange={(e) => {
                const newProvider = e.target.value;
                const providerModels = getModelsByProvider(newProvider);
                setFormData(prev => ({
                  ...prev,
                  provider: newProvider,
                  model: providerModels[0]?.id.split('/').slice(1).join('/') || '',
                }));
              }} className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary">
                {providers.map(p => <option key={p.key} value={p.key}>{p.displayName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Model</label>
              <select name="model" value={formData.model} onChange={handleChange} className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary">
                {modelsForProvider.map(m => (
                  <option key={m.id} value={m.id.split('/').slice(1).join('/')}>
                    {m.displayName} ({Math.round(m.contextWindow / 1000)}K ctx)
                  </option>
                ))}
              </select>
            </div>
            {(() => {
              const selectedModel = modelsForProvider.find(
                m => m.id.split('/').slice(1).join('/') === formData.model,
              );
              if (!selectedModel) return null;
              return (
                <div className="col-span-2 flex flex-wrap gap-2 text-xs">
                  {selectedModel.capabilities.map(cap => (
                    <span key={cap} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{cap}</span>
                  ))}
                  <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {selectedModel.pricingTier}
                  </span>
                </div>
              );
            })()}
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

          {/* Sandbox Configuration */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center">
              <Container className="w-4 h-4 mr-2" /> Sandbox Configuration
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Enable Docker Sandbox</label>
                <Switch.Root
                  checked={formData.sandboxEnabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, sandboxEnabled: checked }))}
                  className="w-[42px] h-[25px] bg-gray-600 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                >
                  <Switch.Thumb className="block w-[21px] h-[21px] bg-white rounded-full shadow-sm transition-transform duration-100 translate-x-0.5 data-[state=checked]:translate-x-[19px]" />
                </Switch.Root>
              </div>
              {formData.sandboxEnabled && (
                <div>
                  <label className="block text-sm font-medium mb-1">Sandbox Image</label>
                  <input
                    type="text"
                    name="sandboxImage"
                    value={formData.sandboxImage}
                    onChange={handleChange}
                    placeholder="node:20"
                    className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Workspace Storage Configuration */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center">
              <HardDrive className="w-4 h-4 mr-2" /> Workspace Storage
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Storage Backend</label>
                <select
                  value={formData.storageType}
                  onChange={(e) => setFormData(prev => ({ ...prev, storageType: e.target.value as 'local' | 's3' | 'r2' }))}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="local">Local (default)</option>
                  <option value="s3">AWS S3</option>
                  <option value="r2">Cloudflare R2</option>
                </select>
              </div>
              {(formData.storageType === 's3' || formData.storageType === 'r2') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Bucket Name</label>
                    <input
                      type="text"
                      value={formData.storageBucket}
                      onChange={(e) => setFormData(prev => ({ ...prev, storageBucket: e.target.value }))}
                      placeholder="my-bucket"
                      className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  {formData.storageType === 'r2' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Endpoint</label>
                      <input
                        type="text"
                        value={formData.storageEndpoint}
                        onChange={(e) => setFormData(prev => ({ ...prev, storageEndpoint: e.target.value }))}
                        placeholder="https://<account>.r2.cloudflarestorage.com"
                        className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-1">Access Key ID</label>
                    <input
                      type="text"
                      value={formData.storageAccessKeyId}
                      onChange={(e) => setFormData(prev => ({ ...prev, storageAccessKeyId: e.target.value }))}
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                      className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Secret Access Key</label>
                    <input
                      type="password"
                      value={formData.storageSecretAccessKey}
                      onChange={(e) => setFormData(prev => ({ ...prev, storageSecretAccessKey: e.target.value }))}
                      placeholder="••••••••••••••••"
                      className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Model Failover Chain */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Model Fallbacks</h3>
              <button
                type="button"
                onClick={addFailoverModel}
                className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90"
              >
                + Add Fallback
              </button>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 mb-2">
              <div className="text-xs text-muted-foreground mb-1">Primary Model</div>
              <div className="text-sm font-medium">{formData.provider} / {formData.model}</div>
            </div>
            {formData.failoverModels.map((fm, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <select
                    value={fm.provider}
                    onChange={(e) => updateFailoverModel(index, 'provider', e.target.value)}
                    className="bg-background border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {LLM_PROVIDERS.map(p => <option key={p.key} value={p.key}>{p.displayName}</option>)}
                  </select>
                  <select
                    value={fm.model}
                    onChange={(e) => updateFailoverModel(index, 'model', e.target.value)}
                    className="bg-background border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {getModelsByProvider(fm.provider).map(m => (
                      <option key={m.id} value={m.id.split('/').slice(1).join('/')}>{m.displayName}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeFailoverModel(index)}
                  className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {formData.failoverModels.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">No fallback models configured</div>
            )}
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
