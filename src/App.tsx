import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
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
  const [targetConversationId, setTargetConversationId] = useState<string | undefined>(undefined);

  // Listen for navigation events dispatched by GlobalNotifications
  useEffect(() => {
    const handler = (e: Event) => {
      const convId = (e as CustomEvent<string | undefined>).detail;
      setCurrentModule('chatbot');
      setTargetConversationId(convId);
      setTimeout(() => setTargetConversationId(undefined), 2000);
    };
    window.addEventListener('erp:navigate-to-chat', handler);
    return () => window.removeEventListener('erp:navigate-to-chat', handler);
  }, []);

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
        return <Chatbot initialConversationId={targetConversationId} />;
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
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;

