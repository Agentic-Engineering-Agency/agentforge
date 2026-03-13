import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Clock, Play, Pause, Plus, History, Trash2, Edit, X, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';

export const Route = createFileRoute('/cron')({ component: CronPage });

function CronPage() {
  const cronJobs = useQuery(api.cronJobs.list, {}) ?? [];
  const agents = useQuery(api.agents.list, {}) ?? [];
  const createCron = useMutation(api.cronJobs.create);
  const updateCron = useMutation(api.cronJobs.update);
  const removeCron = useMutation(api.cronJobs.remove);
  const toggleCron = useMutation(api.cronJobs.toggleEnabled);
  const triggerNow = useMutation(api.cronJobs.triggerNow);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [historyJobId, setHistoryJobId] = useState<string | null>(null);
  const [confirmingDeletingId, setConfirmingDeletingId] = useState<string | null>(null);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  // Create agent lookup map
  const agentMap = useMemo(() => {
    return new Map(agents.map((a: any) => [a.id, a]));
  }, [agents]);

  const handleCreate = async (data: any) => {
    await createCron(data);
    setIsCreateModalOpen(false);
  };

  const handleEdit = async (data: any) => {
    if (!editingJob) return;
    await updateCron({ id: editingJob._id, ...data });
    setEditingJob(null);
  };

  const handleDeleteClick = async (id: any) => {
    if (confirmingDeletingId === id) {
      await removeCron({ id });
      setConfirmingDeletingId(null);
    } else {
      setConfirmingDeletingId(id);
    }
  };

  const handleRunNow = async (id: any) => {
    setRunningJobId(id);
    try {
      await triggerNow({ id });
    } finally {
      setRunningJobId(null);
    }
  };

  const formatNextRun = (nextRun: number | undefined) => {
    if (!nextRun) return 'Not scheduled';
    const date = new Date(nextRun);
    const now = new Date();
    const diffMs = nextRun - Date.now();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'In less than a minute';
    if (diffMins < 60) return `In ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `In ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    return date.toLocaleDateString();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Scheduled Tasks</h1>
            <p className="text-muted-foreground">Automate agent execution with cron schedules.</p>
          </div>
          <button onClick={() => setIsCreateModalOpen(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Schedule
          </button>
        </div>

        {cronJobs.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-lg">
            <Clock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No scheduled tasks</h3>
            <p className="text-muted-foreground mb-4">Create a cron job to run agents on a schedule.</p>
            <button onClick={() => setIsCreateModalOpen(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90">
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
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Next Run</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Run</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cronJobs.map((job: any) => {
                  const agent = agentMap.get(job.agentId);
                  return (
                    <tr key={job._id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{job.name}</p>
                          {job.description && <p className="text-xs text-muted-foreground">{job.description}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{job.schedule}</td>
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground">{agent?.name || job.agentId}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {job.isEnabled ? formatNextRun(job.nextRun) : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {job.lastRun ? new Date(job.lastRun).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${job.isEnabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                          {job.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleRunNow(job._id)}
                            disabled={!job.isEnabled || runningJobId === job._id}
                            className="p-1.5 rounded hover:bg-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Run now"
                          >
                            {runningJobId === job._id ? (
                              <Loader2 className="w-4 h-4 text-green-500 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4 text-green-500" />
                            )}
                          </button>
                          <button
                            onClick={() => setHistoryJobId(historyJobId === job._id ? null : job._id)}
                            className="p-1.5 rounded hover:bg-muted"
                            title="View run history"
                          >
                            <History className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button onClick={() => toggleCron({ id: job._id })} className="p-1.5 rounded hover:bg-muted" title={job.isEnabled ? 'Pause' : 'Resume'}>
                            {job.isEnabled ? <Pause className="w-4 h-4 text-muted-foreground" /> : <Play className="w-4 h-4 text-green-500" />}
                          </button>
                          <button onClick={() => setEditingJob(job)} className="p-1.5 rounded hover:bg-muted" title="Edit">
                            <Edit className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(job._id)}
                            className={`p-1.5 rounded transition-colors ${
                              confirmingDeletingId === job._id
                                ? 'bg-destructive text-destructive-foreground'
                                : 'hover:bg-destructive/10'
                            }`}
                            title={confirmingDeletingId === job._id ? 'Click to confirm delete' : 'Delete cron job'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Run History Panel */}
            {historyJobId && <RunHistoryPanel cronJobId={historyJobId} onClose={() => setHistoryJobId(null)} />}
          </div>
        )}

        <Dialog open={isCreateModalOpen} onOpenChange={(open) => { if (!open) setIsCreateModalOpen(false); }}>
          <DialogContent className="max-w-lg">
            <CronModalContent agents={agents} onSave={handleCreate} onClose={() => setIsCreateModalOpen(false)} />
          </DialogContent>
        </Dialog>
        <Dialog open={!!editingJob} onOpenChange={(open) => { if (!open) setEditingJob(null); }}>
          <DialogContent className="max-w-lg">
            {editingJob && <CronModalContent agents={agents} job={editingJob} onSave={handleEdit} onClose={() => setEditingJob(null)} />}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function RunHistoryPanel({ cronJobId, onClose }: { cronJobId: any; onClose: () => void }) {
  const history = useQuery(api.cronJobs.getRunHistory, { cronJobId, limit: 10 }) ?? [];

  return (
    <div className="border-t border-border bg-muted/30 p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-sm">Run History (Last 10)</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">No run history yet.</p>
      ) : (
        <div className="space-y-2">
          {history.map((run: any) => (
            <div key={run._id} className="bg-card border border-border rounded-md p-3">
              <div className="flex items-center gap-2 mb-1">
                {run.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                {run.status === 'failed' && <XCircle className="w-4 h-4 text-destructive" />}
                {run.status === 'running' && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                <span className="text-xs font-medium capitalize">{run.status}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(run.startedAt).toLocaleString()}
                </span>
              </div>
              {run.output && (
                <div className="text-xs text-muted-foreground mt-1 p-2 bg-muted/50 rounded">
                  {run.output}
                </div>
              )}
              {run.error && (
                <div className="text-xs text-destructive mt-1 p-2 bg-destructive/10 rounded">
                  {run.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CronModalContent({
  agents,
  job,
  onSave,
  onClose,
}: {
  agents: any[];
  job?: any;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(
    job
      ? {
          name: job.name,
          description: job.description || '',
          schedule: job.schedule,
          agentId: job.agentId,
          prompt: job.prompt,
        }
      : {
          name: '',
          description: '',
          schedule: '0 9 * * *',
          agentId: agents[0]?.id || '',
          prompt: '',
        }
  );

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
    <>
      <DialogHeader>
        <DialogTitle>{job ? 'Edit Scheduled Task' : 'New Scheduled Task'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev: any) => ({ ...prev, name: e.target.value }))}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
              placeholder="e.g. Daily Report"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((prev: any) => ({ ...prev, description: e.target.value }))}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Agent</label>
            <select
              value={form.agentId}
              onChange={(e) => setForm((prev: any) => ({ ...prev, agentId: e.target.value }))}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
              required
            >
              {agents.length === 0 ? (
                <option value="">No agents available</option>
              ) : (
                agents.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cron Schedule</label>
            <input
              type="text"
              value={form.schedule}
              onChange={(e) => setForm((prev: any) => ({ ...prev, schedule: e.target.value }))}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono"
              required
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {presets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setForm((prev: any) => ({ ...prev, schedule: p.value }))}
                  className={`text-xs px-2 py-1 rounded border ${
                    form.schedule === p.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Prompt</label>
            <textarea
              value={form.prompt}
              onChange={(e) => setForm((prev: any) => ({ ...prev, prompt: e.target.value }))}
              rows={3}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
              placeholder="What should the agent do?"
              required
            />
          </div>
        </form>
      <DialogFooter>
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!form.name || !form.agentId || !form.prompt}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          {job ? 'Update Schedule' : 'Create Schedule'}
        </button>
      </DialogFooter>
    </>
  );
}
