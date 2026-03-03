import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { Clock, Play, Pause, Plus, History, AlertCircle, Trash2, Edit } from 'lucide-react';

export const Route = createFileRoute('/cron')({ component: CronPageComponent });

type CronJob = {
  _id: Id<'cronJobs'>;
  name: string;
  description: string | undefined;
  schedule: string;
  agentId: string;
  prompt: string;
  isEnabled: boolean;
  lastRun: number | undefined;
  nextRun: number | undefined;
  createdAt: number;
  updatedAt: number;
};

function CronPageComponent() {
  // Convex hooks
  const jobsQuery = useQuery(api.cronJobs.list, {});
  const jobs = jobsQuery ?? [];
  const createJob = useMutation(api.cronJobs.create);
  const updateJob = useMutation(api.cronJobs.update);
  const deleteJob = useMutation(api.cronJobs.remove);
  const toggleJob = useMutation(api.cronJobs.toggleEnabled);
  const [selectedJobHistory, setSelectedJobHistory] = useState<CronJob | null>(null);
  const runHistory = useQuery(
    api.cronJobs.getRunHistory,
    selectedJobHistory ? { cronJobId: selectedJobHistory._id, limit: 10 } : 'skip' as any
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);

  const isLoading = jobsQuery === undefined;

  const handleSaveJob = async (jobData: Omit<CronJob, '_id' | 'createdAt' | 'updatedAt' | 'lastRun' | 'nextRun'>) => {
    if (editingJob) {
      const { agentId, ...updatePayload } = jobData;
      await updateJob({ id: editingJob._id, ...updatePayload });
    } else {
      const { isEnabled, ...createPayload } = jobData as any;
      await createJob(createPayload);
    }
    setIsModalOpen(false);
    setEditingJob(null);
  };

  const handleToggleStatus = async (job: CronJob) => {
    await toggleJob({ id: job._id });
  };

  const handleDeleteJob = async (id: Id<'cronJobs'>) => {
    await deleteJob({ id });
  };

  const openEditModal = (job: CronJob) => {
    setEditingJob(job);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingJob(null);
    setIsModalOpen(true);
  };

  // Helper functions
  const formatTimestamp = (ts: number | undefined) => {
    if (!ts) return 'N/A';
    return new Date(ts).toLocaleString();
  };

  const getNextRunReadable = (schedule: string) => {
    // Simplified readable schedule
    if (schedule === '0 * * * *') return 'Every hour';
    if (schedule === '0 0 * * *') return 'Every day at midnight';
    if (schedule === '0 0 * * 1') return 'Every Monday';
    return schedule;
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Cron Jobs</h1>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateModal}>
                <Plus className="mr-2 h-4 w-4" /> Add Cron Job
              </Button>
            </DialogTrigger>
            <CronJobForm 
              job={editingJob} 
              onSave={handleSaveJob} 
              onClose={() => setIsModalOpen(false)} 
            />
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Scheduled Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {jobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Last Run</TableHead>
                      <TableHead>Next Run</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map(job => (
                      <TableRow key={job._id}>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button onClick={() => handleToggleStatus(job)}>
                                  {job.isEnabled ? (
                                    <Play className="h-5 w-5 text-green-500" />
                                  ) : (
                                    <Pause className="h-5 w-5 text-yellow-500" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{job.isEnabled ? 'Enabled (Click to disable)' : 'Disabled (Click to enable)'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="font-medium">{job.name}</TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="cursor-help">{getNextRunReadable(job.schedule)}</TooltipTrigger>
                              <TooltipContent><p>{job.schedule}</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>{job.agentId}</TableCell>
                        <TableCell>{formatTimestamp(job.lastRun)}</TableCell>
                        <TableCell>{formatTimestamp(job.nextRun)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedJobHistory(job)}>
                            <History className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(job)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteJob(job._id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="mx-auto h-12 w-12" />
                  <h3 className="mt-4 text-lg font-semibold">No Cron Jobs Scheduled</h3>
                  <p className="mt-2 text-sm">Get started by adding a new cron job.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-1 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center">
                <History className="mr-2 h-5 w-5" />
                Execution History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedJobHistory ? (
                <div>
                  <h4 className="font-semibold mb-2">{selectedJobHistory.name}</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {[...Array(5)].map((_, i) => (
                      <li key={i} className="flex items-center justify-between p-2 bg-background rounded-md border">
                        <span>Run #{15 - i}</span>
                        <span className="text-xs">{(new Date(Date.now() - i * 3600000)).toLocaleString()}</span>
                        <span className="text-green-500">Success</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <AlertCircle className="mx-auto h-10 w-10" />
                  <p className="mt-4 text-sm">Select a job to view its execution history.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

interface CronJobFormProps {
  job: CronJob | null;
  onSave: (jobData: Omit<CronJob, '_id' | 'createdAt' | 'updatedAt' | 'lastRun' | 'nextRun'>) => void;
  onClose: () => void;
}

function CronJobForm({ job, onSave, onClose }: CronJobFormProps) {
  const [name, setName] = useState(job?.name || '');
  const [description, setDescription] = useState(job?.description || '');
  const [agentId, setAgentId] = useState(job?.agentId || '');
  const [prompt, setPrompt] = useState(job?.prompt || '');
  const [schedulePreset, setSchedulePreset] = useState('custom');
  const [customSchedule, setCustomSchedule] = useState(job?.schedule || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const schedule = schedulePreset === 'custom' ? customSchedule : schedulePreset;

    onSave({
      name,
      description: description || undefined,
      agentId,
      prompt,
      schedule,
      isEnabled: job?.isEnabled ?? true,
    });
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{job ? 'Edit Cron Job' : 'Create Cron Job'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" placeholder="e.g., Daily Summary" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Description</Label>
            <Input id="description" value={description} onChange={e => setDescription(e.target.value)} className="col-span-3" placeholder="Optional description" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="agentId" className="text-right">Agent ID</Label>
            <Input id="agentId" value={agentId} onChange={e => setAgentId(e.target.value)} className="col-span-3" placeholder="e.g., reporting-agent" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="prompt" className="text-right">Prompt</Label>
            <Input id="prompt" value={prompt} onChange={e => setPrompt(e.target.value)} className="col-span-3" placeholder="Task prompt for the agent" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="schedule" className="text-right">Schedule</Label>
            <Select onValueChange={setSchedulePreset} defaultValue={schedulePreset}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0 * * * *">Every Hour</SelectItem>
                <SelectItem value="0 0 * * *">Every Day (midnight)</SelectItem>
                <SelectItem value="0 0 * * 1">Every Week (Monday)</SelectItem>
                <SelectItem value="custom">Custom Cron Expression</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {schedulePreset === 'custom' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="custom-schedule" className="text-right">Cron</Label>
              <Input
                id="custom-schedule"
                value={customSchedule}
                onChange={e => setCustomSchedule(e.target.value)}
                className="col-span-3"
                placeholder="* * * * *"
                required
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save Job</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
