import React, { useState, useEffect } from 'react';
import { loginUser, getAllData } from '../services/storageService';
import { initGoogleDrive, handleDriveAuth, syncFromDrive, syncToDrive } from '../services/driveService';
import { User } from '../types';

interface LoginProps {
    onLoginSuccess: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    
    // Drive States
    const [driveReady, setDriveReady] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [driveStatus, setDriveStatus] = useState('');

    useEffect(() => {
        // Initialize Drive Service
        initGoogleDrive((success) => {
            if(success) setDriveReady(true);
        });
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        const user = loginUser(username, password);
        if (user) {
            onLoginSuccess(user);
        } else {
            setError('Kullanıcı adı veya şifre hatalı.');
        }
    };

    const handleGoogleSync = async () => {
        setIsSyncing(true);
        setDriveStatus('Google Bağlantısı kuruluyor...');
        
        const authorized = await handleDriveAuth();
        if (!authorized) {
            setDriveStatus('Bağlantı reddedildi.');
            setIsSyncing(false);
            return;
        }

        setDriveStatus('Veriler Drive\'dan kontrol ediliyor...');
        const success = await syncFromDrive();
        
        if (success) {
            setDriveStatus('Veriler yüklendi! Lütfen giriş yapın.');
            // Reload page or just let user login with new data
            setTimeout(() => setDriveStatus(''), 3000);
        } else {
            // If failed (maybe no file), ask to upload current
            if (confirm("Drive'da veri bulunamadı. Mevcut yerel verileri Drive'a yüklemek ister misiniz?")) {
                 setDriveStatus('Yükleniyor...');
                 await syncToDrive();
                 setDriveStatus('Veriler Drive\'a yüklendi.');
            } else {
                setDriveStatus('İşlem iptal edildi.');
            }
        }
        setIsSyncing(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 relative overflow-hidden">
                <div className="text-center mb-8">
                    <div className="text-4xl mb-2">🏥</div>
                    <h1 className="text-2xl font-bold text-gray-800">MediSUT Pro</h1>
                    <p className="text-gray-500 text-sm">Laboratuvar & SUT Takip Sistemi</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kullanıcı Adı</label>
                        <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            placeholder="Kullanıcı Adı"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
                        <input 
                            type="password" 
                            className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            placeholder="******"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-600/20 transition-all transform active:scale-95"
                    >
                        Giriş Yap
                    </button>
                </form>

                {driveReady && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <button 
                            type="button"
                            onClick={handleGoogleSync}
                            disabled={isSyncing}
                            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 rounded-lg transition-colors text-sm"
                        >
                            {isSyncing ? (
                                <span>🔄 İşlem Yapılıyor...</span>
                            ) : (
                                <>
                                    <span>☁️</span> Google Drive Eşitle
                                </>
                            )}
                        </button>
                        {driveStatus && <p className="text-xs text-center text-blue-600 mt-2">{driveStatus}</p>}
                        
                        {!process.env.VITE_GOOGLE_CLIENT_ID && (
                             <p className="text-[10px] text-red-400 mt-2 text-center">
                                 ⚠️ Client ID Ayarlanmamış (.env)
                             </p>
                        )}
                    </div>
                )}

                <div className="mt-6 text-center text-xs text-gray-400">
                    <p>&copy; 2024 MediSUT Pro</p>
                </div>
            </div>
        </div>
    );
};

export default Login;