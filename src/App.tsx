import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Chatbot from './components/modules/Chatbot';
import OrderManagement from './components/modules/OrderManagement';
import DispatchManagement from './components/modules/DispatchManagement';
import FinanceManagement from './components/modules/FinanceManagement';
import FleetManagement from './components/modules/FleetManagement';
import GlobalNotifications from './components/GlobalNotifications';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentModule, setCurrentModule] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const renderModule = () => {
    switch (currentModule) {
      case 'dashboard':
        return <Dashboard />;
      case 'chatbot':
        return <Chatbot />;
      case 'orders':
        return <OrderManagement />;
      case 'dispatch':
        return <DispatchManagement />;
      case 'finance':
        return <FinanceManagement />;
      case 'fleet':
        return <FleetManagement />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      <Layout currentModule={currentModule} onModuleChange={setCurrentModule}>
        {renderModule()}
      </Layout>
      <GlobalNotifications />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

