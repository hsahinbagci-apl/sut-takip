import React, { useState, useEffect } from 'react';
import { 
    getDoctors, saveDoctor, deleteDoctor,
    getSUTCodes, saveSUTCode, deleteSUTCode,
    getLogs, getUsers, saveUser, deleteUser, getCurrentUser,
    getTestProtocols, saveTestProtocol, deleteTestProtocol, generateId
} from '../services/storageService';
import { SUTCode, LogEntry, User, TestProtocol, TestStep } from '../types';

const Settings: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'general' | 'sut' | 'logs' | 'users'>('general');
    
    // States
    const [doctors, setDoctors] = useState<string[]>([]);
    const [newDoctor, setNewDoctor] = useState('');
    
    // Protocol States
    const [protocols, setProtocols] = useState<TestProtocol[]>([]);
    const [editingProtocol, setEditingProtocol] = useState<Partial<TestProtocol>>({ name: '', steps: [] });
    const [newStep, setNewStep] = useState<Partial<TestStep>>({ sutCode: '', daysAfterPrevious: 0, description: '' });

    const [sutCodes, setSutCodes] = useState<SUTCode[]>([]);
    const [newSutCode, setNewSutCode] = useState<SUTCode>({ 
        code: '', 
        description: '', 
        points: 0, 
        price: 0,
        relatedTestName: '',
        nextActionInDays: 0
    });

    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [newUser, setNewUser] = useState<Partial<User>>({ username: '', password: '', fullName: '', role: 'user' });
    const currentUser = getCurrentUser();

    useEffect(() => {
        setDoctors(getDoctors());
        setProtocols(getTestProtocols());
        setSutCodes(getSUTCodes());
        setLogs(getLogs());
        setUsers(getUsers());
    }, [activeTab]);

    // Doctor Handlers
    const handleAddDoctor = (e: React.FormEvent) => {
        e.preventDefault();
        if (newDoctor.trim()) {
            saveDoctor(newDoctor.trim());
            setDoctors(getDoctors());
            setNewDoctor('');
        }
    };
    const handleDeleteDoctor = (name: string) => {
        if(window.confirm(`${name} isimli uzman listeden silinecek. Emin misiniz?`)) {
            deleteDoctor(name);
            setDoctors(getDoctors());
        }
    };

    // Protocol Handlers
    const handleSaveProtocol = () => {
        if (!editingProtocol.name) return alert("Protokol adı giriniz.");
        
        const protocol: TestProtocol = {
            id: editingProtocol.id || generateId(),
            name: editingProtocol.name,
            steps: editingProtocol.steps || []
        };
        saveTestProtocol(protocol);
        setProtocols(getTestProtocols());
        setEditingProtocol({ name: '', steps: [] });
    };

    const handleDeleteProtocol = (id: string) => {
        if(confirm("Protokol silinecek, emin misiniz?")) {
            deleteTestProtocol(id);
            setProtocols(getTestProtocols());
        }
    };

    const handleAddStep = () => {
        if (!newStep.sutCode) return alert("SUT Kodu seçiniz.");
        
        const sutInfo = sutCodes.find(c => c.code === newStep.sutCode);
        
        const step: TestStep = {
            stepNumber: (editingProtocol.steps?.length || 0) + 1,
            sutCode: newStep.sutCode,
            sutDescription: sutInfo?.description || '',
            daysAfterPrevious: newStep.daysAfterPrevious || 0,
            description: newStep.description || ''
        };

        setEditingProtocol({
            ...editingProtocol,
            steps: [...(editingProtocol.steps || []), step]
        });
        setNewStep({ sutCode: '', daysAfterPrevious: 0, description: '' });
    };

    const removeStep = (index: number) => {
        const newSteps = [...(editingProtocol.steps || [])];
        newSteps.splice(index, 1);
        // Re-number
        newSteps.forEach((s, i) => s.stepNumber = i + 1);
        setEditingProtocol({ ...editingProtocol, steps: newSteps });
    };

    // SUT Code Handlers
    const handleAddSUT = (e: React.FormEvent) => {
        e.preventDefault();
        if (newSutCode.code && newSutCode.description) {
            saveSUTCode(newSutCode);
            setSutCodes(getSUTCodes());
            setNewSutCode({ code: '', description: '', points: 0, price: 0, relatedTestName: '', nextActionInDays: 0 });
        } else {
            alert('Lütfen tüm alanları doldurunuz.');
        }
    };
    
    const handleDeleteSUT = (code: string) => {
        if(confirm('Bu SUT kodunu silmek istediğinize emin misiniz?')) {
            deleteSUTCode(code);
            const updatedCodes = getSUTCodes();
            setSutCodes(updatedCodes);
        }
    };

    // User Handlers
    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (newUser.username && newUser.password && newUser.fullName) {
            saveUser({
                id: generateId(),
                username: newUser.username,
                password: newUser.password,
                fullName: newUser.fullName,
                role: newUser.role as 'admin' | 'user'
            });
            setUsers(getUsers());
            setNewUser({ username: '', password: '', fullName: '', role: 'user' });
            alert('Kullanıcı eklendi.');
        }
    };
    
    const handleDeleteUser = (id: string) => {
        if (id === currentUser?.id) {
            alert('Kendinizi silemezsiniz.');
            return;
        }
        if (confirm('Kullanıcı silinecek. Emin misiniz?')) {
            deleteUser(id);
            setUsers(getUsers());
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Sistem Ayarları</h2>
                    <p className="text-gray-500">Tanımlamalar ve parametre yönetimi.</p>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('general')}
                    className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors relative ${activeTab === 'general' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Protokol & Testler
                    {activeTab === 'general' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>}
                </button>
                <button 
                    onClick={() => setActiveTab('sut')}
                    className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors relative ${activeTab === 'sut' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    SUT Kodları
                    {activeTab === 'sut' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>}
                </button>
                <button 
                    onClick={() => setActiveTab('users')}
                    className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors relative ${activeTab === 'users' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Kullanıcılar
                    {activeTab === 'users' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>}
                </button>
                <button 
                    onClick={() => setActiveTab('logs')}
                    className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors relative ${activeTab === 'logs' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    İşlem Geçmişi
                    {activeTab === 'logs' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>}
                </button>
            </div>

            {/* Content: Protocols (General) */}
            {activeTab === 'general' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Doctors Side */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 lg:col-span-1 h-fit">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                            <span className="text-xl mr-2">👨‍⚕️</span> İstemi Yapan Uzmanlar
                        </h3>
                        
                        <form onSubmit={handleAddDoctor} className="flex gap-2 mb-4">
                            <input 
                                type="text" 
                                placeholder="Ad Soyad / Unvan"
                                className="flex-1 border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                                value={newDoctor}
                                onChange={e => setNewDoctor(e.target.value)}
                            />
                            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Ekle</button>
                        </form>

                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {doctors.map((doc, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded hover:bg-gray-100 group">
                                    <span className="text-sm text-gray-700">{doc}</span>
                                    <button onClick={() => handleDeleteDoctor(doc)} className="text-red-400 hover:text-red-600 p-1" title="Sil">🗑️</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Protocol Builder Side */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 lg:col-span-2">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                            <span className="text-xl mr-2">🧪</span> Test Protokolleri
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">Hastaya uygulanacak test sürecini adım adım tanımlayın.</p>

                        <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h4 className="font-semibold text-sm mb-3 text-slate-700">Yeni / Düzenle Protokol</h4>
                            <div className="mb-3">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Protokol Adı</label>
                                <input 
                                    type="text" 
                                    className="w-full border p-2 rounded text-sm" 
                                    placeholder="Örn: Genetik Tarama Paneli v1" 
                                    value={editingProtocol.name}
                                    onChange={e => setEditingProtocol({...editingProtocol, name: e.target.value})}
                                />
                            </div>
                            
                            {/* Step Builder */}
                            <div className="mb-3">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Adımlar</label>
                                <div className="space-y-2 mb-2">
                                    {editingProtocol.steps?.map((step, idx) => {
                                        // Calculate Cumulative Days
                                        const totalDays = editingProtocol.steps!
                                            .slice(0, idx + 1)
                                            .reduce((sum, s) => sum + (s.daysAfterPrevious || 0), 0);
                                        
                                        return (
                                            <div key={idx} className="flex items-center gap-2 bg-white p-2 border rounded shadow-sm text-sm">
                                                <span className="bg-blue-100 text-blue-700 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">{step.stepNumber}</span>
                                                <span className="flex-1 font-mono text-gray-700">{step.sutCode}</span>
                                                <div className="flex flex-col items-end leading-tight min-w-[100px]">
                                                    <span className="text-gray-500 text-xs">+{step.daysAfterPrevious} Gün</span>
                                                    <span className="text-blue-600 text-[10px] font-bold">Toplam: {totalDays}. Gün</span>
                                                </div>
                                                <span className="text-gray-500 text-xs truncate max-w-[100px] border-l pl-2 border-gray-200">{step.description}</span>
                                                <button onClick={() => removeStep(idx)} className="text-red-400 hover:text-red-600 text-xs pl-2">Sil</button>
                                            </div>
                                        );
                                    })}
                                    {(!editingProtocol.steps || editingProtocol.steps.length === 0) && <p className="text-xs text-gray-400 italic">Henüz adım eklenmedi.</p>}
                                </div>

                                <div className="flex gap-2 items-end bg-white p-2 border border-dashed border-gray-300 rounded">
                                    <div className="flex-1">
                                        <label className="text-[10px] text-gray-400">SUT Kodu</label>
                                        <select 
                                            className="w-full border p-1 rounded text-sm bg-white"
                                            value={newStep.sutCode}
                                            onChange={e => setNewStep({...newStep, sutCode: e.target.value})}
                                        >
                                            <option value="">Seç...</option>
                                            {sutCodes.map(c => <option key={c.code} value={c.code}>{c.code} - {c.description}</option>)}
                                        </select>
                                    </div>
                                    <div className="w-20">
                                        <label className="text-[10px] text-gray-400">Gün (Sonra)</label>
                                        <input type="number" className="w-full border p-1 rounded text-sm" value={newStep.daysAfterPrevious} onChange={e => setNewStep({...newStep, daysAfterPrevious: parseInt(e.target.value)||0})} />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] text-gray-400">Adım Açıklaması</label>
                                        <input type="text" className="w-full border p-1 rounded text-sm" placeholder="Örn: 2. Doz" value={newStep.description} onChange={e => setNewStep({...newStep, description: e.target.value})} />
                                    </div>
                                    <button onClick={handleAddStep} className="bg-slate-700 text-white px-3 py-1 rounded text-xs h-8">Adım Ekle</button>
                                </div>
                            </div>
                            
                            <div className="flex justify-end">
                                <button onClick={handleSaveProtocol} className="bg-emerald-600 text-white px-4 py-2 rounded text-sm font-bold shadow-sm hover:bg-emerald-700">Protokolü Kaydet</button>
                            </div>
                        </div>

                        {/* List Protocols */}
                        <div className="space-y-3">
                            {protocols.map(p => (
                                <div key={p.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-gray-800">{p.name}</p>
                                        <p className="text-xs text-gray-500">{p.steps.length} Adımlı Süreç</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setEditingProtocol(p)} className="text-blue-500 text-sm hover:underline">Düzenle</button>
                                        <button onClick={() => handleDeleteProtocol(p.id)} className="text-red-500 text-sm hover:underline">Sil</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Content: SUT Codes */}
            {activeTab === 'sut' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800">SUT Kod Listesi</h3>
                    </div>

                    {/* Add Form */}
                    <div className="p-4 bg-blue-50 border-b border-blue-100">
                        <form onSubmit={handleAddSUT} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                            <div className="md:col-span-1">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Kod</label>
                                <input required type="text" placeholder="530.xx" className="w-full border p-2 rounded text-sm" value={newSutCode.code} onChange={e => setNewSutCode({...newSutCode, code: e.target.value})} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Açıklama</label>
                                <input required type="text" placeholder="İşlem adı..." className="w-full border p-2 rounded text-sm" value={newSutCode.description} onChange={e => setNewSutCode({...newSutCode, description: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Puan</label>
                                <input required type="number" placeholder="0" className="w-full border p-2 rounded text-sm" value={newSutCode.points || ''} onChange={e => setNewSutCode({...newSutCode, points: parseFloat(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Fiyat</label>
                                <input required type="number" placeholder="0" className="w-full border p-2 rounded text-sm" value={newSutCode.price || ''} onChange={e => setNewSutCode({...newSutCode, price: parseFloat(e.target.value)})} />
                            </div>
                            
                            <div className="md:col-span-5 flex justify-end mt-2">
                                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700">Listeye Ekle</button>
                            </div>
                        </form>
                    </div>

                    {/* List */}
                    <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Kod</th>
                                    <th className="px-4 py-3">Açıklama</th>
                                    <th className="px-4 py-3">Puan</th>
                                    <th className="px-4 py-3">Fiyat</th>
                                    <th className="px-4 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {sutCodes.map((code) => (
                                    <tr key={code.code} className="hover:bg-gray-50 group">
                                        <td className="px-4 py-2 font-mono font-medium text-blue-700">{code.code}</td>
                                        <td className="px-4 py-2">{code.description}</td>
                                        <td className="px-4 py-2">{code.points}</td>
                                        <td className="px-4 py-2">{code.price} ₺</td>
                                        <td className="px-4 py-2 text-right">
                                            <button 
                                                type="button"
                                                onClick={() => handleDeleteSUT(code.code)} 
                                                className="text-red-400 hover:text-red-600 font-medium"
                                                title="Sil"
                                            >
                                                Sil
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Content: Users */}
            {activeTab === 'users' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800">Kullanıcı Yönetimi</h3>
                    </div>

                    {/* Add User Form */}
                    <div className="p-4 bg-purple-50 border-b border-purple-100">
                        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                             <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Ad Soyad</label>
                                <input required type="text" className="w-full border p-2 rounded text-sm" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Kullanıcı Adı</label>
                                <input required type="text" className="w-full border p-2 rounded text-sm" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                            </div>
                             <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Şifre</label>
                                <input required type="text" className="w-full border p-2 rounded text-sm" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                            </div>
                            <button type="submit" className="bg-purple-600 text-white px-3 py-2 rounded text-sm h-[38px] font-medium">Kullanıcı Ekle</button>
                        </form>
                    </div>

                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 bg-gray-50 uppercase sticky top-0">
                            <tr>
                                <th className="px-6 py-3">Ad Soyad</th>
                                <th className="px-6 py-3">Kullanıcı Adı</th>
                                <th className="px-6 py-3">Rol</th>
                                <th className="px-6 py-3 text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map((u) => (
                                <tr key={u.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-3 font-medium">{u.fullName} {u.id === currentUser?.id && '(Siz)'}</td>
                                    <td className="px-6 py-3 text-gray-600">{u.username}</td>
                                    <td className="px-6 py-3 text-gray-500">{u.role}</td>
                                    <td className="px-6 py-3 text-right">
                                        <button 
                                            onClick={() => handleDeleteUser(u.id)}
                                            className={`text-red-500 hover:text-red-700 ${u.id === currentUser?.id ? 'opacity-30 cursor-not-allowed' : ''}`}
                                        >
                                            Sil
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Content: Logs */}
            {activeTab === 'logs' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="font-bold text-gray-800">Sistem İşlem Geçmişi</h3>
                        <p className="text-xs text-gray-500 mt-1">Son 1000 işlem görüntülenmektedir.</p>
                    </div>
                    
                    <div className="overflow-auto max-h-[600px]">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 bg-gray-50 uppercase sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">Tarih</th>
                                    <th className="px-6 py-3">Kullanıcı</th>
                                    <th className="px-6 py-3">İşlem</th>
                                    <th className="px-6 py-3">Detay</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-3 whitespace-nowrap text-gray-600 text-xs font-mono">
                                            {new Date(log.timestamp).toLocaleString('tr-TR')}
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap text-gray-800 font-medium">
                                            {log.user}
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                log.action.includes('SIL') ? 'bg-red-100 text-red-700' :
                                                log.action.includes('GUNCELLE') ? 'bg-orange-100 text-orange-700' :
                                                log.action.includes('KAYIT') || log.action.includes('EKLE') ? 'bg-green-100 text-green-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-gray-600">
                                            {log.details}
                                        </td>
                                    </tr>
                                ))}
                                {logs.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-400">
                                            Henüz kaydedilmiş işlem bulunmuyor.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;