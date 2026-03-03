import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { Sparkles, Download, Trash2, Plus, Search, Filter, X } from 'lucide-react';

// --- Types ---
type SkillCategory = string;

interface Skill {
  _id: Id<'skills'>;
  name: string;
  displayName: string;
  description: string;
  category: SkillCategory;
  version: string;
  author?: string;
  repository?: string;
  documentation?: string;
  isInstalled: boolean;
  isEnabled: boolean;
  code: string;
  schema?: any;
  createdAt: number;
  updatedAt: number;
  installedAt?: number;
}

const CATEGORIES: SkillCategory[] = ['Tools', 'Knowledge', 'Workflows', 'Integrations'];

// --- Components ---

function CreateSkillDialog({ open, onOpenChange, onCreateSkill }: { open: boolean; onOpenChange: (open: boolean) => void; onCreateSkill: (skill: Omit<Skill, '_id' | 'isInstalled' | 'createdAt' | 'updatedAt'>) => void; }) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SkillCategory>('Tools');
  const [version, setVersion] = useState('1.0.0');
  const [code, setCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const derivedName = displayName.toLowerCase().replace(/\s+/g, '-');
    if (!displayName || !description || !version) return;
    onCreateSkill({ name: derivedName, displayName, description, category, version, code: code || '// Skill code' });
    onOpenChange(false);
    setName('');
    setDisplayName('');
    setDescription('');
    setCategory('Tools');
    setVersion('1.0.0');
    setCode('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card p-6 rounded-lg shadow-xl w-full max-w-md border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-foreground">Create Custom Skill</h2>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-muted-foreground mb-1">Display Name</label>
            <input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required className="w-full bg-background border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} className="w-full bg-background border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"></textarea>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-muted-foreground mb-1">Category</label>
              <select id="category" value={category} onChange={(e) => setCategory(e.target.value as SkillCategory)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="version" className="block text-sm font-medium text-muted-foreground mb-1">Version</label>
              <input id="version" value={version} onChange={(e) => setVersion(e.target.value)} required className="w-full bg-background border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-md border border-border text-foreground hover:bg-zinc-800 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Create Skill</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SkillCard({ skill, onToggleInstall }: { skill: Skill; onToggleInstall: (id: Id<'skills'>) => void; }) {
  const handleToggle = () => {
    onToggleInstall(skill._id);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col h-full transition-shadow hover:shadow-lg hover:shadow-primary/10">
      <div className="flex-grow">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-md">
              <Sparkles className="text-primary" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{skill.displayName}</h3>
              <p className="text-xs text-muted-foreground">v{skill.version}</p>
            </div>
          </div>
          <span className="text-xs bg-zinc-800 border border-zinc-700 text-muted-foreground px-2 py-0.5 rounded-full whitespace-nowrap">{skill.category}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          {skill.description}
        </p>
      </div>
      <button
        onClick={handleToggle}
        className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${skill.isInstalled ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>
        {skill.isInstalled ? <Trash2 size={16} /> : <Download size={16} />}
        {skill.isInstalled ? 'Uninstall' : 'Install'}
      </button>
    </div>
  );
}

export const Route = createFileRoute('/skills')({ component: SkillsPage });

function SkillsPage() {
  // Convex hooks
  const skillsQuery = useQuery(api.skills.list, {});
  const skills = skillsQuery ?? [];
  const isLoading = skillsQuery === undefined;
  const createSkillMutation = useMutation(api.skills.create);
  const installSkillMutation = useMutation(api.skills.install);
  const uninstallSkillMutation = useMutation(api.skills.uninstall);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<SkillCategory[]>([]);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);

  const handleToggleCategory = (category: SkillCategory) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleCreateSkill = async (newSkillData: Omit<Skill, '_id' | 'isInstalled' | 'createdAt' | 'updatedAt'>) => {
    await createSkillMutation(newSkillData);
  };

  const handleToggleInstall = async (id: Id<'skills'>) => {
    const skill = skills.find(s => s._id === id);
    if (skill) {
      if (skill.isInstalled) {
        await uninstallSkillMutation({ id });
      } else {
        await installSkillMutation({ id });
      }
    }
  };

  const filteredSkills = useMemo(() => {
    return skills.filter(skill =>
      skill.displayName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selectedCategories.length === 0 || selectedCategories.includes(skill.category))
    );
  }, [skills, searchQuery, selectedCategories]);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 bg-background text-foreground min-h-screen">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Skills Marketplace</h1>
            <p className="text-muted-foreground">Discover, install, and create new capabilities for your agents.</p>
          </div>
          <button onClick={() => setCreateDialogOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus size={16} /> Create Skill
          </button>
        </header>

        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder="Search skills by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border rounded-md pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Filter by:</span>
            {CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => handleToggleCategory(category)}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${selectedCategories.includes(category) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-zinc-800 border-border'}`}>
                {category}
              </button>
            ))}
            {selectedCategories.length > 0 && (
              <button onClick={() => setSelectedCategories([])} className="text-sm text-muted-foreground hover:text-foreground underline">Clear</button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
                <div className="h-8 bg-zinc-800 rounded w-12 mb-3"></div>
                <div className="h-5 bg-zinc-800 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-zinc-800 rounded w-1/4 mb-4"></div>
                <div className="h-4 bg-zinc-800 rounded w-full mb-1"></div>
                <div className="h-4 bg-zinc-800 rounded w-5/6"></div>
                <div className="h-10 bg-zinc-800 rounded mt-4"></div>
              </div>
            ))}
          </div>
        ) : filteredSkills.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSkills.map(skill => (
              <SkillCard key={skill._id} skill={skill} onToggleInstall={handleToggleInstall} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-lg bg-card">
            <Sparkles className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-lg font-medium text-foreground">No Skills Found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Your search or filter criteria did not match any skills. Try a different query.</p>
            <button onClick={() => { setSearchQuery(''); setSelectedCategories([]); }} className="mt-4 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Clear Filters
            </button>
          </div>
        )}
      </div>
      <CreateSkillDialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen} onCreateSkill={handleCreateSkill} />
    </DashboardLayout>
  );
}
