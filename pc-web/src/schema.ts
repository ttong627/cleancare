export interface ClientManager {
  id: string;
  name: string;
  contact: string;
  email: string;
  memo?: string;
}

export interface WorkPhoto {
  url: string;
  type: 'before' | 'after' | 'process';
  uploadedAt: number;
  uploadedBy: string;
  storagePath: string;
}

export interface WorkerLocation {
  uid: string;
  name: string;
  lat: number;
  lng: number;
  updatedAt: number;
  isActive: boolean;
}

export interface Client {
  id: string;
  name: string;
  businessNumber: string;
  address?: string;
  ceo?: string;
  phone?: string;
  managers: ClientManager[];
  createdAt?: number;
  updatedAt?: number;
}

export type InvoiceStatus = 'ISSUED' | 'CANCELLED';

export interface Invoice {
  id: string;
  projectId: string;
  clientId: string;
  clientName: string;
  businessNumber: string;
  managerName: string;
  managerEmail: string;
  itemName: string;
  amount: number;
  isVat?: boolean;
  vatAmount?: number;
  totalAmount?: number;
  status: InvoiceStatus;
  issuedAt: number;
  cancelledAt?: number;
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  paidAt?: number;
  paidAmount?: number;
  paymentMethod?: 'CASH' | 'CARD' | 'BANK' | 'OTHER';
  memo?: string;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'BANK' | 'OTHER';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface Payment {
  id: string;
  invoiceId: string;
  projectId: string;
  clientName: string;
  itemName: string;
  supplyAmount: number;
  isVat: boolean;
  vatAmount: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAt?: number;
  createdAt: number;
  memo?: string;
}
