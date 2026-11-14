import { useEffect, useState } from 'react';
import { API, apiFetch } from '../lib/api/client';
import type { ManufacturingBom, WorkCenter, WorkOrder } from '../features/manufacturing/ManufacturingPanel';

function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isBom(value: unknown): value is ManufacturingBom { return isRecord(value) && typeof value.id === 'string' && typeof value.finishedItemId === 'string' && typeof value.revision === 'string' && Array.isArray(value.lines) && Array.isArray(value.operations); }
function isWorkOrder(value: unknown): value is WorkOrder { return isRecord(value) && typeof value.id === 'string' && typeof value.orderNumber === 'string' && typeof value.status === 'string' && Array.isArray(value.materials) && Array.isArray(value.operations); }
function isWorkCenter(value: unknown): value is WorkCenter { return isRecord(value) && typeof value.id === 'string' && typeof value.code === 'string' && typeof value.name === 'string' && typeof value.active === 'boolean'; }
function messageFrom(error: unknown): string { return error instanceof Error ? error.message : String(error); }
async function loadRows<T>(path: string, validate: (value: unknown) => value is T, label: string): Promise<T[]> {
  const response = await apiFetch(`${API}${path}`);
  if (!response.ok) throw new Error(`Could not load ${label}`);
  const value: unknown = await response.json();
  if (!Array.isArray(value) || !value.every(validate)) throw new Error(`Invalid ${label} response`);
  return value;
}

export function useProductionData(section: string, session: unknown, notify: (message: string) => void) {
  const [boms, setBoms] = useState<ManufacturingBom[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [productionLoading, setProductionLoading] = useState(false);
  const reloadProduction = async (): Promise<void> => {
    const [bomData, workOrderData, centerData] = await Promise.all([
      loadRows('/boms', isBom, 'BOMs'), loadRows('/work-orders', isWorkOrder, 'work orders'), loadRows('/work-centers', isWorkCenter, 'work centers'),
    ]);
    setBoms(bomData); setWorkOrders(workOrderData); setWorkCenters(centerData);
  };
  useEffect(() => {
    if (section !== 'Production' || !session) return;
    let current = true;
    setProductionLoading(true);
    void reloadProduction().catch((error: unknown) => { if (current) notify(messageFrom(error)); }).finally(() => { if (current) setProductionLoading(false); });
    return () => { current = false; };
  }, [section, session]);
  return { boms, workOrders, workCenters, productionLoading, reloadProduction };
}
