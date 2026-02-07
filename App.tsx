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
import { getCurrentUser, logoutUser, initializeTenders } from './services/storageService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);
  
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // Bootstrap: Initialize Tenders if empty to prevent reference bugs
    initializeTenders();

    // Check for existing session on load
    const user = getCurrentUser();
    if (user) {
        setCurrentUser(user);
    }
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