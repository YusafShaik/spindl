import { useState, useEffect, useMemo, type FormEvent } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  Gauge,
  Layers,
  LayoutGrid,
  LayoutList,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Truck,
  User,
  Warehouse as WarehouseIcon,
  X
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency } from '../../lib/utils/currency';
import { Status } from '../../components/ui/Status';
import type {
  ChallanSummary,
  ChallanDetail,
  LogisticsMetrics
} from '../../types/logistics';
import type { ItemSummary } from '../../types/inventory';
import type { CustomerRecord } from '../../types/customer';

interface LogisticsPanelProps {
  items: ItemSummary[];
  customers?: CustomerRecord[];
  role?: string;
  notify: (message: string) => void;
}

interface SalesOrderOption {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  status: string;
  lines?: Array<{
    id: string;
    itemId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
}

const CARRIER_OPTIONS = [
  'Blue Dart Express',
  'Delhivery Freight',
  'Safexpress Logistics',
  'DHL Express',
  'FedEx',
  'TCI Freight',
  'DTDC Express',
  'Other / Custom'
];

export function LogisticsPanel({ items, customers = [], role, notify }: LogisticsPanelProps) {
  // Navigation & Data States (Single Screen: Shipments & Challans)
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);

  // Core Data
  const [challans, setChallans] = useState<ChallanSummary[]>([]);
  const [metrics, setMetrics] = useState<LogisticsMetrics | null>(null);
  const [salesOrders, setSalesOrders] = useState<SalesOrderOption[]>([]);
  const [selectedChallanDetail, setSelectedChallanDetail] = useState<ChallanDetail | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState<boolean>(false);
  const [isPodModalOpen, setIsPodModalOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [activeChallan, setActiveChallan] = useState<ChallanSummary | null>(null);

  // Form States - Create Shipment (Simplified, No Boxes)
  const [formSalesOrderId, setFormSalesOrderId] = useState<string>('');
  const [formCustomerId, setFormCustomerId] = useState<string>('');
  const [formWarehouseId, setFormWarehouseId] = useState<string>('');
  const [formCarrierName, setFormCarrierName] = useState<string>('Blue Dart Express');
  const [formCustomCarrier, setFormCustomCarrier] = useState<boolean>(false);
  const [formCarrierMode, setFormCarrierMode] = useState<string>('ROAD');
  const [formTrackingNumber, setFormTrackingNumber] = useState<string>('');
  const [formEwayBillNumber, setFormEwayBillNumber] = useState<string>('');
  const [formWeightKg, setFormWeightKg] = useState<number>(10.0);
  const [formShippingAddress, setFormShippingAddress] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formItems, setFormItems] = useState<Array<{
    packageIndex: number;
    itemId: string;
    quantity: number;
    unitPrice: number;
    hsnCode: string;
  }>>([]);

  // Form States - Update Tracking
  const [trackCarrierName, setTrackCarrierName] = useState<string>('');
  const [trackCarrierMode, setTrackCarrierMode] = useState<string>('ROAD');
  const [trackTrackingNumber, setTrackTrackingNumber] = useState<string>('');
  const [trackEwayBillNumber, setTrackEwayBillNumber] = useState<string>('');

  // Form States - Record POD
  const [podRecipientName, setPodRecipientName] = useState<string>('');
  const [podNotes, setPodNotes] = useState<string>('');

  // Initial Data Fetch
  const loadData = async () => {
    setLoading(true);
    try {
      const [challanData, metricsData, ordersData] = await Promise.all([
        apiFetch(`${API}/logistics/challans`).then((r) => (r.ok ? r.json() : [])),
        apiFetch(`${API}/logistics/metrics`).then((r) => (r.ok ? r.json() : null)),
        apiFetch(`${API}/sales-orders`).then((r) => (r.ok ? r.json() : []))
      ]);
      setChallans(challanData);
      setMetrics(metricsData);
      setSalesOrders(ordersData);
    } catch (e) {
      console.error('Failed to load logistics data', e);
      notify('Failed to load logistics consignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch full detail when viewing or printing a challan
  const openChallanDetail = async (c: ChallanSummary, printMode = false) => {
    setActiveChallan(c);
    try {
      const res = await apiFetch(`${API}/logistics/challans/${c.id}`);
      if (res.ok) {
        const detail: ChallanDetail = await res.json();
        setSelectedChallanDetail(detail);
        if (printMode) {
          setIsPrintModalOpen(true);
        }
      }
    } catch (e) {
      notify('Could not load consignment details');
    }
  };

  // When Sales Order is picked in Create Modal
  const handleSelectSalesOrder = (orderId: string) => {
    setFormSalesOrderId(orderId);
    const order = salesOrders.find((o) => o.id === orderId);
    if (order) {
      setFormCustomerId(order.customerId);
      const cust = customers.find((c) => c.id === order.customerId);
      if (cust) {
        const addr = [cust.addressLine1, cust.addressLine2, cust.city, cust.region, cust.postalCode]
          .filter(Boolean)
          .join(', ');
        setFormShippingAddress(addr || `${cust.name} Factory Receiving Dock`);
      }
      if (order.lines && order.lines.length > 0) {
        setFormItems(
          order.lines.map((l) => ({
            packageIndex: 0,
            itemId: l.itemId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            hsnCode: '8481.80.30'
          }))
        );
      }
    }
  };

  // Actions
  const handleDispatch = async (challanId: string) => {
    setBusy(true);
    try {
      const res = await apiFetch(`${API}/logistics/challans/${challanId}/dispatch`, { method: 'POST' });
      if (res.ok) {
        notify('Consignment marked IN_TRANSIT. Transferred to 3rd-party carrier.');
        await loadData();
        if (selectedChallanDetail) {
          const updated = await apiFetch(`${API}/logistics/challans/${challanId}`).then(r => r.ok ? r.json() : null);
          if (updated) setSelectedChallanDetail(updated);
        }
      } else {
        notify('Failed to dispatch consignment');
      }
    } catch (e) {
      notify('Dispatch action error');
    } finally {
      setBusy(false);
    }
  };

  const openTrackingModal = (c: ChallanSummary) => {
    setActiveChallan(c);
    setTrackCarrierName(c.carrierName || 'Blue Dart Express');
    setTrackCarrierMode(c.carrierMode || 'ROAD');
    setTrackTrackingNumber(c.trackingNumber || '');
    setTrackEwayBillNumber(c.ewayBillNumber || '');
    setIsTrackingModalOpen(true);
  };

  const handleUpdateTracking = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeChallan) return;
    setBusy(true);
    try {
      const res = await apiFetch(`${API}/logistics/challans/${activeChallan.id}/tracking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrierName: trackCarrierName,
          carrierMode: trackCarrierMode,
          trackingNumber: trackTrackingNumber || null,
          vehicleNumber: null,
          driverName: null,
          driverPhone: null,
          ewayBillNumber: trackEwayBillNumber || null
        })
      });
      if (res.ok) {
        notify('Carrier tracking & e-Way bill updated');
        setIsTrackingModalOpen(false);
        await loadData();
        if (selectedChallanDetail && selectedChallanDetail.summary.id === activeChallan.id) {
          const updated = await apiFetch(`${API}/logistics/challans/${activeChallan.id}`).then(r => r.ok ? r.json() : null);
          if (updated) setSelectedChallanDetail(updated);
        }
      } else {
        notify('Failed to update tracking');
      }
    } catch (err) {
      notify('Error updating tracking');
    } finally {
      setBusy(false);
    }
  };

  const openPodModal = (c: ChallanSummary) => {
    setActiveChallan(c);
    setPodRecipientName('');
    setPodNotes('Goods received in full and satisfactory condition.');
    setIsPodModalOpen(true);
  };

  const handleRecordPod = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeChallan) return;
    setBusy(true);
    try {
      const res = await apiFetch(`${API}/logistics/challans/${activeChallan.id}/pod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: podRecipientName,
          podNotes: podNotes,
          deliveryTime: new Date().toISOString()
        })
      });
      if (res.ok) {
        notify('Proof of Delivery (POD) recorded. Consignment DELIVERED.');
        setIsPodModalOpen(false);
        await loadData();
        if (selectedChallanDetail && selectedChallanDetail.summary.id === activeChallan.id) {
          const updated = await apiFetch(`${API}/logistics/challans/${activeChallan.id}`).then(r => r.ok ? r.json() : null);
          if (updated) setSelectedChallanDetail(updated);
        }
      } else {
        notify('Failed to record POD');
      }
    } catch (err) {
      notify('Error recording POD');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateChallan = async (e: FormEvent) => {
    e.preventDefault();
    if (!formCustomerId) {
      notify('Please select a destination customer');
      return;
    }
    setBusy(true);
    try {
      const singlePackage = [
        {
          packageNumber: '1',
          packageType: 'PACKAGE',
          weightKg: Number(formWeightKg) || 1.0,
          dimensionsCm: '',
          contentsSummary: 'Outbound goods consignment'
        }
      ];

      const res = await apiFetch(`${API}/logistics/challans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesOrderId: formSalesOrderId || null,
          customerId: formCustomerId,
          warehouseId: formWarehouseId || null,
          carrierName: formCarrierName,
          carrierMode: formCarrierMode,
          trackingNumber: formTrackingNumber || null,
          vehicleNumber: null,
          driverName: null,
          driverPhone: null,
          ewayBillNumber: formEwayBillNumber || null,
          shippingAddress: formShippingAddress,
          notes: formNotes,
          packages: singlePackage,
          items: formItems
        })
      });
      if (res.ok) {
        notify('Shipment & Delivery Challan created successfully');
        setIsCreateModalOpen(false);
        await loadData();
      } else {
        notify('Failed to create Delivery Challan');
      }
    } catch (err) {
      notify('Error creating Delivery Challan');
    } finally {
      setBusy(false);
    }
  };

  // Filtered List
  const filteredChallans = useMemo(() => {
    return challans.filter((c) => {
      const matchesStatus =
        statusFilter === 'ALL' || c.status.toUpperCase() === statusFilter.toUpperCase();
      const matchesSearch =
        !searchQuery.trim() ||
        c.challanNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.orderNumber && c.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.carrierName && c.carrierName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.trackingNumber && c.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.ewayBillNumber && c.ewayBillNumber.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [challans, statusFilter, searchQuery]);

  const packedCount = useMemo(() => challans.filter((c) => c.status === 'PACKED').length, [challans]);
  const inTransitCount = useMemo(() => challans.filter((c) => c.status === 'IN_TRANSIT').length, [challans]);
  const deliveredCount = useMemo(() => challans.filter((c) => c.status === 'DELIVERED').length, [challans]);

  return (
    <div className="sales-screen-layout">
      {/* 1. EXECUTIVE METRICS STRIP (4 LINEAR TELEMETRY CARDS) */}
      <div className="linear-kpi-grid">
        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Active Shipments (In Transit)</span>
            <Truck size={14} className="linear-kpi-icon" />
          </div>
          <div className="linear-kpi-value">
            {metrics ? `${metrics.activeInTransit} Active` : `${inTransitCount} Active`}
          </div>
          <div className="linear-kpi-caption">
            Road and air multi-carrier transport
          </div>
        </div>

        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Ready at Dock (Packed)</span>
            <PackageCheck size={14} className="linear-kpi-icon" />
          </div>
          <div className="linear-kpi-value">
            {metrics ? `${metrics.readyForPickup} Ready` : `${packedCount} Ready`}
          </div>
          <div className="linear-kpi-caption">
            Consolidated & sealed, awaiting carrier pickup
          </div>
        </div>

        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Dispatch Consignment Value</span>
            <FileText size={14} className="linear-kpi-icon" />
          </div>
          <div className="linear-kpi-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {metrics ? formatCurrency(metrics.totalDispatchedValue) : '₹ 83,700.00'}
          </div>
          <div className="linear-kpi-caption">
            {metrics ? `${metrics.totalWeightKg.toFixed(1)} kg gross outbound weight` : '132.7 kg gross'}
          </div>
        </div>

        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Carrier SLA Performance</span>
            <ShieldCheck size={14} className="linear-kpi-icon" />
          </div>
          <div className="linear-kpi-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {metrics ? `${metrics.onTimeSlaPercent.toFixed(1)}%` : '98.4%'}
          </div>
          <div className="linear-kpi-caption">
            {metrics ? `${metrics.deliveredTotal} verified delivered` : `${deliveredCount} verified delivered`}
          </div>
        </div>
      </div>

      {/* 2. SINGLE SCREEN HEADER & PRIMARY ACTIONS (No Redundant Tabs) */}
      <div className="sales-subnav-container" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={15} style={{ color: 'var(--sp-brand)' }} />
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)', margin: 0 }}>
            Shipments & Challans
          </h2>
          <span className="sales-subnav-badge">{challans.length}</span>
        </div>

        <div className="sales-subnav-actions">
          <button
            type="button"
            className="sales-action-btn secondary"
            onClick={loadData}
            title="Refresh consignments"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="sales-action-btn primary"
            onClick={() => {
              setFormCustomerId(customers.length > 0 ? customers[0].id : '');
              setIsCreateModalOpen(true);
            }}
          >
            <Truck size={13} />
            <span>+ Create Shipment</span>
          </button>
        </div>
      </div>

      {/* 3. MAIN CONTENT: LIST / BOARD OR DETAIL VIEW */}
      {selectedChallanDetail && !isPrintModalOpen ? (
        /* =========================================================================
           AUTHENTIC LINEAR DETAIL VIEW: LOGISTICS SHIPMENT & CHALLAN
           ========================================================================= */
        <div className="linear-detail-container">
          {/* Top Bar with Breadcrumbs & Actions */}
          <div className="linear-detail-topbar">
            <div className="linear-detail-breadcrumbs">
              <button
                type="button"
                className="linear-crumb-back"
                onClick={() => {
                  setSelectedChallanDetail(null);
                  setActiveChallan(null);
                }}
                title="Back to Shipments list"
              >
                <ArrowLeft size={13} />
                <span>Shipments</span>
              </button>
              <span className="linear-crumb-sep">/</span>
              <span className="linear-crumb-id">{selectedChallanDetail.summary.challanNumber}</span>
            </div>

            <div className="linear-detail-top-actions">
              {selectedChallanDetail.summary.status === 'PACKED' && (
                <button
                  type="button"
                  className="sales-action-btn primary"
                  onClick={() => handleDispatch(selectedChallanDetail.summary.id)}
                  disabled={busy}
                >
                  <Truck size={12} />
                  <span>Dispatch to Carrier</span>
                </button>
              )}

              {selectedChallanDetail.summary.status === 'IN_TRANSIT' && (
                <button
                  type="button"
                  className="sales-action-btn primary"
                  style={{ background: '#059669' }}
                  onClick={() => openPodModal(selectedChallanDetail.summary)}
                  disabled={busy}
                >
                  <CheckCircle2 size={12} />
                  <span>Record Proof of Delivery (POD)</span>
                </button>
              )}

              <button
                type="button"
                className="sales-action-btn secondary"
                onClick={() => setIsPrintModalOpen(true)}
                title="Print Delivery Challan"
              >
                <Printer size={12} />
                <span>Print Document</span>
              </button>

              <button
                type="button"
                className="sales-action-btn secondary"
                onClick={() => openTrackingModal(selectedChallanDetail.summary)}
                title="Update 3rd-Party Carrier & AWB Tracking"
              >
                <Truck size={12} />
                <span>Update Tracking</span>
              </button>
            </div>
          </div>

          {/* 2-Column Linear Detail Grid */}
          <div className="linear-detail-grid">
            {/* Left Column: Customer destination & Shipped contents */}
            <div className="linear-detail-content">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="order-number-pill interactive">
                    <span>{selectedChallanDetail.summary.challanNumber}</span>
                  </span>
                  <Status label={selectedChallanDetail.summary.status} />
                  <span className="sales-warehouse-pill">{selectedChallanDetail.summary.carrierMode || 'ROAD'}</span>
                </div>
                <h1 className="linear-detail-h1">{selectedChallanDetail.summary.customerName}</h1>
                <div className="linear-detail-desc" style={{ marginTop: '4px' }}>
                  {selectedChallanDetail.shippingAddress}
                  {selectedChallanDetail.summary.orderNumber ? ` · Ref: ${selectedChallanDetail.summary.orderNumber}` : ''}
                </div>
              </div>

              {/* Shipped Items Breakdown */}
              {selectedChallanDetail.items && selectedChallanDetail.items.length > 0 && (
                <div className="linear-sublines-card">
                  <div className="linear-sublines-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Boxes size={13} style={{ color: 'var(--sp-brand)' }} />
                      <span>Consignment Items Breakdown ({selectedChallanDetail.items.length} Line Items)</span>
                    </div>
                  </div>
                  <table className="sales-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Item Description</th>
                        <th>HSN / SAC</th>
                        <th style={{ textAlign: 'right' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Unit Rate</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedChallanDetail.items.map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td>
                            <div style={{ fontWeight: 500, color: 'var(--sp-text)' }}>{item.itemName}</div>
                            <span className="sales-ref-badge" style={{ fontSize: '10.5px', marginTop: '2px' }}>{item.sku}</span>
                          </td>
                          <td>
                            <code style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>{item.hsnCode || '8481.80'}</code>
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                            {item.quantity} {item.unit}
                          </td>
                          <td className="sales-amount-cell" style={{ textAlign: 'right' }}>
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="sales-amount-cell" style={{ textAlign: 'right', fontWeight: 500 }}>
                            {formatCurrency(item.totalPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right Column: Linear Properties Sidebar */}
            <div className="linear-properties-sidebar">
              <div className="linear-properties-card">
                <div className="linear-properties-title">Shipment Properties</div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Status</span>
                  <Status label={selectedChallanDetail.summary.status} />
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">3rd-Party Carrier</span>
                  <span className="linear-property-value" style={{ fontWeight: 500 }} title={selectedChallanDetail.summary.carrierName || undefined}>
                    {selectedChallanDetail.summary.carrierName || 'Unassigned'}
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Transport Mode</span>
                  <span className="linear-property-value">
                    <span className="sales-warehouse-pill">{selectedChallanDetail.summary.carrierMode || 'ROAD'}</span>
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Airway Bill (AWB)</span>
                  <span className="linear-property-value">
                    {selectedChallanDetail.summary.trackingNumber ? (
                      <span className="sales-ref-badge" style={{ color: 'var(--sp-brand)', fontWeight: 500 }}>
                        {selectedChallanDetail.summary.trackingNumber}
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>AWB Pending</span>
                    )}
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">e-Way Bill</span>
                  <span className="linear-property-value">
                    <span className="sales-ref-badge">{selectedChallanDetail.summary.ewayBillNumber || 'Exempt / None'}</span>
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Gross Weight</span>
                  <span className="linear-property-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {selectedChallanDetail.summary.totalWeightKg.toFixed(1)} kg
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Consignment Value</span>
                  <span className="linear-property-value" style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--sp-text)' }}>
                    {formatCurrency(selectedChallanDetail.summary.totalValue)}
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Dispatched At</span>
                  <span className="linear-property-value" style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                    {selectedChallanDetail.summary.dispatchedAt ? new Date(selectedChallanDetail.summary.dispatchedAt).toLocaleString() : 'Not Yet Dispatched'}
                  </span>
                </div>

                {selectedChallanDetail.summary.podRecipientName && (
                  <div className="linear-property-row">
                    <span className="linear-property-label">POD Receiver</span>
                    <span className="linear-property-value" style={{ fontSize: '11.5px', fontWeight: 500 }}>
                      {selectedChallanDetail.summary.podRecipientName}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {/* Linear Triage Filter Toolbar */}
          <div className="sales-toolbar" style={{ marginBottom: '12px' }}>
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setStatusFilter('ALL')}
              >
                <span>All Consignments</span>
                <span className="sales-pill-count">{challans.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${statusFilter === 'PACKED' ? 'active' : ''}`}
                onClick={() => setStatusFilter('PACKED')}
              >
                <span>Packed</span>
                <span className="sales-pill-count">{packedCount}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${statusFilter === 'IN_TRANSIT' ? 'active' : ''}`}
                onClick={() => setStatusFilter('IN_TRANSIT')}
              >
                <span>In Transit</span>
                <span className="sales-pill-count">{inTransitCount}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${statusFilter === 'DELIVERED' ? 'active' : ''}`}
                onClick={() => setStatusFilter('DELIVERED')}
              >
                <span>Delivered</span>
                <span className="sales-pill-count">{deliveredCount}</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="pos-view-toggle">
                <button
                  type="button"
                  className={`pos-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List View"
                >
                  <LayoutList size={13} />
                </button>
                <button
                  type="button"
                  className={`pos-view-btn ${viewMode === 'board' ? 'active' : ''}`}
                  onClick={() => setViewMode('board')}
                  title="Kanban Board View"
                >
                  <LayoutGrid size={13} />
                </button>
              </div>

              <div className="sales-search-box">
                <Search size={13} className="sales-search-icon" />
                <input
                  className="sales-search-input"
                  placeholder="Filter DC #, customer, tracking…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery ? (
                  <button type="button" className="sales-search-clear" onClick={() => setSearchQuery('')}>
                    <X size={12} />
                  </button>
                ) : (
                  <kbd className="sales-search-kbd">/</kbd>
                )}
              </div>
            </div>
          </div>

          {/* LIST VIEW (Clean Minimum Data with Clickable Affordance) */}
          {viewMode === 'list' && (
            <div className="sales-table-card">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ width: '150px' }}>Challan / Ref</th>
                    <th style={{ width: '110px' }}>Status</th>
                    <th>Customer & Destination</th>
                    <th>3rd-Party Carrier & Tracking</th>
                    <th style={{ textAlign: 'right', width: '120px' }}>Weight</th>
                    <th style={{ textAlign: 'right', width: '130px' }}>Consignment Value</th>
                    <th style={{ textAlign: 'right', width: '120px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChallans.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--sp-text-muted)' }}>
                        No delivery challans found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredChallans.map((c) => {
                      return (
                        <tr
                          key={c.id}
                          className="sales-row production-clickable-row"
                          onClick={() => openChallanDetail(c)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <button
                              type="button"
                              className="order-number-pill interactive"
                              onClick={(e) => {
                                e.stopPropagation();
                                openChallanDetail(c);
                              }}
                              title="Click to view full shipment details"
                            >
                              <span>{c.challanNumber}</span>
                              <ArrowUpRight size={12} className="order-link-arrow" />
                            </button>
                            <div className="sales-date-cell" style={{ marginTop: '3px' }}>
                              {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </td>

                          <td>
                            <Status label={c.status} />
                          </td>

                          <td>
                            <div className="sales-customer-cell">
                              <div className="sales-customer-avatar">
                                {c.customerName ? c.customerName.charAt(0).toUpperCase() : 'C'}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div className="sales-customer-name" title={c.customerName}>{c.customerName}</div>
                                <div className="sales-sub-ref">
                                  {c.customerCity ? `${c.customerCity} · ` : ''}
                                  {c.orderNumber ? `Ref: ${c.orderNumber}` : 'Direct Consignment'}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                              {c.carrierName || 'Unassigned Carrier'}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '3px' }}>
                              <span className="sales-warehouse-pill">{c.carrierMode || 'ROAD'}</span>
                              {c.trackingNumber ? (
                                <span className="sales-ref-badge" style={{ fontSize: '11px', color: 'var(--sp-brand)', fontWeight: 500 }}>
                                  AWB: {c.trackingNumber}
                                </span>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>AWB Pending</span>
                              )}
                            </div>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                              {c.totalWeightKg.toFixed(1)} kg
                            </div>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <div className="sales-amount-cell" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                              {formatCurrency(c.totalValue)}
                            </div>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="sales-action-btn secondary sp-row-inspect-btn"
                              style={{ height: '26px', padding: '0 8px', fontSize: '11px', gap: '4px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openChallanDetail(c);
                              }}
                              title="Click to view full consignment details"
                            >
                              <span>View Details</span>
                              <ChevronRight size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* KANBAN BOARD VIEW */}
          {viewMode === 'board' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'start' }}>
              {/* READY FOR PICKUP */}
              <div className="sales-table-card" style={{ padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', letterSpacing: '0.02em' }}>
                    READY FOR PICKUP (PACKED)
                  </span>
                  <span className="sales-subnav-badge">
                    {filteredChallans.filter((c) => c.status === 'PACKED').length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredChallans
                    .filter((c) => c.status === 'PACKED')
                    .map((c) => (
                      <div
                        key={c.id}
                        className="production-clickable-row"
                        onClick={() => openChallanDetail(c)}
                        style={{
                          background: 'var(--sp-surface-subtle)',
                          border: '1px solid var(--sp-border)',
                          borderRadius: '6px',
                          padding: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <button
                            type="button"
                            className="order-number-pill interactive"
                            onClick={(e) => {
                              e.stopPropagation();
                              openChallanDetail(c);
                            }}
                          >
                            <span>{c.challanNumber}</span>
                            <ArrowUpRight size={12} className="order-link-arrow" />
                          </button>
                          <span style={{ fontWeight: 500, fontSize: '12px', fontVariantNumeric: 'tabular-nums', color: 'var(--sp-text)' }}>
                            {formatCurrency(c.totalValue)}
                          </span>
                        </div>

                        <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)', marginBottom: '4px' }}>
                          {c.customerName}
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginBottom: '8px' }}>
                          {c.carrierName || '3rd-Party Carrier'} · {c.totalWeightKg.toFixed(1)} kg gross
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--sp-border)' }}>
                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            style={{ height: '22px', padding: '0 6px', fontSize: '11px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openChallanDetail(c, true);
                            }}
                          >
                            <Printer size={11} /> Print
                          </button>

                          <button
                            type="button"
                            className="sales-action-btn primary"
                            style={{ height: '22px', padding: '0 8px', fontSize: '11px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDispatch(c.id);
                            }}
                            disabled={busy}
                          >
                            <Truck size={11} /> Dispatch
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* IN TRANSIT */}
              <div className="sales-table-card" style={{ padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', letterSpacing: '0.02em' }}>
                    IN TRANSIT (WITH CARRIER)
                  </span>
                  <span className="sales-subnav-badge">
                    {filteredChallans.filter((c) => c.status === 'IN_TRANSIT').length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredChallans
                    .filter((c) => c.status === 'IN_TRANSIT')
                    .map((c) => (
                      <div
                        key={c.id}
                        className="production-clickable-row"
                        onClick={() => openChallanDetail(c)}
                        style={{
                          background: 'var(--sp-surface-subtle)',
                          border: '1px solid var(--sp-border)',
                          borderRadius: '6px',
                          padding: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <button
                            type="button"
                            className="order-number-pill interactive"
                            onClick={(e) => {
                              e.stopPropagation();
                              openChallanDetail(c);
                            }}
                          >
                            <span>{c.challanNumber}</span>
                            <ArrowUpRight size={12} className="order-link-arrow" />
                          </button>
                          <Status label="IN_TRANSIT" />
                        </div>

                        <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)', marginBottom: '4px' }}>
                          {c.customerName}
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginBottom: '4px' }}>
                          {c.carrierName} · {c.totalWeightKg.toFixed(1)} kg
                        </div>

                        {c.trackingNumber && (
                          <div style={{ fontSize: '11px', color: 'var(--sp-brand)', fontWeight: 500, marginBottom: '8px' }}>
                            AWB: {c.trackingNumber}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--sp-border)' }}>
                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            style={{ height: '22px', padding: '0 6px', fontSize: '11px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openChallanDetail(c, true);
                            }}
                          >
                            <Printer size={11} /> Print
                          </button>

                          <button
                            type="button"
                            className="sales-action-btn primary"
                            style={{ height: '22px', padding: '0 8px', fontSize: '11px', background: '#059669' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openPodModal(c);
                            }}
                            disabled={busy}
                          >
                            <CheckCircle2 size={11} /> Record POD
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* DELIVERED */}
              <div className="sales-table-card" style={{ padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', letterSpacing: '0.02em' }}>
                    DELIVERED & VERIFIED
                  </span>
                  <span className="sales-subnav-badge">
                    {filteredChallans.filter((c) => c.status === 'DELIVERED').length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredChallans
                    .filter((c) => c.status === 'DELIVERED')
                    .map((c) => (
                      <div
                        key={c.id}
                        className="production-clickable-row"
                        onClick={() => openChallanDetail(c)}
                        style={{
                          background: 'var(--sp-surface-subtle)',
                          border: '1px solid var(--sp-border)',
                          borderRadius: '6px',
                          padding: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <button
                            type="button"
                            className="order-number-pill interactive"
                            onClick={(e) => {
                              e.stopPropagation();
                              openChallanDetail(c);
                            }}
                          >
                            <span>{c.challanNumber}</span>
                            <ArrowUpRight size={12} className="order-link-arrow" />
                          </button>
                          <Status label="DELIVERED" />
                        </div>

                        <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)', marginBottom: '4px' }}>
                          {c.customerName}
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginBottom: '6px' }}>
                          {c.carrierName} · POD Signed · {c.totalWeightKg.toFixed(1)} kg
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--sp-border)' }}>
                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            style={{ height: '22px', padding: '0 6px', fontSize: '11px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openChallanDetail(c, true);
                            }}
                          >
                            <Printer size={11} /> View Challan
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: CREATE SHIPMENT / DELIVERY CHALLAN (CLEAN VISUAL HIERARCHY)
          ========================================================================= */}
      {isCreateModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="sales-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '580px', width: '92vw' }}
          >
            {/* Modal Header */}
            <div className="sales-card-header" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--sp-border)' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--sp-text)', margin: 0 }}>
                  Create Outbound Shipment
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', margin: '2px 0 0' }}>
                  Assign 3rd-party commercial carrier and generate delivery challan.
                </p>
              </div>
              <button
                type="button"
                className="sales-search-clear"
                onClick={() => setIsCreateModalOpen(false)}
                title="Close"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateChallan} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
              {/* SECTION 1: CUSTOMER & DESTINATION */}
              <div className="sp-modal-section">
                <div className="sp-modal-section-title">
                  <span className="sp-step-num">1</span>
                  <span>Customer & Destination</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', marginTop: '10px' }}>
                  <div>
                    <label className="sp-modal-field-label">
                      Consignee Customer <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      className="sp-form-select"
                      value={formCustomerId}
                      onChange={(e) => setFormCustomerId(e.target.value)}
                      required
                    >
                      <option value="">Select customer…</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="sp-modal-field-label">
                      Link Sales Order <span style={{ color: 'var(--sp-text-muted)', fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <select
                      className="sp-form-select"
                      value={formSalesOrderId}
                      onChange={(e) => handleSelectSalesOrder(e.target.value)}
                    >
                      <option value="">Direct Consignment</option>
                      {salesOrders.map((so) => (
                        <option key={so.id} value={so.id}>
                          {so.orderNumber} — {so.customerName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <label className="sp-modal-field-label">
                    Delivery Site & Shipping Address <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    className="sp-form-textarea"
                    style={{ height: '52px', resize: 'vertical' }}
                    placeholder="Plant gate address, receiving bay, city, state, PIN code..."
                    value={formShippingAddress}
                    onChange={(e) => setFormShippingAddress(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* SECTION 2: 3RD-PARTY CARRIER & TRACKING */}
              <div className="sp-modal-section">
                <div className="sp-modal-section-title">
                  <span className="sp-step-num">2</span>
                  <span>3rd-Party Carrier & Tracking</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.3fr', gap: '10px', marginTop: '10px' }}>
                  <div>
                    <label className="sp-modal-field-label">
                      Carrier Partner <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      className="sp-form-select"
                      value={formCustomCarrier ? 'Other / Custom' : formCarrierName}
                      onChange={(e) => {
                        if (e.target.value === 'Other / Custom') {
                          setFormCustomCarrier(true);
                          setFormCarrierName('');
                        } else {
                          setFormCustomCarrier(false);
                          setFormCarrierName(e.target.value);
                        }
                      }}
                    >
                      {CARRIER_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="sp-modal-field-label">Transport Mode</label>
                    <select
                      className="sp-form-select"
                      value={formCarrierMode}
                      onChange={(e) => setFormCarrierMode(e.target.value)}
                    >
                      <option value="ROAD">ROAD</option>
                      <option value="AIR">AIR</option>
                      <option value="RAIL">RAIL</option>
                      <option value="EXPRESS">EXPRESS</option>
                    </select>
                  </div>

                  <div>
                    <label className="sp-modal-field-label">
                      Airway Bill (AWB) #
                    </label>
                    <input
                      className="sp-form-input"
                      placeholder="e.g. BD-882910482"
                      value={formTrackingNumber}
                      onChange={(e) => setFormTrackingNumber(e.target.value)}
                    />
                  </div>
                </div>

                {formCustomCarrier && (
                  <div style={{ marginTop: '10px' }}>
                    <label className="sp-modal-field-label">
                      Custom Carrier Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      className="sp-form-input"
                      placeholder="Enter commercial transporter name..."
                      value={formCarrierName}
                      onChange={(e) => setFormCarrierName(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              {/* SECTION 3: WEIGHT & COMPLIANCE */}
              <div className="sp-modal-section">
                <div className="sp-modal-section-title">
                  <span className="sp-step-num">3</span>
                  <span>Consignment Weight & Compliance</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '10px', marginTop: '10px' }}>
                  <div>
                    <label className="sp-modal-field-label">
                      Gross Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="sp-form-input"
                      placeholder="e.g. 15.0"
                      value={formWeightKg || ''}
                      onChange={(e) => setFormWeightKg(parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div>
                    <label className="sp-modal-field-label">
                      GST e-Way Bill Number <span style={{ color: 'var(--sp-text-muted)', fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <input
                      className="sp-form-input"
                      placeholder="12-digit e-Way Bill"
                      value={formEwayBillNumber}
                      onChange={(e) => setFormEwayBillNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <label className="sp-modal-field-label">
                    Dispatch Notes & Instructions <span style={{ color: 'var(--sp-text-muted)', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <input
                    className="sp-form-input"
                    placeholder="e.g. Fragile parts, dock gate clearance"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="sales-action-btn primary" disabled={busy}>
                  {busy ? 'Creating…' : 'Create Delivery Challan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: UPDATE 3RD-PARTY CARRIER TRACKING
          ========================================================================= */}
      {isTrackingModalOpen && activeChallan && (
        <div className="modal-backdrop" onClick={() => setIsTrackingModalOpen(false)}>
          <div
            className="sales-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px' }}
          >
            <div className="sales-card-header" style={{ paddingBottom: '10px', borderBottom: '1px solid var(--sp-border)' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--sp-text)', margin: 0 }}>
                  Update Carrier Tracking
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', margin: '2px 0 0' }}>
                  {activeChallan.challanNumber} · {activeChallan.customerName}
                </p>
              </div>
              <button
                type="button"
                className="sales-search-clear"
                onClick={() => setIsTrackingModalOpen(false)}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleUpdateTracking} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label className="sp-modal-field-label">
                    3rd-Party Carrier Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    className="sp-form-input"
                    value={trackCarrierName}
                    onChange={(e) => setTrackCarrierName(e.target.value)}
                    placeholder="e.g. Blue Dart, Delhivery, Safexpress"
                    required
                  />
                </div>

                <div>
                  <label className="sp-modal-field-label">Mode</label>
                  <select
                    className="sp-form-select"
                    value={trackCarrierMode}
                    onChange={(e) => setTrackCarrierMode(e.target.value)}
                  >
                    <option value="ROAD">ROAD</option>
                    <option value="AIR">AIR</option>
                    <option value="RAIL">RAIL</option>
                    <option value="EXPRESS">EXPRESS</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="sp-modal-field-label">
                    Airway Bill / Tracking (AWB) #
                  </label>
                  <input
                    className="sp-form-input"
                    placeholder="e.g. BD-882910482"
                    value={trackTrackingNumber}
                    onChange={(e) => setTrackTrackingNumber(e.target.value)}
                  />
                </div>

                <div>
                  <label className="sp-modal-field-label">
                    e-Way Bill Number
                  </label>
                  <input
                    className="sp-form-input"
                    placeholder="12-digit e-Way Bill"
                    value={trackEwayBillNumber}
                    onChange={(e) => setTrackEwayBillNumber(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={() => setIsTrackingModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="sales-action-btn primary" disabled={busy}>
                  {busy ? 'Updating…' : 'Save Tracking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: RECORD PROOF OF DELIVERY (POD)
          ========================================================================= */}
      {isPodModalOpen && activeChallan && (
        <div className="modal-backdrop" onClick={() => setIsPodModalOpen(false)}>
          <div
            className="sales-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '460px' }}
          >
            <div className="sales-card-header" style={{ paddingBottom: '10px', borderBottom: '1px solid var(--sp-border)' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--sp-text)', margin: 0 }}>
                  Record Proof of Delivery (POD)
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', margin: '2px 0 0' }}>
                  {activeChallan.challanNumber} · {activeChallan.customerName}
                </p>
              </div>
              <button
                type="button"
                className="sales-search-clear"
                onClick={() => setIsPodModalOpen(false)}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleRecordPod} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
              <div>
                <label className="sp-modal-field-label">
                  Receiver Name / Gate Officer <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  className="sp-form-input"
                  placeholder="e.g. Devendra Patil (Store Incharge)"
                  value={podRecipientName}
                  onChange={(e) => setPodRecipientName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="sp-modal-field-label">
                  Receiving Notes & Condition
                </label>
                <textarea
                  className="sp-form-textarea"
                  style={{ height: '60px' }}
                  value={podNotes}
                  onChange={(e) => setPodNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={() => setIsPodModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sales-action-btn primary"
                  style={{ background: '#059669' }}
                  disabled={busy}
                >
                  {busy ? 'Recording…' : '✓ Mark Consignment Delivered'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: INDUSTRIAL PRINTABLE DELIVERY CHALLAN DOCUMENT
          ========================================================================= */}
      {isPrintModalOpen && selectedChallanDetail && (
        <div className="modal-backdrop" onClick={() => setIsPrintModalOpen(false)}>
          <div
            className="sales-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '860px', width: '92vw', maxHeight: '92vh', background: '#ffffff', color: '#0f172a', overflowX: 'hidden' }}
          >
            {/* Action Bar (Not Printed) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                Delivery Challan Preview
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="sales-action-btn primary"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                  onClick={() => window.print()}
                >
                  <Printer size={12} /> Print Document
                </button>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  style={{ padding: '4px 8px' }}
                  onClick={() => setIsPrintModalOpen(false)}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* PRINTABLE AREA */}
            <div style={{ padding: '8px', fontFamily: 'var(--sp-font-body)' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '14px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, letterSpacing: '-0.3px', color: '#0f172a' }}>
                    SPINDL MANUFACTURING CORP.
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                    Precision Engineering Division · MIDC Bhosari Industrial Area, Pune 411026
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                    GSTIN: 27AABCS1429B1Z8 · CIN: U29253MH2024PTC109923
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', letterSpacing: '-0.2px' }}>
                    DELIVERY CHALLAN
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    (Transport Consignment & Dispatch Note)
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>
                    {selectedChallanDetail.summary.challanNumber}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Date: {new Date(selectedChallanDetail.summary.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Consignee & Transport Meta Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    CONSIGNEE (SHIP TO):
                  </span>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                    {selectedChallanDetail.summary.customerName}
                  </div>
                  <div style={{ color: '#475569', marginTop: '2px', lineHeight: '1.4' }}>
                    {selectedChallanDetail.shippingAddress}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Ref Sales Order: {selectedChallanDetail.summary.orderNumber || 'Standard Dispatch'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    DISPATCH & 3RD-PARTY CARRIER:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '8px', rowGap: '3px', color: '#334155' }}>
                    <span style={{ color: '#64748b' }}>Carrier Partner:</span>
                    <span style={{ fontWeight: 500 }}>{selectedChallanDetail.summary.carrierName || 'Commercial Carrier'}</span>

                    <span style={{ color: '#64748b' }}>AWB / Tracking:</span>
                    <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{selectedChallanDetail.summary.trackingNumber || 'Pending'}</span>

                    <span style={{ color: '#64748b' }}>e-Way Bill No:</span>
                    <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{selectedChallanDetail.summary.ewayBillNumber || 'Exempt'}</span>

                    <span style={{ color: '#64748b' }}>Total Gross Wt:</span>
                    <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{selectedChallanDetail.summary.totalWeightKg.toFixed(2)} kg</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '14px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Item / SKU</th>
                    <th style={{ padding: '6px 8px' }}>HSN/SAC</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty Dispatched</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Unit Rate</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedChallanDetail.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.itemName}</div>
                        <div style={{ fontSize: '10px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{item.sku}</div>
                      </td>
                      <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>{item.hsnCode || '—'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{item.quantity}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.unitPrice)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f8fafc', fontWeight: 600 }}>
                    <td colSpan={2} style={{ padding: '8px' }}>Total Consignment Goods Value</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      {selectedChallanDetail.items.reduce((s, i) => s + i.quantity, 0)} Units
                    </td>
                    <td></td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#0f172a' }}>
                      {formatCurrency(selectedChallanDetail.summary.totalValue)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Statutory Signatures Dock */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1', fontSize: '10px', textAlign: 'center' }}>
                <div>
                  <div style={{ height: '36px' }}></div>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', fontWeight: 600 }}>Prepared By (Dock Store)</div>
                </div>
                <div>
                  <div style={{ height: '36px' }}></div>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', fontWeight: 600 }}>Verified By (QC Inspector)</div>
                </div>
                <div>
                  <div style={{ height: '36px' }}></div>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', fontWeight: 600 }}>Carrier Representative</div>
                </div>
                <div>
                  <div style={{ height: '36px' }}></div>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', fontWeight: 600 }}>Consignee Stamp & Sign</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
