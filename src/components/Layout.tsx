import { useState } from 'react';
import {
  LayoutDashboard, Package, Truck, DollarSign, Users,
  MessageCircle, LogOut, Menu, X, Settings,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { NotificationBell } from './GlobalNotifications';

interface LayoutProps {
  children: React.ReactNode;
  currentModule: string;
  onModuleChange: (module: string) => void;
}

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  chatbot: 'Chat / IA',
  orders: 'Pedidos',
  dispatch: 'Despacho',
  finance: 'Finanzas',
  fleet: 'Flotilla',
  settings: 'Configuración',
};

export default function Layout({ children, currentModule, onModuleChange }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'operator', 'dispatcher', 'finance'] },
    { id: 'chatbot', label: 'Chat / IA', icon: MessageCircle, roles: ['admin', 'operator'] },
    { id: 'orders', label: 'Pedidos', icon: Package, roles: ['admin', 'operator', 'dispatcher'] },
    { id: 'dispatch', label: 'Despacho', icon: Truck, roles: ['admin', 'dispatcher'] },
    { id: 'finance', label: 'Finanzas', icon: DollarSign, roles: ['admin', 'finance'] },
    { id: 'fleet', label: 'Flotilla', icon: Users, roles: ['admin', 'dispatcher'] },
    { id: 'settings', label: 'Configuración', icon: Settings, roles: ['admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item =>
    !profile || item.roles.includes(profile.role)
  );

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar header — NO bell here */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-blue-600">ERP System</h1>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            {profile && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-900">{profile.full_name}</p>
                <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
              </div>
            )}
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { onModuleChange(item.id); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* ── Top header — always visible, bell lives here ── */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
          {/* Left: hamburger (mobile) + page title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-base font-semibold text-gray-700">
              {MODULE_LABELS[currentModule] || 'ERP'}
            </h2>
          </div>

          {/* Right: bell — lots of space to the right, dropdown never cut off */}
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
