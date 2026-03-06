import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import type { Id } from '@convex/_generated/dataModel';
import { api } from '@convex/_generated/api';
import { Folder, File, Upload, Trash2, FolderPlus, Search, Grid, List, Home, FileText, FileImage, FileCode, FileArchive, X, ChevronRight, Download, Loader2 } from 'lucide-react';

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
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createFile = useMutation(api.files.create);
  const getFileUrl = useQuery(api.files.getFileUrl, files.length > 0 && files[0].storageId ? { storageId: files[0].storageId as string } : 'skip');

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [confirmingDeletingFileId, setConfirmingDeletingFileId] = useState<string | null>(null);
  const [confirmingDeletingFolderId, setConfirmingDeletingFolderId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

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
    await createFolder({ name: newFolderName.trim(), parentId: currentFolderId ? (currentFolderId as Id<'folders'>) : undefined });
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const handleDeleteFileClick = (id: string) => {
    if (confirmingDeletingFileId === id) {
      // Second click - actually delete
      removeFile({ id });
      setConfirmingDeletingFileId(null);
    } else {
      // First click - show confirm state
      setConfirmingDeletingFileId(id);
    }
  };

  const handleDeleteFolderClick = (id: string) => {
    if (confirmingDeletingFolderId === id) {
      // Second click - actually delete
      removeFolder({ id });
      setConfirmingDeletingFolderId(null);
    } else {
      // First click - show confirm state
      setConfirmingDeletingFolderId(id);
    }
  };

  // AGE-152: File upload via generateUploadUrl
  const handleFileUpload = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      for (const file of Array.from(selectedFiles)) {
        // Step 1: Get upload URL from Convex
        const uploadUrl = await generateUploadUrl();

        // Step 2: POST file bytes to upload URL
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        // Step 3: Extract storageId from response
        const { storageId } = await response.json();

        // Step 4: Create file metadata record
        await createFile({
          name: file.name,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          url: uploadUrl.split('?')[0], // Base URL without query params
          storageId,
          folderId: currentFolderId ? (currentFolderId as Id<'folders'>) : undefined,
        });
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
      setTimeout(() => setUploadError(null), 5000);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // AGE-152: Download file via getFileUrl
  const handleDownload = async (file: any) => {
    try {
      const url = await getFileUrl;
      if (url) {
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  // AGE-152: Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    await handleFileUpload(droppedFiles);
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
            {/* AGE-152: Upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <button onClick={() => setShowNewFolder(true)} className="bg-muted text-foreground px-3 py-2 rounded-lg text-sm hover:bg-muted/80 flex items-center gap-2">
              <FolderPlus className="w-4 h-4" /> New Folder
            </button>
          </div>
        </div>

        {/* Upload error notification */}
        {uploadError && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">
            <span>{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="ml-auto text-red-400/60 hover:text-red-400">&times;</button>
          </div>
        )}

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

        {/* AGE-152: Drag and drop upload zone */}
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-muted-foreground'
          }`}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drag and drop files here to upload, or click the Upload button above
          </p>
        </div>

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
            <p className="text-muted-foreground">Upload files via the button above or drag and drop</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {currentFolders.map((folder: any) => (
              <div key={folder._id} className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer group" onDoubleClick={() => setCurrentFolderId(folder._id)}>
                <div className="flex items-center justify-between mb-2">
                  <Folder className="w-8 h-8 text-primary" />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteFolderClick(folder._id); }}
                    className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-colors ${
                      confirmingDeletingFolderId === folder._id
                        ? 'bg-destructive text-destructive-foreground'
                        : 'hover:bg-destructive/10'
                    }`}
                    title={confirmingDeletingFolderId === folder._id ? 'Click to confirm delete' : 'Delete folder'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
                    <div className="flex items-center gap-1">
                      {/* AGE-152: Download button */}
                      <button
                        onClick={() => handleDownload(file)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded transition-colors hover:bg-muted"
                        title="Download file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteFileClick(file._id)}
                        className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-colors ${
                          confirmingDeletingFileId === file._id
                            ? 'bg-destructive text-destructive-foreground'
                            : 'hover:bg-destructive/10'
                        }`}
                        title={confirmingDeletingFileId === file._id ? 'Click to confirm delete' : 'Delete file'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-medium truncate" title={file.name}>{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(file.uploadedAt)}</p>
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
                    <td className="px-4 py-3 text-right"><button onClick={() => handleDeleteFolderClick(folder._id)} className={`p-1.5 rounded transition-colors ${confirmingDeletingFolderId === folder._id ? 'bg-destructive text-destructive-foreground' : 'hover:bg-destructive/10'}`} title={confirmingDeletingFolderId === folder._id ? 'Click to confirm delete' : 'Delete folder'}><Trash2 className="w-4 h-4" /></button></td>
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
                      <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                        {/* AGE-152: Download button */}
                        <button
                          onClick={() => handleDownload(file)}
                          className="p-1.5 rounded transition-colors hover:bg-muted"
                          title="Download file"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteFileClick(file._id)} className={`p-1.5 rounded transition-colors ${confirmingDeletingFileId === file._id ? 'bg-destructive text-destructive-foreground' : 'hover:bg-destructive/10'}`} title={confirmingDeletingFileId === file._id ? 'Click to confirm delete' : 'Delete file'}><Trash2 className="w-4 h-4" /></button>
                      </td>
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
