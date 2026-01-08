import React, { useState, useEffect } from 'react';
import { backend } from './services/storage';
import { Service, UserSession } from './types';
import { Sidebar, BottomNav } from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import { Menu } from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [services, setServices] = useState<Service[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load initial data on mount/login
  useEffect(() => {
    if (session) {
        refreshServices();
    }
  }, [session]);

  const refreshServices = async () => {
    const data = await backend.getServices();
    setServices(data);
  };

  const handleLogin = (newSession: UserSession) => {
    setSession(newSession);
  };

  const handleLogout = () => {
    setSession(null);
    setCurrentPage('dashboard');
    setIsSidebarOpen(false);
  };

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
        {/* Sidebar (Desktop + Mobile Drawer) */}
        <Sidebar 
            currentPage={currentPage} 
            onNavigate={setCurrentPage} 
            onLogout={handleLogout} 
            user={session.user}
            isOpen={isSidebarOpen}
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
            
            {/* Mobile Header with Hamburger */}
            <div className="md:hidden flex items-center justify-between px-6 py-4 bg-white border-b border-slate-50 shadow-sm z-30">
                <button 
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                >
                    <Menu size={24} />
                </button>
                <div className="font-bold text-slate-900 tracking-tight">CO-OP TAXI</div>
                <div className="w-10"></div> {/* Spacer for balance */}
            </div>

            <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-4 md:pt-8 scrollbar-hide">
                <div className="max-w-5xl mx-auto pb-24 md:pb-0">
                    {currentPage === 'dashboard' && (
                        <Dashboard 
                            services={services} 
                            navigateToChat={() => setCurrentPage('chat')}
                            onNavigate={setCurrentPage}
                            user={session.user}
                        />
                    )}
                    {currentPage === 'services' && (
                        <Services 
                            services={services} 
                            onServiceAdded={refreshServices}
                            onServiceDeleted={refreshServices}
                        />
                    )}
                    {currentPage === 'chat' && (
                        <Chat services={services} />
                    )}
                    {currentPage === 'settings' && (
                        <Settings />
                    )}
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <BottomNav 
                currentPage={currentPage}
                onNavigate={setCurrentPage}
                onLogout={handleLogout}
                user={session.user}
                toggleSidebar={() => setIsSidebarOpen(true)}
            />
        </div>
    </div>
  );
};

export default App;