import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { FolderKanban, Plus, Trash2, Edit, Search, X } from 'lucide-react';

export const Route = createFileRoute('/projects')({ component: ProjectsPage });

function ProjectsPage() {
  const projects = useQuery(api.projects.list, {}) ?? [];
  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);
  const removeProject = useMutation(api.projects.remove);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);

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

  const handleDelete = async (id: any) => {
    if (confirm('Delete this project?')) {
      await removeProject({ id });
    }
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
              <div key={project._id} className="bg-card border border-border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{project.name}</h3>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{project.description || 'No description'}</p>
                <div className="text-xs text-muted-foreground mb-4">Created {new Date(project.createdAt).toLocaleDateString()}</div>
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <button onClick={() => { setEditingProject(project); setIsModalOpen(true); }} className="p-1.5 rounded hover:bg-muted flex items-center gap-1 text-xs text-muted-foreground"><Edit className="w-4 h-4" /> Edit</button>
                  <button onClick={() => handleDelete(project._id)} className="p-1.5 rounded hover:bg-destructive/10"><Trash2 className="w-4 h-4 text-destructive" /></button>
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
              <ProjectForm initial={editingProject} onSave={handleSave} onClose={() => { setIsModalOpen(false); setEditingProject(null); }} />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function ProjectForm({ initial, onSave, onClose }: { initial: any; onSave: (data: any) => void; onClose: () => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');

  const handleSubmit = (e: any) => {
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
