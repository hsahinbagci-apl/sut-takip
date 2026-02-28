import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import PatientManager from './components/PatientManager';
import SUTEntryForm from './components/SUTEntryForm';
import TenderTracker from './components/TenderTracker';
import Analysis from './components/Analysis';
import Settings from './components/Settings';
import Login from './components/Login';
import { ViewState, User } from './types';
import { getCurrentUser, logoutUser, initializeTenders, loadFromAPI, isInitialized } from './services/storageService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Loading state - data is being fetched from the API
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const initApp = async () => {
      try {
        // Step 1: Load all data from the MySQL-backed API
        await loadFromAPI();

        // Step 2: Bootstrap tenders if empty
        initializeTenders();

        // Step 3: Check for existing session
        const user = getCurrentUser();
        if (user) {
          setCurrentUser(user);
        }
      } catch (error) {
        console.error('App initialization error:', error);
        setLoadError('Sunucuya bağlanılamadı. Lütfen sayfayı yenileyin.');
      } finally {
        setIsLoading(false);
      }
    };

    initApp();
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setCurrentView(ViewState.DASHBOARD);
  };

  const handleViewChange = (view: ViewState, patientId?: string) => {
    setCurrentView(view);
    if (patientId) {
      setSelectedPatientId(patientId);
    } else {
      setSelectedPatientId(undefined);
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case ViewState.DASHBOARD:
        return <Dashboard changeView={handleViewChange} />;
      case ViewState.PATIENTS:
        return <PatientManager />;
      case ViewState.SUT_ENTRY:
        return (
          <SUTEntryForm
            preSelectedPatientId={selectedPatientId}
            onComplete={() => handleViewChange(ViewState.DASHBOARD)}
          />
        );
      case ViewState.ANALYSIS:
        return <Analysis />;
      case ViewState.TENDERS:
        if (currentUser?.role !== 'admin') {
          return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500">
              <span className="text-4xl mb-2">⛔</span>
              <h3 className="text-xl font-bold text-gray-700">Yetkisiz Erişim</h3>
              <p>Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
            </div>
          );
        }
        return <TenderTracker />;
      case ViewState.SETTINGS:
        if (currentUser?.role !== 'admin') {
          return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500">
              <span className="text-4xl mb-2">⛔</span>
              <h3 className="text-xl font-bold text-gray-700">Yetkisiz Erişim</h3>
              <p>Ayarlar sayfasına sadece yöneticiler erişebilir.</p>
            </div>
          );
        }
        return <Settings />;
      default:
        return <Dashboard changeView={handleViewChange} />;
    }
  };

  // Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100">
        <div className="text-5xl mb-4 animate-pulse">🏥</div>
        <h1 className="text-2xl font-bold text-gray-700 mb-2">MediSUT Pro</h1>
        <p className="text-gray-500">Veriler yükleniyor...</p>
        <div className="mt-4 w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full animate-[loading_1.5s_ease-in-out_infinite]"
            style={{ width: '60%', animation: 'loading 1.5s ease-in-out infinite' }}></div>
        </div>
        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(60%); }
            100% { transform: translateX(-100%); }
          }
        `}</style>
      </div>
    );
  }

  // Error Screen
  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-red-600 mb-2">Bağlantı Hatası</h1>
        <p className="text-gray-600 mb-4">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  // Auth Guard
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        currentView={currentView}
        setView={(v) => handleViewChange(v)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="ml-64 flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;