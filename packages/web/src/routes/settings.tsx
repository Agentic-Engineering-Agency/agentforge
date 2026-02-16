import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '~/components/DashboardLayout';
import React, { useState } from 'react';
// import { useQuery, useMutation } from "convex/react";
// import { api } from "../../convex/_generated/api";

import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import * as Switch from '@radix-ui/react-switch';
import { Settings, Key, Palette, Shield, Download, Upload, AlertTriangle, X, Plus, Trash2, ChevronDown } from 'lucide-react';

// Mock data and types
const AVAILABLE_PROVIDERS = ["OpenAI", "Anthropic", "OpenRouter", "Google", "xAI"];

type ApiKey = { id: string; provider: string; maskedKey: string; createdAt: string };
type ProviderSetting = { id: string; name: string; enabled: boolean };

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
            <TabTrigger value="advanced" icon={<AlertTriangle />}>Advanced</TabTrigger>
          </Tabs.List>

          <Tabs.Content value="general"><GeneralTab settings={generalSettings} setSettings={setGeneralSettings} /></Tabs.Content>
          <Tabs.Content value="apiKeys"><ApiKeysTab keys={apiKeys} onAdd={handleAddApiKey} onDelete={handleDeleteApiKey} /></Tabs.Content>
          <Tabs.Content value="providers"><ProvidersTab providers={providerSettings} defaultProvider={defaultProvider} onToggle={handleProviderToggle} onSetDefault={handleSetDefaultProvider} /></Tabs.Content>
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
  const [isSaving, setIsSaving] = useState(false);
  const handleSave = () => {
    setIsSaving(true);
    // updateSettings(settings);
    setTimeout(() => setIsSaving(false), 1000);
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
