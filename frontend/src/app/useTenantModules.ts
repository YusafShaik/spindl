import { useEffect, useState } from 'react';
import { API, apiFetch } from '../lib/api/client';

interface TenantModuleAccess { code: string; enabled: boolean; entitled: boolean; }
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isTenantModule(value: unknown): value is TenantModuleAccess { return isRecord(value) && typeof value.code === 'string' && typeof value.enabled === 'boolean' && typeof value.entitled === 'boolean'; }

export function useTenantModules(session: unknown): { enabledModules: string[] | null; setEnabledModules: (modules: string[] | null) => void } {
  const [enabledModules, setEnabledModules] = useState<string[] | null>(null);
  useEffect(() => {
    if (!session) { setEnabledModules(null); return; }
    let current = true;
    void apiFetch(`${API}/tenant/modules`).then(async (response) => {
      if (!response.ok) throw new Error('Could not load workspace modules');
      const result: unknown = await response.json();
      if (!Array.isArray(result) || !result.every(isTenantModule)) throw new Error('Invalid workspace modules response');
      if (current) setEnabledModules(result.filter((module) => module.enabled && module.entitled).map((module) => module.code));
    }).catch(() => { if (current) setEnabledModules(null); });
    return () => { current = false; };
  }, [session]);
  return { enabledModules, setEnabledModules };
}
