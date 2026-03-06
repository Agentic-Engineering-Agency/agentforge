import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Microscope, Play, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

export const Route = createFileRoute('/research')({ component: ResearchPage });

type ResearchDepth = 'shallow' | 'medium' | 'deep';
type ResearchStatus = 'idle' | 'running' | 'completed' | 'failed';

interface ResearchJob {
  id: string;
  topic: string;
  depth: ResearchDepth;
  agentCount: number;
  status: ResearchStatus;
  results?: string;
  createdAt: number;
  completedAt?: number;
}

function ResearchPage() {
  const startResearchAction = useAction(api.research.start);
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState<ResearchDepth>('medium');
  const [agentCount, setAgentCount] = useState(5);
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [currentJob, setCurrentJob] = useState<ResearchJob | null>(null);

  const startResearch = async () => {
    if (!topic.trim()) return;

    const newJob: ResearchJob = {
      id: `job-${Date.now()}`,
      topic,
      depth,
      agentCount,
      status: 'running',
      createdAt: Date.now(),
    };

    setJobs(prev => [newJob, ...prev]);
    setCurrentJob(newJob);
    setTopic('');

    try {
      await startResearchAction({
        topic,
        depth,
      });
      // Research started successfully
      // In production, you would poll for status updates
      setJobs(prev => prev.map(job =>
        job.id === newJob.id
          ? { ...job, status: 'completed', results: `Research completed on: ${newJob.topic}\n\nResearch task submitted successfully. Check the CLI for detailed results.`, completedAt: Date.now() }
          : job
      ));
    } catch (error) {
      setJobs(prev => prev.map(job =>
        job.id === newJob.id
          ? { ...job, status: 'failed', results: error instanceof Error ? error.message : 'Research failed', completedAt: Date.now() }
          : job
      ));
    } finally {
      setCurrentJob(null);
    }
  };

  const getStatusIcon = (status: ResearchStatus) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getAgentCountFromDepth = (depth: ResearchDepth): number => {
    switch (depth) {
      case 'shallow': return 3;
      case 'medium': return 5;
      case 'deep': return 10;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 bg-background text-foreground">
        <div className="flex items-center mb-6">
          <Microscope className="w-8 h-8 mr-4 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Research Mode</h1>
            <p className="text-muted-foreground">Deep research with parallel multi-agent orchestration</p>
          </div>
        </div>

        {/* Research Input Panel */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Start New Research</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Research Topic</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter a topic or question to research..."
                rows={3}
                className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Research Depth</label>
                <select
                  value={depth}
                  onChange={(e) => setDepth(e.target.value as ResearchDepth)}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="shallow">Shallow (3 agents)</option>
                  <option value="medium">Medium (5 agents)</option>
                  <option value="deep">Deep (10 agents)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Parallel Agents</label>
                <div className="flex gap-2">
                  {[3, 5, 10].map(count => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setAgentCount(count)}
                      className={`flex-1 py-2 rounded-md border transition-colors ${
                        agentCount === count
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:bg-muted'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={startResearch}
              disabled={!topic.trim() || currentJob !== null}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentJob ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Start Research
                </>
              )}
            </button>
          </div>
        </div>

        {/* Research Results */}
        {jobs.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Research History</h2>
            {jobs.map(job => (
              <div key={job.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(job.status)}
                      <h3 className="font-medium">{job.topic}</h3>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Depth: {job.depth} • {job.agentCount} agents • {new Date(job.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {job.status === 'completed' && job.completedAt && (
                    <div className="text-sm text-muted-foreground">
                      Completed in {Math.round((job.completedAt - job.createdAt) / 1000)}s
                    </div>
                  )}
                </div>
                {job.results && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <pre className="whitespace-pre-wrap text-sm font-sans">{job.results}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {jobs.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
            <Microscope className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No research yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Start a research task to see results here.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
