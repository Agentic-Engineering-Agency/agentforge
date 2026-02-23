import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Clock, Play, Pause, Plus, History, Trash2, Edit, X, AlertCircle } from 'lucide-react';

export const Route = createFileRoute('/cron')({ component: CronPage });

function CronPage() {
  const cronJobs = useQuery(api.cronJobs.list, {}) ?? [];
  const agents = useQuery(api.agents.list, {}) ?? [];
  const createCron = useMutation(api.cronJobs.create);
  const removeCron = useMutation(api.cronJobs.remove);
  const toggleCron = useMutation(api.cronJobs.toggleEnabled);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [historyJobId, setHistoryJobId] = useState<string | null>(null);

  const handleCreate = async (data: any) => {
    await createCron(data);
    setIsModalOpen(false);
  };

  const handleDelete = async (id: any) => {
    if (confirm('Delete this cron job?')) {
      await removeCron({ id });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Scheduled Tasks</h1>
            <p className="text-muted-foreground">Automate agent execution with cron schedules.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Schedule
          </button>
        </div>

        {cronJobs.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-lg">
            <Clock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No scheduled tasks</h3>
            <p className="text-muted-foreground mb-4">Create a cron job to run agents on a schedule.</p>
            <button onClick={() => setIsModalOpen(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90">
              <Plus className="w-4 h-4 inline mr-2" />Create Schedule
            </button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Schedule</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agent</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Run</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cronJobs.map((job: any) => (
                  <tr key={job._id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{job.name}</p>
                        {job.description && <p className="text-xs text-muted-foreground">{job.description}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{job.schedule}</td>
                    <td className="px-4 py-3 text-muted-foreground">{job.agentId}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${job.isEnabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                        {job.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{job.lastRun ? new Date(job.lastRun).toLocaleString() : 'Never'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => toggleCron({ id: job._id })} className="p-1.5 rounded hover:bg-muted" title={job.isEnabled ? 'Pause' : 'Resume'}>
                          {job.isEnabled ? <Pause className="w-4 h-4 text-muted-foreground" /> : <Play className="w-4 h-4 text-green-500" />}
                        </button>
                        <button onClick={() => handleDelete(job._id)} className="p-1.5 rounded hover:bg-destructive/10"><Trash2 className="w-4 h-4 text-destructive" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isModalOpen && <CronModal agents={agents} onSave={handleCreate} onClose={() => setIsModalOpen(false)} />}
      </div>
    </DashboardLayout>
  );
}

function CronModal({ agents, onSave, onClose }: { agents: any[]; onSave: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', schedule: '0 9 * * *', agentId: agents[0]?.id || '', prompt: '' });

  const presets = [
    { label: 'Every minute', value: '* * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Daily at 9 AM', value: '0 9 * * *' },
    { label: 'Weekly (Mon 9 AM)', value: '0 9 * * 1' },
    { label: 'Monthly (1st at 9 AM)', value: '0 9 1 * *' },
  ];

  const handleSubmit = (e: any) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-lg font-bold">New Scheduled Task</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" placeholder="e.g. Daily Report" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input type="text" value={form.description} onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" placeholder="Optional description" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Agent</label>
            <select value={form.agentId} onChange={(e) => setForm(prev => ({ ...prev, agentId: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" required>
              {agents.length === 0 ? <option value="">No agents available</option> : agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cron Schedule</label>
            <input type="text" value={form.schedule} onChange={(e) => setForm(prev => ({ ...prev, schedule: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono" required />
            <div className="flex flex-wrap gap-1 mt-2">
              {presets.map(p => (
                <button key={p.value} type="button" onClick={() => setForm(prev => ({ ...prev, schedule: p.value }))} className={`text-xs px-2 py-1 rounded border ${form.schedule === p.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border text-muted-foreground hover:text-foreground'}`}>{p.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Prompt</label>
            <textarea value={form.prompt} onChange={(e) => setForm(prev => ({ ...prev, prompt: e.target.value }))} rows={3} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" placeholder="What should the agent do?" required />
          </div>
        </form>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.name || !form.agentId || !form.prompt} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50">Create Schedule</button>
        </div>
      </div>
    </div>
  );
}
