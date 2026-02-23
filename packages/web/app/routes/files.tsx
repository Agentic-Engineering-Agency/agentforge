import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "../components/DashboardLayout";
import { useState, useRef, useCallback } from "react";
import {
  Folder, File, Upload, Trash2, Edit2, FolderPlus, Download,
  ChevronRight, Search, Grid, List, X, FileText, FileImage, FileCode, FileArchive, Home,
} from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export const Route = createFileRoute("/files")({ component: FilesPage });

interface FolderItem { id: string; name: string; parentId: string | null; createdAt: number; }

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024, sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function getFileIcon(type: string) {
  if (type.startsWith("image/")) return FileImage;
  if (type.includes("script") || type.includes("json") || type.includes("html") || type.includes("css")) return FileCode;
  if (type.includes("zip") || type.includes("tar") || type.includes("rar")) return FileArchive;
  return FileText;
}

function FilesPage() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convex queries
  // TODO: wire folderId filter once folders table is queryable via Convex
  const filesResult = useQuery(api.files.list, currentFolderId ? { folderId: currentFolderId as any } : {});
  const files = filesResult ?? [];

  // Convex mutations
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const confirmUpload = useMutation(api.files.confirmUpload);
  const removeFile = useMutation(api.files.remove);
  const updateFile = useMutation(api.files.update);

  // Folder state is local until a folders Convex table query is available
  // TODO: replace with useQuery(api.folders.list, ...) once wired
  const [folders, setFolders] = useState<FolderItem[]>([
    { id: "f1", name: "Documents", parentId: null, createdAt: Date.now() - 86400000 * 5 },
    { id: "f2", name: "Images", parentId: null, createdAt: Date.now() - 86400000 * 3 },
    { id: "f3", name: "Agent Data", parentId: null, createdAt: Date.now() - 86400000 * 2 },
    { id: "f4", name: "Reports", parentId: "f1", createdAt: Date.now() - 86400000 },
    { id: "f5", name: "Exports", parentId: null, createdAt: Date.now() - 86400000 * 7 },
  ]);

  const currentFolders = folders.filter((f) => f.parentId === currentFolderId);
  const currentFiles = files.filter((f: any) => (f.folderId ?? null) === currentFolderId);
  const filteredFolders = searchQuery ? currentFolders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())) : currentFolders;
  const filteredFiles = searchQuery ? currentFiles.filter((f: any) => f.name.toLowerCase().includes(searchQuery.toLowerCase())) : currentFiles;

  const breadcrumbs: { id: string | null; name: string }[] = [{ id: null, name: "Root" }];
  let crumbId = currentFolderId;
  const crumbParts: { id: string; name: string }[] = [];
  while (crumbId) {
    const folder = folders.find((f) => f.id === crumbId);
    if (folder) { crumbParts.unshift({ id: folder.id, name: folder.name }); crumbId = folder.parentId; } else break;
  }
  breadcrumbs.push(...crumbParts);

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    // TODO: replace with useMutation(api.folders.create) once available
    setFolders([...folders, { id: `f_${Date.now()}`, name: newFolderName.trim(), parentId: currentFolderId, createdAt: Date.now() }]);
    setNewFolderName(""); setShowNewFolderModal(false);
  };
  const handleDeleteFolder = (id: string) => {
    // TODO: replace with useMutation(api.folders.remove) once available
    setFolders(folders.filter((f) => f.id !== id));
  };
  const handleDeleteFile = async (id: string) => {
    await removeFile({ id: id as any });
  };
  const handleRename = async () => {
    if (!renameTarget || !renameName.trim()) return;
    if (renameTarget.type === "folder") {
      // TODO: replace with useMutation(api.folders.update) once available
      setFolders(folders.map((f) => (f.id === renameTarget.id ? { ...f, name: renameName.trim() } : f)));
    } else {
      await updateFile({ id: renameTarget.id as any, name: renameName.trim() });
    }
    setShowRenameModal(false); setRenameTarget(null); setRenameName("");
  };
  const openRename = (id: string, name: string, type: "file" | "folder") => { setRenameTarget({ id, name, type }); setRenameName(name); setShowRenameModal(true); };

  const uploadFiles = useCallback(async (fileList: FileList) => {
    if (!fileList.length) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        // Step 1: Generate upload URL
        const uploadUrl = await generateUploadUrl();
        // Step 2: Upload file to Convex storage
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
        const { storageId } = await response.json() as { storageId: string };
        // Step 3: Confirm upload and create file record
        await confirmUpload({
          storageId: storageId as any,
          name: file.name,
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          folderId: currentFolderId ? (currentFolderId as any) : undefined,
        });
      }
    } finally {
      setIsUploading(false);
    }
  }, [generateUploadUrl, confirmUpload, currentFolderId]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files.length) {
      void uploadFiles(e.dataTransfer.files);
    }
  };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    void uploadFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold">Files</h1><p className="text-muted-foreground mt-1">Manage files and folders for your agents</p></div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNewFolderModal(true)} className="flex items-center gap-2 px-3 py-2 bg-card border rounded-lg hover:bg-accent transition-colors"><FolderPlus className="h-4 w-4" /><span className="text-sm">New Folder</span></button>
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"><Upload className="h-4 w-4" /><span className="text-sm">{isUploading ? "Uploading..." : "Upload"}</span></button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <div key={crumb.id ?? "root"} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                <button onClick={() => setCurrentFolderId(crumb.id)} className={`hover:text-primary transition-colors ${i === breadcrumbs.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {i === 0 ? <Home className="h-4 w-4" /> : crumb.name}
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input type="text" placeholder="Search files..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-3 py-1.5 bg-card border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary w-48" /></div>
            <div className="flex items-center bg-card border rounded-lg">
              <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-l-lg ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><Grid className="h-4 w-4" /></button>
              <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-r-lg ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><List className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
        <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleFileDrop} className={`min-h-[400px] rounded-lg border-2 border-dashed transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-transparent"}`}>
          {filteredFolders.length === 0 && filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" /><h3 className="text-lg font-medium mb-1">No files here</h3>
              <p className="text-muted-foreground text-sm mb-4">Drag and drop files or click Upload to get started</p>
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm">Upload Files</button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredFolders.map((folder) => (
                <div key={folder.id} className="group bg-card border rounded-lg p-4 hover:border-primary/50 cursor-pointer transition-colors relative" onDoubleClick={() => setCurrentFolderId(folder.id)}>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); openRename(folder.id, folder.name, "folder"); }} className="p-1 hover:bg-accent rounded"><Edit2 className="h-3 w-3" /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }} className="p-1 hover:bg-destructive/20 rounded text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                  <Folder className="h-10 w-10 text-blue-400 mb-2" /><p className="text-sm font-medium truncate">{folder.name}</p><p className="text-xs text-muted-foreground mt-1">{formatDate(folder.createdAt)}</p>
                </div>
              ))}
              {filteredFiles.map((file: any) => { const Icon = getFileIcon(file.mimeType ?? file.type ?? ""); return (
                <div key={file._id ?? file.id} className="group bg-card border rounded-lg p-4 hover:border-primary/50 cursor-pointer transition-colors relative">
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button onClick={() => openRename(file._id ?? file.id, file.name, "file")} className="p-1 hover:bg-accent rounded"><Edit2 className="h-3 w-3" /></button>
                    <a href={file.url} download={file.originalName ?? file.name} className="p-1 hover:bg-accent rounded inline-flex items-center"><Download className="h-3 w-3" /></a>
                    <button onClick={() => handleDeleteFile(file._id ?? file.id)} className="p-1 hover:bg-destructive/20 rounded text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                  <Icon className="h-10 w-10 text-muted-foreground mb-2" /><p className="text-sm font-medium truncate">{file.name}</p><p className="text-xs text-muted-foreground mt-1">{formatFileSize(file.size)}</p>
                </div>
              ); })}
            </div>
          ) : (
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground text-left"><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Size</th><th className="px-4 py-3 font-medium">Modified</th><th className="px-4 py-3 font-medium w-24">Actions</th></tr></thead>
                <tbody>
                  {filteredFolders.map((folder) => (
                    <tr key={folder.id} className="border-b hover:bg-accent/50 cursor-pointer" onDoubleClick={() => setCurrentFolderId(folder.id)}>
                      <td className="px-4 py-3 flex items-center gap-2"><Folder className="h-4 w-4 text-blue-400" /><span className="font-medium">{folder.name}</span></td>
                      <td className="px-4 py-3 text-muted-foreground">Folder</td><td className="px-4 py-3 text-muted-foreground">—</td><td className="px-4 py-3 text-muted-foreground">{formatDate(folder.createdAt)}</td>
                      <td className="px-4 py-3"><div className="flex items-center gap-1"><button onClick={() => openRename(folder.id, folder.name, "folder")} className="p-1 hover:bg-accent rounded"><Edit2 className="h-3 w-3" /></button><button onClick={() => handleDeleteFolder(folder.id)} className="p-1 hover:bg-destructive/20 rounded text-destructive"><Trash2 className="h-3 w-3" /></button></div></td>
                    </tr>
                  ))}
                  {filteredFiles.map((file: any) => { const Icon = getFileIcon(file.mimeType ?? file.type ?? ""); return (
                    <tr key={file._id ?? file.id} className="border-b hover:bg-accent/50">
                      <td className="px-4 py-3 flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><span>{file.name}</span></td>
                      <td className="px-4 py-3 text-muted-foreground">{(file.mimeType ?? file.type ?? "").split("/").pop()}</td><td className="px-4 py-3 text-muted-foreground">{formatFileSize(file.size)}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(file.uploadedAt ?? file.updatedAt ?? Date.now())}</td>
                      <td className="px-4 py-3"><div className="flex items-center gap-1"><button onClick={() => openRename(file._id ?? file.id, file.name, "file")} className="p-1 hover:bg-accent rounded"><Edit2 className="h-3 w-3" /></button><a href={file.url} download={file.originalName ?? file.name} className="p-1 hover:bg-accent rounded inline-flex items-center"><Download className="h-3 w-3" /></a><button onClick={() => handleDeleteFile(file._id ?? file.id)} className="p-1 hover:bg-destructive/20 rounded text-destructive"><Trash2 className="h-3 w-3" /></button></div></td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {showNewFolderModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-card border rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">New Folder</h2><button onClick={() => setShowNewFolderModal(false)} className="p-1 hover:bg-accent rounded"><X className="h-4 w-4" /></button></div>
            <input type="text" placeholder="Folder name" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()} className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-4" autoFocus />
            <div className="flex justify-end gap-2"><button onClick={() => setShowNewFolderModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-accent">Cancel</button><button onClick={handleCreateFolder} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Create</button></div>
          </div></div>
        )}
        {showRenameModal && renameTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-card border rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Rename {renameTarget.type}</h2><button onClick={() => setShowRenameModal(false)} className="p-1 hover:bg-accent rounded"><X className="h-4 w-4" /></button></div>
            <input type="text" value={renameName} onChange={(e) => setRenameName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void handleRename()} className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-4" autoFocus />
            <div className="flex justify-end gap-2"><button onClick={() => setShowRenameModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-accent">Cancel</button><button onClick={() => void handleRename()} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Rename</button></div>
          </div></div>
        )}
      </div>
    </DashboardLayout>
  );
}
