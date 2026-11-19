import {
  Activity, Boxes, ChartNoAxesCombined, Check, ClipboardList, Cpu, Factory,
  FileText, GitBranch, HardHat, LayoutDashboard, Package, Scale, ShoppingCart, Truck, Upload, Users, Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export interface NavigationItem {
  label: string;
  icon: LucideIcon;
  count?: string;
}

export interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}

export const navGroups: NavigationGroup[] = [
  { title: 'WORKSPACE', items: [
    { label: 'Overview', icon: LayoutDashboard }, { label: 'Sales', icon: ShoppingCart, count: '8' },
    { label: 'POS', icon: ShoppingCart }, { label: 'Purchases', icon: ClipboardList },
    { label: 'Production', icon: Factory }, { label: 'Planning (MRP)', icon: Cpu },
    { label: 'Engineering (ECO)', icon: GitBranch },
    { label: 'Maintenance', icon: Wrench }, { label: 'Quality', icon: Check },
    { label: 'Workforce', icon: HardHat },
    { label: 'Logistics', icon: Truck },
    { label: 'Leads', icon: Users }, { label: 'Accounting (GL)', icon: Scale },
    { label: 'Inventory', icon: Boxes }, { label: 'Customers', icon: Users },
    { label: 'Products', icon: Package },
  ] },
  { title: 'MANAGE', items: [
    { label: 'Imports', icon: Upload }, { label: 'Team', icon: Users },
    { label: 'Audit log', icon: Activity }, { label: 'Reports', icon: ChartNoAxesCombined },
    { label: 'Warehouses', icon: Warehouse },
  ] },
];

const moduleByNavigationLabel: Record<string, string> = {
  Overview: 'dashboard', Sales: 'sales', POS: 'sales', Purchases: 'purchasing',
  Production: 'manufacturing', 'Planning (MRP)': 'manufacturing', 'Engineering (ECO)': 'manufacturing',
  Maintenance: 'manufacturing', Quality: 'quality', Workforce: 'manufacturing',
  Logistics: 'sales', Leads: 'crm', Transactions: 'finance', 'Accounting (GL)': 'finance',
  Inventory: 'inventory', Customers: 'crm', Products: 'catalog', Imports: 'imports',
  Team: 'team', 'Audit log': 'operations', Reports: 'finance', Warehouses: 'inventory',
};

export function navModuleCode(label: string): string {
  return moduleByNavigationLabel[label] ?? 'dashboard';
}
