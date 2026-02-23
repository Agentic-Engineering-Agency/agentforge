import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Folder, File, Upload, Trash2, FolderPlus, Search, Grid, List, Home, FileText, FileImage, FileCode, FileArchive, X, ChevronRight } from 'lucide-react';

export const Route = createFileRoute('/files')({ component: FilesPage });

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return FileImage;
  if (type.includes('script') || type.includes('json') || type.includes('html') || type.includes('css')) return FileCode;
  if (type.includes('zip') || type.includes('tar') || type.includes('rar')) return FileArchive;
  return FileText;
}

function FilesPage() {
  const files = useQuery(api.files.list, {}) ?? [];
  const folders = useQuery(api.folders.list, {}) ?? [];
  const createFolder = useMutation(api.folders.create);
  const removeFile = useMutation(api.files.remove);
  const removeFolder = useMutation(api.folders.remove);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);

  const currentFolders = useMemo(() => {
    const result = folders.filter((f: any) => {
      if (currentFolderId === null) return !f.parentId;
      return f.parentId === currentFolderId;
    });
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return result.filter((f: any) => f.name.toLowerCase().includes(q));
    }
    return result;
  }, [folders, currentFolderId, searchQuery]);

  const currentFiles = useMemo(() => {
    const result = files.filter((f: any) => {
      if (currentFolderId === null) return !f.folderId;
      return f.folderId === currentFolderId;
    });
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return result.filter((f: any) => f.name.toLowerCase().includes(q));
    }
    return result;
  }, [files, currentFolderId, searchQuery]);

  // Build breadcrumb path
  const breadcrumb = useMemo(() => {
    const path: { id: string | null; name: string }[] = [{ id: null, name: 'Home' }];
    let id = currentFolderId;
    const visited = new Set<string>();
    while (id) {
      if (visited.has(id)) break;
      visited.add(id);
      const folder = folders.find((f: any) => f._id === id);
      if (folder) {
        path.push({ id: folder._id, name: folder.name });
        id = folder.parentId || null;
      } else break;
    }
    return path;
  }, [currentFolderId, folders]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder({ name: newFolderName.trim(), parentId: currentFolderId as any });
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const handleDeleteFile = async (id: any) => {
    if (confirm('Delete this file?')) await removeFile({ id });
  };

  const handleDeleteFolder = async (id: any) => {
    if (confirm('Delete this folder and all its contents?')) await removeFolder({ id });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Files</h1>
            <p className="text-muted-foreground">Manage files and folders stored in your workspace.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNewFolder(true)} className="bg-muted text-foreground px-3 py-2 rounded-lg text-sm hover:bg-muted/80 flex items-center gap-2">
              <FolderPlus className="w-4 h-4" /> New Folder
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm">
          {breadcrumb.map((item, i) => (
            <div key={item.id ?? 'root'} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              <button onClick={() => setCurrentFolderId(item.id)} className={`hover:text-primary ${currentFolderId === item.id ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {i === 0 ? <Home className="w-4 h-4 inline" /> : item.name}
              </button>
            </div>
          ))}
        </nav>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search files..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full" />
          </div>
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-card shadow-sm' : ''}`}><Grid className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-card shadow-sm' : ''}`}><List className="w-4 h-4" /></button>
          </div>
        </div>

        {/* New Folder Input */}
        {showNewFolder && (
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-3">
            <FolderPlus className="w-5 h-5 text-primary" />
            <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()} placeholder="Folder name..." className="flex-1 bg-transparent border-none outline-none text-sm" autoFocus />
            <button onClick={handleCreateFolder} className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm">Create</button>
            <button onClick={() => setShowNewFolder(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Content */}
        {currentFolders.length === 0 && currentFiles.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-lg">
            <File className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">{searchQuery ? 'No results' : 'This folder is empty'}</h3>
            <p className="text-muted-foreground">Upload files via the CLI with <code className="bg-muted px-1 rounded">agentforge files upload</code></p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {currentFolders.map((folder: any) => (
              <div key={folder._id} className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer group" onDoubleClick={() => setCurrentFolderId(folder._id)}>
                <div className="flex items-center justify-between mb-2">
                  <Folder className="w-8 h-8 text-primary" />
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder._id); }} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                </div>
                <p className="text-sm font-medium truncate">{folder.name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(folder.createdAt)}</p>
              </div>
            ))}
            {currentFiles.map((file: any) => {
              const Icon = getFileIcon(file.mimeType);
              return (
                <div key={file._id} className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow group">
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="w-8 h-8 text-muted-foreground" />
                    <button onClick={() => handleDeleteFile(file._id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                  </div>
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Size</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentFolders.map((folder: any) => (
                  <tr key={folder._id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onDoubleClick={() => setCurrentFolderId(folder._id)}>
                    <td className="px-4 py-3 flex items-center gap-2"><Folder className="w-4 h-4 text-primary" />{folder.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">Folder</td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(folder.createdAt)}</td>
                    <td className="px-4 py-3 text-right"><button onClick={() => handleDeleteFolder(folder._id)} className="p-1.5 rounded hover:bg-destructive/10"><Trash2 className="w-4 h-4 text-destructive" /></button></td>
                  </tr>
                ))}
                {currentFiles.map((file: any) => {
                  const Icon = getFileIcon(file.mimeType);
                  return (
                    <tr key={file._id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3 flex items-center gap-2"><Icon className="w-4 h-4 text-muted-foreground" />{file.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{file.mimeType}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatFileSize(file.size)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(file.uploadedAt)}</td>
                      <td className="px-4 py-3 text-right"><button onClick={() => handleDeleteFile(file._id)} className="p-1.5 rounded hover:bg-destructive/10"><Trash2 className="w-4 h-4 text-destructive" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
