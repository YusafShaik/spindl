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

export function PosPanel({ items, customers, role, userId, notify }: PosPanelProps) {
  // Navigation & Data States
  const [activeTab, setActiveTab] = useState<'terminal' | 'shifts' | 'receipts' | 'registers'>('terminal');
  const [registers, setRegisters] = useState<PosRegister[]>([]);
  const [sessions, setSessions] = useState<PosSession[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [cashiers, setCashiers] = useState<PosCashier[]>([]);
  const [salesHistory, setSalesHistory] = useState<PosSale[]>([]);
  const [refundKeys, setRefundKeys] = useState<Record<string, string>>({});
  const [receiptSessionId, setReceiptSessionId] = useState<string>('');
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
  const [productSearch, setProductSearch] = useState<string>('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<'ALL' | 'FINISHED' | 'SERVICE'>('ALL');
  const [productInStockOnly, setProductInStockOnly] = useState(false);
  const [receiptModal, setReceiptModal] = useState<PosReceipt | null>(null);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [editingBasketLineId, setEditingBasketLineId] = useState<string | null>(null);

  // Search & Filters for Receipts
  const [receiptSearch, setReceiptSearch] = useState<string>('');
  const [receiptStatusFilter, setReceiptStatusFilter] = useState<'ALL' | 'POSTED' | 'VOIDED' | 'REFUNDED' | 'PARTIAL_REFUND'>('ALL');

  // Modals States
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [openShiftFloat, setOpenShiftFloat] = useState('500.00');

  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [closeShiftSession, setCloseShiftSession] = useState<PosSession | null>(null);
  const [closeShiftCountedCash, setCloseShiftCountedCash] = useState('0.00');

  const [isNewRegisterModalOpen, setIsNewRegisterModalOpen] = useState(false);
  const [newRegisterWarehouseId, setNewRegisterWarehouseId] = useState('');
  const [newRegisterCashierId, setNewRegisterCashierId] = useState('');

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

  // Cashier list loader
  const loadCashiers = async (warehouseId: string): Promise<void> => {
    if (!manager || !warehouseId) {
      setCashiers([]);
      return;
    }
    try {
      const response = await apiFetch(`${API}/pos/cashiers?warehouseId=${encodeURIComponent(warehouseId)}`);
      setCashiers(response.ok ? await response.json() : []);
    } catch {
      setCashiers([]);
    }
  };

  // Sales history loader
  const loadSales = async (sessionId: string): Promise<void> => {
    if (!sessionId) {
      setSalesHistory([]);
      return;
    }
    try {
      const response = await apiFetch(`${API}/pos/sessions/${sessionId}/sales`);
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

      const selectedSession = mine?.id || (sessionRows.some((r) => r.id === receiptSessionId) ? receiptSessionId : sessionRows[0]?.id || '');
      setReceiptSessionId(selectedSession);
      if (selectedSession) {
        await loadSales(selectedSession);
      }

      if (manager && warehouseRows[0]) {
        setNewRegisterWarehouseId(warehouseRows[0].id);
        await loadCashiers(warehouseRows[0].id);
      }
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

  // Product Catalogue filters
  const sellableProducts = useMemo(() => {
    return items.filter((item) => ['FINISHED', 'SERVICE'].includes(item.itemType) && item.active !== false);
  }, [items]);

  const filteredProducts = useMemo(() => {
    let result = sellableProducts;
    if (productCategoryFilter !== 'ALL') {
      result = result.filter((item) => item.itemType === productCategoryFilter);
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
    if (!currentSession) {
      notify('You must have an open register shift before posting a sale.');
      setIsOpenShiftModalOpen(true);
      return;
    }
    if (!basket.length) {
      notify('Basket is empty. Add products to post sale.');
      return;
    }

    const intent: PendingCheckout = {
      sessionId: currentSession.id,
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

  // Open Shift Form Submission
  const handleOpenShift = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const targetRegId = form.get('registerId') as string;
    const openingFloatVal = Number(form.get('openingFloat') || 0);

    setBusy(true);
    try {
      const response = await apiFetch(`${API}/pos/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registerId: targetRegId,
          openingFloat: openingFloatVal
        })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || 'Could not open shift. Check your store assignment and register status.');
      }
      const opened = await response.json();
      setCurrentSession(opened);
      setIsOpenShiftModalOpen(false);
      notify(`Register shift opened · Opening float ${formatCurrency(openingFloatVal)}`);
      await refresh();
    } catch (error: unknown) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  // Close Shift Submission
  const handleCloseShift = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!closeShiftSession) return;
    const form = new FormData(event.currentTarget);
    const countedCashVal = Number(form.get('countedCash') || 0);

    setBusy(true);
    try {
      const response = await apiFetch(`${API}/pos/sessions/${closeShiftSession.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedCash: countedCashVal })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || 'Could not close shift');
      }
      const closed = await response.json();
      notify(`Shift closed · cash variance ${formatCurrency(closed.cashVariance)}`);
      setIsCloseShiftModalOpen(false);
      setCloseShiftSession(null);
      if (currentSession?.id === closeShiftSession.id) {
        setCurrentSession(null);
        setBasket([]);
      }
      await refresh();
    } catch (error: unknown) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  // Create Register
  const handleCreateRegister = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/pos/registers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.get('code'),
          name: form.get('name'),
          warehouseId: form.get('warehouseId'),
          cashierUserId: form.get('cashierUserId')
        })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || 'Could not create register');
      }
      setIsNewRegisterModalOpen(false);
      notify('Register created and cashier assigned');
      await refresh();
    } catch (error: unknown) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

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
      await loadSales(sale.sessionId);
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
      await loadSales(refundTargetSale.sessionId);
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
    if (receiptStatusFilter !== 'ALL') {
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

  // Open Close Shift Dialog
  const triggerCloseShift = (session: PosSession): void => {
    setCloseShiftSession(session);
    // Pre-fill with expected cash
    const exp = Number(session.openingFloat || 0) + (session.id === currentSession?.id ? shiftCashRevenue : 0);
    setCloseShiftCountedCash(exp.toFixed(2));
    setIsCloseShiftModalOpen(true);
  };

  return (
    <div className="reports-screen-layout pos-screen-layout">
      {/* 1. Executive Telemetry Strip — 4 Monochrome Linear Metric Cards */}
      <div className="sales-metric-strip">
        <div className="reports-metric-card">
          <div className="reports-metric-header">
            <span className="reports-metric-label">REGISTER SHIFT</span>
            <Store size={14} className="reports-metric-icon" />
          </div>
          <div className="reports-metric-val">
            {currentSession ? currentSession.registerCode : 'Shift Closed'}
          </div>
          <div className="reports-metric-sub">
            {currentSession
              ? `${currentSession.registerName} · ${currentSession.warehouseName}`
              : registers.length > 0
              ? `${registers.length} terminals configured`
              : 'No register assigned'}
          </div>
        </div>

        <div className="reports-metric-card">
          <div className="reports-metric-header">
            <span className="reports-metric-label">SHIFT REVENUE</span>
            <DollarSign size={14} className="reports-metric-icon" />
          </div>
          <div className="reports-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(shiftSalesRevenue)}
          </div>
          <div className="reports-metric-sub">
            {salesHistory.length} receipts posted in active shift
          </div>
        </div>

        <div className="reports-metric-card">
          <div className="reports-metric-header">
            <span className="reports-metric-label">DRAWER CASH</span>
            <Coins size={14} className="reports-metric-icon" />
          </div>
          <div className="reports-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {currentSession ? formatCurrency(currentDrawerCash) : '—'}
          </div>
          <div className="reports-metric-sub">
            {currentSession
              ? `Float ${formatCurrency(currentSession.openingFloat)} · ${formatCurrency(shiftCashRevenue)} cash in`
              : 'Open shift to initialize drawer'}
          </div>
        </div>

        <div className="reports-metric-card">
          <div className="reports-metric-header">
            <span className="reports-metric-label">STORE SCOPE & TAX</span>
            <Tag size={14} className="reports-metric-icon" />
          </div>
          <div className="reports-metric-val">
            {tax.taxCode} ({Number(tax.taxRate || 0)}%)
          </div>
          <div className="reports-metric-sub">
            {sellableProducts.length} sellable SKUs · {openSessionsCount} active open shifts
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
            className="button button-primary"
            disabled={busy}
            onClick={() => void postCheckout(pendingCheckout)}
            style={{ height: '30px', fontSize: '12px', padding: '0 12px' }}
          >
            {busy ? 'Syncing…' : 'Retry sync now'}
          </button>
        </div>
      )}

      {/* 2. Linear Sub-Navigation Tabs & Controls */}
      <div className="reports-subnav-container">
        <div className="reports-subnav-tabs">
          <button
            type="button"
            className={`reports-subnav-tab ${activeTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveTab('terminal')}
          >
            <ShoppingCart size={13} />
            <span>Register Terminal</span>
            {basket.length > 0 && <span className="reports-subnav-badge">{basket.length}</span>}
          </button>

          <button
            type="button"
            className={`reports-subnav-tab ${activeTab === 'shifts' ? 'active' : ''}`}
            onClick={() => setActiveTab('shifts')}
          >
            <Clock size={13} />
            <span>Shifts & Drawers</span>
            {openSessionsCount > 0 && <span className="reports-subnav-badge">{openSessionsCount}</span>}
          </button>

          <button
            type="button"
            className={`reports-subnav-tab ${activeTab === 'receipts' ? 'active' : ''}`}
            onClick={() => setActiveTab('receipts')}
          >
            <DollarSign size={13} />
            <span>Receipts & Returns</span>
            {salesHistory.length > 0 && <span className="reports-subnav-badge">{salesHistory.length}</span>}
          </button>

          {manager && (
            <button
              type="button"
              className={`reports-subnav-tab ${activeTab === 'registers' ? 'active' : ''}`}
              onClick={() => setActiveTab('registers')}
            >
              <Sliders size={13} />
              <span>Register Setup</span>
              <span className="reports-subnav-badge">{registers.length}</span>
            </button>
          )}
        </div>

        <div className="action-row" style={{ gap: '8px' }}>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void refresh()}
            disabled={loading || busy}
            title="Refresh POS registers and sessions"
            style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
          >
            <RefreshCw size={13} className={loading || busy ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          {!currentSession && registers.length > 0 && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setIsOpenShiftModalOpen(true)}
              style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
            >
              <Store size={13} />
              <span>Open Shift</span>
            </button>
          )}

          {currentSession && manager && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => triggerCloseShift(currentSession)}
              style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
            >
              <Clock size={13} />
              <span>Close Shift</span>
            </button>
          )}

          {manager && activeTab === 'registers' && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setIsNewRegisterModalOpen(true)}
              style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
            >
              <Plus size={13} />
              <span>New Register</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. SUB-TAB VIEW CONTENT */}

      {/* TAB 1: REGISTER TERMINAL WORKSPACE */}
      {activeTab === 'terminal' && (
        <div className="pos-terminal-layout">
          {/* Left Column: Product Catalogue & Scanner */}
          <div className="pos-catalogue-column">
            {/* Shift Inactive Banner if closed */}
            {!currentSession && (
              <div className="pos-shift-warning-banner">
                <AlertCircle size={15} />
                <div>
                  <b>Terminal is offline / shift closed.</b>
                  <p>Open a register shift to record sales and connect to the cash drawer.</p>
                </div>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setIsOpenShiftModalOpen(true)}
                  style={{ height: '28px', fontSize: '11.5px', padding: '0 10px' }}
                >
                  Open Shift
                </button>
              </div>
            )}

            {/* Filter & Barcode Search Bar */}
            <div className="table-controls" style={{ marginBottom: '12px' }}>
              <div className="search-box" style={{ flex: 1, minWidth: '240px' }}>
                <Search size={14} />
                <input
                  ref={searchInputRef}
                  className="search-input"
                  placeholder="Scan barcode [Enter] or search SKU / item name…"
                  value={productSearch}
                  disabled={!!pendingCheckout}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onKeyDown={handleProductScan}
                />
              </div>

              <div className="filter-group">
                <select
                  className="filter-select"
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value as 'ALL' | 'FINISHED' | 'SERVICE')}
                >
                  <option value="ALL">All Categories</option>
                  <option value="FINISHED">Finished Goods</option>
                  <option value="SERVICE">Services</option>
                </select>

                <label className="pos-checkbox-label">
                  <input
                    type="checkbox"
                    checked={productInStockOnly}
                    onChange={(e) => setProductInStockOnly(e.target.checked)}
                  />
                  <span>In stock only</span>
                </label>
              </div>
            </div>

            {/* Product Catalogue Grid */}
            <div className="pos-catalogue-grid">
              {filteredProducts.map((item) => {
                const stockVal = item.available ?? item.stock ?? 0;
                const isService = item.itemType === 'SERVICE';
                const isOutOfStock = !isService && stockVal <= 0;

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
                      <span className="station-code-pill" style={{ fontSize: '10px', padding: '1px 5px' }}>
                        {item.sku}
                      </span>
                      <span
                        className={`status-chip ${
                          isService ? 'status-chip-subtle' : isOutOfStock ? 'status-chip-danger' : 'status-chip-success'
                        }`}
                        style={{ fontSize: '10px', height: '18px', padding: '0 6px' }}
                      >
                        {isService ? 'Service' : isOutOfStock ? 'Out of stock' : `${stockVal} available`}
                      </span>
                    </div>

                    <div className="pos-product-name" title={item.name}>
                      {item.name}
                    </div>

                    <div className="pos-product-bottom">
                      <div className="pos-product-price" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(item.unitPrice)}
                      </div>
                      <button
                        type="button"
                        className="button button-secondary pos-add-btn"
                        disabled={isOutOfStock || !!pendingCheckout}
                        onClick={(e) => {
                          e.stopPropagation();
                          addProduct(item);
                        }}
                      >
                        <Plus size={12} />
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
          </div>

          {/* Right Column: Interactive Basket & Checkout */}
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
                    style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}
                  >
                    Clear basket
                  </button>
                )}
              </div>

              {/* Customer Selector */}
              <div className="pos-customer-selector">
                <label className="pos-input-label">Customer (Optional)</label>
                <select
                  className="filter-select"
                  style={{ width: '100%', height: '32px', fontSize: '12px' }}
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
                  className="button button-primary pos-post-sale-btn"
                  disabled={busy || !basket.length || !currentSession || !!pendingCheckout}
                >
                  {pendingCheckout
                    ? 'Sale awaiting sync…'
                    : busy
                    ? 'Posting sale…'
                    : !currentSession
                    ? 'Shift Closed'
                    : `Post Sale · ${formatCurrency(totalDue)}`}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SHIFTS & DRAWERS */}
      {activeTab === 'shifts' && (
        <div className="pos-shifts-layout">
          {/* Active Cashier Shift Card */}
          <div className="panel directory-panel" style={{ marginBottom: '16px' }}>
            <div className="panel-header directory-top">
              <div>
                <h2>Active Cashier Shift</h2>
                <p>Register drawer float and session sales balance</p>
              </div>
              {currentSession && manager && (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => triggerCloseShift(currentSession)}
                  style={{ height: '32px', fontSize: '12px' }}
                >
                  Close Shift & Count Cash
                </button>
              )}
            </div>

            {currentSession ? (
              <div className="pos-shift-detail-grid">
                <div className="pos-shift-detail-card">
                  <span className="reports-metric-label">REGISTER TERMINAL</span>
                  <b>{currentSession.registerCode}</b>
                  <span>{currentSession.registerName} · {currentSession.warehouseName}</span>
                </div>

                <div className="pos-shift-detail-card">
                  <span className="reports-metric-label">SHIFT STATUS & TIME</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="status-chip status-chip-success" style={{ height: '20px', padding: '0 7px' }}>
                      OPEN
                    </span>
                    <b>Opened {new Date(currentSession.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b>
                  </div>
                  <span>{new Date(currentSession.openedAt).toLocaleDateString()}</span>
                </div>

                <div className="pos-shift-detail-card">
                  <span className="reports-metric-label">OPENING CASH FLOAT</span>
                  <b style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(currentSession.openingFloat)}</b>
                  <span>Initial drawer cash baseline</span>
                </div>

                <div className="pos-shift-detail-card">
                  <span className="reports-metric-label">EXPECTED DRAWER CASH</span>
                  <b style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(currentDrawerCash)}</b>
                  <span>Float + {formatCurrency(shiftCashRevenue)} cash sales</span>
                </div>
              </div>
            ) : (
              <div className="empty-cell" style={{ padding: '24px 16px' }}>
                <Store size={22} style={{ color: 'var(--sp-text-muted)', strokeWidth: 1.5, marginBottom: '6px' }} />
                <div>No active register shift is currently open for your user account.</div>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setIsOpenShiftModalOpen(true)}
                  style={{ marginTop: '12px', height: '30px', fontSize: '12px' }}
                >
                  Open Cashier Shift
                </button>
              </div>
            )}
          </div>

          {/* All Open Shifts Across Terminals (for Managers) */}
          <div className="panel directory-panel" style={{ marginBottom: '16px' }}>
            <div className="panel-header directory-top">
              <div>
                <h2>Active Open Shifts</h2>
                <p>Terminals currently operating on the shop floor</p>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Register</th>
                    <th>Store Warehouse</th>
                    <th>Cashier User</th>
                    <th>Opened At</th>
                    <th style={{ textAlign: 'right' }}>Opening Float</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions
                    .filter((s) => s.status === 'OPEN')
                    .map((s) => (
                      <tr key={s.id}>
                        <td>
                          <b>{s.registerCode}</b>
                          <div style={{ color: 'var(--sp-text-muted)', fontSize: '11px' }}>{s.registerName}</div>
                        </td>
                        <td>{s.warehouseName}</td>
                        <td>
                          {s.cashierUserId === userId ? (
                            <span className="status-chip status-chip-brand">Current User</span>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--sp-text-secondary)' }}>
                              {s.cashierUserId.slice(0, 8)}…
                            </span>
                          )}
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{new Date(s.openedAt).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(s.openingFloat)}
                        </td>
                        <td>
                          <span className="status-chip status-chip-success">OPEN</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {manager && (
                            <button
                              type="button"
                              className="button button-secondary"
                              onClick={() => triggerCloseShift(s)}
                              style={{ height: '26px', fontSize: '11.5px', padding: '0 8px' }}
                            >
                              Close Shift
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                  {!sessions.filter((s) => s.status === 'OPEN').length && (
                    <tr>
                      <td colSpan={7} className="empty-cell">
                        No active open shifts on any register terminal.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shift History Ledger */}
          <div className="panel directory-panel">
            <div className="panel-header directory-top">
              <div>
                <h2>Shift History Ledger</h2>
                <p>Closed register shifts, cash reconciliation, and variance telemetry</p>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Register</th>
                    <th>Opened</th>
                    <th>Closed</th>
                    <th style={{ textAlign: 'right' }}>Opening Float</th>
                    <th style={{ textAlign: 'right' }}>Expected Cash</th>
                    <th style={{ textAlign: 'right' }}>Counted Cash</th>
                    <th style={{ textAlign: 'right' }}>Variance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions
                    .filter((s) => s.status === 'CLOSED')
                    .map((s) => {
                      const variance = Number(s.cashVariance || 0);
                      return (
                        <tr key={s.id}>
                          <td>
                            <b>{s.registerCode}</b>
                            <div style={{ color: 'var(--sp-text-muted)', fontSize: '11px' }}>{s.warehouseName}</div>
                          </td>
                          <td style={{ fontVariantNumeric: 'tabular-nums' }}>{new Date(s.openedAt).toLocaleString()}</td>
                          <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {s.closedAt ? new Date(s.closedAt).toLocaleString() : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(s.openingFloat)}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {s.expectedCash != null ? formatCurrency(s.expectedCash) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {s.countedCash != null ? formatCurrency(s.countedCash) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <span
                              className={`status-chip ${
                                variance === 0
                                  ? 'status-chip-success'
                                  : variance > 0
                                  ? 'status-chip-warning'
                                  : 'status-chip-danger'
                              }`}
                              style={{ fontSize: '11px', height: '18px', padding: '0 6px' }}
                            >
                              {variance >= 0 ? `+${formatCurrency(variance)}` : formatCurrency(variance)}
                            </span>
                          </td>
                          <td>
                            <span className="status-chip status-chip-subtle">CLOSED</span>
                          </td>
                        </tr>
                      );
                    })}

                  {!sessions.filter((s) => s.status === 'CLOSED').length && (
                    <tr>
                      <td colSpan={8} className="empty-cell">
                        No closed shift records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RECEIPTS & RETURNS */}
      {activeTab === 'receipts' && (
        <div className="pos-receipts-layout">
          <div className="panel directory-panel">
            <div className="panel-header directory-top">
              <div>
                <h2>Receipts & Returns Ledger</h2>
                <p>Transactions posted on register shifts with item-level returns and voiding</p>
              </div>

              <div className="action-row" style={{ gap: '8px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={exportReceiptsCsv}
                  disabled={!visibleReceipts.length}
                  style={{ height: '32px', fontSize: '12px', padding: '0 10px' }}
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="table-controls" style={{ marginBottom: '12px' }}>
              <div className="search-box" style={{ flex: 1, minWidth: '220px' }}>
                <Search size={14} />
                <input
                  className="search-input"
                  placeholder="Search receipt #, customer name, SKU…"
                  value={receiptSearch}
                  onChange={(e) => setReceiptSearch(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <label className="pos-mini-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--sp-text-muted)' }}>Shift:</span>
                  <select
                    className="filter-select"
                    value={receiptSessionId}
                    onChange={(e) => {
                      setReceiptSessionId(e.target.value);
                      void loadSales(e.target.value);
                    }}
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.registerCode} · {new Date(s.openedAt).toLocaleDateString()} {new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({s.status})
                      </option>
                    ))}
                  </select>
                </label>

                <select
                  className="filter-select"
                  value={receiptStatusFilter}
                  onChange={(e) =>
                    setReceiptStatusFilter(
                      e.target.value as 'ALL' | 'POSTED' | 'VOIDED' | 'REFUNDED' | 'PARTIAL_REFUND'
                    )
                  }
                >
                  <option value="ALL">All Statuses</option>
                  <option value="POSTED">Posted</option>
                  <option value="VOIDED">Voided</option>
                  <option value="REFUNDED">Refunded</option>
                  <option value="PARTIAL_REFUND">Partial Refund</option>
                </select>
              </div>
            </div>

            {/* Receipts Table */}
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '32px' }}></th>
                    <th>Receipt #</th>
                    <th>Posted Date</th>
                    <th>Customer</th>
                    <th>Tender</th>
                    <th style={{ textAlign: 'center' }}>Items</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Refunded</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
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
                      sale.tenders.every((t) => t.method === 'CASH') &&
                      currentSession?.id === sale.sessionId;

                    const canRefund =
                      manager &&
                      ['POSTED', 'PARTIAL_REFUND'].includes(sale.status) &&
                      sale.lines.some((l) => l.refundableQuantity > 0);

                    return (
                      <Fragment key={sale.id}>
                        <tr
                          className={isExpanded ? 'row-expanded' : ''}
                          onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td style={{ color: 'var(--sp-text-muted)' }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                          <td>
                            <b style={{ color: 'var(--sp-text)' }}>{sale.receiptNumber}</b>
                          </td>
                          <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {new Date(sale.postedAt).toLocaleString()}
                          </td>
                          <td>{cust?.name || 'Walk-in Customer'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {(sale.tenders || []).map((t, idx) => (
                                <span key={idx} className="station-code-pill" style={{ fontSize: '10px' }}>
                                  {t.method}
                                  {t.reference ? ` · ${t.reference}` : ''}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                            {sale.lines.length}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                            {formatCurrency(sale.total)}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {sale.refundedTotal > 0 ? (
                              <span style={{ color: 'var(--sp-danger)' }}>{formatCurrency(sale.refundedTotal)}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            <span
                              className={`status-chip ${
                                sale.status === 'POSTED'
                                  ? 'status-chip-success'
                                  : sale.status === 'VOIDED'
                                  ? 'status-chip-danger'
                                  : 'status-chip-warning'
                              }`}
                            >
                              {sale.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            <div className="action-row" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                              <button
                                type="button"
                                className="button button-secondary"
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
                                style={{ height: '24px', fontSize: '11px', padding: '0 7px' }}
                                title="View printable receipt"
                              >
                                <Printer size={12} />
                                <span>Receipt</span>
                              </button>

                              {canRefund && (
                                <button
                                  type="button"
                                  className="button button-secondary"
                                  onClick={() => openRefundModal(sale)}
                                  style={{ height: '24px', fontSize: '11px', padding: '0 7px' }}
                                >
                                  <RotateCcw size={12} />
                                  <span>Refund</span>
                                </button>
                              )}

                              {canVoid && (
                                <button
                                  type="button"
                                  className="button button-secondary"
                                  disabled={busy}
                                  onClick={() => void handleVoidSale(sale)}
                                  style={{ height: '24px', fontSize: '11px', padding: '0 7px', color: 'var(--sp-danger)' }}
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

                                <table className="data-table" style={{ background: 'var(--sp-surface)' }}>
                                  <thead>
                                    <tr>
                                      <th>SKU</th>
                                      <th>Item Description</th>
                                      <th style={{ textAlign: 'right' }}>Quantity</th>
                                      <th style={{ textAlign: 'right' }}>Unit Price</th>
                                      <th style={{ textAlign: 'right' }}>Line Total</th>
                                      <th style={{ textAlign: 'right' }}>Refundable Units</th>
                                      <th style={{ textAlign: 'right' }}>Refunded Units</th>
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
                      <td colSpan={10} className="empty-cell">
                        No sales receipts recorded on this session.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REGISTER SETUP (MANAGERS ONLY) */}
      {activeTab === 'registers' && manager && (
        <div className="pos-registers-layout">
          <div className="panel directory-panel">
            <div className="panel-header directory-top">
              <div>
                <h2>Configured POS Terminals</h2>
                <p>Hardware registers mapped to shop warehouses and assigned cashiers</p>
              </div>

              <button
                type="button"
                className="button button-primary"
                onClick={() => setIsNewRegisterModalOpen(true)}
                style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
              >
                <Plus size={13} />
                <span>Add Register</span>
              </button>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Register Code</th>
                    <th>Terminal Name</th>
                    <th>Store Warehouse</th>
                    <th>Assigned Cashier</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registers.map((reg) => {
                    const assignedCashier = cashiers.find((c) => c.userId === reg.assignedCashierUserId);
                    return (
                      <tr key={reg.id}>
                        <td>
                          <b>{reg.code}</b>
                        </td>
                        <td>{reg.name}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <WarehouseIcon size={13} style={{ color: 'var(--sp-text-muted)' }} />
                            <span>{reg.warehouseName}</span>
                          </div>
                        </td>
                        <td>
                          {assignedCashier ? (
                            <div>
                              <span>{assignedCashier.name}</span>
                              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                                {assignedCashier.email} · {assignedCashier.role}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                              {reg.assignedCashierUserId ? `Cashier ID: ${reg.assignedCashierUserId.slice(0, 8)}…` : 'Unassigned'}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="status-chip status-chip-success">ACTIVE</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => {
                              setActiveTab('shifts');
                            }}
                            style={{ height: '26px', fontSize: '11.5px', padding: '0 8px' }}
                          >
                            View Shifts
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {!registers.length && (
                    <tr>
                      <td colSpan={6} className="empty-cell">
                        No registers configured yet. Click "Add Register" to connect a POS terminal to a warehouse.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: OPEN SHIFT MODAL */}
      {isOpenShiftModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsOpenShiftModalOpen(false)}>
          <div className="record-modal" style={{ width: 'min(440px, 100%)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <h2>Open Register Shift</h2>
                <p>Initialize cash drawer float and link terminal to warehouse inventory.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpenShiftModalOpen(false)}
                title="Close"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleOpenShift}>
              <label>
                <span>Select Register</span>
                <select
                  name="registerId"
                  value={registerId}
                  onChange={(e) => setRegisterId(e.target.value)}
                  required
                >
                  {registers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} · {r.name} ({r.warehouseName})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Opening Cash Float</span>
                <input
                  name="openingFloat"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={openShiftFloat}
                  required
                  placeholder="0.00"
                />
                <small style={{ color: 'var(--sp-text-muted)', fontSize: '11px', marginTop: '2px' }}>
                  Physical cash in drawer at start of shift.
                </small>
              </label>

              <div className="pos-modal-note">
                Sales will be recorded against the store warehouse assigned to this register terminal.
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setIsOpenShiftModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={busy || !registers.length}>
                  {busy ? 'Opening…' : 'Open Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CLOSE SHIFT MODAL (WITH VARIANCE CALCULATION) */}
      {isCloseShiftModalOpen && closeShiftSession && (
        <div className="modal-backdrop" onClick={() => setIsCloseShiftModalOpen(false)}>
          <div className="record-modal" style={{ width: 'min(480px, 100%)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <h2>Close Register Shift</h2>
                <p>Count cash drawer and reconcile against expected float and sales.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCloseShiftModalOpen(false)}
                title="Close"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCloseShift}>
              <div className="pos-reconcile-card">
                <div className="pos-reconcile-row">
                  <span>Register Terminal:</span>
                  <b>{closeShiftSession.registerCode} · {closeShiftSession.registerName}</b>
                </div>
                <div className="pos-reconcile-row">
                  <span>Store Warehouse:</span>
                  <span>{closeShiftSession.warehouseName}</span>
                </div>
                <div className="pos-reconcile-row">
                  <span>Opened At:</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(closeShiftSession.openedAt).toLocaleString()}
                  </span>
                </div>
                <div className="pos-reconcile-row">
                  <span>Opening Float:</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(closeShiftSession.openingFloat)}
                  </span>
                </div>
                {closeShiftSession.id === currentSession?.id && (
                  <div className="pos-reconcile-row">
                    <span>Shift Cash Sales:</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      +{formatCurrency(shiftCashRevenue)}
                    </span>
                  </div>
                )}
                <div className="pos-reconcile-row pos-reconcile-highlight">
                  <span>Expected Drawer Cash:</span>
                  <b style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(
                      Number(closeShiftSession.openingFloat || 0) +
                        (closeShiftSession.id === currentSession?.id ? shiftCashRevenue : 0)
                    )}
                  </b>
                </div>
              </div>

              <label style={{ marginTop: '14px' }}>
                <span>Counted Cash in Drawer</span>
                <input
                  name="countedCash"
                  type="number"
                  min="0"
                  step="0.01"
                  value={closeShiftCountedCash}
                  onChange={(e) => setCloseShiftCountedCash(e.target.value)}
                  required
                />
              </label>

              {/* Live Variance Calculation */}
              {(() => {
                const exp =
                  Number(closeShiftSession.openingFloat || 0) +
                  (closeShiftSession.id === currentSession?.id ? shiftCashRevenue : 0);
                const counted = Number(closeShiftCountedCash || 0);
                const variance = Math.round((counted - exp) * 100) / 100;
                return (
                  <div
                    className={`pos-variance-box ${
                      variance === 0 ? 'balanced' : variance > 0 ? 'surplus' : 'shortage'
                    }`}
                  >
                    <span className="pos-variance-label">Cash Variance:</span>
                    <b className="pos-variance-amount" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {variance >= 0 ? `+${formatCurrency(variance)}` : formatCurrency(variance)}
                    </b>
                    <small>
                      {variance === 0
                        ? 'Drawer is perfectly balanced'
                        : variance > 0
                        ? 'Surplus in drawer'
                        : 'Cash shortage detected'}
                    </small>
                  </div>
                );
              })()}

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setIsCloseShiftModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={busy}>
                  {busy ? 'Closing…' : 'Confirm & Close Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE REGISTER MODAL */}
      {isNewRegisterModalOpen && manager && (
        <div className="modal-backdrop" onClick={() => setIsNewRegisterModalOpen(false)}>
          <div className="record-modal" style={{ width: 'min(480px, 100%)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <h2>Add Register Terminal</h2>
                <p>Connect a physical point-of-sale checkout counter to a store warehouse.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewRegisterModalOpen(false)}
                title="Close"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateRegister}>
              <label>
                <span>Register Code</span>
                <input name="code" required maxLength={32} placeholder="REG-04" />
              </label>

              <label>
                <span>Terminal Name</span>
                <input name="name" required maxLength={120} placeholder="Counter 2 — Trade Desk" />
              </label>

              <label>
                <span>Assigned Store Warehouse</span>
                <select
                  name="warehouseId"
                  value={newRegisterWarehouseId}
                  onChange={(e) => {
                    setNewRegisterWarehouseId(e.target.value);
                    void loadCashiers(e.target.value);
                  }}
                  required
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} · {w.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Assigned Cashier</span>
                <select
                  name="cashierUserId"
                  value={newRegisterCashierId}
                  onChange={(e) => setNewRegisterCashierId(e.target.value)}
                  required
                >
                  <option value="">Select an active cashier</option>
                  {cashiers.map((c) => (
                    <option key={c.userId} value={c.userId}>
                      {c.name} ({c.email}) · {c.role}
                    </option>
                  ))}
                </select>
                {!cashiers.length && (
                  <small style={{ color: 'var(--sp-warning)', fontSize: '11px', marginTop: '2px' }}>
                    No active cashier found with branch access to this warehouse.
                  </small>
                )}
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setIsNewRegisterModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy || !warehouses.length || !cashiers.length}
                >
                  {busy ? 'Creating…' : 'Create Register'}
                </button>
              </div>
            </form>
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
