import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useEffect, useMemo, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { AlertTriangle, Check, ExternalLink, Key, Plus, Settings, Shield, Trash2, X } from 'lucide-react';
import { useModelCatalog, type ProviderCatalogEntry } from '../lib/model-catalog';

export const Route = createFileRoute('/settings')({ component: SettingsPage });

const LOCAL_SETTINGS_USER = 'local';
const KEY_PREFIXES: Record<string, string> = {
  openai: 'sk-',
  anthropic: 'sk-ant-',
  openrouter: 'sk-or-',
  google: 'AIza',
  xai: 'xai-',
  groq: 'gsk_',
  perplexity: 'pplx-',
};

function SettingsPage() {
  const apiKeys = useQuery(api.apiKeys.list, {}) ?? [];
  const vaultSecrets = useQuery(api.vault.list, {}) ?? [];
  const userSettings = useQuery(api.settings.list, { userId: LOCAL_SETTINGS_USER }) ?? [];
  const createApiKey = useAction(api.apiKeys.create);
  const removeApiKey = useMutation(api.apiKeys.remove);
  const toggleApiKey = useMutation(api.apiKeys.toggleActive);
  const storeVaultSecret = useMutation(api.vault.store);
  const removeVaultSecret = useMutation(api.vault.remove);
  const setSetting = useMutation(api.settings.set);
  const removeSetting = useMutation(api.settings.remove);

  const [tab, setTab] = useState<'providers' | 'vault' | 'general'>('providers');
  const [addingProvider, setAddingProvider] = useState<ProviderCatalogEntry | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [addingVaultSecret, setAddingVaultSecret] = useState(false);
  const [vaultForm, setVaultForm] = useState({ name: '', category: 'api_key', provider: '', value: '' });
  const [defaultModel, setDefaultModel] = useState('');
  const [defaultTemperature, setDefaultTemperature] = useState(0.7);
  const [confirmingDeleteKeyId, setConfirmingDeleteKeyId] = useState<string | null>(null);
  const [confirmingDeleteSecretId, setConfirmingDeleteSecretId] = useState<string | null>(null);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [generalSavedMessage, setGeneralSavedMessage] = useState<string | null>(null);

  const keysByProvider = apiKeys.reduce((acc: Record<string, any[]>, key: any) => {
    if (!acc[key.provider]) acc[key.provider] = [];
    acc[key.provider].push(key);
    return acc;
  }, {} as Record<string, any[]>);

  const { providers, loading: catalogLoading, error: catalogError } = useModelCatalog([
    ...apiKeys.map((key: any) => key.provider),
    ...vaultSecrets.map((secret: any) => secret.provider).filter(Boolean),
  ]);

  const providerEntries = providers;
  const allModels = useMemo(
    () =>
      providers.flatMap((provider) =>
        provider.models.map((model) => ({ provider: provider.id, model })),
      ),
    [providers],
  );

  useEffect(() => {
    const savedDefaultModel = userSettings.find((setting: any) => setting.key === 'defaultModel')?.value;
    const savedDefaultTemperature = userSettings.find((setting: any) => setting.key === 'defaultTemperature')?.value;

    if (typeof savedDefaultModel === 'string') {
      setDefaultModel(savedDefaultModel);
    }
    if (typeof savedDefaultTemperature === 'number') {
      setDefaultTemperature(savedDefaultTemperature);
    }
  }, [userSettings]);

  const handleAddKey = async () => {
    if (!addingProvider || !newKeyValue.trim()) return;

    await createApiKey({
      provider: addingProvider.id,
      keyName: newKeyName || `${addingProvider.name} Key`,
      encryptedKey: newKeyValue,
    });

    setAddingProvider(null);
    setNewKeyName('');
    setNewKeyValue('');
  };

  const handleDeleteKey = async (id: string) => {
    if (confirmingDeleteKeyId === id) {
      await removeApiKey({ id });
      setConfirmingDeleteKeyId(null);
      return;
    }

    setConfirmingDeleteKeyId(id);
  };

  const handleAddVaultSecret = async () => {
    if (!vaultForm.name || !vaultForm.value) return;

    await storeVaultSecret(vaultForm);
    setAddingVaultSecret(false);
    setVaultForm({ name: '', category: 'api_key', provider: '', value: '' });
  };

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);

    try {
      if (defaultModel) {
        await setSetting({
          userId: LOCAL_SETTINGS_USER,
          key: 'defaultModel',
          value: defaultModel,
        });
      } else {
        await removeSetting({
          userId: LOCAL_SETTINGS_USER,
          key: 'defaultModel',
        });
      }

      await setSetting({
        userId: LOCAL_SETTINGS_USER,
        key: 'defaultTemperature',
        value: defaultTemperature,
      });

      setGeneralSavedMessage('General settings saved.');
      setTimeout(() => setGeneralSavedMessage(null), 3000);
    } finally {
      setSavingGeneral(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage AI provider keys, secrets, and workspace configuration.</p>
        </div>

        <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
          <button onClick={() => setTab('providers')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'providers' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Key className="w-4 h-4 inline mr-2" />AI Providers
          </button>
          <button onClick={() => setTab('vault')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'vault' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Shield className="w-4 h-4 inline mr-2" />Secure Vault
          </button>
          <button onClick={() => setTab('general')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'general' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Settings className="w-4 h-4 inline mr-2" />General
          </button>
        </div>

        {catalogError && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Provider catalog unavailable. Start the daemon to load the latest providers and models.
          </div>
        )}

        {tab === 'providers' && (
          <div className="space-y-6">
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-foreground font-medium">API keys are stored encrypted in Convex</p>
                <p className="text-xs text-muted-foreground mt-1">Keys are encrypted at rest and only decrypted when making API calls. You can also manage keys via the CLI with <code className="bg-muted px-1 rounded">agentforge vault set</code>.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providerEntries.map((provider) => {
                const keys = keysByProvider[provider.id] || [];
                const hasKey = keys.length > 0;
                const keyPrefix = KEY_PREFIXES[provider.id] ?? '';

                return (
                  <div key={provider.id} className={`bg-card border rounded-lg p-5 shadow-sm ${hasKey ? 'border-green-700/30' : 'border-border'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${provider.colorClass ?? 'bg-slate-500'}`} />
                        <div>
                          <h3 className="font-semibold text-foreground">{provider.name}</h3>
                          <p className="text-xs text-muted-foreground">{provider.description ?? 'Provider metadata loaded from the daemon catalog.'}</p>
                        </div>
                      </div>
                      {provider.docsUrl && (
                        <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                          Docs <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {keys.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {keys.map((key: any) => (
                          <div key={key._id} className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border border-border">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-2 h-2 rounded-full ${key.isActive ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                              <span className="text-sm truncate">{key.keyName}</span>
                              <span className="text-xs font-mono text-muted-foreground">••••••••</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => toggleApiKey({ id: key._id })} className="p-1 rounded hover:bg-muted">
                                {key.isActive ? <Check className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-muted-foreground" />}
                              </button>
                              <button onClick={() => handleDeleteKey(key._id)} className="p-1 rounded hover:bg-destructive/10">
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button onClick={() => { setAddingProvider(provider); setNewKeyName(`${provider.name} Key`); setNewKeyValue(''); }} className={`w-full px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-2 ${hasKey ? 'bg-muted text-muted-foreground hover:text-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                      <Plus className="w-4 h-4" /> {hasKey ? 'Add Another Key' : 'Add API Key'}
                    </button>
                    {keyPrefix && <p className="mt-2 text-xs text-muted-foreground">Expected prefix: <code className="bg-muted px-1 rounded">{keyPrefix}</code></p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'vault' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Encrypted secrets stored in the Secure Vault. Secrets detected in chat are automatically stored here.</p>
              <button onClick={() => setAddingVaultSecret(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:bg-primary/90 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Secret
              </button>
            </div>

            {vaultSecrets.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border rounded-lg">
                <Shield className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Vault is empty</h3>
                <p className="text-muted-foreground">Secrets will appear here when detected in chat or added manually.</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Provider</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Value</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vaultSecrets.map((secret: any) => (
                      <tr key={secret._id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{secret.name}</td>
                        <td className="px-4 py-3"><span className="text-xs bg-muted px-2 py-0.5 rounded">{secret.category}</span></td>
                        <td className="px-4 py-3 text-muted-foreground">{secret.provider || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{secret.maskedValue}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(secret.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              if (confirmingDeleteSecretId === secret._id) {
                                removeVaultSecret({ id: secret._id });
                                setConfirmingDeleteSecretId(null);
                              } else {
                                setConfirmingDeleteSecretId(secret._id);
                              }
                            }}
                            className={`p-1.5 rounded transition-colors ${confirmingDeleteSecretId === secret._id ? 'bg-destructive/20 text-destructive' : 'hover:bg-destructive/10 text-muted-foreground'}`}
                            title={confirmingDeleteSecretId === secret._id ? 'Click to confirm delete' : 'Delete secret'}
                          >
                            {confirmingDeleteSecretId === secret._id ? <span className="text-xs font-medium px-1">Confirm?</span> : <Trash2 className="w-4 h-4 text-destructive" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'general' && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Workspace Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Default Model</label>
                  <select
                    value={defaultModel}
                    onChange={(event) => setDefaultModel(event.target.value)}
                    className="w-full max-w-sm bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">None (use agent default)</option>
                    {allModels.map(({ provider, model }) => (
                      <option key={`${provider}/${model}`} value={`${provider}/${model}`}>
                        {model} ({provider})
                      </option>
                    ))}
                    {catalogLoading && <option value="" disabled>Loading models…</option>}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Used when creating new agents without specifying a model.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Default Temperature</label>
                  <input
                    type="number"
                    value={defaultTemperature}
                    onChange={(event) => setDefaultTemperature(parseFloat(event.target.value) || 0)}
                    step={0.1}
                    min={0}
                    max={2}
                    className="w-full max-w-sm bg-background border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={handleSaveGeneral} disabled={savingGeneral} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {savingGeneral ? 'Saving…' : 'Save General Settings'}
                  </button>
                  {generalSavedMessage && <span className="text-sm text-green-400">{generalSavedMessage}</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {addingProvider && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md">
              <div className="flex justify-between items-center p-4 border-b border-border">
                <h2 className="text-lg font-bold">Add {addingProvider.name} API Key</h2>
                <button onClick={() => setAddingProvider(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Key Name</label>
                  <input type="text" value={newKeyName} onChange={(event) => setNewKeyName(event.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" placeholder="e.g. Production Key" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium">API Key</label>
                    {addingProvider.docsUrl && (
                      <a href={addingProvider.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">Docs <ExternalLink className="w-3 h-3" /></a>
                    )}
                  </div>
                  <input type="password" value={newKeyValue} onChange={(event) => setNewKeyValue(event.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono" placeholder={`${KEY_PREFIXES[addingProvider.id] ?? ''}xxxxxxxxxxxxxxxxxxxx`} />
                </div>
                {newKeyValue && KEY_PREFIXES[addingProvider.id] && !newKeyValue.startsWith(KEY_PREFIXES[addingProvider.id]!) && (
                  <p className="text-xs text-yellow-500 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Key should start with "{KEY_PREFIXES[addingProvider.id]}"</p>
                )}
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <button onClick={() => setAddingProvider(null)} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm">Cancel</button>
                <button onClick={handleAddKey} disabled={!newKeyValue.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                  <Key className="w-4 h-4" /> Save Key
                </button>
              </div>
            </div>
          </div>
        )}

        {addingVaultSecret && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md">
              <div className="flex justify-between items-center p-4 border-b border-border">
                <h2 className="text-lg font-bold">Add Secret to Vault</h2>
                <button onClick={() => setAddingVaultSecret(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input type="text" value={vaultForm.name} onChange={(event) => setVaultForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" placeholder="e.g. Database Password" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <select value={vaultForm.category} onChange={(event) => setVaultForm((prev) => ({ ...prev, category: event.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm">
                      <option value="api_key">API Key</option>
                      <option value="token">Token</option>
                      <option value="credential">Credential</option>
                      <option value="certificate">Certificate</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Provider</label>
                    <input type="text" value={vaultForm.provider} onChange={(event) => setVaultForm((prev) => ({ ...prev, provider: event.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" placeholder="e.g. aws" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Secret Value</label>
                  <input type="password" value={vaultForm.value} onChange={(event) => setVaultForm((prev) => ({ ...prev, value: event.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono" placeholder="Enter the secret value" />
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <button onClick={() => setAddingVaultSecret(false)} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm">Cancel</button>
                <button onClick={handleAddVaultSecret} disabled={!vaultForm.name || !vaultForm.value} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Store Secret
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
