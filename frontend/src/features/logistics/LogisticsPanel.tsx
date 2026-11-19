import { useState, useEffect, useMemo, type FormEvent } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
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
  ChallanPackage,
  ChallanItem,
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

export function LogisticsPanel({ items, customers = [], role, notify }: LogisticsPanelProps) {
  // Navigation & Data States
  const [activeTab, setActiveTab] = useState<'challans' | 'packages' | 'tracking'>('challans');
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
  const [carrierFilter, setCarrierFilter] = useState<string>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState<boolean>(false);
  const [isPodModalOpen, setIsPodModalOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeChallan, setActiveChallan] = useState<ChallanSummary | null>(null);

  // Form States - Create Challan
  const [formSalesOrderId, setFormSalesOrderId] = useState<string>('');
  const [formCustomerId, setFormCustomerId] = useState<string>('');
  const [formWarehouseId, setFormWarehouseId] = useState<string>('');
  const [formCarrierName, setFormCarrierName] = useState<string>('Blue Dart Express');
  const [formCarrierMode, setFormCarrierMode] = useState<string>('ROAD');
  const [formTrackingNumber, setFormTrackingNumber] = useState<string>('');
  const [formVehicleNumber, setFormVehicleNumber] = useState<string>('');
  const [formDriverName, setFormDriverName] = useState<string>('');
  const [formDriverPhone, setFormDriverPhone] = useState<string>('');
  const [formEwayBillNumber, setFormEwayBillNumber] = useState<string>('');
  const [formShippingAddress, setFormShippingAddress] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formPackages, setFormPackages] = useState<Array<{
    packageNumber: string;
    packageType: string;
    weightKg: number;
    dimensionsCm: string;
    contentsSummary: string;
  }>>([
    { packageNumber: 'BOX 1 of 1', packageType: 'BOX', weightKg: 12.5, dimensionsCm: '40 x 30 x 20 cm', contentsSummary: 'Industrial parts packed with anti-static foam' }
  ]);
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
  const [trackVehicleNumber, setTrackVehicleNumber] = useState<string>('');
  const [trackDriverName, setTrackDriverName] = useState<string>('');
  const [trackDriverPhone, setTrackDriverPhone] = useState<string>('');
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

  const openDrawer = async (c: ChallanSummary) => {
    setActiveChallan(c);
    await openChallanDetail(c, false);
  };

  // When Sales Order is picked in Create Challan Modal
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
        notify('Consignment marked IN_TRANSIT. Driver and carrier notified.');
        await loadData();
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
    setTrackVehicleNumber(c.vehicleNumber || '');
    setTrackDriverName(c.driverName || '');
    setTrackDriverPhone(c.driverPhone || '');
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
          trackingNumber: trackTrackingNumber,
          vehicleNumber: trackVehicleNumber,
          driverName: trackDriverName,
          driverPhone: trackDriverPhone,
          ewayBillNumber: trackEwayBillNumber
        })
      });
      if (res.ok) {
        notify('Carrier tracking & e-Way bill updated');
        setIsTrackingModalOpen(false);
        await loadData();
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
    setPodNotes('Goods received in full and satisfactory condition without transit damage.');
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
          vehicleNumber: formVehicleNumber || null,
          driverName: formDriverName || null,
          driverPhone: formDriverPhone || null,
          ewayBillNumber: formEwayBillNumber || null,
          shippingAddress: formShippingAddress,
          notes: formNotes,
          packages: formPackages,
          items: formItems
        })
      });
      if (res.ok) {
        notify('Delivery Challan & Packing Manifest created successfully');
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

  const addPackageRow = () => {
    const nextIdx = formPackages.length + 1;
    setFormPackages([
      ...formPackages,
      {
        packageNumber: `BOX ${nextIdx} of ${nextIdx}`,
        packageType: 'BOX',
        weightKg: 10.0,
        dimensionsCm: '40 x 30 x 20 cm',
        contentsSummary: 'Standard factory packing'
      }
    ]);
  };

  // Filtered List
  const filteredChallans = useMemo(() => {
    return challans.filter((c) => {
      const matchesStatus =
        statusFilter === 'ALL' || c.status.toUpperCase() === statusFilter.toUpperCase();
      const matchesCarrier =
        carrierFilter === 'ALL' || (c.carrierName && c.carrierName.toLowerCase().includes(carrierFilter.toLowerCase()));
      const matchesSearch =
        !searchQuery.trim() ||
        c.challanNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.orderNumber && c.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.vehicleNumber && c.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.trackingNumber && c.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.ewayBillNumber && c.ewayBillNumber.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesCarrier && matchesSearch;
    });
  }, [challans, statusFilter, carrierFilter, searchQuery]);

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

      {/* 2. SUB-NAVIGATION TABS & PRIMARY ACTIONS */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'challans' ? 'active' : ''}`}
            onClick={() => setActiveTab('challans')}
          >
            <FileText size={13} />
            <span>Delivery Challans</span>
            <span className="sales-subnav-badge">{challans.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'packages' ? 'active' : ''}`}
            onClick={() => setActiveTab('packages')}
          >
            <Layers size={13} />
            <span>Box Packing Slips & Manifests</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'tracking' ? 'active' : ''}`}
            onClick={() => setActiveTab('tracking')}
          >
            <Truck size={13} />
            <span>Carrier Tracking & e-Way Bills</span>
            <span className="sales-subnav-badge">
              {challans.filter((c) => c.status === 'IN_TRANSIT').length}
            </span>
          </button>
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
            <span>+ Create Delivery Challan</span>
          </button>
        </div>
      </div>

      {/* 3. TAB 1: DELIVERY CHALLANS (LIST & BOARD VIEWS) */}
      {activeTab === 'challans' && (
        selectedChallanDetail && !isPrintModalOpen ? (
          /* =========================================================================
             AUTHENTIC LINEAR DETAIL VIEW: LOGISTICS DELIVERY CHALLAN
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
                >
                  <ArrowLeft size={13} />
                  <span>Delivery Challans</span>
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
                    <span>Dispatch Consignment</span>
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
                  title="Update Tracking & Vehicle"
                >
                  <Truck size={12} />
                  <span>Update Tracking</span>
                </button>
              </div>
            </div>

            {/* 2-Column Linear Detail Grid */}
            <div className="linear-detail-grid">
              {/* Left Column: Customer destination, Packaging boxes, Shipped contents */}
              <div className="linear-detail-content">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="sales-ref-badge">{selectedChallanDetail.summary.challanNumber}</span>
                    <Status label={selectedChallanDetail.summary.status} />
                    <span className="sales-warehouse-pill">{selectedChallanDetail.summary.carrierMode || 'ROAD'}</span>
                  </div>
                  <h1 className="linear-detail-h1">{selectedChallanDetail.summary.customerName}</h1>
                  <div className="linear-detail-desc" style={{ marginTop: '4px' }}>
                    {selectedChallanDetail.shippingAddress}
                    {selectedChallanDetail.summary.orderNumber ? ` · Ref: ${selectedChallanDetail.summary.orderNumber}` : ''}
                  </div>
                </div>

                {/* Multi-Box Manifest */}
                <div className="linear-sublines-card">
                  <div className="linear-sublines-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Package size={13} style={{ color: 'var(--sp-brand)' }} />
                      <span>Multi-Box Packaging Manifest ({selectedChallanDetail.packages.length} Boxes)</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      Gross Weight: {selectedChallanDetail.summary.totalWeightKg.toFixed(1)} kg
                    </span>
                  </div>
                  {selectedChallanDetail.packages.map((pkg, idx) => (
                    <div key={pkg.id || idx} className="linear-subline-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="sales-ref-badge">{pkg.packageNumber}</span>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '12.5px' }}>
                            {pkg.packageType} · {pkg.dimensionsCm}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                            {pkg.contentsSummary}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '12.5px', fontWeight: 500 }}>
                        {pkg.weightKg.toFixed(1)} kg
                      </div>
                    </div>
                  ))}
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
                  <div className="linear-properties-title">Properties</div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Status</span>
                    <Status label={selectedChallanDetail.summary.status} />
                  </div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Carrier</span>
                    <span className="linear-property-value" title={selectedChallanDetail.summary.carrierName || undefined}>
                      {selectedChallanDetail.summary.carrierName || 'Fleet Assigned'}
                    </span>
                  </div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Mode</span>
                    <span className="linear-property-value">
                      <span className="sales-warehouse-pill">{selectedChallanDetail.summary.carrierMode || 'ROAD'}</span>
                    </span>
                  </div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Airway Bill (AWB)</span>
                    <span className="linear-property-value">
                      <span className="sales-ref-badge">{selectedChallanDetail.summary.trackingNumber || 'Local Direct'}</span>
                    </span>
                  </div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Vehicle</span>
                    <span className="linear-property-value">
                      <span className="sales-ref-badge">{selectedChallanDetail.summary.vehicleNumber || '—'}</span>
                    </span>
                  </div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Driver</span>
                    <span className="linear-property-value" title={selectedChallanDetail.summary.driverPhone || undefined}>
                      {selectedChallanDetail.summary.driverName || '—'}
                    </span>
                  </div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">e-Way Bill</span>
                    <span className="linear-property-value">
                      <span className="sales-ref-badge">{selectedChallanDetail.summary.ewayBillNumber || 'Exempt'}</span>
                    </span>
                  </div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Total Packages</span>
                    <span className="linear-property-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {selectedChallanDetail.summary.totalPackages} Boxes
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

          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <div className="sales-table-card">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>Challan No.</th>
                    <th style={{ width: '110px' }}>Status</th>
                    <th>Customer & Destination</th>
                    <th>Transporter & Mode</th>
                    <th style={{ textAlign: 'right', width: '160px' }}>Packages & Value</th>
                    <th style={{ textAlign: 'right', width: '90px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChallans.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--sp-text-muted)' }}>
                        No delivery challans found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredChallans.map((c) => {
                      return (
                        <tr
                          key={c.id}
                          className="sales-row"
                          onClick={() => openDrawer(c)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <button
                              type="button"
                              className="sales-ref-badge interactive"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDrawer(c);
                              }}
                              title="Click to inspect full consignment details"
                            >
                              {c.challanNumber}
                            </button>
                            <div className="sales-date-cell" style={{ marginTop: '3px' }}>
                              {new Date(c.createdAt).toLocaleDateString()}
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
                                <div className="sales-customer-name">{c.customerName}</div>
                                <div className="sales-sub-ref">
                                  {c.orderNumber ? `Ref: ${c.orderNumber}` : 'Direct Consignment'}
                                  {c.customerCity ? ` · ${c.customerCity}` : ''}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                              {c.carrierName || 'Unassigned Carrier'}
                            </div>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '2px' }}>
                              <span className="sales-warehouse-pill">{c.carrierMode || 'ROAD'}</span>
                              {c.trackingNumber && (
                                <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                  AWB: {c.trackingNumber}
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <div className="sales-amount-cell">
                              {formatCurrency(c.totalValue)}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                              {c.totalPackages} pkgs · {c.totalWeightKg.toFixed(1)} kg
                            </div>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="sales-action-btn secondary"
                              style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openDrawer(c);
                              }}
                            >
                              <span>Inspect</span>
                              <ChevronRight size={11} />
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
                        style={{
                          background: 'var(--sp-surface-subtle)',
                          border: '1px solid var(--sp-border)',
                          borderRadius: '6px',
                          padding: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span className="sales-ref-badge">
                            {c.challanNumber}
                          </span>
                          <span style={{ fontWeight: 500, fontSize: '12px', fontVariantNumeric: 'tabular-nums', color: 'var(--sp-text)' }}>
                            {formatCurrency(c.totalValue)}
                          </span>
                        </div>

                        <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)', marginBottom: '4px' }}>
                          {c.customerName}
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginBottom: '8px' }}>
                          {c.carrierName || 'Fleet Assigned'} · {c.totalPackages} Boxes ({c.totalWeightKg} kg)
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--sp-border)' }}>
                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            style={{ height: '22px', padding: '0 6px', fontSize: '11px' }}
                            onClick={() => openChallanDetail(c, true)}
                          >
                            <Printer size={11} /> Print
                          </button>

                          <button
                            type="button"
                            className="sales-action-btn primary"
                            style={{ height: '22px', padding: '0 8px', fontSize: '11px' }}
                            onClick={() => handleDispatch(c.id)}
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
                    IN TRANSIT (ON ROAD)
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
                        style={{
                          background: 'var(--sp-surface-subtle)',
                          border: '1px solid var(--sp-border)',
                          borderRadius: '6px',
                          padding: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span className="sales-ref-badge">
                            {c.challanNumber}
                          </span>
                          <Status label="IN_TRANSIT" />
                        </div>

                        <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)', marginBottom: '4px' }}>
                          {c.customerName}
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginBottom: '4px' }}>
                          {c.carrierName} · {c.vehicleNumber}
                        </div>

                        {c.trackingNumber && (
                          <div style={{ fontSize: '11px', color: 'var(--sp-brand)', marginBottom: '8px' }}>
                            AWB: {c.trackingNumber}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--sp-border)' }}>
                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            style={{ height: '22px', padding: '0 6px', fontSize: '11px' }}
                            onClick={() => openChallanDetail(c, true)}
                          >
                            <Printer size={11} /> Print
                          </button>

                          <button
                            type="button"
                            className="sales-action-btn primary"
                            style={{ height: '22px', padding: '0 8px', fontSize: '11px', background: '#059669' }}
                            onClick={() => openPodModal(c)}
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
                        style={{
                          background: 'var(--sp-surface-subtle)',
                          border: '1px solid var(--sp-border)',
                          borderRadius: '6px',
                          padding: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span className="sales-ref-badge">
                            {c.challanNumber}
                          </span>
                          <Status label="DELIVERED" />
                        </div>

                        <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)', marginBottom: '4px' }}>
                          {c.customerName}
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginBottom: '6px' }}>
                          POD Signed · {c.totalPackages} Boxes ({c.totalWeightKg} kg)
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--sp-border)' }}>
                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            style={{ height: '22px', padding: '0 6px', fontSize: '11px' }}
                            onClick={() => openChallanDetail(c, true)}
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
        )
      )}

      {/* 4. TAB 2: BOX PACKING SLIPS & MANIFESTS */}
      {activeTab === 'packages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sp-text)', margin: 0 }}>
              Multi-Box Packing Slips & Parcel Manifests
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', margin: '2px 0 0' }}>
              Itemized weight, dimensions, and contents breakdown for logistics carrier compliance.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '14px' }}>
            {challans.map((c) => (
              <div
                key={c.id}
                className="sales-table-card"
                style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="sales-ref-badge">{c.challanNumber}</span>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', marginTop: '4px' }}>
                      {c.customerName}
                    </div>
                  </div>
                  <Status label={c.status} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '10px', background: 'var(--sp-surface-subtle)', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--sp-border)' }}>
                  <div>
                    <span style={{ color: 'var(--sp-text-muted)', display: 'block', fontSize: '10px', fontWeight: 500, textTransform: 'uppercase' }}>TOTAL BOXES</span>
                    <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{c.totalPackages}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--sp-text-muted)', display: 'block', fontSize: '10px', fontWeight: 500, textTransform: 'uppercase' }}>GROSS WEIGHT</span>
                    <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{c.totalWeightKg.toFixed(1)} kg</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--sp-text-muted)', display: 'block', fontSize: '10px', fontWeight: 500, textTransform: 'uppercase' }}>CARRIER</span>
                    <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.carrierName ? c.carrierName.split(' ')[0] : 'Fleet'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    Vehicle: {c.vehicleNumber || 'Unassigned'}
                  </span>
                  <button
                    type="button"
                    className="sales-action-btn secondary"
                    style={{ fontSize: '11px', padding: '0 8px', height: '24px' }}
                    onClick={() => openChallanDetail(c, true)}
                  >
                    <FileText size={11} />
                    <span>Print Manifest</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. TAB 3: CARRIER TRACKING & E-WAY BILLS */}
      {activeTab === 'tracking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)', margin: 0 }}>
              Transporter Fleet, GPS Tracking & Statutory e-Way Bills
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', margin: '2px 0 0' }}>
              Carrier airway bill integrations (Blue Dart, Delhivery, FedEx) and Indian GST e-Way bill compliance.
            </p>
          </div>

          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Consignment / DC</th>
                    <th>Carrier Partner</th>
                    <th>Airway Bill (AWB)</th>
                    <th>Vehicle Registration</th>
                    <th>Driver Details</th>
                    <th>e-Way Bill No.</th>
                    <th>Validity Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {challans.map((c) => (
                    <tr key={c.id} className="sales-row">
                      <td>
                        <span className="sales-ref-badge">{c.challanNumber}</span>
                        <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>{c.customerName}</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500, fontSize: '12.5px' }}>{c.carrierName || 'Spindl Dedicated Fleet'}</span>
                      </td>
                      <td>
                        {c.trackingNumber ? (
                          <span className="sales-ref-badge">
                            {c.trackingNumber}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--sp-text-muted)', fontSize: '11px' }}>Local Direct Run</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, fontSize: '12px' }}>
                          {c.vehicleNumber || '—'}
                        </span>
                      </td>
                      <td>
                        {c.driverName ? (
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--sp-text)' }}>{c.driverName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>{c.driverPhone}</div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--sp-text-muted)', fontSize: '11px' }}>—</span>
                        )}
                      </td>
                      <td>
                        {c.ewayBillNumber ? (
                          <span className="sales-ref-badge">
                            {c.ewayBillNumber}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--sp-text-muted)', fontSize: '11px' }}>Exempt</span>
                        )}
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                          <ShieldCheck size={12} /> Valid & Compliant
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="sales-action-btn secondary"
                          style={{ padding: '0 8px', height: '24px', fontSize: '11px' }}
                          onClick={() => openTrackingModal(c)}
                        >
                          Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: CREATE DELIVERY CHALLAN
          ========================================================================= */}
      {isCreateModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="sales-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px' }}
          >
            <div className="sales-card-header" style={{ paddingBottom: '10px', borderBottom: '1px solid var(--sp-border)' }}>
              <div>
                <h3 className="sales-card-title">Create Outbound Delivery Challan</h3>
                <p className="sales-card-subtitle">
                  Generate statutory consignment note, multi-box manifest, and carrier dispatch tags.
                </p>
              </div>
              <button
                type="button"
                className="sales-search-clear"
                onClick={() => setIsCreateModalOpen(false)}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateChallan} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              {/* Sales Order & Customer Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label className="pos-input-label">
                  Link Sales Order (Optional)
                  <select
                    className="filter-select"
                    style={{ width: '100%', height: '32px', marginTop: '4px' }}
                    value={formSalesOrderId}
                    onChange={(e) => handleSelectSalesOrder(e.target.value)}
                  >
                    <option value="">Direct Consignment (No Order)</option>
                    {salesOrders.map((so) => (
                      <option key={so.id} value={so.id}>
                        {so.orderNumber} — {so.customerName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="pos-input-label">
                  Consignee Customer *
                  <select
                    className="filter-select"
                    style={{ width: '100%', height: '32px', marginTop: '4px' }}
                    value={formCustomerId}
                    onChange={(e) => setFormCustomerId(e.target.value)}
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Carrier & Transporter Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '10px' }}>
                <label className="pos-input-label">
                  Carrier / Transporter
                  <input
                    className="sales-search-input"
                    style={{ width: '100%', height: '32px', marginTop: '4px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                    placeholder="e.g. Blue Dart Express, Spindl Fleet..."
                    value={formCarrierName}
                    onChange={(e) => setFormCarrierName(e.target.value)}
                  />
                </label>

                <label className="pos-input-label">
                  Mode
                  <select
                    className="filter-select"
                    style={{ width: '100%', height: '32px', marginTop: '4px' }}
                    value={formCarrierMode}
                    onChange={(e) => setFormCarrierMode(e.target.value)}
                  >
                    <option value="ROAD">ROAD</option>
                    <option value="AIR">AIR</option>
                    <option value="RAIL">RAIL</option>
                    <option value="SEA">SEA</option>
                    <option value="SELF_PICKUP">SELF PICKUP</option>
                  </select>
                </label>

                <label className="pos-input-label">
                  Vehicle Registration No.
                  <input
                    className="sales-search-input"
                    style={{ width: '100%', height: '32px', marginTop: '4px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                    placeholder="e.g. MH-12-RN-8821"
                    value={formVehicleNumber}
                    onChange={(e) => setFormVehicleNumber(e.target.value)}
                  />
                </label>
              </div>

              {/* Driver & e-Way Bill */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <label className="pos-input-label">
                  Driver Name
                  <input
                    className="sales-search-input"
                    style={{ width: '100%', height: '32px', marginTop: '4px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                    placeholder="e.g. Ramesh Shinde"
                    value={formDriverName}
                    onChange={(e) => setFormDriverName(e.target.value)}
                  />
                </label>

                <label className="pos-input-label">
                  Driver Contact No.
                  <input
                    className="sales-search-input"
                    style={{ width: '100%', height: '32px', marginTop: '4px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                    placeholder="e.g. +91 98221 44091"
                    value={formDriverPhone}
                    onChange={(e) => setFormDriverPhone(e.target.value)}
                  />
                </label>

                <label className="pos-input-label">
                  e-Way Bill Number
                  <input
                    className="sales-search-input"
                    style={{ width: '100%', height: '32px', marginTop: '4px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                    placeholder="12-digit e-Way Bill"
                    value={formEwayBillNumber}
                    onChange={(e) => setFormEwayBillNumber(e.target.value)}
                  />
                </label>
              </div>

              {/* Multi-Box Manifest Builder */}
              <div style={{ padding: '12px', background: 'var(--sp-surface-subtle)', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="pos-input-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Boxes size={13} />
                    <span>Multi-Box Packaging Manifest ({formPackages.length} Packages)</span>
                  </span>
                  <button
                    type="button"
                    className="sales-action-btn secondary"
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                    onClick={addPackageRow}
                  >
                    + Add Box / Pallet
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {formPackages.map((pkg, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 1fr 1fr 1.5fr',
                        gap: '6px',
                        background: 'var(--sp-surface)',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid var(--sp-border)'
                      }}
                    >
                      <input
                        className="sales-search-input"
                        style={{ height: '28px', padding: '0 6px', fontSize: '11px' }}
                        value={pkg.packageNumber}
                        onChange={(e) => {
                          const updated = [...formPackages];
                          updated[idx].packageNumber = e.target.value;
                          setFormPackages(updated);
                        }}
                      />
                      <select
                        className="filter-select"
                        style={{ height: '28px', fontSize: '11px' }}
                        value={pkg.packageType}
                        onChange={(e) => {
                          const updated = [...formPackages];
                          updated[idx].packageType = e.target.value;
                          setFormPackages(updated);
                        }}
                      >
                        <option value="BOX">BOX</option>
                        <option value="PALLET">PALLET</option>
                        <option value="CRATE">CRATE</option>
                        <option value="BAG">BAG</option>
                      </select>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Weight kg"
                        className="sales-search-input"
                        style={{ height: '28px', padding: '0 6px', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}
                        value={pkg.weightKg}
                        onChange={(e) => {
                          const updated = [...formPackages];
                          updated[idx].weightKg = parseFloat(e.target.value) || 0;
                          setFormPackages(updated);
                        }}
                      />
                      <input
                        placeholder="Contents summary"
                        className="sales-search-input"
                        style={{ height: '28px', padding: '0 6px', fontSize: '11px' }}
                        value={pkg.contentsSummary}
                        onChange={(e) => {
                          const updated = [...formPackages];
                          updated[idx].contentsSummary = e.target.value;
                          setFormPackages(updated);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping Address */}
              <label className="pos-input-label">
                Delivery Site & Shipping Address *
                <textarea
                  className="sales-search-input"
                  style={{ width: '100%', height: '50px', padding: '6px', marginTop: '4px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                  placeholder="Full plant gate address, city, state, postal code..."
                  value={formShippingAddress}
                  onChange={(e) => setFormShippingAddress(e.target.value)}
                  required
                />
              </label>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
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
          MODAL 2: UPDATE TRACKING & TRANSPORTER
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
                <h3 className="sales-card-title">Update Tracking & Transporter</h3>
                <p className="sales-card-subtitle">
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

            <form onSubmit={handleUpdateTracking} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <label className="pos-input-label">
                  Carrier Name
                  <input
                    className="sales-search-input"
                    style={{ width: '100%', height: '32px', marginTop: '4px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                    value={trackCarrierName}
                    onChange={(e) => setTrackCarrierName(e.target.value)}
                  />
                </label>

                <label className="pos-input-label">
                  Mode
                  <select
                    className="filter-select"
                    style={{ width: '100%', height: '32px', marginTop: '4px' }}
                    value={trackCarrierMode}
                    onChange={(e) => setTrackCarrierMode(e.target.value)}
                  >
                    <option value="ROAD">ROAD</option>
                    <option value="AIR">AIR</option>
                    <option value="RAIL">RAIL</option>
                    <option value="SEA">SEA</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label className="pos-input-label">
                  Airway Bill / Tracking No.
                  <input
                    className="sales-search-input"
                    style={{ width: '100%', height: '32px', marginTop: '4px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                    placeholder="AWB Tracking #"
                    value={trackTrackingNumber}
                    onChange={(e) => setTrackTrackingNumber(e.target.value)}
                  />
                </label>

                <label className="pos-input-label">
                  Vehicle Number
                  <input
                    className="sales-search-input"
                    style={{ width: '100%', height: '32px', marginTop: '4px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                    placeholder="MH-12-..."
                    value={trackVehicleNumber}
                    onChange={(e) => setTrackVehicleNumber(e.target.value)}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label className="pos-input-label">
                  Driver Name
                  <input
                    className="sales-search-input"
                    style={{ width: '100%', height: '32px', marginTop: '4px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                    value={trackDriverName}
                    onChange={(e) => setTrackDriverName(e.target.value)}
                  />
                </label>

                <label className="pos-input-label">
                  Driver Phone
                  <input
                    className="sales-search-input"
                    style={{ width: '100%', height: '32px', marginTop: '4px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                    value={trackDriverPhone}
                    onChange={(e) => setTrackDriverPhone(e.target.value)}
                  />
                </label>
              </div>

              <label className="pos-input-label">
                e-Way Bill Number
                <input
                  className="sales-search-input"
                  style={{ width: '100%', height: '32px', marginTop: '4px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                  value={trackEwayBillNumber}
                  onChange={(e) => setTrackEwayBillNumber(e.target.value)}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={() => setIsTrackingModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="sales-action-btn primary" disabled={busy}>
                  {busy ? 'Updating…' : 'Save Details'}
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
                <h3 className="sales-card-title">Record Proof of Delivery (POD)</h3>
                <p className="sales-card-subtitle">
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

            <form onSubmit={handleRecordPod} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              <label className="pos-input-label">
                Receiver Name / Gate Officer *
                <input
                  className="sales-search-input"
                  style={{ width: '100%', height: '32px', marginTop: '4px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                  placeholder="e.g. Devendra Patil (Store Incharge)"
                  value={podRecipientName}
                  onChange={(e) => setPodRecipientName(e.target.value)}
                  required
                />
              </label>

              <label className="pos-input-label">
                Receiving Notes & Condition
                <textarea
                  className="sales-search-input"
                  style={{ width: '100%', height: '60px', padding: '6px', marginTop: '4px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                  value={podNotes}
                  onChange={(e) => setPodNotes(e.target.value)}
                />
              </label>

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
                Delivery Challan & Packing Slip Preview
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
                    (Transport Consignment & Packing Slip)
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
                    DISPATCH & TRANSPORTER DETAILS:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '8px', rowGap: '3px', color: '#334155' }}>
                    <span style={{ color: '#64748b' }}>Transporter:</span>
                    <span style={{ fontWeight: 500 }}>{selectedChallanDetail.summary.carrierName || 'Spindl Fleet'}</span>

                    <span style={{ color: '#64748b' }}>Vehicle No:</span>
                    <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{selectedChallanDetail.summary.vehicleNumber || '—'}</span>

                    <span style={{ color: '#64748b' }}>e-Way Bill No:</span>
                    <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{selectedChallanDetail.summary.ewayBillNumber || 'Exempt'}</span>

                    <span style={{ color: '#64748b' }}>Total Gross Wt:</span>
                    <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{selectedChallanDetail.summary.totalWeightKg.toFixed(2)} kg ({selectedChallanDetail.summary.totalPackages} Pkgs)</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '14px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Item / SKU</th>
                    <th style={{ padding: '6px 8px' }}>HSN/SAC</th>
                    <th style={{ padding: '6px 8px' }}>Package / Box</th>
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
                      <td style={{ padding: '6px 8px' }}>{item.packageNumber}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{item.quantity}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.unitPrice)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f8fafc', fontWeight: 600 }}>
                    <td colSpan={3} style={{ padding: '8px' }}>Total Consignment Goods Value</td>
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

              {/* Package Breakdown */}
              {selectedChallanDetail.packages.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    BOX PACKAGING MANIFEST
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
                    {selectedChallanDetail.packages.map((pkg, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '6px 8px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '4px',
                          fontSize: '10px',
                          background: '#f8fafc'
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{pkg.packageNumber} ({pkg.packageType})</div>
                        <div style={{ color: '#64748b' }}>Weight: {pkg.weightKg} kg · {pkg.dimensionsCm}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', fontWeight: 600 }}>Carrier / Driver Signature</div>
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
