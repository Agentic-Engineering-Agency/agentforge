import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { GitBranch, Play, Eye, Clock, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

export const Route = createFileRoute('/workflows')({ component: WorkflowsPage });

type WorkflowStatus = 'pending' | 'running' | 'suspended' | 'completed' | 'failed';

interface WorkflowRun {
  _id: string;
  workflowId: string;
  status: WorkflowStatus;
  input?: string;
  output?: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
  steps?: WorkflowStep[];
}

interface WorkflowStep {
  _id: string;
  name: string;
  status: WorkflowStatus;
  input?: string;
  output?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

interface WorkflowDefinition {
  _id: Id<'workflowDefinitions'>;
  name: string;
  description?: string;
  steps: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

function WorkflowsPage() {
  // Real Convex queries
  const workflows = useQuery(api.workflows.list, {});
  const runs = useQuery(api.workflows.listRuns, {});
  const createRun = useMutation(api.workflows.createRun);

  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());

  const toggleExpand = (runId: string) => {
    setExpandedRuns(prev => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  };

  const runWorkflow = async (workflowId: Id<'workflowDefinitions'>) => {
    await createRun({
      workflowId,
      input: '',
    });
  };

  const getStatusBadge = (status: WorkflowStatus) => {
    const styles = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      running: 'bg-blue-500/20 text-blue-400',
      suspended: 'bg-orange-500/20 text-orange-400',
      completed: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400',
    };
    const labels = {
      pending: 'Pending',
      running: 'Running',
      suspended: 'Suspended',
      completed: 'Completed',
      failed: 'Failed',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getStatusIcon = (status: WorkflowStatus) => {
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

  return (
    <DashboardLayout>
      <div className="p-6 bg-background text-foreground">
        <div className="flex items-center mb-6">
          <GitBranch className="w-8 h-8 mr-4 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Workflows</h1>
            <p className="text-muted-foreground">Multi-agent pipeline orchestration</p>
          </div>
        </div>

        {/* Workflow Definitions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Workflow Definitions</h2>
          {workflows === undefined ? (
            <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
              <Loader2 className="mx-auto h-8 w-8 text-muted-foreground animate-spin" />
              <p className="mt-2 text-sm text-muted-foreground">Loading workflows...</p>
            </div>
          ) : workflows && workflows.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows.map((workflow: WorkflowDefinition) => (
                <div key={workflow._id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium">{workflow.name}</h3>
                    {getStatusBadge(workflow.isActive ? 'completed' : 'pending')}
                  </div>
                  {workflow.description && (
                    <p className="text-sm text-muted-foreground mb-3">{workflow.description}</p>
                  )}
                  <div className="text-xs text-muted-foreground mb-3">
                    {(() => { try { return JSON.parse(workflow.steps).length; } catch { return 0; } })()} steps • Created {new Date(workflow.createdAt).toLocaleDateString()}
                  </div>
                  <button
                    onClick={() => runWorkflow(workflow._id)}
                    className="w-full bg-primary text-primary-foreground py-2 rounded-lg flex items-center justify-center hover:bg-primary/90"
                  >
                    <Play className="w-4 h-4 mr-2" /> Run
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
              <GitBranch className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No workflows yet</p>
              <p className="text-xs text-muted-foreground">Create a pipeline from the CLI: agentforge workflows run &lt;pipeline-name&gt;</p>
            </div>
          )}
        </div>

        {/* Workflow Runs */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Runs</h2>
          {runs === undefined ? (
            <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
              <Loader2 className="mx-auto h-8 w-8 text-muted-foreground animate-spin" />
              <p className="mt-2 text-sm text-muted-foreground">Loading runs...</p>
            </div>
          ) : runs && runs.length > 0 ? (
            <div className="space-y-4">
              {runs.map((run: WorkflowRun) => {
                const workflow = workflows?.find((w: WorkflowDefinition) => w._id === run.workflowId);
                const isExpanded = expandedRuns.has(run._id);
                return (
                  <div key={run._id} className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(run.status)}
                          <div>
                            <h3 className="font-medium">{workflow?.name || 'Unknown Workflow'}</h3>
                            <p className="text-xs text-muted-foreground">
                              {new Date(run.startedAt).toLocaleString()} • {run.completedAt
                                ? `Completed in ${Math.round((run.completedAt - run.startedAt) / 1000)}s`
                                : 'Running...'
                              }
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(run.status)}
                          <button
                            onClick={() => toggleExpand(run._id)}
                            className="p-2 rounded hover:bg-muted"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      {run.input && !isExpanded && (
                        <div className="mt-3 text-sm text-muted-foreground truncate">
                          Input: {run.input}
                        </div>
                      )}
                    </div>

                    {isExpanded && run.steps && (
                      <div className="border-t border-border bg-muted/30 p-4">
                        <h4 className="text-sm font-semibold mb-3">Steps</h4>
                        <div className="space-y-2">
                          {run.steps.map((step: WorkflowStep, index: number) => (
                            <div key={step._id} className="flex items-start gap-3 bg-background rounded-lg p-3">
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{step.name}</span>
                                  {getStatusBadge(step.status)}
                                </div>
                                {step.error && (
                                  <p className="text-xs text-red-400 mt-1">{step.error}</p>
                                )}
                                {step.output && (
                                  <p className="text-xs text-muted-foreground mt-1 truncate">{step.output}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {run.output && (
                          <div className="mt-4">
                            <h4 className="text-sm font-semibold mb-2">Output</h4>
                            <div className="bg-background rounded-lg p-3 text-sm">
                              {run.output}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
              <Clock className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No workflow runs yet</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
