import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  CreditCard,
  DollarSign,
  Download,
  Filter,
  LayoutGrid,
  LayoutList,
  Monitor,
  Package,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sliders,
  Store,
  Tag,
  Trash2,
  User,
  Users,
  Warehouse as WarehouseIcon,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency } from '../../lib/utils/currency';
import { Status } from '../../components/ui/Status';
import type { ItemSummary, WarehouseSummary } from '../../types/inventory';

export interface PosItem extends ItemSummary {
  active?: boolean;
  qualityInspectionRequired?: boolean;
  barcode?: string | null;
}

export interface PosCustomer {
  id: string;
  name: string;
  active?: boolean;
}

export interface PosRegister {
  id: string;
  code: string;
  name: string;
  warehouseId?: string;
  warehouseCode?: string;
  warehouseName: string;
  branchId?: string;
  assignedCashierUserId?: string;
}

export interface PosSession {
  id: string;
  status: 'OPEN' | 'CLOSED' | string;
  cashierUserId: string;
  branchId: string | null;
  registerId?: string;
  registerCode: string;
  registerName: string;
  warehouseName: string;
  openedAt: string;
  closedAt?: string | null;
  openingFloat: number;
  expectedCash?: number | null;
  countedCash?: number | null;
  cashVariance?: number | null;
}

export interface PosCashier {
  userId: string;
  name: string;
  email: string;
  role: string;
}

export interface PosTax {
  taxCode: string;
  taxRate: number;
}

export interface BasketLine {
  itemId: string;
  quantity: number;
  unitPriceOverride: string | number;
  discountPercent: string | number;
}

export interface PosSaleLine {
  saleLineId: string;
  sku: string;
  itemName: string;
  quantity: number;
  unitPrice: number | string;
  total: number;
  subtotal?: number;
  taxTotal?: number;
  listUnitPrice?: number;
  discountPercent?: number;
  refundableQuantity: number;
  refundedQuantity: number;
  refundedSubtotal: number;
  refundedTaxTotal: number;
}

export interface PosTender {
  method: string;
  amount?: number;
  reference?: string | null;
}

export interface PosSale {
  id: string;
  sessionId: string;
  receiptNumber: string;
  postedAt: string;
  status: 'POSTED' | 'VOIDED' | 'REFUNDED' | 'PARTIAL_REFUND' | string;
  total: number;
  subtotal?: number;
  taxTotal?: number;
  taxCode?: string;
  taxRate: number;
  refundedTotal: number;
  refundedSubtotal?: number;
  customerId?: string | null;
  lines: PosSaleLine[];
  tenders: PosTender[];
}

export interface PosReceipt {
  receiptNumber: string;
  postedAt: string;
  total: number;
  subtotal?: number;
  taxCode?: string;
  taxRate?: number;
  taxTotal?: number;
  customerName?: string;
  cashierName?: string;
  registerCode?: string;
  warehouseName?: string;
  lines: Array<{
    sku: string;
    itemName: string;
    quantity: number;
    unitPrice?: number;
    total: number;
  }>;
  tenders?: Array<{
    method: string;
    amount?: number;
    reference?: string | null;
  }>;
}

export interface CheckoutLine {
  itemId: string;
  quantity: number;
  unitPriceOverride: number | null;
  discountPercent: number;
}

export interface PendingCheckout {
  sessionId: string;
  idempotencyKey: string;
  createdAt: number;
  payload: {
    customerId: string | null;
    lines: CheckoutLine[];
    tenders: Array<{ method: string; amount: number; reference?: string | null }>;
  };
}

export interface PosPanelProps {
  items: PosItem[];
  customers: PosCustomer[];
  role?: string;
  userId?: string;
  notify: (message: string) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCheckoutLine(value: unknown): value is CheckoutLine {
  return (
    isRecord(value) &&
    typeof value.itemId === 'string' &&
    typeof value.quantity === 'number' &&
    (typeof value.unitPriceOverride === 'number' || value.unitPriceOverride === null) &&
    typeof value.discountPercent === 'number'
  );
}

function isCheckoutTender(value: unknown): value is { method: string; amount: number; reference?: string | null } {
  return isRecord(value) && typeof value.method === 'string' && typeof value.amount === 'number';
}

function isPendingCheckout(value: unknown): value is PendingCheckout {
  if (!isRecord(value) || !isRecord(value.payload)) return false;
  const payload = value.payload;
  return (
    typeof value.sessionId === 'string' &&
    typeof value.idempotencyKey === 'string' &&
    typeof value.createdAt === 'number' &&
    (typeof payload.customerId === 'string' || payload.customerId === null) &&
    Array.isArray(payload.lines) &&
    payload.lines.every(isCheckoutLine) &&
    Array.isArray(payload.tenders) &&
    payload.tenders.every(isCheckoutTender)
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function posPendingCheckoutKey(userId: string | undefined): string {
  try {
    const session: unknown = JSON.parse(localStorage.getItem('spindl.session') || '{}');
    const tenantId = isRecord(session) && typeof session.tenantId === 'string' ? session.tenantId : 'unknown';
    return `spindl.pos.pending-checkout.${tenantId}.${userId || 'unknown'}`;
  } catch {
    return `spindl.pos.pending-checkout.unknown.${userId || 'unknown'}`;
  }
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const content = [
    headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
    )
  ].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
  } catch {
    return dateStr;
  }
}

export function PosPanel({ items, customers, role, userId, notify }: PosPanelProps) {
  // Navigation & Data States
  const [activeTab, setActiveTab] = useState<'terminal' | 'receipts'>('terminal');
  const [registers, setRegisters] = useState<PosRegister[]>([]);
  const [sessions, setSessions] = useState<PosSession[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [salesHistory, setSalesHistory] = useState<PosSale[]>([]);
  const [refundKeys, setRefundKeys] = useState<Record<string, string>>({});
  const [tax, setTax] = useState<PosTax>({ taxCode: 'NONE', taxRate: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Terminal & Checkout States
  const [registerId, setRegisterId] = useState<string>('');
  const [currentSession, setCurrentSession] = useState<PosSession | null>(null);
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [tenderMethod, setTenderMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'OTHER'>('CASH');
  const [tenderReference, setTenderReference] = useState<string>('');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [catalogueView, setCatalogueView] = useState<'grid' | 'table'>('grid');
  const [productSearch, setProductSearch] = useState<string>('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('ALL');
  const [productInStockOnly, setProductInStockOnly] = useState(false);
  const [receiptModal, setReceiptModal] = useState<PosReceipt | null>(null);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [editingBasketLineId, setEditingBasketLineId] = useState<string | null>(null);
  const activeRegister = registers.find((r) => r.id === registerId) || registers[0] || null;

  // Search & Filters for Receipts
  const [receiptSearch, setReceiptSearch] = useState<string>('');
  const [receiptStatusFilter, setReceiptStatusFilter] = useState<'ALL' | 'POSTED' | 'VOIDED' | 'REFUNDED' | 'PARTIAL_REFUND'>('ALL');

  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundTargetSale, setRefundTargetSale] = useState<PosSale | null>(null);
  const [refundReason, setRefundReason] = useState('Customer return');
  const [refundSessionDrawerId, setRefundSessionDrawerId] = useState('');
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'OTHER'>('CASH');
  const [refundReference, setRefundReference] = useState('');
  const [refundQtys, setRefundQtys] = useState<Record<string, number>>({});
  const [refundDispositions, setRefundDispositions] = useState<Record<string, string>>({});

  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckout | null>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(posPendingCheckoutKey(userId)) || 'null');
      return isPendingCheckout(value) ? value : null;
    } catch {
      return null;
    }
  });

  const checkoutInFlight = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const manager = ['OWNER', 'ADMIN', 'MANAGER'].includes(role ?? '');

  // Sales history loader
  const loadSales = async (): Promise<void> => {
    try {
      const response = await apiFetch(`${API}/pos/sales`);
      setSalesHistory(response.ok ? await response.json() : []);
    } catch {
      setSalesHistory([]);
    }
  };

  // Main refresh routine
  const refresh = async (): Promise<void> => {
    setLoading(true);
    try {
      const [registerRows, sessionRows, warehouseRows, taxSettings]: [
        PosRegister[],
        PosSession[],
        WarehouseSummary[],
        PosTax
      ] = await Promise.all([
        apiFetch(`${API}/pos/registers`).then((res) => (res.ok ? res.json() : Promise.reject())),
        apiFetch(`${API}/pos/sessions`).then((res) => (res.ok ? res.json() : Promise.reject())),
        apiFetch(`${API}/inventory/warehouses`).then((res) => (res.ok ? res.json() : Promise.reject())),
        apiFetch(`${API}/pos/settings`).then((res) => (res.ok ? res.json() : Promise.reject()))
      ]);

      setRegisters(registerRows);
      setSessions(sessionRows);
      setWarehouses(warehouseRows);
      setTax(taxSettings);

      const mine = sessionRows.find((row) => row.status === 'OPEN' && row.cashierUserId === userId);
      setCurrentSession(mine || null);

      const defaultReg = registerRows.some((r) => r.id === registerId)
        ? registerId
        : (mine?.registerId || registerRows[0]?.id || '');
      setRegisterId(defaultReg);

      await loadSales();
    } catch {
      notify('Could not load point-of-sale data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Basket calculations
  const posUnitPrice = (line: BasketLine): number => {
    const item = items.find((row) => row.id === line.itemId);
    const listPrice =
      line.unitPriceOverride !== '' && line.unitPriceOverride !== undefined
        ? Number(line.unitPriceOverride)
        : Number(item?.unitPrice || 0);
    const discount = Number(line.discountPercent || 0);
    return Math.round(listPrice * (1 - discount / 100) * 100) / 100;
  };

  const due = useMemo(() => {
    return basket.reduce((total, line) => total + posUnitPrice(line) * line.quantity, 0);
  }, [basket, items]);

  const taxAmount = useMemo(() => {
    return basket.reduce(
      (sum, line) => sum + Math.round(posUnitPrice(line) * line.quantity * Number(tax.taxRate || 0)) / 100,
      0
    );
  }, [basket, items, tax.taxRate]);

  const totalDue = useMemo(() => {
    return Math.round((due + taxAmount) * 100) / 100;
  }, [due, taxAmount]);

  // Product Catalogue filters & categorization
  const sellableProducts = useMemo(() => {
    return items.filter(
      (item) =>
        item.active !== false &&
        item.unitPrice !== undefined &&
        item.unitPrice !== null &&
        Number(item.unitPrice) > 0
    );
  }, [items]);

  const availableCategories = useMemo(() => {
    const catMap = new Map<string, number>();
    sellableProducts.forEach((item) => {
      const cat =
        item.category ||
        (item.itemType === 'SERVICE'
          ? 'Services'
          : item.itemType === 'FINISHED'
          ? 'Finished Goods'
          : item.itemType === 'RAW'
          ? 'Raw Materials'
          : item.itemType === 'WIP'
          ? 'Sub-Assemblies'
          : 'General');
      catMap.set(cat, (catMap.get(cat) || 0) + 1);
    });
    return [
      { id: 'ALL', label: 'All Items', count: sellableProducts.length },
      ...Array.from(catMap.entries()).map(([id, count]) => ({ id, label: id, count }))
    ];
  }, [sellableProducts]);

  const filteredProducts = useMemo(() => {
    let result = sellableProducts;
    if (productCategoryFilter !== 'ALL') {
      result = result.filter((item) => {
        const cat =
          item.category ||
          (item.itemType === 'SERVICE'
            ? 'Services'
            : item.itemType === 'FINISHED'
            ? 'Finished Goods'
            : item.itemType === 'RAW'
            ? 'Raw Materials'
            : item.itemType === 'WIP'
            ? 'Sub-Assemblies'
            : 'General');
        return cat === productCategoryFilter || item.itemType === productCategoryFilter;
      });
    }
    if (productInStockOnly) {
      result = result.filter((item) => item.itemType === 'SERVICE' || (item.available ?? item.stock ?? 0) > 0);
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.barcode && item.barcode.toLowerCase().includes(q))
      );
    }
    return result;
  }, [sellableProducts, productCategoryFilter, productInStockOnly, productSearch]);

  // Cash Tender & Quick Change Calculations
  const numericCashTendered = useMemo(() => {
    const parsed = parseFloat(cashTendered);
    return isNaN(parsed) ? 0 : parsed;
  }, [cashTendered]);

  const changeDue = useMemo(() => {
    if (tenderMethod !== 'CASH' || !numericCashTendered || numericCashTendered < totalDue) return 0;
    return Math.round((numericCashTendered - totalDue) * 100) / 100;
  }, [tenderMethod, numericCashTendered, totalDue]);

  const quickCashOptions = useMemo(() => {
    if (totalDue <= 0) return [];
    const opts: number[] = [totalDue]; // Exact
    const roundSteps = [100, 500, 1000, 2000, 5000];
    for (const step of roundSteps) {
      const rounded = Math.ceil(totalDue / step) * step;
      if (rounded > totalDue && !opts.includes(rounded)) {
        opts.push(rounded);
      }
      if (opts.length >= 4) break;
    }
    return opts;
  }, [totalDue]);

  // Basket actions
  const addProduct = (item: PosItem): void => {
    setBasket((rows) => {
      const existing = rows.find((line) => line.itemId === item.id);
      if (existing) {
        return rows.map((line) =>
          line.itemId === item.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...rows, { itemId: item.id, quantity: 1, unitPriceOverride: '', discountPercent: 0 }];
    });
  };

  const updateBasketQuantity = (itemId: string, delta: number): void => {
    setBasket((rows) => {
      return rows
        .map((line) => {
          if (line.itemId === itemId) {
            const nextQty = line.quantity + delta;
            return nextQty > 0 ? { ...line, quantity: nextQty } : null;
          }
          return line;
        })
        .filter((l): l is BasketLine => l !== null);
    });
  };

  const removeBasketLine = (itemId: string): void => {
    setBasket((rows) => rows.filter((line) => line.itemId !== itemId));
  };

  const clearBasket = (): void => {
    setBasket([]);
    setEditingBasketLineId(null);
    setCashTendered('');
  };

  // Barcode Scan Handler
  const handleProductScan = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return;
    const scanned = productSearch.trim().toLowerCase();
    if (!scanned) return;
    const match = sellableProducts.find(
      (item) =>
        (item.barcode && item.barcode.trim().toLowerCase() === scanned) ||
        item.sku.toLowerCase() === scanned
    );
    if (match) {
      event.preventDefault();
      addProduct(match);
      setProductSearch('');
      notify(`Added "${match.name}" to basket`);
    }
  };

  // Post Checkout
  const postCheckout = async (intent: PendingCheckout): Promise<boolean> => {
    if (checkoutInFlight.current) return false;
    checkoutInFlight.current = true;
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/pos/sessions/${intent.sessionId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...intent.payload, idempotencyKey: intent.idempotencyKey })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status >= 400 && response.status < 500 && ![401, 409, 429].includes(response.status)) {
          localStorage.removeItem(posPendingCheckoutKey(userId));
          setPendingCheckout(null);
        }
        throw new Error(body.detail || 'Checkout could not be posted');
      }

      const saved = await response.json();
      localStorage.removeItem(posPendingCheckoutKey(userId));
      setPendingCheckout(null);

      const custObj = customers.find((c) => c.id === intent.payload.customerId);
      const receiptData: PosReceipt = {
        receiptNumber: saved.receiptNumber,
        postedAt: saved.postedAt || new Date().toISOString(),
        total: saved.total,
        subtotal: saved.subtotal,
        taxCode: saved.taxCode || tax.taxCode,
        taxRate: saved.taxRate || tax.taxRate,
        taxTotal: saved.taxTotal,
        customerName: custObj?.name || 'Walk-in Customer',
        cashierName: currentSession?.cashierUserId === userId ? 'Current Cashier' : 'Cashier',
        registerCode: currentSession?.registerCode || 'POS-01',
        warehouseName: currentSession?.warehouseName || 'Main Store',
        lines: (saved.lines || []).map((l: PosSaleLine) => ({
          sku: l.sku,
          itemName: l.itemName,
          quantity: l.quantity,
          unitPrice: Number(l.unitPrice),
          total: l.total
        })),
        tenders: saved.tenders || intent.payload.tenders
      };

      setReceiptModal(receiptData);
      setBasket([]);
      setTenderReference('');
      setCashTendered('');
      notify(`${saved.receiptNumber} posted successfully`);
      await refresh();
      return true;
    } catch (error: unknown) {
      const saved = localStorage.getItem(posPendingCheckoutKey(userId));
      notify(
        saved
          ? 'Sale is saved safely on this device and has not been charged again. Retry sync when the connection is available.'
          : errorMessage(error)
      );
      return false;
    } finally {
      checkoutInFlight.current = false;
      setBusy(false);
    }
  };

  // Submit Checkout
  const handleCheckout = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (pendingCheckout) {
      await postCheckout(pendingCheckout);
      return;
    }
    if (!basket.length) {
      notify('Basket is empty. Add products to post sale.');
      return;
    }

    let activeSessionId = currentSession?.id || (sessions.find(s => s.status === 'OPEN')?.id) || '';
    if (!activeSessionId && (registerId || registers[0]?.id)) {
      try {
        const regToUse = registerId || registers[0]?.id;
        const res = await apiFetch(`${API}/pos/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registerId: regToUse, openingFloat: 0 })
        });
        if (res.ok) {
          const sess = await res.json();
          activeSessionId = sess.id;
          setCurrentSession(sess);
        }
      } catch {
        // backend checkout will auto-resolve session
      }
    }

    const intent: PendingCheckout = {
      sessionId: activeSessionId || crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      createdAt: Date.now(),
      payload: {
        customerId: customerId || null,
        lines: basket.map((line) => ({
          itemId: line.itemId,
          quantity: line.quantity,
          unitPriceOverride: line.unitPriceOverride === '' ? null : Number(line.unitPriceOverride),
          discountPercent: Number(line.discountPercent || 0)
        })),
        tenders: [
          {
            method: tenderMethod,
            amount: totalDue,
            reference: tenderReference.trim() || null
          }
        ]
      }
    };

    try {
      localStorage.setItem(posPendingCheckoutKey(userId), JSON.stringify(intent));
      setPendingCheckout(intent);
    } catch {
      notify('Could not save a safe retry record on this device. Checkout was not sent.');
      return;
    }

    await postCheckout(intent);
  };

  // Offline Auto-Sync listener
  useEffect(() => {
    if (!pendingCheckout) return;
    const retry = (): void => {
      if (navigator.onLine) void postCheckout(pendingCheckout);
    };
    window.addEventListener('online', retry);
    if (navigator.onLine) {
      const timer = window.setTimeout(retry, 0);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('online', retry);
      };
    }
    return () => window.removeEventListener('online', retry);
  }, [pendingCheckout]);

  // Void Sale
  const handleVoidSale = async (sale: PosSale): Promise<void> => {
    const reason = window.prompt(
      `Void cash receipt ${sale.receiptNumber}. This restores warehouse stock and reverses cash collected.\nEnter reason:`
    );
    if (!reason?.trim()) return;

    setBusy(true);
    try {
      const response = await apiFetch(`${API}/pos/sales/${sale.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          reason: reason.trim()
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || 'Could not void this receipt');
      notify(`${body.receiptNumber} voided · cash returned`);
      await loadSales();
      await refresh();
    } catch (error: unknown) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  // Open Refund Modal
  const openRefundModal = (sale: PosSale): void => {
    setRefundTargetSale(sale);
    setRefundReason('Customer return');
    // Default refund session drawer to active open session in same branch
    const saleSession = sessions.find((s) => s.id === sale.sessionId);
    const branchMatch = sessions.find((s) => s.status === 'OPEN' && s.branchId === saleSession?.branchId);
    setRefundSessionDrawerId(branchMatch?.id || currentSession?.id || '');
    setRefundMethod('CASH');
    setRefundReference('');

    // Prepopulate quantities to 0
    const initialQtys: Record<string, number> = {};
    const initialDispositions: Record<string, string> = {};
    sale.lines.forEach((l) => {
      initialQtys[l.saleLineId] = 0;
      const it = items.find((row) => row.sku === l.sku);
      if (it?.itemType === 'SERVICE') {
        initialDispositions[l.saleLineId] = 'SCRAP';
      } else if (it?.qualityInspectionRequired) {
        initialDispositions[l.saleLineId] = 'QUARANTINE';
      } else {
        initialDispositions[l.saleLineId] = 'RESTOCK';
      }
    });
    setRefundQtys(initialQtys);
    setRefundDispositions(initialDispositions);
    setIsRefundModalOpen(true);
  };

  // Calculate Refund Modal live total
  const calculatedRefundTotal = useMemo(() => {
    if (!refundTargetSale) return { subtotal: 0, taxTotal: 0, total: 0, lines: [] };
    let subtotal = 0;
    let taxTotal = 0;
    const linesToRefund: Array<{ line: PosSaleLine; qty: number; lineSub: number; lineTax: number }> = [];

    for (const line of refundTargetSale.lines) {
      const qty = refundQtys[line.saleLineId] || 0;
      if (qty <= 0) continue;
      const cumulativeQty = line.refundedQuantity + qty;
      const cumulativeSub = Number(line.unitPrice) * cumulativeQty;
      const lineSub = cumulativeSub - Number(line.refundedSubtotal);
      const cumulativeTax = Math.round(cumulativeSub * Number(refundTargetSale.taxRate || 0)) / 100;
      const lineTax = cumulativeTax - Number(line.refundedTaxTotal);

      subtotal += lineSub;
      taxTotal += lineTax;
      linesToRefund.push({ line, qty, lineSub, lineTax });
    }

    const total = Math.round((subtotal + taxTotal) * 100) / 100;
    return { subtotal, taxTotal, total, lines: linesToRefund };
  }, [refundTargetSale, refundQtys]);

  // Submit Refund
  const handleRefundSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!refundTargetSale) return;

    const linesPayload = calculatedRefundTotal.lines.map(({ line, qty }) => ({
      saleLineId: line.saleLineId,
      quantity: qty,
      disposition: refundDispositions[line.saleLineId] || 'RESTOCK'
    }));

    if (!linesPayload.length || calculatedRefundTotal.total <= 0) {
      notify('Enter a return quantity greater than 0 on at least one receipt line');
      return;
    }

    if (!refundSessionDrawerId) {
      notify('Please select an open register shift to disburse the refund.');
      return;
    }

    const idempotencyKey = crypto.randomUUID();
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/pos/sales/${refundTargetSale.id}/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey,
          sessionId: refundSessionDrawerId,
          reason: refundReason.trim(),
          lines: linesPayload,
          tenders: [
            {
              method: refundMethod,
              amount: calculatedRefundTotal.total,
              reference: refundReference.trim() || null
            }
          ]
        })
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || 'Could not post the POS refund');

      notify(`${body.refundNumber} recorded · ${formatCurrency(body.total)} refunded`);
      setIsRefundModalOpen(false);
      setRefundTargetSale(null);
      await loadSales();
      await refresh();
    } catch (error: unknown) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  // Telemetry Metrics
  const shiftSalesRevenue = useMemo(() => {
    return salesHistory
      .filter((s) => s.status !== 'VOIDED')
      .reduce((sum, s) => sum + Number(s.total || 0), 0);
  }, [salesHistory]);

  const shiftCashRevenue = useMemo(() => {
    return salesHistory
      .filter((s) => s.status !== 'VOIDED')
      .reduce((sum, s) => {
        const cashTenders = (s.tenders || []).filter((t) => t.method === 'CASH');
        return sum + cashTenders.reduce((acc, t) => acc + Number(t.amount || s.total), 0);
      }, 0);
  }, [salesHistory]);

  const shiftElectronicRevenue = useMemo(() => {
    return Math.max(0, shiftSalesRevenue - shiftCashRevenue);
  }, [shiftSalesRevenue, shiftCashRevenue]);

  const shiftRefundsTotal = useMemo(() => {
    return salesHistory.reduce((sum, s) => sum + Number(s.refundedTotal || 0), 0);
  }, [salesHistory]);

  const currentDrawerCash = useMemo(() => {
    if (!currentSession) return 0;
    return Number(currentSession.openingFloat || 0) + shiftCashRevenue;
  }, [currentSession, shiftCashRevenue]);

  const openSessionsCount = useMemo(() => {
    return sessions.filter((s) => s.status === 'OPEN').length;
  }, [sessions]);

  // Receipts Table Filtered List
  const visibleReceipts = useMemo(() => {
    let list = salesHistory;
    if (receiptStatusFilter === 'REFUNDED') {
      list = list.filter((s) => s.status === 'REFUNDED' || s.status === 'PARTIAL_REFUND');
    } else if (receiptStatusFilter !== 'ALL') {
      list = list.filter((s) => s.status === receiptStatusFilter);
    }
    if (receiptSearch.trim()) {
      const q = receiptSearch.toLowerCase().trim();
      list = list.filter((s) => {
        const cust = customers.find((c) => c.id === s.customerId);
        return (
          s.receiptNumber.toLowerCase().includes(q) ||
          (cust && cust.name.toLowerCase().includes(q)) ||
          s.lines.some((l) => l.sku.toLowerCase().includes(q) || l.itemName.toLowerCase().includes(q))
        );
      });
    }
    return list;
  }, [salesHistory, receiptStatusFilter, receiptSearch, customers]);

  // Export Receipts CSV
  const exportReceiptsCsv = (): void => {
    const today = new Date().toISOString().slice(0, 10);
    const headers = ['Receipt #', 'Date Time', 'Status', 'Customer', 'Items Count', 'Subtotal', 'Tax', 'Total', 'Refunded', 'Tenders'];
    const rows = visibleReceipts.map((s) => {
      const cust = customers.find((c) => c.id === s.customerId);
      const tenderStr = (s.tenders || []).map((t) => `${t.method}${t.reference ? ` (${t.reference})` : ''}`).join('; ');
      return [
        s.receiptNumber,
        new Date(s.postedAt).toLocaleString(),
        s.status,
        cust?.name || 'Walk-in Customer',
        s.lines.length,
        s.subtotal ?? (s.total - (s.taxTotal || 0)),
        s.taxTotal ?? 0,
        s.total,
        s.refundedTotal,
        tenderStr
      ];
    });
    downloadCsv(`spindl-pos-receipts-${today}.csv`, headers, rows);
    notify('POS Receipts exported as CSV');
  };

  return (
    <div className="sales-screen-layout pos-screen-layout">
      {/* 1. Executive Telemetry Strip — 4 Monochrome Linear Metric Cards */}
      <div className="sales-metric-strip">
        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">STORE LOCATION</span>
            <Store size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val">
            {activeRegister?.warehouseName || 'Main Store'}
          </div>
          <div className="sales-metric-sub">
            Terminal {activeRegister?.code || 'REG-01'} · Inventory synced
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">TOTAL POS SALES</span>
            <DollarSign size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(shiftSalesRevenue)}
          </div>
          <div className="sales-metric-sub">
            {salesHistory.length} receipts posted
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">CASH COLLECTED</span>
            <Coins size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(shiftCashRevenue)}
          </div>
          <div className="sales-metric-sub">
            Electronic: {formatCurrency(shiftElectronicRevenue)}
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">STORE SCOPE & TAX</span>
            <Tag size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val">
            {tax.taxCode} ({Number(tax.taxRate || 0)}%)
          </div>
          <div className="sales-metric-sub">
            {sellableProducts.length} sellable SKUs in catalog
          </div>
        </div>
      </div>

      {/* Offline Pending Checkout Alert Banner */}
      {pendingCheckout && (
        <div className="pos-pending-banner">
          <div className="pos-pending-content">
            <AlertTriangle size={16} className="pos-pending-icon" />
            <div>
              <span className="pos-pending-title">Sale awaiting network sync</span>
              <p className="pos-pending-text">
                The transaction is safely stored in local memory with idempotency key{' '}
                <code>{pendingCheckout.idempotencyKey.slice(0, 8)}…</code>. Customer will not be double-charged.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="sales-action-btn primary"
            disabled={busy}
            onClick={() => void postCheckout(pendingCheckout)}
          >
            {busy ? 'Syncing…' : 'Retry sync now'}
          </button>
        </div>
      )}

      {/* 2. Linear Sub-Navigation Tabs & Controls */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveTab('terminal')}
          >
            <ShoppingCart size={13} />
            <span>Register Terminal</span>
            {basket.length > 0 && <span className="sales-subnav-badge">{basket.length}</span>}
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'receipts' ? 'active' : ''}`}
            onClick={() => setActiveTab('receipts')}
          >
            <DollarSign size={13} />
            <span>Receipts & Returns</span>
            {salesHistory.length > 0 && <span className="sales-subnav-badge">{salesHistory.length}</span>}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="sales-action-btn secondary"
            onClick={() => void refresh()}
            disabled={loading || busy}
            title="Refresh POS terminal"
          >
            <RefreshCw size={12} className={loading || busy ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 3. SUB-TAB VIEW CONTENT */}

      {/* TAB 1: REGISTER TERMINAL WORKSPACE */}
      {activeTab === 'terminal' && (
        <div className={`pos-terminal-layout ${basket.length > 0 ? 'has-basket' : 'basket-empty'}`}>
          {/* Left Column: Product Catalogue & Scanner */}
          <div className="pos-catalogue-column">
            {/* Unified Barcode Scanner, Filter & View Controls */}
            <div className="pos-terminal-toolbar">
              <div className="pos-terminal-toolbar-left">
                <div className="pos-terminal-search-box">
                  <Search size={14} className="sales-search-icon" />
                  <input
                    ref={searchInputRef}
                    className="pos-terminal-search-input"
                    placeholder="Scan barcode [Enter] or search SKU, name…"
                    value={productSearch}
                    disabled={!!pendingCheckout}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onKeyDown={handleProductScan}
                  />
                  {productSearch ? (
                    <button
                      type="button"
                      className="sales-search-clear"
                      onClick={() => setProductSearch('')}
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  ) : (
                    <kbd className="sales-search-kbd">/</kbd>
                  )}
                </div>
              </div>

              <div className="pos-terminal-toolbar-right">
                {/* Category Dropdown Filter */}
                <select
                  className="linear-select"
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                  style={{ height: '32px', fontSize: '12px', minWidth: '150px' }}
                >
                  {availableCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label} ({cat.count})
                    </option>
                  ))}
                </select>

                {/* In Stock Toggle Pill */}
                <button
                  type="button"
                  className={`pos-toggle-pill ${productInStockOnly ? 'active' : ''}`}
                  onClick={() => setProductInStockOnly(!productInStockOnly)}
                >
                  <span>In stock only</span>
                </button>

                {/* Linear View Mode Switcher */}
                <div className="pos-view-toggle">
                  <button
                    type="button"
                    className={`pos-view-btn ${catalogueView === 'grid' ? 'active' : ''}`}
                    onClick={() => setCatalogueView('grid')}
                    title="Card Grid View"
                  >
                    <LayoutGrid size={13} />
                  </button>
                  <button
                    type="button"
                    className={`pos-view-btn ${catalogueView === 'table' ? 'active' : ''}`}
                    onClick={() => setCatalogueView('table')}
                    title="High-Density Scanner Table"
                  >
                    <LayoutList size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Product Catalogue View: Grid or High-Density Table */}
            {catalogueView === 'grid' ? (
              <div className="pos-catalogue-grid">
                {filteredProducts.map((item) => {
                  const stockVal = item.available ?? item.stock ?? 0;
                  const isService = item.itemType === 'SERVICE';
                  const isOutOfStock = !isService && stockVal <= 0;
                  const isLowStock = !isService && stockVal > 0 && stockVal <= 10;
                  const catName =
                    item.category ||
                    (isService
                      ? 'Service'
                      : item.itemType === 'FINISHED'
                      ? 'Finished Good'
                      : item.itemType === 'RAW'
                      ? 'Raw Material'
                      : item.itemType === 'WIP'
                      ? 'Sub-Assembly'
                      : 'Inventory');

                  return (
                    <div
                      key={item.id}
                      className={`pos-product-card ${isOutOfStock ? 'out-of-stock' : ''}`}
                      onClick={() => {
                        if (!isOutOfStock && !pendingCheckout) {
                          addProduct(item);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="pos-product-top">
                        <span className="pos-product-sku-pill">{item.sku}</span>
                        <span
                          className={`pos-product-stock-pill ${
                            isService
                              ? 'service'
                              : isOutOfStock
                              ? 'out-of-stock'
                              : isLowStock
                              ? 'low-stock'
                              : 'in-stock'
                          }`}
                        >
                          {isService ? 'Service' : isOutOfStock ? 'Out of stock' : `${stockVal} in stock`}
                        </span>
                      </div>

                      <div>
                        <div className="pos-product-name" title={item.name}>
                          {item.name}
                        </div>
                        <div className="pos-product-cat">{catName}</div>
                      </div>

                      <div className="pos-product-bottom">
                        <div className="pos-product-price">
                          {formatCurrency(item.unitPrice)}
                        </div>
                        <button
                          type="button"
                          className="pos-card-add-btn"
                          disabled={isOutOfStock || !!pendingCheckout}
                          onClick={(e) => {
                            e.stopPropagation();
                            addProduct(item);
                          }}
                        >
                          <Plus size={11} />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {!filteredProducts.length && (
                  <div className="empty-cell" style={{ gridColumn: '1 / -1', padding: '36px 16px' }}>
                    No sellable items match your search or filter.
                  </div>
                )}
              </div>
            ) : (
              <div className="pos-catalogue-table-card">
                <table className="pos-catalogue-table">
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>SKU</th>
                      <th>Product Name</th>
                      <th style={{ width: '130px' }}>Category</th>
                      <th style={{ width: '120px' }}>Availability</th>
                      <th style={{ width: '110px', textAlign: 'right' }}>Price</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((item) => {
                      const stockVal = item.available ?? item.stock ?? 0;
                      const isService = item.itemType === 'SERVICE';
                      const isOutOfStock = !isService && stockVal <= 0;
                      const isLowStock = !isService && stockVal > 0 && stockVal <= 10;
                      const catName =
                        item.category ||
                        (isService
                          ? 'Service'
                          : item.itemType === 'FINISHED'
                          ? 'Finished Good'
                          : item.itemType === 'RAW'
                          ? 'Raw Material'
                          : item.itemType === 'WIP'
                          ? 'Sub-Assembly'
                          : 'Inventory');

                      return (
                        <tr
                          key={item.id}
                          className={`pos-table-row ${isOutOfStock ? 'out-of-stock' : ''}`}
                          onClick={() => {
                            if (!isOutOfStock && !pendingCheckout) {
                              addProduct(item);
                            }
                          }}
                        >
                          <td>
                            <span className="pos-product-sku-pill">{item.sku}</span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '12.5px' }}>{item.name}</div>
                          </td>
                          <td>
                            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>{catName}</span>
                          </td>
                          <td>
                            <span
                              className={`pos-product-stock-pill ${
                                isService
                                  ? 'service'
                                  : isOutOfStock
                                  ? 'out-of-stock'
                                  : isLowStock
                                  ? 'low-stock'
                                  : 'in-stock'
                              }`}
                            >
                              {isService ? 'Service' : isOutOfStock ? 'Out of stock' : `${stockVal} units`}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500, fontSize: '12.5px', color: 'var(--sp-text)' }}>
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="pos-card-add-btn"
                              disabled={isOutOfStock || !!pendingCheckout}
                              onClick={(e) => {
                                e.stopPropagation();
                                addProduct(item);
                              }}
                            >
                              <Plus size={11} />
                              <span>Add</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!filteredProducts.length && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--sp-text-muted)' }}>
                          No sellable items match your search or filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Column: Interactive Basket & Checkout — ONLY VISIBLE WHEN BASKET HAS ITEMS */}
          {basket.length > 0 && (
            <div className="pos-basket-column">
            <div className="pos-basket-card">
              {/* Basket Header */}
              <div className="pos-basket-header">
                <div className="pos-basket-title-wrap">
                  <ShoppingCart size={15} />
                  <span className="pos-basket-title">Current Basket</span>
                  <span className="reports-subnav-badge" style={{ marginLeft: '4px' }}>
                    {basket.reduce((sum, l) => sum + l.quantity, 0)} items
                  </span>
                </div>
                {basket.length > 0 && (
                  <button
                    type="button"
                    className="button-link-muted"
                    onClick={clearBasket}
                    style={{ fontSize: '11px', color: 'var(--sp-text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}
                  >
                    Clear basket
                  </button>
                )}
              </div>

              {/* Customer Selector */}
              <div className="pos-customer-selector">
                <label className="pos-input-label">Customer (Optional)</label>
                <div className="pos-customer-input-wrap">
                  <User size={13} style={{ color: 'var(--sp-text-muted)', flexShrink: 0 }} />
                  <select
                    className="pos-customer-select"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                  >
                    <option value="">Walk-in Customer (Unregistered)</option>
                    {customers
                      .filter((c) => c.active !== false)
                      .map((cust) => (
                        <option key={cust.id} value={cust.id}>
                          {cust.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Basket Lines List */}
              <div className="pos-basket-lines-wrap">
                {basket.map((line) => {
                  const item = items.find((row) => row.id === line.itemId);
                  const effectiveUnit = posUnitPrice(line);
                  const lineTotal = effectiveUnit * line.quantity;
                  const isEditing = editingBasketLineId === line.itemId;
                  const hasDiscount = Number(line.discountPercent || 0) > 0;
                  const hasOverride = line.unitPriceOverride !== '' && line.unitPriceOverride !== undefined;

                  return (
                    <div key={line.itemId} className="pos-basket-line-item">
                      <div className="pos-basket-line-main">
                        <div className="pos-basket-line-info">
                          <span className="pos-basket-line-name">{item?.name || 'Unknown item'}</span>
                          <span className="pos-basket-line-sku">
                            {item?.sku} · {formatCurrency(effectiveUnit)} / unit
                            {hasDiscount && <span className="pos-discount-tag">-{line.discountPercent}%</span>}
                            {hasOverride && <span className="pos-override-tag">Override</span>}
                          </span>
                        </div>

                        <div className="pos-basket-line-qty-controls">
                          <button
                            type="button"
                            className="pos-qty-btn"
                            disabled={!!pendingCheckout}
                            onClick={() => updateBasketQuantity(line.itemId, -1)}
                            title="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="pos-qty-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            className="pos-qty-btn"
                            disabled={!!pendingCheckout}
                            onClick={() => updateBasketQuantity(line.itemId, 1)}
                            title="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        <div className="pos-basket-line-total" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(lineTotal)}
                        </div>

                        <button
                          type="button"
                          className="pos-remove-line-btn"
                          disabled={!!pendingCheckout}
                          onClick={() => removeBasketLine(line.itemId)}
                          title="Remove line"
                        >
                          <X size={13} />
                        </button>
                      </div>

                      {/* Manager Controls: Inline Price Override & Discount */}
                      {manager && (
                        <div className="pos-line-manager-bar">
                          <button
                            type="button"
                            className="pos-line-manager-toggle"
                            onClick={() => setEditingBasketLineId(isEditing ? null : line.itemId)}
                          >
                            <Sliders size={11} />
                            <span>{isEditing ? 'Hide manager pricing' : 'Manager price & discount'}</span>
                          </button>

                          {isEditing && (
                            <div className="pos-line-edit-controls">
                              <label className="pos-mini-label">
                                <span>Unit price</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="search-input"
                                  style={{ height: '26px', fontSize: '11px', width: '90px' }}
                                  value={line.unitPriceOverride ?? ''}
                                  placeholder={String(item?.unitPrice || 0)}
                                  onChange={(e) =>
                                    setBasket((rows) =>
                                      rows.map((r) =>
                                        r.itemId === line.itemId ? { ...r, unitPriceOverride: e.target.value } : r
                                      )
                                    )
                                  }
                                />
                              </label>

                              <label className="pos-mini-label">
                                <span>Discount %</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="99.99"
                                  step="0.01"
                                  className="search-input"
                                  style={{ height: '26px', fontSize: '11px', width: '80px' }}
                                  value={line.discountPercent ?? 0}
                                  onChange={(e) =>
                                    setBasket((rows) =>
                                      rows.map((r) =>
                                        r.itemId === line.itemId ? { ...r, discountPercent: e.target.value } : r
                                      )
                                    )
                                  }
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {!basket.length && (
                  <div className="pos-basket-empty">
                    <ShoppingBag size={24} style={{ color: 'var(--sp-text-muted)', strokeWidth: 1.5 }} />
                    <span>Basket is empty</span>
                    <small>Click products or scan barcodes to begin sale</small>
                  </div>
                )}
              </div>

              {/* Totals Summary */}
              <div className="pos-order-summary">
                <div className="pos-summary-row">
                  <span>Subtotal</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(due)}</span>
                </div>
                <div className="pos-summary-row">
                  <span>
                    Tax ({tax.taxCode} · {Number(tax.taxRate || 0)}%)
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(taxAmount)}</span>
                </div>
                <div className="pos-summary-row pos-total-row">
                  <span>Total Due</span>
                  <span className="pos-total-amount" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(totalDue)}
                  </span>
                </div>
              </div>

              {/* Tender Selector & Checkout Form */}
              <form onSubmit={handleCheckout} className="pos-checkout-form">
                <div className="pos-tender-tabs">
                  {(['CASH', 'CARD', 'UPI', 'OTHER'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      className={`pos-tender-tab ${tenderMethod === method ? 'active' : ''}`}
                      onClick={() => setTenderMethod(method)}
                    >
                      {method === 'CASH' && <Coins size={12} />}
                      {method === 'CARD' && <CreditCard size={12} />}
                      {method === 'UPI' && <QrCode size={12} />}
                      {method === 'OTHER' && <DollarSign size={12} />}
                      <span>{method}</span>
                    </button>
                  ))}
                </div>

                {/* Cash Flow Helper: Quick Denominations & Change Calculator */}
                {tenderMethod === 'CASH' && totalDue > 0 && (
                  <div className="pos-cash-flow-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="pos-input-label">Quick Cash Tender</span>
                      {changeDue > 0 && (
                        <span style={{ fontSize: '10.5px', color: 'var(--sp-success)', fontWeight: 600 }}>
                          Change: {formatCurrency(changeDue)}
                        </span>
                      )}
                    </div>

                    <div className="pos-quick-cash-grid">
                      {quickCashOptions.map((amt, idx) => (
                        <button
                          key={amt}
                          type="button"
                          className={`pos-quick-cash-btn ${idx === 0 ? 'exact' : ''}`}
                          onClick={() => setCashTendered(String(amt))}
                        >
                          {idx === 0 ? `Exact (${formatCurrency(amt)})` : formatCurrency(amt)}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={`Enter cash amount (e.g. ${totalDue})`}
                        className="sales-search-input"
                        style={{
                          height: '28px',
                          fontSize: '11.5px',
                          background: 'var(--sp-surface)',
                          border: '1px solid var(--sp-border)',
                          borderRadius: '4px',
                          padding: '0 8px',
                          fontVariantNumeric: 'tabular-nums',
                          flex: 1
                        }}
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                      />
                      {cashTendered && (
                        <button
                          type="button"
                          className="sales-search-clear"
                          onClick={() => setCashTendered('')}
                          style={{ position: 'static' }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {changeDue > 0 && (
                      <div className="pos-change-due-box">
                        <span>Change to Customer</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(changeDue)}</span>
                      </div>
                    )}
                  </div>
                )}

                {tenderMethod !== 'CASH' && (
                  <div style={{ marginTop: '8px' }}>
                    <input
                      className="search-input"
                      placeholder={`Payment reference / authorization ID (${tenderMethod})`}
                      value={tenderReference}
                      onChange={(e) => setTenderReference(e.target.value)}
                      style={{ width: '100%', height: '30px', fontSize: '11.5px' }}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="sales-action-btn primary pos-post-sale-btn"
                  disabled={busy || !basket.length || !!pendingCheckout}
                >
                  {pendingCheckout
                    ? 'Sale awaiting sync…'
                    : busy
                    ? 'Posting sale…'
                    : `⚡ Post Sale · ${formatCurrency(totalDue)}`}
                </button>
              </form>
            </div>
          </div>
          )}
        </div>
      )}

      {/* TAB 2: RECEIPTS & RETURNS */}

      {activeTab === 'receipts' && (
        <div className="pos-receipts-layout">
          <div className="sales-table-card">
            <div className="sales-card-header">
              <div>
                <h2 className="sales-card-title">Receipts & Returns Ledger</h2>
                <p className="sales-card-subtitle">Complete audit ledger of sales receipts, customer refunds, and return credit notes</p>
              </div>
            </div>

            {/* Linear Toolbar for Receipts */}
            <div className="pos-receipts-toolbar">
              <div className="sales-pill-group">
                <button
                  type="button"
                  className={`sales-pill-btn ${receiptStatusFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setReceiptStatusFilter('ALL')}
                >
                  <span>All Receipts</span>
                  <span className="sales-pill-count">{salesHistory.length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${receiptStatusFilter === 'POSTED' ? 'active' : ''}`}
                  onClick={() => setReceiptStatusFilter('POSTED')}
                >
                  <span>Posted</span>
                  <span className="sales-pill-count">
                    {salesHistory.filter((s) => s.status === 'POSTED').length}
                  </span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${receiptStatusFilter === 'REFUNDED' ? 'active' : ''}`}
                  onClick={() => setReceiptStatusFilter('REFUNDED')}
                >
                  <span>Refunded</span>
                  <span className="sales-pill-count">
                    {salesHistory.filter((s) => ['REFUNDED', 'PARTIAL_REFUND'].includes(s.status)).length}
                  </span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${receiptStatusFilter === 'VOIDED' ? 'active' : ''}`}
                  onClick={() => setReceiptStatusFilter('VOIDED')}
                >
                  <span>Voided</span>
                  <span className="sales-pill-count">
                    {salesHistory.filter((s) => s.status === 'VOIDED').length}
                  </span>
                </button>
              </div>

              <div className="pos-receipts-toolbar-right">
                <div className="pos-receipts-search-box">
                  <Search size={13} className="sales-search-icon" />
                  <input
                    className="pos-terminal-search-input"
                    placeholder="Search receipt #, customer, SKU…"
                    value={receiptSearch}
                    onChange={(e) => setReceiptSearch(e.target.value)}
                  />
                  {receiptSearch ? (
                    <button
                      type="button"
                      className="sales-search-clear"
                      onClick={() => setReceiptSearch('')}
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  ) : (
                    <kbd className="sales-search-kbd">/</kbd>
                  )}
                </div>

                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={exportReceiptsCsv}
                  disabled={!visibleReceipts.length}
                  title="Export Receipts as CSV"
                  style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Receipts Table */}
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ width: '32px', textAlign: 'center' }}></th>
                    <th style={{ width: '150px' }}>Receipt #</th>
                    <th style={{ width: '135px' }}>Posted Date</th>
                    <th>Customer</th>
                    <th style={{ width: '120px' }}>Tender</th>
                    <th style={{ width: '50px', textAlign: 'center' }}>Items</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Total</th>
                    <th style={{ width: '90px', textAlign: 'right' }}>Refunded</th>
                    <th style={{ width: '95px', textAlign: 'center' }}>Status</th>
                    <th style={{ width: '185px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReceipts.map((sale) => {
                    const cust = customers.find((c) => c.id === sale.customerId);
                    const isExpanded = expandedSaleId === sale.id;
                    const canVoid =
                      manager &&
                      sale.status === 'POSTED' &&
                      sale.refundedTotal === 0 &&
                      sale.tenders.length > 0 &&
                      sale.tenders.every((t) => t.method === 'CASH');

                    const canRefund =
                      manager &&
                      ['POSTED', 'PARTIAL_REFUND'].includes(sale.status) &&
                      sale.lines.some((l) => l.refundableQuantity > 0);

                    return (
                      <Fragment key={sale.id}>
                        <tr
                          className={`sales-row ${isExpanded ? 'row-expanded' : ''}`}
                          onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td style={{ color: 'var(--sp-text-muted)', textAlign: 'center' }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                          <td>
                            <span className="sales-ref-badge interactive">{sale.receiptNumber}</span>
                          </td>
                          <td>
                            <div className="sales-date-cell">
                              {formatDate(sale.postedAt)}
                              <span style={{ fontSize: '10px', color: 'var(--sp-text-muted)', marginLeft: '4px' }}>
                                {formatTime(sale.postedAt)}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span
                              style={{
                                fontWeight: 500,
                                color: 'var(--sp-text)',
                                display: 'inline-block',
                                maxWidth: '170px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                verticalAlign: 'middle'
                              }}
                              title={cust?.name || 'Walk-in Customer'}
                            >
                              {cust?.name || 'Walk-in Customer'}
                            </span>
                          </td>
                          <td style={{ verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {(sale.tenders || []).map((t, idx) => {
                                const label =
                                  t.method === 'CASH'
                                    ? 'Cash'
                                    : t.method === 'CARD'
                                    ? (t.reference ? `Card (${t.reference})` : 'Card')
                                    : t.method === 'UPI'
                                    ? (t.reference ? `UPI (${t.reference})` : 'UPI')
                                    : t.method;
                                return (
                                  <span
                                    key={idx}
                                    className="pos-tender-badge"
                                    title={t.reference ? `${t.method} · ${t.reference}` : t.method}
                                  >
                                    {label}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                            {sale.lines.length}
                          </td>
                          <td className="sales-amount-cell" style={{ textAlign: 'right' }}>
                            {formatCurrency(sale.total)}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {sale.refundedTotal > 0 ? (
                              <span style={{ color: 'var(--sp-danger)', fontWeight: 500 }}>
                                -{formatCurrency(sale.refundedTotal)}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--sp-text-muted)' }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <Status label={sale.status} />
                          </td>
                          <td style={{ textAlign: 'right', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                            <div className="pos-row-actions">
                              <button
                                type="button"
                                className="pos-table-action-btn"
                                onClick={() => {
                                  setReceiptModal({
                                    receiptNumber: sale.receiptNumber,
                                    postedAt: sale.postedAt,
                                    total: sale.total,
                                    subtotal: sale.subtotal,
                                    taxCode: sale.taxCode,
                                    taxRate: sale.taxRate,
                                    taxTotal: sale.taxTotal,
                                    customerName: cust?.name || 'Walk-in Customer',
                                    lines: sale.lines.map((l) => ({
                                      sku: l.sku,
                                      itemName: l.itemName,
                                      quantity: l.quantity,
                                      unitPrice: Number(l.unitPrice),
                                      total: l.total
                                    })),
                                    tenders: sale.tenders
                                  });
                                }}
                                title="View printable receipt"
                              >
                                <Printer size={12} />
                                <span>Receipt</span>
                              </button>

                              {canRefund && (
                                <button
                                  type="button"
                                  className="pos-table-action-btn"
                                  onClick={() => openRefundModal(sale)}
                                  title="Process refund for this sale"
                                >
                                  <RotateCcw size={12} />
                                  <span>Refund</span>
                                </button>
                              )}

                              {canVoid && (
                                <button
                                  type="button"
                                  className="pos-table-action-btn danger"
                                  disabled={busy}
                                  onClick={() => void handleVoidSale(sale)}
                                  title="Void cash sale and restore stock"
                                >
                                  <span>Void</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Receipt Lines Breakdown */}
                        {isExpanded && (
                          <tr className="expanded-row-detail">
                            <td colSpan={10} style={{ padding: '12px 18px', background: 'var(--sp-surface-subtle)' }}>
                              <div className="pos-receipt-expansion">
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
                                    Line Items Breakdown
                                  </span>
                                  <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                                    Tax Rate: {sale.taxRate}% ({sale.taxCode || 'Standard'})
                                  </span>
                                </div>

                                <table className="sales-table" style={{ width: '100%', tableLayout: 'fixed', background: 'var(--sp-surface)' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ width: '15%' }}>SKU</th>
                                      <th style={{ width: '30%' }}>Item Description</th>
                                      <th style={{ width: '10%', textAlign: 'right' }}>Quantity</th>
                                      <th style={{ width: '12%', textAlign: 'right' }}>Unit Price</th>
                                      <th style={{ width: '13%', textAlign: 'right' }}>Line Total</th>
                                      <th style={{ width: '10%', textAlign: 'right' }}>Refundable Units</th>
                                      <th style={{ width: '10%', textAlign: 'right' }}>Refunded Units</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sale.lines.map((line) => (
                                      <tr key={line.saleLineId}>
                                        <td>
                                          <span className="station-code-pill" style={{ fontSize: '10px' }}>
                                            {line.sku}
                                          </span>
                                        </td>
                                        <td>{line.itemName}</td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                          {line.quantity}
                                        </td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                          {formatCurrency(line.unitPrice)}
                                        </td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                                          {formatCurrency(line.total)}
                                        </td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                          {line.refundableQuantity}
                                        </td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                          {line.refundedQuantity > 0 ? (
                                            <span style={{ color: 'var(--sp-danger)' }}>{line.refundedQuantity}</span>
                                          ) : (
                                            0
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}

                  {!visibleReceipts.length && (
                    <tr>
                      <td colSpan={10} className="empty-cell" style={{ padding: '32px 0', textAlign: 'center', color: 'var(--sp-text-muted)' }}>
                        No sales receipts found matching your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PRINTABLE SALE RECEIPT MODAL */}
      {receiptModal && (
        <div className="modal-backdrop" onClick={() => setReceiptModal(null)}>
          <div className="record-modal" style={{ width: 'min(420px, 100%)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <h2>Sale Receipt</h2>
                <p>{receiptModal.receiptNumber} · {new Date(receiptModal.postedAt).toLocaleDateString()}</p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModal(null)}
                title="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Slip Content */}
            <div className="pos-slip-container">
              <div className="pos-slip-header">
                <div className="pos-slip-brand">SPINDL ERP</div>
                <div className="pos-slip-meta">
                  {receiptModal.warehouseName || 'Main Store'}
                </div>
                <div className="pos-slip-meta">
                  Receipt: <b>{receiptModal.receiptNumber}</b>
                </div>
                <div className="pos-slip-meta" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(receiptModal.postedAt).toLocaleString()}
                </div>
                {receiptModal.customerName && (
                  <div className="pos-slip-meta">
                    Customer: {receiptModal.customerName}
                  </div>
                )}
              </div>

              <div className="pos-slip-divider"></div>

              <div className="pos-slip-items">
                {receiptModal.lines.map((line, idx) => (
                  <div key={idx} className="pos-slip-item-row">
                    <div className="pos-slip-item-name">
                      {line.quantity} × {line.itemName}
                    </div>
                    <div className="pos-slip-item-total" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(line.total)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pos-slip-divider"></div>

              <div className="pos-slip-totals">
                {receiptModal.subtotal !== undefined && (
                  <div className="pos-slip-total-row">
                    <span>Subtotal</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(receiptModal.subtotal)}
                    </span>
                  </div>
                )}
                {receiptModal.taxTotal !== undefined && (
                  <div className="pos-slip-total-row">
                    <span>Tax ({receiptModal.taxRate || tax.taxRate}%)</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(receiptModal.taxTotal)}
                    </span>
                  </div>
                )}
                <div className="pos-slip-total-row pos-slip-grand-total">
                  <b>TOTAL PAID</b>
                  <b style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(receiptModal.total)}
                  </b>
                </div>
              </div>

              {receiptModal.tenders && receiptModal.tenders.length > 0 && (
                <div className="pos-slip-tenders">
                  {receiptModal.tenders.map((t, i) => (
                    <div key={i} className="pos-slip-meta" style={{ textAlign: 'center', marginTop: '4px' }}>
                      Tender: {t.method} {t.amount ? `(${formatCurrency(t.amount)})` : ''}
                      {t.reference ? ` [${t.reference}]` : ''}
                    </div>
                  ))}
                </div>
              )}

              <div className="pos-slip-footer">
                <div>Thank you for your business.</div>
                <small>Authorized Register Checkout</small>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setReceiptModal(null)}
              >
                Dismiss
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => window.print()}
              >
                <Printer size={13} />
                <span>Print Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: REFUND & RETURNS MODAL */}
      {isRefundModalOpen && refundTargetSale && (
        <div className="modal-backdrop" onClick={() => setIsRefundModalOpen(false)}>
          <div className="record-modal" style={{ width: 'min(640px, 100%)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <h2>Process Return & Refund</h2>
                <p>Record item return quantities, inventory disposition, and payment reversal.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(false)}
                title="Close"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleRefundSubmit}>
              <div className="pos-reconcile-card" style={{ marginBottom: '14px' }}>
                <div className="pos-reconcile-row">
                  <span>Original Receipt:</span>
                  <b>{refundTargetSale.receiptNumber}</b>
                </div>
                <div className="pos-reconcile-row">
                  <span>Posted Date:</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(refundTargetSale.postedAt).toLocaleString()}
                  </span>
                </div>
                <div className="pos-reconcile-row">
                  <span>Original Total:</span>
                  <b style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(refundTargetSale.total)}
                  </b>
                </div>
              </div>

              <div className="table-wrap" style={{ marginBottom: '14px' }}>
                <table className="data-table" style={{ background: 'var(--sp-surface)' }}>
                  <thead>
                    <tr>
                      <th>SKU / Item</th>
                      <th style={{ textAlign: 'right' }}>Max Ret</th>
                      <th style={{ width: '90px' }}>Return Qty</th>
                      <th>Disposition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refundTargetSale.lines
                      .filter((l) => l.refundableQuantity > 0)
                      .map((line) => {
                        const it = items.find((row) => row.sku === line.sku);
                        const isService = it?.itemType === 'SERVICE';
                        const requiresQuality = it?.qualityInspectionRequired;

                        return (
                          <tr key={line.saleLineId}>
                            <td>
                              <b>{line.itemName}</b>
                              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                                {line.sku} · {formatCurrency(line.unitPrice)} each
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              {line.refundableQuantity}
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max={line.refundableQuantity}
                                value={refundQtys[line.saleLineId] ?? 0}
                                onChange={(e) =>
                                  setRefundQtys({
                                    ...refundQtys,
                                    [line.saleLineId]: Math.min(
                                      line.refundableQuantity,
                                      Math.max(0, parseInt(e.target.value, 10) || 0)
                                    )
                                  })
                                }
                                className="search-input"
                                style={{ width: '70px', height: '28px', fontSize: '12px' }}
                              />
                            </td>
                            <td>
                              {isService ? (
                                <span className="station-code-pill" style={{ fontSize: '11px' }}>
                                  SCRAP (Service)
                                </span>
                              ) : (
                                <select
                                  className="filter-select"
                                  style={{ height: '28px', fontSize: '11px' }}
                                  value={refundDispositions[line.saleLineId] || (requiresQuality ? 'QUARANTINE' : 'RESTOCK')}
                                  onChange={(e) =>
                                    setRefundDispositions({
                                      ...refundDispositions,
                                      [line.saleLineId]: e.target.value
                                    })
                                  }
                                >
                                  {!requiresQuality && <option value="RESTOCK">Restock (Warehouse)</option>}
                                  <option value="QUARANTINE">Quarantine (Quality)</option>
                                  <option value="SCRAP">Scrap / Write-off</option>
                                </select>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="pos-refund-controls-grid">
                <label>
                  <span>Disbursing Register Shift</span>
                  <select
                    value={refundSessionDrawerId}
                    onChange={(e) => setRefundSessionDrawerId(e.target.value)}
                    required
                  >
                    <option value="">Select active open shift</option>
                    {sessions
                      .filter((s) => s.status === 'OPEN')
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.registerCode} · {s.registerName} ({s.warehouseName})
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  <span>Refund Method</span>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value as 'CASH' | 'CARD' | 'UPI' | 'OTHER')}
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card Reversal</option>
                    <option value="UPI">UPI</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>

                <label>
                  <span>Return Reason</span>
                  <input
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    required
                    maxLength={300}
                    placeholder="e.g. Defective part or customer return"
                  />
                </label>

                <label>
                  <span>Payment Reference (Optional)</span>
                  <input
                    value={refundReference}
                    onChange={(e) => setRefundReference(e.target.value)}
                    placeholder="Card refund txn / auth code"
                    maxLength={120}
                  />
                </label>
              </div>

              <div className="pos-order-summary" style={{ marginTop: '14px' }}>
                <div className="pos-summary-row">
                  <span>Return Items Subtotal</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(calculatedRefundTotal.subtotal)}
                  </span>
                </div>
                <div className="pos-summary-row">
                  <span>Tax Refunded</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(calculatedRefundTotal.taxTotal)}
                  </span>
                </div>
                <div className="pos-summary-row pos-total-row">
                  <span>Total Refund Amount</span>
                  <b className="pos-total-amount" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--sp-danger)' }}>
                    {formatCurrency(calculatedRefundTotal.total)}
                  </b>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setIsRefundModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy || calculatedRefundTotal.total <= 0 || !refundSessionDrawerId}
                  style={{ background: 'var(--sp-brand)' }}
                >
                  {busy ? 'Processing…' : `Confirm Refund · ${formatCurrency(calculatedRefundTotal.total)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
