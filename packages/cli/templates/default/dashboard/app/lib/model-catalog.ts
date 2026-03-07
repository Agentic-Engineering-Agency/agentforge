import { useEffect, useMemo, useState } from 'react';

export interface ProviderCatalogEntry {
  id: string;
  name: string;
  docsUrl?: string;
  colorClass?: string;
  description?: string;
  models: string[];
}

interface ModelCatalogResponse {
  providers: ProviderCatalogEntry[];
}

function titleCase(value: string): string {
  return value
    .split(/[-_/]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildFallbackProviders(ids: string[]): ProviderCatalogEntry[] {
  return ids
    .filter(Boolean)
    .filter((id, index, list) => list.indexOf(id) === index)
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({
      id,
      name: titleCase(id),
      colorClass: 'bg-slate-500',
      models: [],
    }));
}

export function useModelCatalog(fallbackProviderIds: string[] = []) {
  const fallbackKey = fallbackProviderIds.filter(Boolean).sort().join('|');
  const [providers, setProviders] = useState<ProviderCatalogEntry[]>(() => buildFallbackProviders(fallbackProviderIds));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const daemonUrl: string = (window as any).__AGENTFORGE_DAEMON_URL__ ?? 'http://localhost:3001';

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${daemonUrl}/api/models`, {
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((data: ModelCatalogResponse) => {
        if (Array.isArray(data.providers) && data.providers.length > 0) {
          setProviders(data.providers);
          setError(null);
          return;
        }

        throw new Error('No providers returned by daemon');
      })
      .catch((fetchError) => {
        if (controller.signal.aborted) {
          return;
        }

        setProviders((existing) => existing.length > 0 ? existing : buildFallbackProviders(fallbackProviderIds));
        setError(fetchError instanceof Error ? fetchError.message : 'Unable to load provider catalog');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [daemonUrl, fallbackKey]);

  const providersById = useMemo(
    () => new Map(providers.map((provider) => [provider.id, provider])),
    [providers],
  );

  const providerIds = useMemo(
    () => providers.map((provider) => provider.id),
    [providers],
  );

  const modelsByProvider = useMemo(
    () =>
      Object.fromEntries(
        providers.map((provider) => [provider.id, provider.models]),
      ) as Record<string, string[]>,
    [providers],
  );

  return {
    daemonUrl,
    error,
    loading,
    modelsByProvider,
    providerIds,
    providers,
    providersById,
  };
}
