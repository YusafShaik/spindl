export interface CsvImportError {
  row: number;
  message: string;
}

export interface CsvImportPreview {
  totalRows: number;
  validRows: number;
  errors: CsvImportError[];
  sampleRows: Array<Record<string, string>>;
}

export interface PublishedCustomField {
  id: string;
  fieldKey: string;
  displayName: string;
  fieldType: string;
  required: boolean;
  published: boolean;
}

export type ImportResource = 'CUSTOMERS' | 'SUPPLIERS' | 'ITEMS';

export type ExportResource =
  | 'CUSTOMERS'
  | 'ITEMS'
  | 'SUPPLIERS'
  | 'PURCHASE_ORDERS'
  | 'QUOTES'
  | 'SALES_ORDERS'
  | 'INVOICES'
  | 'WORK_ORDERS';
