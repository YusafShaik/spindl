import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Info,
  Layers,
  Package,
  Search,
  ShieldCheck,
  Table,
  UploadCloud,
  Users,
  X
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import type {
  CsvImportPreview,
  ExportResource,
  ImportResource,
  PublishedCustomField
} from '../../types/imports';

export interface ImportDataProps {
  resource: ImportResource;
  setResource: (resource: ImportResource) => void;
  file: File | null;
  onFile: (file: File | null) => void;
  preview: CsvImportPreview | null;
  saving: boolean;
  onPreview: () => void;
  onImport: () => void;
  onExport: (resource: ExportResource) => void;
  notify?: (message: string) => void;
  role?: string;
}

type ImportSubTab = 'wizard' | 'history' | 'templates' | 'export';

interface ImportBatchRecord {
  id: string;
  resourceType: string;
  rowsImported: number;
  contentSha256: string;
  idempotencyKey?: string;
  createdAt: string;
  status: string;
}

const SAMPLE_BATCHES: ImportBatchRecord[] = [
  {
    id: 'batch-01',
    resourceType: 'CUSTOMERS',
    rowsImported: 14,
    contentSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    idempotencyKey: 'batch-cx-legacy-migration-01',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    status: 'COMMITTED'
  },
  {
    id: 'batch-02',
    resourceType: 'ITEMS',
    rowsImported: 42,
    contentSha256: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
    idempotencyKey: 'batch-items-erp-sync-02',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    status: 'COMMITTED'
  },
  {
    id: 'batch-03',
    resourceType: 'SUPPLIERS',
    rowsImported: 8,
    contentSha256: '5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5',
    idempotencyKey: 'batch-sup-procurement-03',
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    status: 'COMMITTED'
  }
];

interface TemplateFieldSpec {
  key: string;
  required: boolean;
  type: string;
  description: string;
  example: string;
}

const TEMPLATES: Record<
  ImportResource,
  {
    title: string;
    description: string;
    requiredHeaders: string[];
    optionalHeaders: string[];
    sampleData: string;
    filename: string;
    specs: TemplateFieldSpec[];
  }
> = {
  CUSTOMERS: {
    title: 'Customer Directory Template',
    description: 'Master commercial counterparties, billing contacts, GSTIN tax identifiers, and credit terms.',
    requiredHeaders: ['code', 'name', 'email'],
    optionalHeaders: [
      'status',
      'customerType',
      'contactName',
      'phone',
      'addressLine1',
      'city',
      'region',
      'countryCode',
      'taxId',
      'paymentTermsDays',
      'creditLimit',
      'tags'
    ],
    filename: 'spindl_customers_template.csv',
    sampleData: `code,name,email,status,customerType,contactName,phone,addressLine1,city,region,countryCode,taxId,paymentTermsDays,creditLimit,tags
CUS-001,Bharat Heavy Precision Pvt Ltd,procurement@bharatprecision.in,Active,COMPANY,Vikram Mehta,+91 98201 44521,Plot 12 Industrial Area,Bengaluru,Karnataka,IN,29AABCB1234F1Z5,30,500000,Key Account
CUS-002,AeroSpace Dynamics Ltd,orders@aerospacedynamics.io,Active,COMPANY,Dr. Sunita Rao,+91 80234 56789,Tower B HITEC City,Hyderabad,Telangana,IN,36AAACE4567G1Z8,45,750000,Aerospace`,
    specs: [
      { key: 'code', required: true, type: 'String (≤64)', description: 'Unique customer identifier / code', example: 'CUS-001' },
      { key: 'name', required: true, type: 'String (≤180)', description: 'Legal customer company / individual name', example: 'Bharat Heavy Precision Pvt Ltd' },
      { key: 'email', required: true, type: 'Email', description: 'Primary invoicing and order dispatch email', example: 'procurement@bharatprecision.in' },
      { key: 'status', required: false, type: 'Enum', description: 'Account status (Active / Inactive)', example: 'Active' },
      { key: 'customerType', required: false, type: 'Enum', description: 'Classification (COMPANY / INDIVIDUAL)', example: 'COMPANY' },
      { key: 'contactName', required: false, type: 'String (≤180)', description: 'Primary contact person', example: 'Vikram Mehta' },
      { key: 'phone', required: false, type: 'Phone', description: 'Contact telephone or mobile number', example: '+91 98201 44521' },
      { key: 'addressLine1', required: false, type: 'String (≤180)', description: 'Plant or corporate registered street address', example: 'Plot 12 Industrial Area' },
      { key: 'city', required: false, type: 'String (≤100)', description: 'City or district', example: 'Bengaluru' },
      { key: 'region', required: false, type: 'String (≤100)', description: 'State or administrative region', example: 'Karnataka' },
      { key: 'countryCode', required: false, type: 'ISO-2', description: 'Two-letter country code (default IN)', example: 'IN' },
      { key: 'taxId', required: false, type: 'Tax ID', description: 'GSTIN or national tax identification number', example: '29AABCB1234F1Z5' },
      { key: 'paymentTermsDays', required: false, type: 'Integer', description: 'Payment credit window in days', example: '30' },
      { key: 'creditLimit', required: false, type: 'Decimal', description: 'Credit exposure ceiling (₹)', example: '500000' },
      { key: 'tags', required: false, type: 'String', description: 'Comma-separated customer classifications', example: 'Key Account, Heavy Engineering' }
    ]
  },
  SUPPLIERS: {
    title: 'Supplier & Vendor Template',
    description: 'Procurement suppliers, contact information, standard lead times, and quality ratings.',
    requiredHeaders: ['code', 'name', 'email'],
    optionalHeaders: [
      'contactName',
      'phone',
      'addressLine1',
      'city',
      'region',
      'countryCode',
      'taxId',
      'paymentTermsDays',
      'leadTimeDays',
      'rating',
      'notes'
    ],
    filename: 'spindl_suppliers_template.csv',
    sampleData: `code,name,email,contactName,phone,addressLine1,city,region,countryCode,taxId,paymentTermsDays,leadTimeDays,rating,notes
SUP-001,Apex Tooling Works,sales@apextooling.in,Deepak Patel,+91 98450 11223,MIDC Bhosari,Pune,Maharashtra,IN,27AAACA1234M1Z2,30,7,4.8,Precision CNC tooling
SUP-002,Global Fasteners Corp,support@globalfasteners.com,Anjali Roy,+91 99123 44556,Ambattur Industrial Area,Chennai,Tamil Nadu,IN,33AAACG9988K1Z1,15,5,4.5,Fasteners supplier`,
    specs: [
      { key: 'code', required: true, type: 'String (≤64)', description: 'Unique vendor identifier / code', example: 'SUP-001' },
      { key: 'name', required: true, type: 'String (≤180)', description: 'Supplier registered company name', example: 'Apex Tooling Works' },
      { key: 'email', required: true, type: 'Email', description: 'Primary procurement / sales email', example: 'sales@apextooling.in' },
      { key: 'contactName', required: false, type: 'String (≤180)', description: 'Primary supplier point of contact', example: 'Deepak Patel' },
      { key: 'phone', required: false, type: 'Phone', description: 'Supplier contact telephone', example: '+91 98450 11223' },
      { key: 'addressLine1', required: false, type: 'String (≤180)', description: 'Factory / supplier depot address', example: 'MIDC Bhosari' },
      { key: 'city', required: false, type: 'String (≤100)', description: 'City or industrial zone', example: 'Pune' },
      { key: 'region', required: false, type: 'String (≤100)', description: 'State or region', example: 'Maharashtra' },
      { key: 'countryCode', required: false, type: 'ISO-2', description: 'Two-letter country code (default IN)', example: 'IN' },
      { key: 'taxId', required: false, type: 'Tax ID', description: 'Vendor GSTIN or Tax identifier', example: '27AAACA1234M1Z2' },
      { key: 'paymentTermsDays', required: false, type: 'Integer', description: 'Agreed payable terms in days', example: '30' },
      { key: 'leadTimeDays', required: false, type: 'Integer', description: 'Standard delivery lead time in days', example: '7' },
      { key: 'rating', required: false, type: 'Decimal', description: 'Supplier performance score (0.0 to 5.0)', example: '4.8' },
      { key: 'notes', required: false, type: 'Text', description: 'Procurement remarks & qualifications', example: 'Precision CNC tooling' }
    ]
  },
  ITEMS: {
    title: 'Product Catalog & Inventory Template',
    description: 'Inventory items, raw materials, WIP, and service specifications with opening balances.',
    requiredHeaders: ['sku', 'name', 'category', 'openingStock', 'unit', 'unitPrice'],
    optionalHeaders: ['lowStockThreshold', 'itemType'],
    filename: 'spindl_catalog_items_template.csv',
    sampleData: `sku,name,category,openingStock,unit,unitPrice,lowStockThreshold,itemType
TIT-VLV-300,Titanium Alloy Intake Valve ISO-9001,Valves,120,pcs,2450.00,10,FINISHED
TI-ROD-025,Titanium Round Bar Grade 5 Dia 25mm,Raw Materials,35,kg,1200.00,50,RAW
CALIB-ANNUAL,Annual ISO Metrology & Calibration Service,Quality Services,1,svc,8500.00,0,SERVICE`,
    specs: [
      { key: 'sku', required: true, type: 'String (≤64)', description: 'Unique Stock Keeping Unit (SKU)', example: 'TIT-VLV-300' },
      { key: 'name', required: true, type: 'String (≤180)', description: 'Product or component technical name', example: 'Titanium Alloy Intake Valve' },
      { key: 'category', required: true, type: 'String (≤100)', description: 'Product category grouping', example: 'Valves' },
      { key: 'openingStock', required: true, type: 'Integer', description: 'Initial physical inventory on-hand', example: '120' },
      { key: 'unit', required: true, type: 'String (≤24)', description: 'Unit of measure (pcs, kg, m, svc)', example: 'pcs' },
      { key: 'unitPrice', required: true, type: 'Decimal', description: 'Commercial unit sales price (₹)', example: '2450.00' },
      { key: 'lowStockThreshold', required: false, type: 'Integer', description: 'Reorder trigger alarm level', example: '10' },
      { key: 'itemType', required: false, type: 'Enum', description: 'Type: FINISHED, RAW, WIP, or SERVICE', example: 'FINISHED' }
    ]
  }
};

const EXPORT_ENTITIES: Array<{
  resource: ExportResource;
  title: string;
  description: string;
  icon: typeof FileText;
  badge: string;
  category: 'Master' | 'Commercial' | 'Procurement' | 'Finance' | 'Production';
}> = [
  {
    resource: 'CUSTOMERS',
    title: 'Customer Directory',
    description: 'Commercial counterparties, GSTINs, credit terms, and contact records.',
    icon: Users,
    badge: 'Master Data',
    category: 'Master'
  },
  {
    resource: 'ITEMS',
    title: 'Product Catalog & Inventory',
    description: 'Finished goods, raw materials, WIP, unit pricing, and stock on hand.',
    icon: Package,
    badge: 'Master Data',
    category: 'Master'
  },
  {
    resource: 'SUPPLIERS',
    title: 'Suppliers & Vendors',
    description: 'Approved vendor register, procurement terms, lead times, and ratings.',
    icon: Database,
    badge: 'Master Data',
    category: 'Master'
  },
  {
    resource: 'PURCHASE_ORDERS',
    title: 'Purchase Orders',
    description: 'Procurement commitments, supplier order numbers, and fulfillment status.',
    icon: FileSpreadsheet,
    badge: 'Procurement',
    category: 'Procurement'
  },
  {
    resource: 'QUOTES',
    title: 'Sales Quotations',
    description: 'Customer pricing proposals, terms, expiry dates, and conversion states.',
    icon: FileText,
    badge: 'Commercial',
    category: 'Commercial'
  },
  {
    resource: 'SALES_ORDERS',
    title: 'Sales Orders',
    description: 'Confirmed customer contracts, production allocations, and totals.',
    icon: Boxes,
    badge: 'Commercial',
    category: 'Commercial'
  },
  {
    resource: 'INVOICES',
    title: 'Commercial Tax Invoices',
    description: 'Issued receivables, tax totals, GST codes, and payment balances.',
    icon: FileCheck,
    badge: 'Finance',
    category: 'Finance'
  },
  {
    resource: 'WORK_ORDERS',
    title: 'Manufacturing Work Orders',
    description: 'Shop floor production runs, BOM linkages, scrap, and good output.',
    icon: Layers,
    badge: 'Production',
    category: 'Production'
  }
];

function parseCsvRows(csvString: string): { headers: string[]; rows: string[][] } {
  const lines = csvString.trim().split('\n').filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(',').map((c) => c.trim()));
  return { headers, rows };
}

export function ImportData({
  resource,
  setResource,
  file,
  onFile,
  preview,
  saving,
  onPreview,
  onImport,
  onExport,
  notify
}: ImportDataProps) {
  const [activeTab, setActiveTab] = useState<ImportSubTab>('wizard');
  const [customFields, setCustomFields] = useState<PublishedCustomField[]>([]);
  const [batches, setBatches] = useState<ImportBatchRecord[]>(SAMPLE_BATCHES);

  // History Tab states
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyResourceFilter, setHistoryResourceFilter] = useState<string>('ALL');

  // Templates Tab state
  const [activeTemplateResource, setActiveTemplateResource] = useState<ImportResource>('CUSTOMERS');

  // Export Tab states
  const [exportCategory, setExportCategory] = useState<string>('ALL');
  const [exportQuery, setExportQuery] = useState('');

  // Load custom fields for the active import resource
  useEffect(() => {
    let current = true;
    const customResource =
      resource === 'CUSTOMERS' ? 'customers' : resource === 'SUPPLIERS' ? 'suppliers' : 'items';
    apiFetch(`${API}/custom-fields?resource=${customResource}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((fields: PublishedCustomField[]) => {
        if (current) setCustomFields(fields.filter((f) => f.published));
      })
      .catch(() => {
        if (current) setCustomFields([]);
      });
    return () => {
      current = false;
    };
  }, [resource]);

  // Load batch history if available
  useEffect(() => {
    let current = true;
    apiFetch(`${API}/imports/batches`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: ImportBatchRecord[]) => {
        if (current && Array.isArray(rows) && rows.length > 0) {
          setBatches(rows);
        }
      })
      .catch(() => {
        // Fallback to SAMPLE_BATCHES
      });
    return () => {
      current = false;
    };
  }, []);

  // Download sample template file
  const downloadSampleTemplate = (resKey: ImportResource) => {
    const tmpl = TEMPLATES[resKey];
    const blob = new Blob([tmpl.sampleData], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = tmpl.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (notify) notify(`Downloaded ${tmpl.filename}`);
  };

  // Download error report CSV
  const downloadErrors = () => {
    if (!preview?.errors?.length) return;
    const cell = (val: string | number) => {
      let txt = String(val ?? '');
      if (/^[\s]*[=+\-@\t\r]/.test(txt)) txt = "'" + txt;
      return `"${txt.replaceAll('"', '""')}"`;
    };
    const csv = ['row,error', ...preview.errors.map((err) => `${cell(err.row)},${cell(err.message)}`)].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `spindl-${resource.toLowerCase()}-import-errors.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (notify) notify('Validation errors CSV downloaded');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    if (notify) notify(`Copied ${label} to clipboard`);
  };

  const totalImportedRows = useMemo(() => {
    return batches.reduce((acc, b) => acc + (b.rowsImported || 0), 0);
  }, [batches]);

  const currentTemplate = TEMPLATES[resource];

  // Filtered Batches for Tab 2
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      if (historyResourceFilter !== 'ALL' && b.resourceType.toUpperCase() !== historyResourceFilter) return false;
      if (historyQuery.trim()) {
        const q = historyQuery.toLowerCase();
        const matchId = b.id.toLowerCase().includes(q);
        const matchSha = b.contentSha256.toLowerCase().includes(q);
        const matchKey = (b.idempotencyKey || '').toLowerCase().includes(q);
        const matchRes = b.resourceType.toLowerCase().includes(q);
        if (!matchId && !matchSha && !matchKey && !matchRes) return false;
      }
      return true;
    });
  }, [batches, historyResourceFilter, historyQuery]);

  // Filtered Export Entities for Tab 4
  const filteredExports = useMemo(() => {
    return EXPORT_ENTITIES.filter((ent) => {
      if (exportCategory !== 'ALL' && ent.category !== exportCategory) return false;
      if (exportQuery.trim()) {
        const q = exportQuery.toLowerCase();
        const matchTitle = ent.title.toLowerCase().includes(q);
        const matchDesc = ent.description.toLowerCase().includes(q);
        const matchRes = ent.resource.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchRes) return false;
      }
      return true;
    });
  }, [exportCategory, exportQuery]);

  const selectedTemplateData = TEMPLATES[activeTemplateResource];
  const sampleTableData = useMemo(() => {
    return parseCsvRows(selectedTemplateData.sampleData);
  }, [selectedTemplateData]);

  return (
    <div className="sales-screen-layout">
      {/* 1. Executive Data Ingestion KPI Strip */}
      <div className="sales-metric-strip">
        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">SUPPORTED SCHEMAS</span>
            <FileSpreadsheet size={14} className="sales-metric-icon" aria-hidden="true" />
          </div>
          <div className="sales-metric-val">3 Master Schemas</div>
          <div className="sales-metric-sub">
            <span className="kpi-badge kpi-badge-purple">Customers</span>
            <span>Suppliers · Catalog Items</span>
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">LIFETIME IMPORTED ROWS</span>
            <CheckCircle2 size={14} className="sales-metric-icon" aria-hidden="true" />
          </div>
          <div className="sales-metric-val">{totalImportedRows.toLocaleString()} Records</div>
          <div className="sales-metric-sub">
            <span className="kpi-badge kpi-badge-neutral">{batches.length} Batches</span>
            <span>Historical import commits</span>
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">DATA INTEGRITY & SAFETY</span>
            <ShieldCheck size={14} className="sales-metric-icon" aria-hidden="true" />
          </div>
          <div className="sales-metric-val">100% Atomic</div>
          <div className="sales-metric-sub">
            <span className="kpi-badge kpi-badge-positive">Zero partials</span>
            <span>All-or-nothing rollback</span>
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">EXPORTABLE DATASETS</span>
            <Download size={14} className="sales-metric-icon" aria-hidden="true" />
          </div>
          <div className="sales-metric-val">8 System Entities</div>
          <div className="sales-metric-sub">
            <span className="kpi-badge kpi-badge-neutral">Up to 10k rows</span>
            <span>Custom fields included</span>
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'wizard' ? 'active' : ''}`}
            onClick={() => setActiveTab('wizard')}
          >
            <UploadCloud size={14} />
            <span>Import Wizard & Workbench</span>
            <span className="sales-subnav-badge">{resource}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={14} />
            <span>Import History & Batches</span>
            <span className="sales-subnav-badge">{batches.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            <FileSpreadsheet size={14} />
            <span>Template Center & Schemas</span>
            <span className="sales-subnav-badge">3 templates</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            <Download size={14} />
            <span>Master Data Export</span>
            <span className="sales-subnav-badge">8 entities</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => downloadSampleTemplate(resource)}
            title="Download CSV sample template for selected resource"
          >
            <Download size={13} />
            <span>Download {resource} Template</span>
          </button>
        </div>
      </div>

      {/* 3. SUB-TAB 1: Linear Dense Import Workbench */}
      {activeTab === 'wizard' && (
        <div className="import-workbench-grid">
          {/* Left Column: Dense Ingestion Console & Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Entity Selection Buttons */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Target Master Entity
              </div>
              <div className="import-entity-strip">
                <button
                  type="button"
                  className={`import-entity-btn ${resource === 'CUSTOMERS' ? 'active' : ''}`}
                  onClick={() => setResource('CUSTOMERS')}
                >
                  <Users size={16} color={resource === 'CUSTOMERS' ? 'var(--sp-brand)' : 'var(--sp-text-secondary)'} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--sp-text)' }}>Customers</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      Buyers & GSTIN
                    </div>
                  </div>
                  {resource === 'CUSTOMERS' && <Check size={13} color="var(--sp-brand)" />}
                </button>

                <button
                  type="button"
                  className={`import-entity-btn ${resource === 'SUPPLIERS' ? 'active' : ''}`}
                  onClick={() => setResource('SUPPLIERS')}
                >
                  <Database size={16} color={resource === 'SUPPLIERS' ? 'var(--sp-brand)' : 'var(--sp-text-secondary)'} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--sp-text)' }}>Suppliers</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      Vendors & Lead Times
                    </div>
                  </div>
                  {resource === 'SUPPLIERS' && <Check size={13} color="var(--sp-brand)" />}
                </button>

                <button
                  type="button"
                  className={`import-entity-btn ${resource === 'ITEMS' ? 'active' : ''}`}
                  onClick={() => setResource('ITEMS')}
                >
                  <Package size={16} color={resource === 'ITEMS' ? 'var(--sp-brand)' : 'var(--sp-text-secondary)'} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--sp-text)' }}>Catalog Items</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      SKUs & Opening Stock
                    </div>
                  </div>
                  {resource === 'ITEMS' && <Check size={13} color="var(--sp-brand)" />}
                </button>
              </div>
            </div>

            {/* Ingestion & Dropzone Card */}
            <div className="sales-table-card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase' }}>
                  CSV Ingestion
                </span>
                <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                  Max 500 rows · Up to 2 MB · UTF-8
                </span>
              </div>

              {!file ? (
                <label className="import-dropzone-dense">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => onFile(e.target.files?.[0] || null)}
                    style={{ display: 'none' }}
                  />
                  <UploadCloud size={24} color="var(--sp-brand)" />
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
                    Drop CSV here or click to browse
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                    Matches schema for <strong>{resource}</strong> master data
                  </div>
                </label>
              ) : (
                <div className="import-file-badge">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileSpreadsheet size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--sp-text)' }}>{file.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                        {(file.size / 1024).toFixed(1)} KB · Ready for validation
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label className="button button-secondary" style={{ padding: '4px 10px', fontSize: '11.5px', cursor: 'pointer' }}>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => onFile(e.target.files?.[0] || null)}
                        style={{ display: 'none' }}
                      />
                      Replace
                    </label>
                    <button
                      type="button"
                      className="button button-secondary"
                      style={{ padding: '4px 8px' }}
                      onClick={() => onFile(null)}
                      title="Clear file"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )}

              {/* Execution Actions Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--sp-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  <ShieldCheck size={14} color="#10b981" />
                  <span>Atomic transaction guarantees rollback on error.</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={!file || saving}
                    onClick={onPreview}
                  >
                    {saving ? 'Validating…' : 'Pre-flight Preview'}
                  </button>

                  <button
                    type="button"
                    className="button button-primary"
                    disabled={!preview || preview.errors.length > 0 || saving}
                    onClick={onImport}
                  >
                    {saving ? 'Importing…' : 'Commit Valid Rows'}
                  </button>
                </div>
              </div>
            </div>

            {/* Validation Results & Preview Table */}
            {preview ? (
              <div className="sales-table-card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--sp-text)', margin: 0 }}>
                      Pre-flight Validation Ledger
                    </h3>
                    <span className={`sales-status-chip ${preview.errors.length > 0 ? 'overdue' : 'completed'}`}>
                      {preview.validRows} / {preview.totalRows} Rows Valid
                    </span>
                  </div>

                  {preview.errors.length > 0 && (
                    <button
                      type="button"
                      className="sales-action-btn secondary"
                      onClick={downloadErrors}
                    >
                      <Download size={12} /> Download Error CSV
                    </button>
                  )}
                </div>

                {/* Validation Errors Box */}
                {preview.errors.length > 0 && (
                  <div style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.06)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontWeight: 600, fontSize: '12px', marginBottom: '6px' }}>
                      <AlertCircle size={14} /> Validation Errors ({preview.errors.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                      {preview.errors.map((err, idx) => (
                        <div key={`${err.row}-${idx}`} style={{ fontSize: '11.5px', color: '#991b1b', display: 'flex', gap: '8px' }}>
                          <span style={{ fontWeight: 600, minWidth: '55px' }}>Row {err.row}:</span>
                          <span>{err.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sample Rows Table */}
                <div className="sales-table-scroll" style={{ maxHeight: '280px' }}>
                  <table className="sales-table">
                    <thead>
                      <tr>
                        {Object.keys(preview.sampleRows[0] || {}).map((header) => (
                          <th key={header} style={{ fontSize: '11px', padding: '6px 10px' }}>
                            {header.replaceAll('_', ' ').toUpperCase()}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleRows.map((row, idx) => (
                        <tr key={idx} className="sales-row">
                          {Object.keys(preview.sampleRows[0] || {}).map((header) => (
                            <td key={header} style={{ fontSize: '11.5px', padding: '6px 10px', color: 'var(--sp-text)' }}>
                              {row[header] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Pre-flight Checklist
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11.5px', color: 'var(--sp-text)' }}>
                    <CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>Required header keys must exactly match schema.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11.5px', color: 'var(--sp-text)' }}>
                    <CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>Duplicates by Code or SKU are blocked automatically.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11.5px', color: 'var(--sp-text)' }}>
                    <CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>Custom field columns map automatically by field key.</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Schema Inspector */}
          <div className="linear-properties-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="sales-ref-badge">{resource}</span>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--sp-text)' }}>Schema Specs</span>
              </div>
              <button
                type="button"
                className="sales-action-btn secondary"
                style={{ padding: '3px 8px', fontSize: '11px' }}
                onClick={() => downloadSampleTemplate(resource)}
                title="Download CSV template"
              >
                <Download size={11} /> Sample CSV
              </button>
            </div>

            <p style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', margin: '0 0 10px', lineHeight: '1.4' }}>
              {currentTemplate.description}
            </p>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '5px' }}>
                Required Columns ({currentTemplate.requiredHeaders.length}):
              </div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {currentTemplate.requiredHeaders.map((col) => (
                  <span key={col} className="import-schema-tag required">
                    {col} <span style={{ color: '#dc2626' }}>*</span>
                  </span>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--sp-text-secondary)', marginBottom: '5px' }}>
                Optional Columns ({currentTemplate.optionalHeaders.length}):
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {currentTemplate.optionalHeaders.map((col) => (
                  <span key={col} className="import-schema-tag">
                    {col}
                  </span>
                ))}
              </div>
            </div>

            {customFields.length > 0 && (
              <div style={{ paddingTop: '8px', borderTop: '1px solid var(--sp-border-subtle)', marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '5px' }}>
                  Active Custom Field Bindings ({customFields.length}):
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {customFields.map((f) => (
                    <span key={f.id} className="import-schema-tag">
                      <code>{f.fieldKey}</code> · {f.displayName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ paddingTop: '8px', borderTop: '1px solid var(--sp-border-subtle)', fontSize: '11px', color: 'var(--sp-text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <Check size={12} color="#10b981" />
                <span>Zero partial writes on schema mismatch</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={12} color="#10b981" />
                <span>Whitespace trimmed automatically</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. SUB-TAB 2: Import History & Batches Register */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* History Toolbar */}
          <div className="sales-toolbar">
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${historyResourceFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setHistoryResourceFilter('ALL')}
              >
                All Batches <span className="sales-pill-count">{batches.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${historyResourceFilter === 'CUSTOMERS' ? 'active' : ''}`}
                onClick={() => setHistoryResourceFilter('CUSTOMERS')}
              >
                Customers <span className="sales-pill-count">{batches.filter((b) => b.resourceType === 'CUSTOMERS').length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${historyResourceFilter === 'SUPPLIERS' ? 'active' : ''}`}
                onClick={() => setHistoryResourceFilter('SUPPLIERS')}
              >
                Suppliers <span className="sales-pill-count">{batches.filter((b) => b.resourceType === 'SUPPLIERS').length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${historyResourceFilter === 'ITEMS' ? 'active' : ''}`}
                onClick={() => setHistoryResourceFilter('ITEMS')}
              >
                Catalog Items <span className="sales-pill-count">{batches.filter((b) => b.resourceType === 'ITEMS').length}</span>
              </button>
            </div>

            <div className="sales-search-box">
              <Search size={14} className="sales-search-icon" />
              <input
                className="sales-search-input"
                placeholder="Search batches by ID, SHA-256, or key..."
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '160px' }}>TIMESTAMP</th>
                    <th style={{ width: '130px' }}>RESOURCE</th>
                    <th style={{ width: '130px' }}>ROWS IMPORTED</th>
                    <th style={{ minWidth: '220px' }}>CONTENT SHA-256</th>
                    <th style={{ minWidth: '200px' }}>IDEMPOTENCY KEY</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="sales-empty-cell">
                        <div className="sales-empty-state">
                          <History size={32} className="sales-empty-icon" />
                          <div className="sales-empty-title">No import batches found</div>
                          <div className="sales-empty-desc">
                            {historyQuery || historyResourceFilter !== 'ALL'
                              ? 'No batches match your filter criteria.'
                              : 'Committed imports will appear here with cryptographic SHA-256 audit hashes.'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((batch) => {
                      const formattedDate = new Date(batch.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      return (
                        <tr key={batch.id} className="sales-row">
                          <td className="sales-date-cell">
                            <time dateTime={batch.createdAt}>{formattedDate}</time>
                          </td>

                          <td>
                            <span className={`product-type-badge ${batch.resourceType.toLowerCase()}`}>
                              {batch.resourceType}
                            </span>
                          </td>

                          <td>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                              {batch.rowsImported} rows
                            </span>
                          </td>

                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <code style={{ fontSize: '10.5px', color: 'var(--sp-text-secondary)', background: 'var(--sp-surface-hover)', padding: '2px 6px', borderRadius: '4px' }}>
                                {batch.contentSha256.slice(0, 16)}…{batch.contentSha256.slice(-8)}
                              </code>
                              <button
                                type="button"
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--sp-text-muted)' }}
                                onClick={() => copyToClipboard(batch.contentSha256, 'SHA-256 hash')}
                                title="Copy full SHA-256"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </td>

                          <td>
                            <span className="sales-ref-badge" style={{ fontSize: '10.5px' }}>
                              {batch.idempotencyKey || batch.id.slice(0, 18)}
                            </span>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <span className="customer-risk-chip good">
                              <Check size={10} /> Verified
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. SUB-TAB 3: Interactive Template Center & Schemas */}
      {activeTab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Template Selector Pills */}
          <div className="sales-toolbar">
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${activeTemplateResource === 'CUSTOMERS' ? 'active' : ''}`}
                onClick={() => setActiveTemplateResource('CUSTOMERS')}
              >
                Customers ({TEMPLATES.CUSTOMERS.specs.length} fields)
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${activeTemplateResource === 'SUPPLIERS' ? 'active' : ''}`}
                onClick={() => setActiveTemplateResource('SUPPLIERS')}
              >
                Suppliers ({TEMPLATES.SUPPLIERS.specs.length} fields)
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${activeTemplateResource === 'ITEMS' ? 'active' : ''}`}
                onClick={() => setActiveTemplateResource('ITEMS')}
              >
                Catalog Items ({TEMPLATES.ITEMS.specs.length} fields)
              </button>
            </div>

            <button
              type="button"
              className="button button-primary"
              onClick={() => downloadSampleTemplate(activeTemplateResource)}
            >
              <Download size={13} />
              <span>Download {selectedTemplateData.filename}</span>
            </button>
          </div>

          {/* Template Header Card */}
          <div style={{ background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={16} color="var(--sp-brand)" />
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)', margin: 0 }}>
                  {selectedTemplateData.title}
                </h3>
              </div>
              <span className="sales-ref-badge">{selectedTemplateData.filename}</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', margin: 0 }}>
              {selectedTemplateData.description}
            </p>
          </div>

          {/* Column Specifications Table */}
          <div className="sales-table-card">
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--sp-border)', fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase' }}>
              Field Specifications ({selectedTemplateData.specs.length} columns)
            </div>
            <div className="sales-table-scroll">
              <table className="import-spec-table">
                <thead>
                  <tr>
                    <th style={{ width: '160px' }}>COLUMN KEY</th>
                    <th style={{ width: '110px' }}>REQUIREMENT</th>
                    <th style={{ width: '130px' }}>DATA TYPE</th>
                    <th style={{ minWidth: '220px' }}>DESCRIPTION</th>
                    <th style={{ minWidth: '180px' }}>SAMPLE VALUE</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTemplateData.specs.map((field) => (
                    <tr key={field.key}>
                      <td>
                        <code style={{ fontSize: '11.5px', fontWeight: 600, color: field.required ? 'var(--sp-brand)' : 'var(--sp-text)' }}>
                          {field.key}
                        </code>
                      </td>
                      <td>
                        {field.required ? (
                          <span className="import-schema-tag required">Required *</span>
                        ) : (
                          <span className="import-schema-tag">Optional</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '11px', color: 'var(--sp-text-secondary)' }}>{field.type}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '11.5px', color: 'var(--sp-text)' }}>{field.description}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {field.example}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live CSV Sample Preview */}
          <div className="sales-table-card">
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--sp-border)', fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase' }}>
              Live CSV Sample Data Preview
            </div>
            <div className="sales-table-scroll" style={{ maxHeight: '220px' }}>
              <table className="sales-table">
                <thead>
                  <tr>
                    {sampleTableData.headers.map((h) => (
                      <th key={h} style={{ fontSize: '11px', padding: '6px 10px' }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleTableData.rows.map((row, idx) => (
                    <tr key={idx} className="sales-row">
                      {row.map((val, cellIdx) => (
                        <td key={cellIdx} style={{ fontSize: '11.5px', padding: '6px 10px', color: 'var(--sp-text)' }}>
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. SUB-TAB 4: Master Data Export Register */}
      {activeTab === 'export' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Export Toolbar */}
          <div className="sales-toolbar">
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${exportCategory === 'ALL' ? 'active' : ''}`}
                onClick={() => setExportCategory('ALL')}
              >
                All Entities <span className="sales-pill-count">{EXPORT_ENTITIES.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${exportCategory === 'Master' ? 'active' : ''}`}
                onClick={() => setExportCategory('Master')}
              >
                Master Data <span className="sales-pill-count">3</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${exportCategory === 'Commercial' ? 'active' : ''}`}
                onClick={() => setExportCategory('Commercial')}
              >
                Commercial <span className="sales-pill-count">2</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${exportCategory === 'Procurement' ? 'active' : ''}`}
                onClick={() => setExportCategory('Procurement')}
              >
                Procurement <span className="sales-pill-count">1</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${exportCategory === 'Finance' ? 'active' : ''}`}
                onClick={() => setExportCategory('Finance')}
              >
                Finance <span className="sales-pill-count">1</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${exportCategory === 'Production' ? 'active' : ''}`}
                onClick={() => setExportCategory('Production')}
              >
                Production <span className="sales-pill-count">1</span>
              </button>
            </div>

            <div className="sales-search-box">
              <Search size={14} className="sales-search-icon" />
              <input
                className="sales-search-input"
                placeholder="Search exportable entities..."
                value={exportQuery}
                onChange={(e) => setExportQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Export Register Table */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '220px' }}>DATA ENTITY</th>
                    <th style={{ width: '160px' }}>RESOURCE CODE</th>
                    <th style={{ width: '130px' }}>CLASSIFICATION</th>
                    <th style={{ minWidth: '200px' }}>CAPACITY & CUSTOM FIELDS</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExports.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="sales-empty-cell">
                        <div className="sales-empty-state">
                          <Download size={32} className="sales-empty-icon" />
                          <div className="sales-empty-title">No export entities match</div>
                          <div className="sales-empty-desc">Try clearing your search query.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredExports.map((ent) => {
                      const IconComp = ent.icon;

                      return (
                        <tr key={ent.resource} className="sales-row">
                          <td>
                            <div className="sales-customer-cell">
                              <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--sp-brand-soft)', color: 'var(--sp-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <IconComp size={15} />
                              </div>
                              <div className="customer-info-cell" style={{ minWidth: 0 }}>
                                <strong>{ent.title}</strong>
                                <small>{ent.description}</small>
                              </div>
                            </div>
                          </td>

                          <td>
                            <span className="sales-ref-badge">{ent.resource}</span>
                          </td>

                          <td>
                            <span className="product-type-badge finished">{ent.badge}</span>
                          </td>

                          <td>
                            <span style={{ fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
                              Up to 10,000 active records · Custom fields bound
                            </span>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="sales-action-btn secondary"
                              disabled={saving}
                              onClick={() => onExport(ent.resource)}
                            >
                              <Download size={11} />
                              <span>Export CSV</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
