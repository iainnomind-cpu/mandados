export type UserRole = 'admin' | 'operator' | 'dispatcher' | 'finance' | 'driver';

export type DriverStatus = 'available' | 'busy' | 'offline' | 'suspended';

export type OrderType = 'mandadito' | 'restaurant' | 'express';

export type OrderSource = 'chatbot' | 'phone' | 'web' | 'restaurant';

export type OrderStatus = 'pending' | 'confirmed' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';

export type OrderPriority = 'normal' | 'high' | 'urgent';

export type PaymentMethod = 'cash' | 'card' | 'transfer';

export type PaymentStatus = 'pending' | 'paid' | 'cod';

export type AssignmentStatus = 'assigned' | 'accepted' | 'rejected' | 'in_progress' | 'completed' | 'cancelled';

export type TransactionType = 'collection' | 'commission' | 'advance_deduction' | 'fee' | 'refund';

export type ReconciliationStatus = 'pending' | 'in_progress' | 'completed' | 'disputed';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  avatar_url?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  user_id?: string;
  license_number?: string;
  license_expiry?: string;
  vehicle_type?: string;
  vehicle_plate?: string;
  status: DriverStatus;
  rating: number;
  total_deliveries: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  addresses: Address[];
  preferences: Record<string, unknown>;
  created_at: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  reference?: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id?: string;
  conversation_id?: string;
  order_type: OrderType;
  source: OrderSource;
  status: OrderStatus;
  priority: OrderPriority;
  pickup_address: Address;
  delivery_address: Address;
  pickup_contact?: Contact;
  delivery_contact?: Contact;
  items: OrderItem[];
  special_instructions?: string;
  total_amount: number;
  delivery_fee: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  scheduled_pickup?: string;
  scheduled_delivery?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
  notes?: string;
}

export interface Contact {
  name: string;
  phone: string;
}

export interface Assignment {
  id: string;
  order_id: string;
  driver_id: string;
  assigned_by?: string;
  status: AssignmentStatus;
  assigned_at: string;
  accepted_at?: string;
  picked_up_at?: string;
  delivered_at?: string;
  estimated_distance_km?: number;
  actual_distance_km?: number;
  estimated_duration_min?: number;
  actual_duration_min?: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  order_id?: string;
  assignment_id?: string;
  driver_id?: string;
  transaction_type: TransactionType;
  amount: number;
  payment_method: PaymentMethod;
  status: string;
  reference?: string;
  notes?: string;
  created_at: string;
}

export interface Reconciliation {
  id: string;
  driver_id: string;
  reconciliation_date: string;
  total_collections: number;
  total_commissions: number;
  advances_deducted: number;
  net_amount: number;
  status: ReconciliationStatus;
  reconciled_by?: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
}

export interface ChatConversation {
  id: string;
  customer_id?: string;
  channel: string;
  status: 'active' | 'completed' | 'abandoned';
  started_at: string;
  ended_at?: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_type: 'customer' | 'bot' | 'operator';
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
