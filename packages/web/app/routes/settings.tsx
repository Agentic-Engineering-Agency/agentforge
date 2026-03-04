import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import React, { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import * as Switch from '@radix-ui/react-switch';
import { Settings, Key, Palette, Shield, Download, Upload, AlertTriangle, X, Plus, Trash2, ChevronDown, Lock, Eye, EyeOff, Clock, Activity, ShieldCheck, Copy, CheckCircle, KeyRound } from 'lucide-react';

// Mock data and types
const AVAILABLE_PROVIDERS = ["OpenAI", "Anthropic", "OpenRouter", "Google", "xAI"];

type ApiKey = { id: string; provider: string; maskedKey: string; createdAt: string };
type ProviderSetting = { id: string; name: string; enabled: boolean };

// API Access Token type (from Convex)
type ApiAccessToken = {
  _id: Id<"apiAccessTokens">;
  name: string;
  token: string;
  createdAt: number;
  expiresAt?: number;
  isActive: boolean;
};

// --- Main Component --- //
export const Route = createFileRoute('/settings')({ component: SettingsPage });

function SettingsPage() {
  // const settings = useQuery(api.settings.get);
  // const updateSettings = useMutation(api.settings.update);
  // const apiKeys = useQuery(api.apiKeys.list) || [];
  // const addApiKey = useMutation(api.apiKeys.create);
  // const deleteApiKey = useMutation(api.apiKeys.delete);
  // const providerSettings = useQuery(api.providers.list) || [];
  // const updateProvider = useMutation(api.providers.update);

  // Local state for UI development
  const [generalSettings, setGeneralSettings] = useState({ appName: 'AgentForge', defaultModel: 'gpt-4.1-mini', defaultProvider: 'OpenAI' });
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    { id: '1', provider: 'OpenAI', maskedKey: 'sk-******************1234', createdAt: new Date().toISOString() },
    { id: '2', provider: 'Google', maskedKey: 'go-******************5678', createdAt: new Date().toISOString() },
  ]);
  const [providerSettings, setProviderSettings] = useState<ProviderSetting[]>([
    { id: '1', name: 'OpenAI', enabled: true },
    { id: '2', name: 'Anthropic', enabled: false },
    { id: '3', name: 'OpenRouter', enabled: true },
    { id: '4', name: 'Google', enabled: true },
    { id: '5', name: 'xAI', enabled: false },
  ]);
  const [appearance, setAppearance] = useState({ theme: 'dark' });
  const [defaultProvider, setDefaultProvider] = useState('OpenAI');

  const handleAddApiKey = (provider: string, key: string) => {
    const newKey: ApiKey = {
      id: (apiKeys.length + 1).toString(),
      provider,
      maskedKey: `${key.substring(0, 5)}******************${key.substring(key.length - 4)}`,
      createdAt: new Date().toISOString(),
    };
    // addApiKey({ provider, key });
    setApiKeys([...apiKeys, newKey]);
  };

  const handleDeleteApiKey = (id: string) => {
    // deleteApiKey({ id });
    setApiKeys(apiKeys.filter(key => key.id !== id));
  };

  const handleProviderToggle = (id: string, enabled: boolean) => {
    // updateProvider({ id, enabled });
    setProviderSettings(providerSettings.map(p => p.id === id ? { ...p, enabled } : p));
  };

  const handleSetDefaultProvider = (name: string) => {
    // updateSettings({ defaultProvider: name });
    setDefaultProvider(name);
  }

  return (
    <DashboardLayout>
      <div className="p-8 bg-background text-foreground">
        <div className="flex items-center mb-6">
          <Settings className="w-8 h-8 mr-4 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Configuration</h1>
            <p className="text-muted-foreground">Manage your application settings and preferences.</p>
          </div>
        </div>

        <Tabs.Root defaultValue="general" className="w-full">
          <Tabs.List className="flex border-b border-border mb-6">
            <TabTrigger value="general" icon={<Settings />}>General</TabTrigger>
            <TabTrigger value="apiKeys" icon={<Key />}>API Keys</TabTrigger>
            <TabTrigger value="providers" icon={<Shield />}>Providers</TabTrigger>
            <TabTrigger value="appearance" icon={<Palette />}>Appearance</TabTrigger>
            <TabTrigger value="vault" icon={<Lock />}>Vault</TabTrigger>
            <TabTrigger value="tokens" icon={<KeyRound />}>Tokens</TabTrigger>
            <TabTrigger value="advanced" icon={<AlertTriangle />}>Advanced</TabTrigger>
          </Tabs.List>

          <Tabs.Content value="general"><GeneralTab settings={generalSettings} setSettings={setGeneralSettings} /></Tabs.Content>
          <Tabs.Content value="apiKeys"><ApiKeysTab keys={apiKeys} onAdd={handleAddApiKey} onDelete={handleDeleteApiKey} /></Tabs.Content>
          <Tabs.Content value="providers"><ProvidersTab providers={providerSettings} defaultProvider={defaultProvider} onToggle={handleProviderToggle} onSetDefault={handleSetDefaultProvider} /></Tabs.Content>
          <Tabs.Content value="vault"><VaultTab /></Tabs.Content>
          <Tabs.Content value="tokens"><TokensTab /></Tabs.Content>
          <Tabs.Content value="appearance"><AppearanceTab appearance={appearance} setAppearance={setAppearance} /></Tabs.Content>
          <Tabs.Content value="advanced"><AdvancedTab /></Tabs.Content>
        </Tabs.Root>
      </div>
    </DashboardLayout>
  );
}

// --- Tab Components --- //

const TabTrigger = ({ children, value, icon }: { children: React.ReactNode, value: string, icon: React.ReactNode }) => (
  <Tabs.Trigger
    value={value}
    className="flex items-center px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-t-md transition-colors"
  >
    {React.cloneElement(icon as React.ReactElement, { className: 'w-4 h-4 mr-2' })}
    {children}
  </Tabs.Trigger>
);

const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-card border border-border rounded-lg p-6 ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ title, description }: { title: string, description: string }) => (
    <div className="mb-6">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-1">{description}</p>
    </div>
);

const Button = ({ children, variant = 'primary', ...props }: { children: React.ReactNode, variant?: 'primary' | 'destructive' | 'secondary', [key: string]: any }) => {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90 border border-border',
  };
  return (
    <button className={`px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]}`} {...props}>
      {children}
    </button>
  );
};

function GeneralTab({ settings, setSettings }: { settings: any, setSettings: any }) {
  const updateSettings = useMutation(api.settings.set);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Use a default user ID for now - in production this would come from auth
      const userId = 'default';
      await Promise.all([
        updateSettings({ userId, key: 'appName', value: settings.appName }),
        updateSettings({ userId, key: 'defaultModel', value: settings.defaultModel }),
        updateSettings({ userId, key: 'defaultProvider', value: settings.defaultProvider }),
      ]);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="General Settings" description="Configure the core settings for your application." />
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">App Name</label>
          <input type="text" value={settings.appName} onChange={e => setSettings({...settings, appName: e.target.value})} className="w-full bg-background border border-border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Default Model</label>
          <input type="text" value={settings.defaultModel} onChange={e => setSettings({...settings, defaultModel: e.target.value})} className="w-full bg-background border border-border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Default Provider</label>
          <input type="text" value={settings.defaultProvider} onChange={e => setSettings({...settings, defaultProvider: e.target.value})} className="w-full bg-background border border-border rounded-md px-3 py-2" />
        </div>
      </div>
      {saveError && (
        <div className="mt-4 p-3 bg-red-500/20 text-red-400 rounded-md text-sm">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="mt-4 p-3 bg-green-500/20 text-green-400 rounded-md text-sm">
          Settings saved successfully
        </div>
      )}
      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</Button>
      </div>
    </Card>
  );
}

function ApiKeysTab({ keys, onAdd, onDelete }: { keys: ApiKey[], onAdd: (p: string, k: string) => void, onDelete: (id: string) => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProvider, setNewProvider] = useState(AVAILABLE_PROVIDERS[0]);
  const [newKey, setNewKey] = useState('');

  const handleAdd = () => {
    if (newKey.trim()) {
      onAdd(newProvider, newKey.trim());
      setNewKey('');
      setIsModalOpen(false);
    }
  };

  return (
    <Card>
      <div className="flex justify-between items-start">
        <CardHeader title="API Keys" description="Manage API keys for third-party providers." />
        <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
          <Dialog.Trigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add API Key</Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-lg p-6 w-[400px] shadow-lg">
              <Dialog.Title className="text-lg font-semibold">Add New API Key</Dialog.Title>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Provider</label>
                  <Select.Root value={newProvider} onValueChange={setNewProvider}>
                    <Select.Trigger className="w-full flex justify-between items-center bg-background border border-border rounded-md px-3 py-2">
                      <Select.Value />
                      <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="bg-card border border-border rounded-md shadow-lg">
                        <Select.Viewport className="p-2">
                          {AVAILABLE_PROVIDERS.map(p => (
                            <Select.Item key={p} value={p} className="px-3 py-2 rounded-md hover:bg-primary/20 cursor-pointer focus:outline-none">
                              <Select.ItemText>{p}</Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">API Key</label>
                  <input type="password" value={newKey} onChange={e => setNewKey(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2" />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-2">
                <Dialog.Close asChild><Button variant="secondary">Cancel</Button></Dialog.Close>
                <Button onClick={handleAdd}>Add Key</Button>
              </div>
              <Dialog.Close asChild className="absolute top-4 right-4"><button><X className="w-4 h-4" /></button></Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      <div className="mt-4 space-y-3">
        {keys.length > 0 ? keys.map(key => (
          <div key={key.id} className="flex items-center justify-between bg-background/50 p-3 rounded-md border border-border">
            <div>
              <span className="font-semibold">{key.provider}</span>
              <p className="text-sm text-muted-foreground font-mono">{key.maskedKey}</p>
            </div>
            <Button variant="destructive" onClick={() => onDelete(key.id)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        )) : (
          <p className="text-muted-foreground text-center py-4">No API keys added yet.</p>
        )}
      </div>
    </Card>
  );
}

function ProvidersTab({ providers, defaultProvider, onToggle, onSetDefault }: { providers: ProviderSetting[], defaultProvider: string, onToggle: (id: string, e: boolean) => void, onSetDefault: (name: string) => void }) {
  return (
    <Card>
      <CardHeader title="Providers" description="Enable or disable providers and set a default." />
      <div className="space-y-3">
        {providers.map(provider => (
          <div key={provider.id} className="flex items-center justify-between bg-background/50 p-3 rounded-md border border-border">
            <span className="font-semibold">{provider.name}</span>
            <div className="flex items-center space-x-4">
              <Button 
                variant={defaultProvider === provider.name ? 'primary' : 'secondary'} 
                onClick={() => onSetDefault(provider.name)}
                disabled={!provider.enabled}
              >
                {defaultProvider === provider.name ? 'Default' : 'Set as Default'}
              </Button>
              <div className="flex items-center space-x-2">
                <label htmlFor={`switch-${provider.id}`} className="text-sm">{provider.enabled ? 'Enabled' : 'Disabled'}</label>
                <Switch.Root
                  id={`switch-${provider.id}`}
                  checked={provider.enabled}
                  onCheckedChange={(checked) => onToggle(provider.id, checked)}
                  className="w-[42px] h-[25px] bg-gray-600 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                >
                  <Switch.Thumb className="block w-[21px] h-[21px] bg-white rounded-full shadow-sm transition-transform duration-100 translate-x-0.5 data-[state=checked]:translate-x-[19px]" />
                </Switch.Root>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AppearanceTab({ appearance, setAppearance }: { appearance: any, setAppearance: any }) {
  const toggleTheme = () => {
    const newTheme = appearance.theme === 'dark' ? 'light' : 'dark';
    setAppearance({ ...appearance, theme: newTheme });
    // In a real app, you'd also do:
    // document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <Card>
      <CardHeader title="Appearance" description="Customize the look and feel of the application." />
      <div className="flex items-center justify-between">
        <span className="font-medium">Theme</span>
        <div className="flex items-center space-x-2">
          <span>Light</span>
          <Switch.Root
            checked={appearance.theme === 'dark'}
            onCheckedChange={toggleTheme}
            className="w-[42px] h-[25px] bg-gray-600 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
          >
            <Switch.Thumb className="block w-[21px] h-[21px] bg-white rounded-full shadow-sm transition-transform duration-100 translate-x-0.5 data-[state=checked]:translate-x-[19px]" />
          </Switch.Root>
          <span>Dark</span>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// VAULT TAB - Secure secrets management
// ============================================================
type VaultEntry = {
  id: string;
  name: string;
  category: string;
  provider: string;
  maskedValue: string;
  isActive: boolean;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
};

type AuditLogEntry = {
  id: string;
  action: string;
  source: string;
  timestamp: string;
  secretName: string;
};

function VaultTab() {
  const [entries, setEntries] = useState<VaultEntry[]>([
    { id: '1', name: 'OpenAI API Key', category: 'api_key', provider: 'openai', maskedValue: 'sk-pro...abc123', isActive: true, accessCount: 47, lastAccessedAt: new Date(Date.now() - 3600000).toISOString(), createdAt: new Date(Date.now() - 86400000 * 7).toISOString() },
    { id: '2', name: 'Anthropic API Key', category: 'api_key', provider: 'anthropic', maskedValue: 'sk-ant...xyz789', isActive: true, accessCount: 12, lastAccessedAt: new Date(Date.now() - 7200000).toISOString(), createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
    { id: '3', name: 'GitHub Token (auto-captured)', category: 'token', provider: 'github', maskedValue: 'ghp_ab...ef1234', isActive: true, accessCount: 3, lastAccessedAt: new Date(Date.now() - 86400000).toISOString(), createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: '4', name: 'Stripe Test Key', category: 'api_key', provider: 'stripe', maskedValue: 'sk_tes...9876ab', isActive: false, accessCount: 0, lastAccessedAt: null, createdAt: new Date(Date.now() - 86400000 * 14).toISOString() },
  ]);

  const [auditLog] = useState<AuditLogEntry[]>([
    { id: '1', action: 'accessed', source: 'agent', timestamp: new Date(Date.now() - 3600000).toISOString(), secretName: 'OpenAI API Key' },
    { id: '2', action: 'auto_captured', source: 'chat', timestamp: new Date(Date.now() - 86400000).toISOString(), secretName: 'GitHub Token' },
    { id: '3', action: 'created', source: 'dashboard', timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), secretName: 'Anthropic API Key' },
    { id: '4', action: 'updated', source: 'dashboard', timestamp: new Date(Date.now() - 86400000 * 5).toISOString(), secretName: 'OpenAI API Key' },
  ]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSecret, setNewSecret] = useState({ name: '', category: 'api_key', provider: '', value: '' });
  const [showAuditLog, setShowAuditLog] = useState(false);

  const handleAddSecret = () => {
    if (!newSecret.name.trim() || !newSecret.value.trim()) return;
    const masked = newSecret.value.length > 12
      ? newSecret.value.substring(0, 6) + '...' + newSecret.value.substring(newSecret.value.length - 4)
      : newSecret.value.substring(0, 3) + '...' + newSecret.value.substring(newSecret.value.length - 3);
    setEntries(prev => [{
      id: Date.now().toString(),
      name: newSecret.name,
      category: newSecret.category,
      provider: newSecret.provider,
      maskedValue: masked,
      isActive: true,
      accessCount: 0,
      lastAccessedAt: null,
      createdAt: new Date().toISOString(),
    }, ...prev]);
    setNewSecret({ name: '', category: 'api_key', provider: '', value: '' });
    setIsAddModalOpen(false);
  };

  const handleToggle = (id: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, isActive: !e.isActive } : e));
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure? This will permanently delete this secret.')) {
      setEntries(prev => prev.filter(e => e.id !== id));
    }
  };

  const categoryColors: Record<string, string> = {
    api_key: 'bg-ae-primary/10 text-ae-accent border-ae-accent/40',
    token: 'bg-purple-900/30 text-purple-400 border-purple-700/40',
    secret: 'bg-yellow-900/30 text-yellow-400 border-yellow-700/40',
    credential: 'bg-orange-900/30 text-orange-400 border-orange-700/40',
  };

  const actionColors: Record<string, string> = {
    created: 'text-green-400',
    accessed: 'text-ae-accent',
    updated: 'text-yellow-400',
    deleted: 'text-red-400',
    auto_captured: 'text-purple-400',
  };

  return (
    <div className="space-y-6">
      {/* Vault Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Lock className="w-4 h-4" /> Total Secrets</div>
          <p className="text-2xl font-bold">{entries.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><ShieldCheck className="w-4 h-4" /> Active</div>
          <p className="text-2xl font-bold text-green-400">{entries.filter(e => e.isActive).length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Activity className="w-4 h-4" /> Total Accesses</div>
          <p className="text-2xl font-bold">{entries.reduce((sum, e) => sum + e.accessCount, 0)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Shield className="w-4 h-4" /> Auto-Captured</div>
          <p className="text-2xl font-bold text-purple-400">{entries.filter(e => e.name.includes('auto-captured')).length}</p>
        </div>
      </div>

      {/* Vault Entries */}
      <Card>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-semibold flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Secure Vault</h3>
            <p className="text-muted-foreground mt-1">Encrypted storage for API keys, tokens, and secrets. Values are never exposed in the UI or database.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowAuditLog(!showAuditLog)}>
              <Clock className="w-4 h-4 mr-2" />{showAuditLog ? 'Hide' : 'Show'} Audit Log
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)}><Plus className="w-4 h-4 mr-2" />Add Secret</Button>
          </div>
        </div>

        <div className="space-y-3">
          {entries.map(entry => (
            <div key={entry.id} className={`flex items-center justify-between p-4 rounded-lg border ${entry.isActive ? 'bg-background/50 border-border' : 'bg-background/20 border-border/50 opacity-60'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${entry.isActive ? 'bg-primary/20' : 'bg-muted'}`}>
                  <Lock className={`w-5 h-5 ${entry.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{entry.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${categoryColors[entry.category] || 'bg-muted text-muted-foreground'}`}>{entry.category}</span>
                    {entry.provider && <span className="text-xs text-muted-foreground">{entry.provider}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <code className="text-xs text-muted-foreground font-mono bg-background px-2 py-0.5 rounded">{entry.maskedValue}</code>
                    <span className="text-xs text-muted-foreground">{entry.accessCount} accesses</span>
                    {entry.lastAccessedAt && <span className="text-xs text-muted-foreground">Last: {new Date(entry.lastAccessedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch.Root
                  checked={entry.isActive}
                  onCheckedChange={() => handleToggle(entry.id)}
                  className="w-[42px] h-[25px] bg-gray-600 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                >
                  <Switch.Thumb className="block w-[21px] h-[21px] bg-white rounded-full shadow-sm transition-transform duration-100 translate-x-0.5 data-[state=checked]:translate-x-[19px]" />
                </Switch.Root>
                <button onClick={() => handleDelete(entry.id)} className="p-2 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Audit Log */}
      {showAuditLog && (
        <Card>
          <CardHeader title="Audit Log" description="Track all vault access and modifications." />
          <div className="space-y-2">
            {auditLog.map(log => (
              <div key={log.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-background/50 border border-border">
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium capitalize ${actionColors[log.action] || 'text-foreground'}`}>{log.action.replace('_', ' ')}</span>
                  <span className="text-sm text-foreground">{log.secretName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="px-2 py-0.5 bg-card rounded border border-border">{log.source}</span>
                  <span>{new Date(log.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add Secret Modal */}
      <Dialog.Root open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-lg p-6 w-[450px] shadow-lg">
            <Dialog.Title className="text-lg font-semibold flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Add Secret to Vault</Dialog.Title>
            <p className="text-sm text-muted-foreground mt-1">The value will be encrypted before storage. It will never be visible again.</p>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input type="text" value={newSecret.name} onChange={e => setNewSecret({...newSecret, name: e.target.value})} placeholder="e.g., OpenAI Production Key" className="w-full bg-background border border-border rounded-md px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select value={newSecret.category} onChange={e => setNewSecret({...newSecret, category: e.target.value})} className="w-full bg-background border border-border rounded-md px-3 py-2">
                    <option value="api_key">API Key</option>
                    <option value="token">Token</option>
                    <option value="secret">Secret</option>
                    <option value="credential">Credential</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Provider</label>
                  <input type="text" value={newSecret.provider} onChange={e => setNewSecret({...newSecret, provider: e.target.value})} placeholder="e.g., openai" className="w-full bg-background border border-border rounded-md px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Secret Value</label>
                <input type="password" value={newSecret.value} onChange={e => setNewSecret({...newSecret, value: e.target.value})} placeholder="Enter the secret value" className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono" />
                <p className="text-xs text-muted-foreground mt-1">This value will be encrypted with AES-256-GCM. You will only see a masked version after saving.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <Dialog.Close asChild><Button variant="secondary">Cancel</Button></Dialog.Close>
              <Button onClick={handleAddSecret}><Lock className="w-4 h-4 mr-2" />Encrypt &amp; Store</Button>
            </div>
            <Dialog.Close asChild className="absolute top-4 right-4"><button><X className="w-4 h-4" /></button></Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

// ============================================================
// TOKENS TAB - API Access Token Management (SPEC-004)
// ============================================================
type GeneratedTokenData = { id: string; token: string } | null;

function TokensTab() {
  // Convex queries and mutations
  const tokens = useQuery(api.apiAccessTokens.list, {}) as ApiAccessToken[] | undefined;
  const generateToken = useMutation(api.apiAccessTokens.generate);
  const revokeToken = useMutation(api.apiAccessTokens.revoke);

  // Local state
  const [newTokenName, setNewTokenName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<GeneratedTokenData>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Token masking helper
  const maskToken = (token: string): string => {
    if (token.length <= 12) return token;
    return `${token.slice(0, 8)}...${token.slice(-4)}`;
  };

  // Generate token handler
  const handleGenerate = async () => {
    if (!newTokenName.trim()) {
      setError('Token name is required');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateToken({ name: newTokenName.trim() }) as { id: string; token: string };
      setGeneratedToken({ id: result.id, token: result.token });
      setNewTokenName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate token');
    } finally {
      setIsGenerating(false);
    }
  };

  // Revoke token handler
  const handleRevoke = async (id: Id<"apiAccessTokens">) => {
    if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.')) return;

    try {
      await revokeToken({ id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke token');
    }
  };

  // Copy to clipboard handler
  const handleCopy = async () => {
    if (generatedToken?.token) {
      await navigator.clipboard.writeText(generatedToken.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Dismiss token reveal
  const handleDismiss = () => {
    setGeneratedToken(null);
    setCopied(false);
  };

  return (
    <div className="space-y-6">
      {/* Generate Token Form */}
      <Card>
        <div className="mb-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            API Access Tokens
          </h3>
          <p className="text-muted-foreground mt-1">
            Generate tokens for authenticating API requests to the /v1/chat/completions endpoint.
          </p>
        </div>

        {/* Inline Generate Form */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="Token name (e.g., Production App)"
            className="flex-1 bg-background border border-border rounded-md px-3 py-2"
            disabled={isGenerating}
          />
          <Button onClick={handleGenerate} disabled={isGenerating || !newTokenName.trim()}>
            {isGenerating ? 'Generating...' : 'Generate Token'}
          </Button>
        </div>
        {error && (
          <p className="text-destructive text-sm mt-2">{error}</p>
        )}
      </Card>

      {/* One-time Token Reveal Callout */}
      {generatedToken && (
        <Card className="border-primary bg-primary/5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <h4 className="font-semibold text-foreground">Token Generated Successfully!</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Save this token now — it won't be shown again.
              </p>
              <div className="bg-background border border-border rounded-md p-3 mb-3">
                <code className="text-sm font-mono break-all text-primary">
                  {generatedToken.token}
                </code>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleCopy}>
                  <Copy className="w-4 h-4 mr-2" />
                  {copied ? 'Copied!' : 'Copy Token'}
                </Button>
                <Button variant="primary" onClick={handleDismiss}>
                  Done
                </Button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground ml-4"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </Card>
      )}

      {/* Tokens List */}
      <Card>
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Your Tokens</h3>
          <p className="text-sm text-muted-foreground">
            Active tokens can be used to authenticate API requests.
          </p>
        </div>

        {!tokens || tokens.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <KeyRound className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No tokens generated yet.</p>
            <p className="text-sm">Create a token above to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Token</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Created</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Expires</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={token._id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <span className="font-medium">{token.name}</span>
                    </td>
                    <td className="py-3 px-4">
                      <code className="text-sm font-mono text-muted-foreground">
                        {maskToken(token.token)}
                      </code>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(token.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {token.expiresAt
                        ? new Date(token.expiresAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          token.isActive
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-red-500/10 text-red-500'
                        }`}
                      >
                        {token.isActive ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {token.isActive && (
                        <button
                          onClick={() => handleRevoke(token._id)}
                          className="text-destructive hover:text-destructive/80 text-sm font-medium"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function AdvancedTab() {
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const handleReset = () => {
    console.log("Resetting all settings...");
    // Call mutation to reset settings
    setIsResetModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Configuration Management" description="Export or import your application configuration." />
        <div className="flex space-x-4">
          <Button variant="secondary"><Upload className="w-4 h-4 mr-2" />Import Configuration</Button>
          <Button variant="secondary"><Download className="w-4 h-4 mr-2" />Export Configuration</Button>
        </div>
      </Card>
      <Card className="border-destructive">
        <CardHeader title="Danger Zone" description="These actions are irreversible. Please proceed with caution." />
        <Dialog.Root open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
          <Dialog.Trigger asChild>
            <Button variant="destructive">Reset All Settings</Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-lg p-6 w-[400px] shadow-lg">
              <Dialog.Title className="text-lg font-semibold flex items-center"><AlertTriangle className="w-5 h-5 mr-2 text-destructive"/>Confirm Reset</Dialog.Title>
              <p className="mt-2 text-muted-foreground">Are you sure you want to reset all settings? This will erase all API keys, provider configurations, and general settings. This action cannot be undone.</p>
              <div className="mt-6 flex justify-end space-x-2">
                <Dialog.Close asChild><Button variant="secondary">Cancel</Button></Dialog.Close>
                <Button variant="destructive" onClick={handleReset}>Yes, Reset Everything</Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </Card>
    </div>
  );
}
