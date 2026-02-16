import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '~/components/DashboardLayout';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Switch } from '~/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import { Clock, Play, Pause, Plus, History, AlertCircle, Trash2, Edit } from 'lucide-react';
// import { useQuery, useMutation } from 'convex/react';
// import { api } from '../../convex/_generated/api';

export const Route = createFileRoute('/cron')({ component: CronPageComponent });

type CronJob = {
  id: string;
  name: string;
  schedule: string;
  scheduleReadable: string;
  agent: string;
  status: 'enabled' | 'disabled';
  lastRun: string | null;
  nextRun: string;
};

const initialCronJobs: CronJob[] = [
  {
    id: 'cron_1',
    name: 'Daily Report',
    schedule: '0 9 * * *',
    scheduleReadable: 'Every day at 9:00 AM',
    agent: 'reporting-agent',
    status: 'enabled',
    lastRun: '2026-02-15 09:00:12',
    nextRun: '2026-02-16 09:00:00',
  },
  {
    id: 'cron_2',
    name: 'Hourly Sync',
    schedule: '0 * * * *',
    scheduleReadable: 'Every hour',
    agent: 'sync-agent',
    status: 'disabled',
    lastRun: '2026-02-15 14:00:05',
    nextRun: '2026-02-15 16:00:00',
  },
  {
    id: 'cron_3',
    name: 'Nightly Cleanup',
    schedule: '0 2 * * *',
    scheduleReadable: 'Every day at 2:00 AM',
    agent: 'cleanup-agent',
    status: 'enabled',
    lastRun: '2026-02-15 02:00:08',
    nextRun: '2026-02-16 02:00:00',
  },
];

function CronPageComponent() {
  // const cronJobs = useQuery(api.cronJobs.list) ?? [];
  // const createCronJob = useMutation(api.cronJobs.create);
  // const updateCronJob = useMutation(api.cronJobs.update);
  // const deleteCronJob = useMutation(api.cronJobs.delete);

  const [cronJobs, setCronJobs] = useState<CronJob[]>(initialCronJobs);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [selectedJobHistory, setSelectedJobHistory] = useState<CronJob | null>(null);

  const handleSaveJob = (jobData: Omit<CronJob, 'id'>) => {
    if (editingJob) {
      const updatedJob = { ...editingJob, ...jobData };
      setCronJobs(cronJobs.map(j => j.id === editingJob.id ? updatedJob : j));
      // updateCronJob({ id: updatedJob.id, ...jobData });
    } else {
      const newJob = { ...jobData, id: `cron_${Date.now()}` };
      setCronJobs([...cronJobs, newJob]);
      // createCronJob(jobData);
    }
    setIsModalOpen(false);
    setEditingJob(null);
  };

  const handleToggleStatus = (job: CronJob) => {
    const newStatus = job.status === 'enabled' ? 'disabled' : 'enabled';
    const updatedJob = { ...job, status: newStatus };
    setCronJobs(cronJobs.map(j => j.id === job.id ? updatedJob : j));
    // updateCronJob({ id: job.id, status: newStatus });
  };

  const handleDeleteJob = (id: string) => {
    if (window.confirm('Are you sure you want to delete this cron job?')) {
      setCronJobs(cronJobs.filter(j => j.id !== id));
      // deleteCronJob({ id });
    }
  };

  const openEditModal = (job: CronJob) => {
    setEditingJob(job);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingJob(null);
    setIsModalOpen(true);
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
              {cronJobs.length > 0 ? (
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
                    {cronJobs.map(job => (
                      <TableRow key={job.id}>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button onClick={() => handleToggleStatus(job)}>
                                  {job.status === 'enabled' ? (
                                    <Play className="h-5 w-5 text-green-500" />
                                  ) : (
                                    <Pause className="h-5 w-5 text-yellow-500" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{job.status === 'enabled' ? 'Enabled (Click to disable)' : 'Disabled (Click to enable)'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="font-medium">{job.name}</TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="cursor-help">{job.scheduleReadable}</TooltipTrigger>
                              <TooltipContent><p>{job.schedule}</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>{job.agent}</TableCell>
                        <TableCell>{job.lastRun || 'N/A'}</TableCell>
                        <TableCell>{job.nextRun}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedJobHistory(job)}>
                            <History className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(job)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteJob(job.id)}>
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
  onSave: (jobData: Omit<CronJob, 'id'>) => void;
  onClose: () => void;
}

function CronJobForm({ job, onSave, onClose }: CronJobFormProps) {
  const [name, setName] = useState(job?.name || '');
  const [agent, setAgent] = useState(job?.agent || '');
  const [schedulePreset, setSchedulePreset] = useState('custom');
  const [customSchedule, setCustomSchedule] = useState(job?.schedule || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const schedule = schedulePreset === 'custom' ? customSchedule : schedulePreset;
    // This is a simplified readable schedule. A real implementation would use a library.
    const scheduleReadable = schedulePreset === 'custom' ? `Custom: ${customSchedule}` : `Every ${schedulePreset.split(' ')[1]}`;
    
    onSave({
      name,
      agent,
      schedule,
      scheduleReadable,
      status: job?.status || 'enabled',
      lastRun: job?.lastRun || null,
      nextRun: job?.nextRun || 'Calculating...',
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
            <Label htmlFor="agent" className="text-right">Agent</Label>
            <Input id="agent" value={agent} onChange={e => setAgent(e.target.value)} className="col-span-3" placeholder="e.g., reporting-agent" required />
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
