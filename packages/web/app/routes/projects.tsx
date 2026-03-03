import { createFileRoute, Link } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import React, { useState, useMemo, useEffect } from 'react';
// import { useQuery, useMutation } from 'convex/react';
// import { api } from '../../convex/_generated/api';
import { FolderKanban, Plus, Settings, Users, FileText, Trash2, Edit, X, Search, MoreVertical } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { LLM_PROVIDERS, getModelsByProvider } from '../../../../convex/llmProviders';
import { useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';


// --- MOCK DATA & TYPES ---
type ProjectSettings = {
  systemPrompt?: string;
  defaultModel?: string;
  defaultProvider?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
};

type Project = {
  id: string;
  name: string;
  description: string;
  settings?: ProjectSettings;
  agentCount: number;
  fileCount: number;
  createdAt: string;
};

const initialProjects: Project[] = [
  { id: 'proj_1', name: 'AgentForge UI Revamp', description: 'Complete overhaul of the dashboard UI using TanStack and Tailwind.', agentCount: 5, fileCount: 42, createdAt: '2024-07-21' },
  { id: 'proj_2', name: 'Customer Support Bot', description: 'An AI-powered chatbot to handle customer queries in real-time.', agentCount: 2, fileCount: 15, createdAt: '2024-07-20' },
  { id: 'proj_3', name: 'Data Analysis Pipeline', description: 'Automated workflow for processing and analyzing sales data.', agentCount: 8, fileCount: 128, createdAt: '2024-06-15' },
  { id: 'proj_4', name: 'Internal Documentation Hub', description: 'A centralized place for all internal project documentation.', agentCount: 1, fileCount: 256, createdAt: '2024-05-01' },
];

// --- HELPER COMPONENTS ---

const ProjectCard = ({ project, onEdit, onDelete, onSelect }: { project: Project, onEdit: (project: Project) => void, onDelete: (id: string) => void, onSelect: (project: Project) => void }) => (
  <div className="bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col">
    <div className="p-4 flex-grow cursor-pointer" onClick={() => onSelect(project)}>
      <div className="flex items-start justify-between">
        <h3 className="font-bold text-lg text-foreground mb-2">{project.name}</h3>
        <FolderKanban className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground mb-4 h-10 overflow-hidden">{project.description}</p>
    </div>
    <div className="border-t border-border p-4 flex justify-between items-center text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {project.agentCount}</span>
        <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> {project.fileCount}</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onEdit(project)} className="hover:text-foreground"><Edit className="w-4 h-4" /></button>
        <button onClick={() => onDelete(project.id)} className="hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  </div>
);

const ProjectForm = ({ project, onSave, onCancel }: { project?: Project | null, onSave: (p: Omit<Project, 'id' | 'agentCount' | 'fileCount' | 'createdAt'>) => void, onCancel: () => void }) => {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [settings, setSettings] = useState<ProjectSettings>(project?.settings || {});
  const [showSettings, setShowSettings] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSave({ name, description, settings });
  };

  const providers = LLM_PROVIDERS;
  const modelsForProvider = settings.defaultProvider
    ? getModelsByProvider(settings.defaultProvider)
    : [];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-1">Project Name</label>
        <input id="name" value={name} onChange={e => setName(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-foreground focus:ring-2 focus:ring-primary" required />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
        <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full bg-background border border-border rounded-md px-3 py-2 text-foreground focus:ring-2 focus:ring-primary" />
      </div>

      <div className="border border-border rounded-md">
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="w-full px-4 py-2 flex items-center justify-between text-sm font-medium hover:bg-card transition-colors"
        >
          <span className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Agent Settings (overrides)
          </span>
          <X className={`w-4 h-4 transition-transform ${showSettings ? 'rotate-45' : ''}`} />
        </button>
        {showSettings && (
          <div className="px-4 pb-4 space-y-4 border-t border-border">
            <p className="text-xs text-muted-foreground mt-2">
              These settings override agent-level defaults for all agents in this project.
            </p>
            <div>
              <label htmlFor="systemPrompt" className="block text-sm font-medium text-muted-foreground mb-1">System Prompt Override</label>
              <textarea
                id="systemPrompt"
                value={settings.systemPrompt || ''}
                onChange={e => setSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
                rows={4}
                placeholder="Enter a project-level system prompt that will be prepended to all agent instructions..."
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-foreground focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="defaultProvider" className="block text-sm font-medium text-muted-foreground mb-1">Default Provider</label>
                <select
                  id="defaultProvider"
                  value={settings.defaultProvider || ''}
                  onChange={e => {
                    const newProvider = e.target.value;
                    setSettings(prev => ({
                      ...prev,
                      defaultProvider: newProvider,
                      defaultModel: undefined,
                    }));
                  }}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-foreground focus:ring-2 focus:ring-primary"
                >
                  <option value="">Use agent default</option>
                  {providers.map(p => <option key={p.key} value={p.key}>{p.displayName}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="defaultModel" className="block text-sm font-medium text-muted-foreground mb-1">Default Model</label>
                <select
                  id="defaultModel"
                  value={settings.defaultModel || ''}
                  onChange={e => setSettings(prev => ({ ...prev, defaultModel: e.target.value }))}
                  disabled={!settings.defaultProvider}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-foreground focus:ring-2 focus:ring-primary disabled:opacity-50"
                >
                  <option value="">Use agent default</option>
                  {modelsForProvider.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md border border-border text-foreground hover:bg-card">Cancel</button>
        <button type="submit" className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Save Project</button>
      </div>
    </form>
  );
};

const ProjectDetailView = ({ project, onBack }: { project: Project, onBack: () => void }) => {
  const providers = LLM_PROVIDERS;
  return (
  <div className="bg-background p-6 rounded-lg">
    <div className="flex justify-between items-start mb-6">
      <div>
        <button onClick={onBack} className="text-sm text-primary hover:underline mb-2">&larr; Back to Projects</button>
        <h2 className="text-2xl font-bold text-foreground">{project.name}</h2>
        <p className="text-muted-foreground">{project.description}</p>
      </div>
      <div className="text-sm text-muted-foreground">Created: {new Date(project.createdAt).toLocaleDateString()}</div>
    </div>

    <Tabs.Root defaultValue="overview" className="w-full">
      <Tabs.List className="flex border-b border-border mb-4">
        <Tabs.Trigger value="overview" className="px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary">Overview</Tabs.Trigger>
        <Tabs.Trigger value="agents" className="px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary">Agents</Tabs.Trigger>
        <Tabs.Trigger value="files" className="px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary">Files</Tabs.Trigger>
        <Tabs.Trigger value="settings" className="px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary">Settings</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="overview" className="p-4 bg-card rounded-b-lg border border-t-0 border-border">
        <h4 className="font-bold text-lg mb-2">Project Overview</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-background p-4 rounded-lg border border-border"><p className="text-2xl font-bold">{project.agentCount}</p><p className="text-sm text-muted-foreground">Agents</p></div>
            <div className="bg-background p-4 rounded-lg border border-border"><p className="text-2xl font-bold">{project.fileCount}</p><p className="text-sm text-muted-foreground">Files</p></div>
        </div>
      </Tabs.Content>
      <Tabs.Content value="agents" className="p-4 bg-card rounded-b-lg border border-t-0 border-border"><p className="text-muted-foreground">Agent management UI will be here.</p></Tabs.Content>
      <Tabs.Content value="files" className="p-4 bg-card rounded-b-lg border border-t-0 border-border"><p className="text-muted-foreground">File management UI will be here.</p></Tabs.Content>
      <Tabs.Content value="settings" className="p-4 bg-card rounded-b-lg border border-t-0 border-border">
        <div className="space-y-6">
          <div>
            <h4 className="font-bold text-lg mb-2">Agent Settings Override</h4>
            <p className="text-sm text-muted-foreground mb-4">
              These settings apply to all agents in this project, overriding their individual defaults.
            </p>
          </div>

          {project.settings ? (
            <div className="space-y-4">
              {project.settings.systemPrompt && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">System Prompt</label>
                  <div className="bg-background border border-border rounded-md p-3 text-sm">
                    <pre className="whitespace-pre-wrap break-words font-sans text-muted-foreground">{project.settings.systemPrompt}</pre>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.settings.defaultProvider && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Default Provider</label>
                    <div className="bg-background border border-border rounded-md px-3 py-2 text-sm text-muted-foreground">
                      {providers.find(p => p.key === project.settings?.defaultProvider)?.displayName || project.settings.defaultProvider}
                    </div>
                  </div>
                )}

                {project.settings.defaultModel && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Default Model</label>
                    <div className="bg-background border border-border rounded-md px-3 py-2 text-sm text-muted-foreground">
                      {project.settings.defaultModel}
                    </div>
                  </div>
                )}
              </div>

              {project.settings.defaultTemperature !== undefined && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Default Temperature</label>
                  <div className="bg-background border border-border rounded-md px-3 py-2 text-sm text-muted-foreground">
                    {project.settings.defaultTemperature}
                  </div>
                </div>
              )}

              {project.settings.defaultMaxTokens !== undefined && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Default Max Tokens</label>
                  <div className="bg-background border border-border rounded-md px-3 py-2 text-sm text-muted-foreground">
                    {project.settings.defaultMaxTokens}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">No custom settings configured. This project uses agent-level defaults.</p>
          )}

          <div className="pt-4 border-t border-border">
            <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm">
              Edit Settings
            </button>
          </div>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  </div>
  );
};

// --- MAIN PAGE COMPONENT ---

export const Route = createFileRoute('/projects')({ component: ProjectsPage });

function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // --- Commented-out Convex Hooks ---
  /*
  const projectsData = useQuery(api.projects.list, { search: searchQuery });
  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);
  const deleteProject = useMutation(api.projects.delete);

  React.useEffect(() => {
    if (projectsData) {
      setProjects(projectsData);
    }
  }, [projectsData]);
  */

  const handleCreate = () => {
    setEditingProject(null);
    setIsModalOpen(true);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      // await deleteProject({ id });
      setProjects(projects.filter(p => p.id !== id));
    }
  };

  const handleSave = (data: Omit<Project, 'id' | 'agentCount' | 'fileCount' | 'createdAt'>) => {
    setIsLoading(true);
    setTimeout(() => { // Simulate async operation
      if (editingProject) {
        // await updateProject({ id: editingProject.id, ...data });
        setProjects(projects.map(p => p.id === editingProject.id ? { ...p, ...data } : p));
      } else {
        const newProject: Project = {
          id: `proj_${Date.now()}`,
          ...data,
          agentCount: 0,
          fileCount: 0,
          createdAt: new Date().toISOString().split('T')[0],
        };
        // await createProject(newProject);
        setProjects([newProject, ...projects]);
      }
      setIsLoading(false);
      setIsModalOpen(false);
      setEditingProject(null);
    }, 500);
  };

  const filteredProjects = useMemo(() =>
    projects.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    ), [projects, searchQuery]);

  if (selectedProject) {
    return (
      <DashboardLayout>
        <ProjectDetailView project={selectedProject} onBack={() => setSelectedProject(null)} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 bg-background min-h-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <button onClick={handleCreate} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">
            <Plus className="w-5 h-5" />
            New Project
          </button>
        </div>

        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-md pl-10 pr-4 py-2 text-foreground"
          />
        </div>

        {isLoading && <p className="text-muted-foreground">Loading projects...</p>}
        {error && <p className="text-destructive">{error}</p>}

        {!isLoading && !error && (
          filteredProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProjects.map(project => (
                <ProjectCard key={project.id} project={project} onEdit={handleEdit} onDelete={handleDelete} onSelect={setSelectedProject} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
              <FolderKanban className="mx-auto w-12 h-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium text-foreground">No projects found</h3>
              <p className="mt-1 text-sm text-muted-foreground">Get started by creating a new project.</p>
              <button onClick={handleCreate} className="mt-6 flex mx-auto items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">
                <Plus className="w-5 h-5" />
                New Project
              </button>
            </div>
          )
        )}

        <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-card p-6 rounded-lg shadow-lg border border-border">
              <Dialog.Title className="text-lg font-bold text-foreground mb-4">{editingProject ? 'Edit Project' : 'Create New Project'}</Dialog.Title>
              <ProjectForm project={editingProject} onSave={handleSave} onCancel={() => setIsModalOpen(false)} />
              <Dialog.Close asChild>
                <button className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </DashboardLayout>
  );
}
