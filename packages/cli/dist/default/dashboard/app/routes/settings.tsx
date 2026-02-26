import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Key, Plus, Trash2, Eye, EyeOff, Check, X, Shield, AlertTriangle, ExternalLink, Settings } from 'lucide-react';

export const Route = createFileRoute('/settings')({ component: SettingsPage });

// ─── AI Provider Definitions ─────────────────────────────────────
const AI_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4.1 Mini, DALL-E, Whisper',
    prefix: 'sk-',
    docsUrl: 'https://platform.openai.com/api-keys',
    color: 'bg-green-500',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Opus',
    prefix: 'sk-ant-',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    color: 'bg-orange-500',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Multi-model routing — access 200+ models through one API',
    prefix: 'sk-or-',
    docsUrl: 'https://openrouter.ai/keys',
    color: 'bg-purple-500',
  },
  {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini 2.5 Flash, Gemini 1.5 Pro',
    prefix: 'AIza',
    docsUrl: 'https://aistudio.google.com/apikey',
    color: 'bg-blue-500',
  },
  {
    id: 'xai',
    name: 'xAI',
    description: 'Grok 4, Grok 3',
    prefix: 'xai-',
    docsUrl: 'https://console.x.ai/',
    color: 'bg-gray-500',
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast inference — Llama, Mixtral, Gemma',
    prefix: 'gsk_',
    docsUrl: 'https://console.groq.com/keys',
    color: 'bg-red-500',
  },
  {
    id: 'together',
    name: 'Together AI',
    description: 'Open-source models — Llama, Mistral, Code Llama',
    prefix: '',
    docsUrl: 'https://api.together.xyz/settings/api-keys',
    color: 'bg-indigo-500',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    description: 'Sonar — real-time web-grounded AI search',
    prefix: 'pplx-',
    docsUrl: 'https://www.perplexity.ai/settings/api',
    color: 'bg-teal-500',
  },
];

function SettingsPage() {
  const apiKeys = useQuery(api.apiKeys.list, {}) ?? [];
  const vaultSecrets = useQuery(api.vault.list, {}) ?? [];
  const createApiKey = useMutation(api.apiKeys.create);
  const removeApiKey = useMutation(api.apiKeys.remove);
  const toggleApiKey = useMutation(api.apiKeys.toggleActive);
  const storeVaultSecret = useMutation(api.vault.store);
  const removeVaultSecret = useMutation(api.vault.remove);

  const [tab, setTab] = useState<'providers' | 'vault' | 'general'>('providers');
  const [addingProvider, setAddingProvider] = useState<typeof AI_PROVIDERS[0] | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [addingVaultSecret, setAddingVaultSecret] = useState(false);
  const [vaultForm, setVaultForm] = useState({ name: '', category: 'api_key', provider: '', value: '' });
  const [confirmingDeleteKeyId, setConfirmingDeleteKeyId] = useState<string | null>(null);
  const [confirmingDeleteSecretId, setConfirmingDeleteSecretId] = useState<string | null>(null);

  const keysByProvider = apiKeys.reduce((acc: Record<string, any[]>, key: any) => {
    if (!acc[key.provider]) acc[key.provider] = [];
    acc[key.provider].push(key);
    return acc;
  }, {} as Record<string, any[]>);

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
    } else {
      setConfirmingDeleteKeyId(id);
    }
  };

  const handleAddVaultSecret = async () => {
    if (!vaultForm.name || !vaultForm.value) return;
    await storeVaultSecret(vaultForm);
    setAddingVaultSecret(false);
    setVaultForm({ name: '', category: 'api_key', provider: '', value: '' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage AI provider keys, secrets, and workspace configuration.</p>
        </div>

        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
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

        {/* AI Providers Tab */}
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
              {AI_PROVIDERS.map(provider => {
                const keys = keysByProvider[provider.id] || [];
                const hasKey = keys.length > 0;
                return (
                  <div key={provider.id} className={`bg-card border rounded-lg p-5 shadow-sm ${hasKey ? 'border-green-700/30' : 'border-border'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${provider.color}`} />
                        <div>
                          <h3 className="font-semibold text-foreground">{provider.name}</h3>
                          <p className="text-xs text-muted-foreground">{provider.description}</p>
                        </div>
                      </div>
                      <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                        Get Key <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {keys.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {keys.map((key: any) => (
                          <div key={key._id} className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border border-border">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-2 h-2 rounded-full ${key.isActive ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                              <span className="text-sm truncate">{key.keyName}</span>
                              <span className="text-xs font-mono text-muted-foreground">
                                {showKey[key._id] ? key.encryptedKey : key.encryptedKey.substring(0, 8) + '...'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => setShowKey(prev => ({ ...prev, [key._id]: !prev[key._id] }))} className="p-1 rounded hover:bg-muted">
                                {showKey[key._id] ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                              </button>
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
                    ) : null}

                    <button onClick={() => { setAddingProvider(provider); setNewKeyName(`${provider.name} Key`); setNewKeyValue(''); }} className={`w-full px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-2 ${hasKey ? 'bg-muted text-muted-foreground hover:text-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                      <Plus className="w-4 h-4" /> {hasKey ? 'Add Another Key' : 'Add API Key'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Vault Tab */}
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

        {/* General Tab */}
        {tab === 'general' && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Workspace Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Default Model</label>
                  <select className="w-full max-w-sm bg-background border border-border rounded-md px-3 py-2 text-sm">
                    <option value="gpt-4.1-mini">gpt-4.1-mini (OpenAI)</option>
                    <option value="claude-3.5-sonnet">claude-3.5-sonnet (Anthropic)</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash (Google)</option>
                    <option value="openrouter/auto">auto (OpenRouter)</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Used when creating new agents without specifying a model.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Default Temperature</label>
                  <input type="number" defaultValue={0.7} step={0.1} min={0} max={2} className="w-full max-w-sm bg-background border border-border rounded-md px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Key Modal */}
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
                  <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" placeholder="e.g. Production Key" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium">API Key</label>
                    <a href={addingProvider.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">Get key <ExternalLink className="w-3 h-3" /></a>
                  </div>
                  <input type="password" value={newKeyValue} onChange={(e) => setNewKeyValue(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono" placeholder={`${addingProvider.prefix}xxxxxxxxxxxxxxxxxxxx`} />
                </div>
                {newKeyValue && !newKeyValue.startsWith(addingProvider.prefix) && addingProvider.prefix && (
                  <p className="text-xs text-yellow-500 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Key should start with "{addingProvider.prefix}"</p>
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

        {/* Add Vault Secret Modal */}
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
                  <input type="text" value={vaultForm.name} onChange={(e) => setVaultForm(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" placeholder="e.g. Database Password" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <select value={vaultForm.category} onChange={(e) => setVaultForm(prev => ({ ...prev, category: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm">
                      <option value="api_key">API Key</option>
                      <option value="token">Token</option>
                      <option value="credential">Credential</option>
                      <option value="certificate">Certificate</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Provider</label>
                    <input type="text" value={vaultForm.provider} onChange={(e) => setVaultForm(prev => ({ ...prev, provider: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" placeholder="e.g. aws" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Secret Value</label>
                  <input type="password" value={vaultForm.value} onChange={(e) => setVaultForm(prev => ({ ...prev, value: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono" placeholder="Enter the secret value" />
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
