import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo, useEffect } from 'react';
// import { useQuery, useMutation } from 'convex/react';
// import { api } from '../../convex/_generated/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '../components/ui/sheet';
import { Badge } from '../components/ui/badge';
import { Activity, Clock, MessageSquare, XCircle, Loader2 } from 'lucide-react';

// Mock data structure, aligned with the requirements
const mockSessions = [
  {
    _id: 's1',
    agentId: 'agent-001',
    status: 'active',
    _creationTime: new Date().getTime() - 1000 * 60 * 5,
    messageCount: 42,
  },
  {
    _id: 's2',
    agentId: 'agent-007',
    status: 'idle',
    _creationTime: new Date().getTime() - 1000 * 60 * 30,
    messageCount: 12,
  },
  {
    _id: 's3',
    agentId: 'agent-002',
    status: 'ended',
    _creationTime: new Date().getTime() - 1000 * 60 * 120,
    endTime: new Date().getTime() - 1000 * 60 * 60,
    messageCount: 150,
  },
  {
    _id: 's4',
    agentId: 'agent-001',
    status: 'active',
    _creationTime: new Date().getTime() - 1000 * 60 * 2,
    messageCount: 5,
  },
];

type Session = typeof mockSessions[0] & { endTime?: number };

export const Route = createFileRoute('/sessions')({
  component: SessionsPage,
});

function formatDuration(startTime: number, endTime?: number) {
  const end = endTime ? endTime : new Date().getTime();
  const seconds = Math.floor((end - startTime) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // --- Commented-out Convex Hooks ---
  /*
  const sessionsData = useQuery(
    api.sessions.listByStatus,
    statusFilter === 'all' ? {} : { status: statusFilter }
  );
  const endSessionMutation = useMutation(api.sessions.endSession);

  useEffect(() => {
    if (sessionsData === undefined) {
      setIsLoading(true);
      setError(null);
    } else if (sessionsData) {
      setSessions(sessionsData);
      setIsLoading(false);
    } else {
      // Handle potential query error from Convex
      setIsLoading(false);
      setError("Failed to fetch sessions.");
    }
  }, [sessionsData]);
  */

  // Local state simulation of fetching data
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      try {
        // Simulate API call
        setSessions(mockSessions.map(s => ({...s, endTime: s.status === 'ended' ? (s as any).endTime : undefined })));
        setIsLoading(false);
      } catch (e) {
        setError("Failed to load sessions.");
        setIsLoading(false);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleEndSession = async (sessionId: string) => {
    // Optimistic update for local state
    setSessions(prev =>
      prev.map(s =>
        s._id === sessionId ? { ...s, status: 'ended', endTime: new Date().getTime() } : s
      )
    );

    // --- Commented-out Convex Mutation Call ---
    /*
    try {
      await endSessionMutation({ sessionId });
      // Optionally, you can show a toast notification for success
    } catch (err) {
      console.error("Failed to end session:", err);
      // Revert optimistic update on failure
      setSessions(sessionsData || []); // Revert to original data from query
      // Optionally, show an error toast
    }
    */
  };

  const filteredSessions = useMemo(() => {
    if (statusFilter === 'all') {
      return sessions;
    }
    return sessions.filter(s => s.status === statusFilter);
  }, [sessions, statusFilter]);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500 text-white">Active</Badge>;
      case 'idle':
        return <Badge variant="secondary" className="bg-yellow-500 text-white">Idle</Badge>;
      case 'ended':
        return <Badge variant="destructive" className="bg-gray-500 text-white">Ended</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 lg:p-8">
        <h1 className="text-2xl font-bold mb-4">Sessions</h1>
        <Card>
          <CardHeader>
            <CardTitle>Manage and monitor all user sessions.</CardTitle>
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full pt-4">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="idle">Idle</TabsTrigger>
                <TabsTrigger value="ended">Ended</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center text-destructive py-10">{error}</div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">
                <p className="text-lg">No sessions found.</p>
                <p>Start a new chat to create a session.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session ID</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Messages</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.map(session => (
                      <TableRow key={session._id} onClick={() => setSelectedSession(session)} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-mono text-xs">{session._id}</TableCell>
                        <TableCell>{session.agentId}</TableCell>
                        <TableCell>{statusBadge(session.status)}</TableCell>
                        <TableCell>{new Date(session._creationTime).toLocaleString()}</TableCell>
                        <TableCell>{formatDuration(session._creationTime, session.endTime)}</TableCell>
                        <TableCell className="text-right">{session.messageCount}</TableCell>
                        <TableCell className="text-right">
                          {session.status !== 'ended' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleEndSession(session._id); }}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              End Session
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <SheetContent className="w-full sm:max-w-lg bg-background border-l">
          {selectedSession && (
            <>
              <SheetHeader>
                <SheetTitle>Session Details</SheetTitle>
                <SheetDescription className="font-mono text-xs pt-2">{selectedSession._id}</SheetDescription>
              </SheetHeader>
              <div className="py-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  {statusBadge(selectedSession.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center"><Activity className="h-4 w-4 mr-2" />Agent</span>
                  <span>{selectedSession.agentId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center"><Clock className="h-4 w-4 mr-2" />Started</span>
                  <span>{new Date(selectedSession._creationTime).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center"><Clock className="h-4 w-4 mr-2" />Duration</span>
                  <span>{formatDuration(selectedSession._creationTime, selectedSession.endTime)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center"><MessageSquare className="h-4 w-4 mr-2" />Messages</span>
                  <span>{selectedSession.messageCount}</span>
                </div>
                {selectedSession.status === 'ended' && selectedSession.endTime && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center"><XCircle className="h-4 w-4 mr-2" />Ended</span>
                    <span>{new Date(selectedSession.endTime).toLocaleString()}</span>
                  </div>
                )}
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button variant="outline">Close</Button>
                </SheetClose>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
