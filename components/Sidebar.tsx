import React from 'react';
import { ViewState, User } from '../types';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  currentUser: User | null;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, currentUser, onLogout }) => {
  const menuItems = [
    { id: ViewState.DASHBOARD, label: 'Panel', icon: '📊' },
    { id: ViewState.PATIENTS, label: 'Hasta Takip', icon: '🔬' },
    { id: ViewState.SUT_ENTRY, label: 'SUT Girişi', icon: '📝' },
    { id: ViewState.ANALYSIS, label: 'Analiz', icon: '📈' },
    // Tenders is conditional
  ];

  if (currentUser?.role === 'admin') {
      menuItems.push({ id: ViewState.TENDERS, label: 'İhale & Fatura', icon: '💼' });
  }

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-xl z-50">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
          MediSUT Pro
        </h1>
        <p className="text-xs text-slate-400 mt-1">TNKÜ Patoloji AD</p>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              currentView === item.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        {currentUser?.role === 'admin' && (
          <button
              onClick={() => setView(ViewState.SETTINGS)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 mb-2 ${
                currentView === ViewState.SETTINGS
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="text-xl">⚙️</span>
              <span className="font-medium">Ayarlar</span>
          </button>
        )}
        
        <div className="bg-slate-800 rounded-lg p-3 mb-2">
          <p className="text-xs text-slate-400">Aktif Kullanıcı</p>
          <p className="text-sm font-semibold truncate">{currentUser?.fullName || 'Misafir'}</p>
          <p className="text-[10px] text-slate-500 uppercase">{currentUser?.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}</p>
        </div>

        <button 
            onClick={onLogout}
            className="w-full text-left text-xs text-red-400 hover:text-red-300 flex items-center space-x-2 px-2"
        >
            <span>🚪</span> <span>Çıkış Yap</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;