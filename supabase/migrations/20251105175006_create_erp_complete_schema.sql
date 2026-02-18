/*
  # ERP Complete Database Schema
  
  ## Overview
  Complete database schema for an integrated ERP system with 5 interconnected modules:
  1. Conversational Interface (Chatbot/AI)
  2. Order Management System (OMS)
  3. Dispatch & Transport Management (TMS/DMS)
  4. Finance & Reconciliation (COD Management)
  5. HR & Fleet Management
  
  ## New Tables
  
  ### Module 1: Users & Authentication
  - `profiles` - User profiles with role-based access
  
  ### Module 2: HR & Fleet Management
  - `drivers` - Driver registry
  - `driver_locations` - Real-time driver location tracking
  
  ### Module 3: Conversational Interface & Customer Management
  - `customers` - Customer registry
  - `chat_conversations` - Chat session tracking
  - `chat_messages` - Conversation messages
  
  ### Module 4: Order Management System (OMS)
  - `orders` - Centralized order registry
  - `order_events` - Order status history
  
  ### Module 5: Dispatch & Transport Management (TMS/DMS)
  - `assignments` - Driver-order assignments
  - `routes` - Optimized delivery routes
  
  ### Module 6: Finance & Reconciliation (COD Management)
  - `driver_advances` - Driver cash advances
  - `transactions` - Financial transaction registry
  - `reconciliations` - Daily reconciliation records
  
  ## Security
  - Enable RLS on all tables
  - Policies based on user roles and data ownership
  
  ## Indexes
  - Performance indexes for common queries
*/

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'operator', 'dispatcher', 'finance', 'driver');
CREATE TYPE driver_status AS ENUM ('available', 'busy', 'offline', 'suspended');
CREATE TYPE order_type AS ENUM ('mandadito', 'restaurant', 'express');
CREATE TYPE order_source AS ENUM ('chatbot', 'phone', 'web', 'restaurant');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'assigned', 'in_transit', 'delivered', 'cancelled');
CREATE TYPE order_priority AS ENUM ('normal', 'high', 'urgent');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'transfer');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'cod');
CREATE TYPE assignment_status AS ENUM ('assigned', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled');
CREATE TYPE route_status AS ENUM ('planned', 'active', 'completed');
CREATE TYPE advance_type AS ENUM ('advance', 'loan', 'bonus');
CREATE TYPE advance_status AS ENUM ('pending', 'approved', 'disbursed', 'deducted');
CREATE TYPE transaction_type AS ENUM ('collection', 'commission', 'advance_deduction', 'fee', 'refund');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'reconciled');
CREATE TYPE reconciliation_status AS ENUM ('pending', 'in_progress', 'completed', 'disputed');
CREATE TYPE chat_status AS ENUM ('active', 'completed', 'abandoned');
CREATE TYPE sender_type AS ENUM ('customer', 'bot', 'operator');

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'operator',
  phone text,
  avatar_url text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  license_number text,
  license_expiry date,
  vehicle_type text,
  vehicle_plate text,
  status driver_status DEFAULT 'offline',
  rating numeric(3,2) DEFAULT 5.00,
  total_deliveries integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Driver locations table
CREATE TABLE IF NOT EXISTS driver_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
  latitude numeric(10,8) NOT NULL,
  longitude numeric(11,8) NOT NULL,
  accuracy numeric(6,2),
  timestamp timestamptz DEFAULT now()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  name text,
  email text,
  addresses jsonb DEFAULT '[]'::jsonb,
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Chat conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  channel text DEFAULT 'web',
  status chat_status DEFAULT 'active',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES chat_conversations(id) ON DELETE CASCADE NOT NULL,
  sender_type sender_type NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES chat_conversations(id) ON DELETE SET NULL,
  order_type order_type NOT NULL,
  source order_source NOT NULL,
  status order_status DEFAULT 'pending',
  priority order_priority DEFAULT 'normal',
  pickup_address jsonb NOT NULL,
  delivery_address jsonb NOT NULL,
  pickup_contact jsonb,
  delivery_contact jsonb,
  items jsonb DEFAULT '[]'::jsonb,
  special_instructions text,
  total_amount numeric(10,2) DEFAULT 0,
  delivery_fee numeric(10,2) DEFAULT 0,
  payment_method payment_method DEFAULT 'cash',
  payment_status payment_status DEFAULT 'pending',
  scheduled_pickup timestamptz,
  scheduled_delivery timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Order events table
CREATE TABLE IF NOT EXISTS order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  description text,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL NOT NULL,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status assignment_status DEFAULT 'assigned',
  assigned_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  estimated_distance_km numeric(8,2),
  actual_distance_km numeric(8,2),
  estimated_duration_min integer,
  actual_duration_min integer,
  created_at timestamptz DEFAULT now()
);

-- Routes table
CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
  route_date date NOT NULL,
  order_sequence jsonb DEFAULT '[]'::jsonb,
  total_distance_km numeric(8,2) DEFAULT 0,
  total_duration_min integer DEFAULT 0,
  status route_status DEFAULT 'planned',
  created_at timestamptz DEFAULT now()
);

-- Driver advances table
CREATE TABLE IF NOT EXISTS driver_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
  amount numeric(10,2) NOT NULL,
  type advance_type NOT NULL,
  status advance_status DEFAULT 'pending',
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES assignments(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  transaction_type transaction_type NOT NULL,
  amount numeric(10,2) NOT NULL,
  payment_method payment_method DEFAULT 'cash',
  status transaction_status DEFAULT 'pending',
  reference text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Reconciliations table
CREATE TABLE IF NOT EXISTS reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
  reconciliation_date date NOT NULL,
  total_collections numeric(10,2) DEFAULT 0,
  total_commissions numeric(10,2) DEFAULT 0,
  advances_deducted numeric(10,2) DEFAULT 0,
  net_amount numeric(10,2) DEFAULT 0,
  status reconciliation_status DEFAULT 'pending',
  reconciled_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_timestamp ON driver_locations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_customer_id ON chat_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_assignments_order_id ON assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_assignments_driver_id ON assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_routes_driver_id ON routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_routes_route_date ON routes(route_date);
CREATE INDEX IF NOT EXISTS idx_driver_advances_driver_id ON driver_advances(driver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_driver_id ON transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_reconciliations_driver_id ON reconciliations(driver_id);
CREATE INDEX IF NOT EXISTS idx_reconciliations_date ON reconciliations(reconciliation_date);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for drivers
CREATE POLICY "Authenticated users can view drivers"
  ON drivers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and dispatchers can manage drivers"
  ON drivers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'dispatcher')
    )
  );

CREATE POLICY "Drivers can update own record"
  ON drivers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for driver_locations
CREATE POLICY "Authenticated users can view driver locations"
  ON driver_locations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Drivers can insert own location"
  ON driver_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_id
      AND drivers.user_id = auth.uid()
    )
  );

-- RLS Policies for customers
CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operators and admins can manage customers"
  ON customers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operator')
    )
  );

-- RLS Policies for chat_conversations
CREATE POLICY "Authenticated users can view conversations"
  ON chat_conversations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operators and admins can manage conversations"
  ON chat_conversations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operator')
    )
  );

-- RLS Policies for chat_messages
CREATE POLICY "Authenticated users can view messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operators and admins can manage messages"
  ON chat_messages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operator')
    )
  );

-- RLS Policies for orders
CREATE POLICY "Authenticated users can view orders"
  ON orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operators and admins can manage orders"
  ON orders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operator', 'dispatcher')
    )
  );

-- RLS Policies for order_events
CREATE POLICY "Authenticated users can view order events"
  ON order_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create order events"
  ON order_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for assignments
CREATE POLICY "Authenticated users can view assignments"
  ON assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Dispatchers and admins can manage assignments"
  ON assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'dispatcher')
    )
  );

CREATE POLICY "Drivers can update own assignments"
  ON assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_id
      AND drivers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_id
      AND drivers.user_id = auth.uid()
    )
  );

-- RLS Policies for routes
CREATE POLICY "Authenticated users can view routes"
  ON routes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Dispatchers and admins can manage routes"
  ON routes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'dispatcher')
    )
  );

-- RLS Policies for driver_advances
CREATE POLICY "Finance and admins can view advances"
  ON driver_advances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'finance')
    )
  );

CREATE POLICY "Finance and admins can manage advances"
  ON driver_advances FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'finance')
    )
  );

CREATE POLICY "Drivers can view own advances"
  ON driver_advances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_id
      AND drivers.user_id = auth.uid()
    )
  );

-- RLS Policies for transactions
CREATE POLICY "Finance and admins can view transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'finance')
    )
  );

CREATE POLICY "Finance and admins can manage transactions"
  ON transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'finance')
    )
  );

CREATE POLICY "Drivers can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_id
      AND drivers.user_id = auth.uid()
    )
  );

-- RLS Policies for reconciliations
CREATE POLICY "Finance and admins can view reconciliations"
  ON reconciliations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'finance')
    )
  );

CREATE POLICY "Finance and admins can manage reconciliations"
  ON reconciliations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'finance')
    )
  );

CREATE POLICY "Drivers can view own reconciliations"
  ON reconciliations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_id
      AND drivers.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();