export interface ClientManager {
  id: string;
  name: string;
  contact: string;
  email: string;
  memo?: string;
}

export interface Client {
  id: string;
  name: string;
  businessNumber: string;
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
  status: InvoiceStatus;
  issuedAt: number;
  cancelledAt?: number;
}
