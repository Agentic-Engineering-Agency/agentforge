import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { FolderKanban, Plus, Trash2, Edit, Search, X, Bot, Settings, Check } from 'lucide-react';
import { useModelCatalog } from '../lib/model-catalog';

export const Route = createFileRoute('/projects')({ component: ProjectsPage });

function stripProviderPrefix(provider: string, model: string): string {
  const prefix = provider ? `${provider}/` : '';
  return prefix && model.startsWith(prefix) ? model.slice(prefix.length) : model;
}

function joinProviderModel(provider: string, model: string): string {
  return provider && model ? `${provider}/${model}` : model;
}

function ProjectsPage() {
  const projects = useQuery(api.projects.list, {}) ?? [];
  const allAgents = useQuery(api.projects.getAllAgents, {}) ?? [];
  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);
  const removeProject = useMutation(api.projects.remove);
  const assignAgent = useMutation(api.projects.assignAgent);
  const unassignAgent = useMutation(api.projects.unassignAgent);
  const updateSettings = useMutation(api.projects.updateSettings);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [detailProject, setDetailProject] = useState<any>(null);
  const [confirmingDeletingId, setConfirmingDeletingId] = useState<Id<'projects'> | null>(null);
  const [confirmingUnassignAgentId, setConfirmingUnassignAgentId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter((p: any) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  }, [projects, searchQuery]);

  const handleSave = async (data: { name: string; description: string }) => {
    if (editingProject) {
      await updateProject({ id: editingProject._id, ...data });
    } else {
      await createProject(data);
    }
    setIsModalOpen(false);
    setEditingProject(null);
  };

  const handleDeleteClick = (id: Id<'projects'>) => {
    if (confirmingDeletingId === id) {
      removeProject({ id });
      setConfirmingDeletingId(null);
    } else {
      setConfirmingDeletingId(id);
    }
  };

  const handleProjectClick = (project: any) => {
    setDetailProject(project);
    setIsDetailOpen(true);
  };

  const handleToggleAgent = async (agentId: string) => {
    if (!detailProject) return;

    const isAssigned = detailProject.agentIds?.includes(agentId);
    if (isAssigned) {
      if (confirmingUnassignAgentId === agentId) {
        await unassignAgent({ id: detailProject._id, agentId });
        setConfirmingUnassignAgentId(null);
      } else {
        setConfirmingUnassignAgentId(agentId);
      }
    } else {
      await assignAgent({ id: detailProject._id, agentId });
    }
  };

  const handleSettingsSave = async (settings: { systemPrompt?: string; defaultModel?: string; defaultProvider?: string }) => {
    if (!detailProject) return;
    await updateSettings({ id: detailProject._id, ...settings });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-muted-foreground">Organize your agents, files, and threads into workspaces.</p>
          </div>
          <button onClick={() => { setEditingProject(null); setIsModalOpen(true); }} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full" />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-lg">
            <FolderKanban className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">{projects.length === 0 ? 'No projects yet' : 'No matching projects'}</h3>
            <p className="text-muted-foreground mb-4">Create a project to organize your work.</p>
            {projects.length === 0 && (
              <button onClick={() => setIsModalOpen(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90">
                <Plus className="w-4 h-4 inline mr-2" />Create Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project: any) => (
              <div
                key={project._id}
                onClick={() => handleProjectClick(project)}
                className="bg-card border border-border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{project.name}</h3>
                  </div>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                    {project.agentIds?.length || 0} {project.agentIds?.length === 1 ? 'agent' : 'agents'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{project.description || 'No description'}</p>
                <div className="text-xs text-muted-foreground mb-4">Created {new Date(project.createdAt).toLocaleDateString()}</div>
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingProject(project); setIsModalOpen(true); }}
                    className="p-1.5 rounded hover:bg-muted flex items-center gap-1 text-xs text-muted-foreground"
                  >
                    <Edit className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(project._id);
                    }}
                    className={`p-1.5 rounded transition-colors ${
                      confirmingDeletingId === project._id
                        ? 'bg-destructive text-destructive-foreground'
                        : 'hover:bg-destructive/10'
                    }`}
                    title={confirmingDeletingId === project._id ? 'Click to confirm delete' : 'Delete project'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md">
              <div className="flex justify-between items-center p-4 border-b border-border">
                <h2 className="text-lg font-bold">{editingProject ? 'Edit Project' : 'New Project'}</h2>
                <button onClick={() => { setIsModalOpen(false); setEditingProject(null); }} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>
              <ProjectForm key={editingProject?._id ?? 'create'} initial={editingProject} onSave={handleSave} onClose={() => { setIsModalOpen(false); setEditingProject(null); }} />
            </div>
          </div>
        )}

        {isDetailOpen && detailProject && (
          <ProjectDetailModal
            project={detailProject}
            allAgents={allAgents}
            onClose={() => { setIsDetailOpen(false); setDetailProject(null); setConfirmingUnassignAgentId(null); }}
            onToggleAgent={handleToggleAgent}
            onSettingsSave={handleSettingsSave}
            confirmingUnassignAgentId={confirmingUnassignAgentId}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function ProjectForm({ initial, onSave, onClose }: { initial: any; onSave: (data: any) => void; onClose: () => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, description });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" placeholder="Project name" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" placeholder="What is this project about?" />
        </div>
      </div>
      <div className="p-4 border-t border-border flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm">Cancel</button>
        <button type="submit" disabled={!name.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50">Save</button>
      </div>
    </form>
  );
}

interface ProjectDetailModalProps {
  project: any;
  allAgents: any[];
  onClose: () => void;
  onToggleAgent: (agentId: string) => void;
  onSettingsSave: (settings: { systemPrompt?: string; defaultModel?: string; defaultProvider?: string }) => void;
  confirmingUnassignAgentId: string | null;
}

function ProjectDetailModal({ project, allAgents, onClose, onToggleAgent, onSettingsSave, confirmingUnassignAgentId }: ProjectDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'agents' | 'settings'>('agents');
  const [systemPrompt, setSystemPrompt] = useState(project.systemPrompt || '');
  const [defaultModel, setDefaultModel] = useState(stripProviderPrefix(project.defaultProvider || '', project.defaultModel || ''));
  const [defaultProvider, setDefaultProvider] = useState(project.defaultProvider || '');

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSettingsSave({
      systemPrompt,
      defaultProvider,
      defaultModel: joinProviderModel(defaultProvider, defaultModel),
    });
  };

  const assignedAgents = allAgents.filter((agent) => project.agentIds?.includes(agent.id));

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">{project.name}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('agents')}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${
              activeTab === 'agents' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bot className="w-4 h-4" />
            Agents ({assignedAgents.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${
              activeTab === 'settings' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-6">
          {activeTab === 'agents' ? (
            <AgentAssignmentSection
              allAgents={allAgents}
              assignedAgents={assignedAgents}
              onToggleAgent={onToggleAgent}
              confirmingUnassignAgentId={confirmingUnassignAgentId}
            />
          ) : (
            <ProjectSettingsSection
              systemPrompt={systemPrompt}
              defaultModel={defaultModel}
              defaultProvider={defaultProvider}
              onSystemPromptChange={setSystemPrompt}
              onDefaultModelChange={setDefaultModel}
              onDefaultProviderChange={setDefaultProvider}
              onSubmit={handleSettingsSubmit}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface AgentAssignmentSectionProps {
  allAgents: any[];
  assignedAgents: any[];
  onToggleAgent: (agentId: string) => void;
  confirmingUnassignAgentId: string | null;
}

function AgentAssignmentSection({ allAgents, assignedAgents, onToggleAgent, confirmingUnassignAgentId }: AgentAssignmentSectionProps) {
  if (allAgents.length === 0) {
    return (
      <div className="text-center py-8">
        <Bot className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">No agents available. Create an agent first.</p>
      </div>
    );
  }

  if (assignedAgents.length === 0) {
    return (
      <div>
        <p className="text-sm text-muted-foreground mb-4">No agents assigned yet. Select agents below to assign them to this project.</p>
        <div className="space-y-2">
          {allAgents.map((agent) => (
            <AgentCheckbox
              key={agent.id}
              agent={agent}
              isAssigned={false}
              isConfirming={false}
              onToggle={() => onToggleAgent(agent.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {allAgents.map((agent) => (
        <AgentCheckbox
          key={agent.id}
          agent={agent}
          isAssigned={assignedAgents.some((a) => a.id === agent.id)}
          isConfirming={confirmingUnassignAgentId === agent.id}
          onToggle={() => onToggleAgent(agent.id)}
        />
      ))}
    </div>
  );
}

interface AgentCheckboxProps {
  agent: any;
  isAssigned: boolean;
  isConfirming: boolean;
  onToggle: () => void;
}

function AgentCheckbox({ agent, isAssigned, isConfirming, onToggle }: AgentCheckboxProps) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
        isAssigned ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-border/80'
      } ${isConfirming ? 'border-destructive bg-destructive/5' : ''}`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
            isAssigned ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-primary'
          } ${isConfirming ? 'bg-destructive border-destructive' : ''}`}
        >
          {isAssigned && !isConfirming && <Check className="w-3.5 h-3.5" />}
          {isConfirming && <X className="w-3.5 h-3.5" />}
        </button>
        <div className="flex items-center gap-2">
          <Bot className={`w-4 h-4 ${isAssigned ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={`text-sm font-medium ${isAssigned ? 'text-foreground' : 'text-muted-foreground'}`}>{agent.name}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="bg-muted px-2 py-0.5 rounded">{agent.provider}</span>
        {isConfirming && <span className="text-destructive text-xs">Click to confirm remove</span>}
      </div>
    </div>
  );
}

interface ProjectSettingsSectionProps {
  systemPrompt: string;
  defaultModel: string;
  defaultProvider: string;
  onSystemPromptChange: (value: string) => void;
  onDefaultModelChange: (value: string) => void;
  onDefaultProviderChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

function ProjectSettingsSection({
  systemPrompt,
  defaultModel,
  defaultProvider,
  onSystemPromptChange,
  onDefaultModelChange,
  onDefaultProviderChange,
  onSubmit,
}: ProjectSettingsSectionProps) {
  const { modelsByProvider, providerIds } = useModelCatalog();
  const availableModels = defaultProvider ? modelsByProvider[defaultProvider] ?? [] : [];

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">System Prompt {systemPrompt.length}/2000</label>
        <p className="text-xs text-muted-foreground mb-2">This prompt will be prepended to agent instructions when running in this project.</p>
        <textarea
          value={systemPrompt}
          onChange={(e) => onSystemPromptChange(e.target.value)}
          maxLength={2000}
          rows={6}
          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Enter a project-level system prompt..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Default Provider</label>
          <select
            value={defaultProvider}
            onChange={(e) => {
              onDefaultProviderChange(e.target.value);
              onDefaultModelChange((modelsByProvider[e.target.value] || [])[0] || '');
            }}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">None (use agent default)</option>
            {providerIds.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Default Model</label>
          <select
            value={defaultModel}
            onChange={(e) => onDefaultModelChange(e.target.value)}
            disabled={!defaultProvider}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          >
            <option value="">None (use agent default)</option>
            {defaultProvider && availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="pt-4 border-t border-border flex justify-end">
        <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90">
          Save Settings
        </button>
      </div>
    </form>
  );
}
