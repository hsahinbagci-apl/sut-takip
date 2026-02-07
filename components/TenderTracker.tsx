import React, { useState, useEffect, useCallback } from 'react';
import { Tender, Invoice, TestProtocol, BilledProtocolItem, ProtocolQuota, Patient } from '../types';
import { getTenders, getInvoices, saveInvoice, getTestProtocols, saveTender, getPatients, getEntries, deleteInvoice, generateId } from '../services/storageService';

const TenderTracker: React.FC = () => {
    const [tender, setTender] = useState<Tender | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [protocols, setProtocols] = useState<TestProtocol[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [allEntries, setAllEntries] = useState<any[]>([]); 
    
    // Invoice Form
    const [invAmount, setInvAmount] = useState('');
    const [invDesc, setInvDesc] = useState('');
    
    // Invoice Protocol Breakdown State
    const [invoiceBreakdown, setInvoiceBreakdown] = useState<BilledProtocolItem[]>([]);
    const [selectedBreakdownProtocolId, setSelectedBreakdownProtocolId] = useState('');
    const [breakdownCount, setBreakdownCount] = useState<number>(0);

    // Quota Editing State
    const [isEditingQuota, setIsEditingQuota] = useState(false);
    const [tempQuotas, setTempQuotas] = useState<ProtocolQuota[]>([]);

    // Budget Editing State
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [newBudget, setNewBudget] = useState(0);

    // --- CENTRALIZED DATA FETCHING ---
    // Bu fonksiyon her işlemden sonra çağrılarak State ve Storage'ın %100 senkron olmasını sağlar.
    const refreshData = useCallback(() => {
        const tenders = getTenders();
        const active = tenders.find(t => t.active) || null;
        
        // 1. Update Tender State
        setTender(active);
        
        if (active) {
            // 2. Update Invoices from Storage (Source of Truth)
            const allInvoices = getInvoices();
            const tenderInvoices = allInvoices.filter(i => i.tenderId === active.id);
            setInvoices(tenderInvoices);

            // 3. Update Temp States for editing
            setTempQuotas(active.protocolQuotas || []);
            setNewBudget(active.totalBudget);
        } else {
            setInvoices([]);
        }

        // 4. Update other dependencies
        setProtocols(getTestProtocols());
        setPatients(getPatients());
        setAllEntries(getEntries());
    }, []);

    // Initial Load
    useEffect(() => {
        refreshData();
    }, [refreshData]);

    // --- Budget Logic ---
    const handleSaveBudget = () => {
        if (!tender) return;
        const updatedTender = { ...tender, totalBudget: newBudget };
        saveTender(updatedTender);
        setIsEditingBudget(false);
        refreshData(); // Sync UI
    };

    // --- Quota Logic ---
    const handleAddQuota = () => {
        if(!selectedBreakdownProtocolId) return; 
        
        const protocol = protocols.find(p => p.id === selectedBreakdownProtocolId);
        if(!protocol) return;

        const exists = tempQuotas.find(q => q.protocolId === protocol.id);
        if(exists) {
            alert("Bu protokol zaten listede.");
            return;
        }

        setTempQuotas([...tempQuotas, { protocolId: protocol.id, protocolName: protocol.name, quota: breakdownCount }]);
        setSelectedBreakdownProtocolId('');
        setBreakdownCount(0);
    };

    const handleRemoveQuota = (id: string) => {
        setTempQuotas(tempQuotas.filter(q => q.protocolId !== id));
    };

    const saveQuotasToTender = () => {
        if(!tender) return;
        const updatedTender = { ...tender, protocolQuotas: tempQuotas };
        saveTender(updatedTender);
        setIsEditingQuota(false);
        refreshData(); // Sync UI
    };

    // --- Invoice Breakdown Logic ---
    const addToBreakdown = () => {
        if (!selectedBreakdownProtocolId || breakdownCount <= 0) return;
        
        const protocol = protocols.find(p => p.id === selectedBreakdownProtocolId);
        if (!protocol) return;

        const newItem: BilledProtocolItem = {
            protocolId: protocol.id,
            protocolName: protocol.name,
            count: breakdownCount
        };

        const existingIndex = invoiceBreakdown.findIndex(i => i.protocolId === protocol.id);
        if (existingIndex >= 0) {
            const newBreakdown = [...invoiceBreakdown];
            newBreakdown[existingIndex].count += breakdownCount;
            setInvoiceBreakdown(newBreakdown);
        } else {
            setInvoiceBreakdown([...invoiceBreakdown, newItem]);
        }
        
        setSelectedBreakdownProtocolId('');
        setBreakdownCount(0);
    };

    const removeFromBreakdown = (index: number) => {
        const newBreakdown = [...invoiceBreakdown];
        newBreakdown.splice(index, 1);
        setInvoiceBreakdown(newBreakdown);
    };

    const handleAddInvoice = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tender || !invAmount) return;

        const amount = parseFloat(invAmount);
        const safeUUID = generateId();

        const newInvoice: Invoice = {
            id: safeUUID,
            tenderId: tender.id,
            date: new Date().toISOString(),
            amount: amount,
            description: invDesc,
            billedProtocols: invoiceBreakdown
        };

        saveInvoice(newInvoice);
        
        // Reset Form
        setInvAmount('');
        setInvDesc('');
        setInvoiceBreakdown([]);

        // REFRESH ALL DATA FROM STORAGE
        refreshData();
    };

    const handleDeleteInvoice = (invoiceId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) return;

        if (!window.confirm(`${invoice.amount.toLocaleString('tr-TR')} TL tutarındaki fatura silinecek ve bütçeye iade edilecek. Emin misiniz?`)) {
            return;
        }

        // 1. Optimistic Update (Hemen arayüzden sil)
        setInvoices(prev => prev.filter(i => i.id !== invoiceId));
        
        // Update Tender Budget immediately in UI too
        setTender(prev => {
            if (!prev) return null;
            return {
                ...prev,
                currentSpent: Math.max(0, prev.currentSpent - invoice.amount)
            };
        });

        try {
            // 2. Perform Delete in Storage
            deleteInvoice(invoiceId);
            
            // 3. REFRESH ALL DATA FROM STORAGE to ensure consistency
            // LocalStorage is sync, so no timeout needed
            refreshData();
            
        } catch(error) {
             console.error("Fatura silme hatası:", error);
             alert("Silme işlemi başarısız oldu, sayfa yenileniyor.");
             refreshData(); // Revert to source of truth on error
        }
    };

    if (!tender) return <div className="p-10 text-center text-gray-500">Aktif ihale bulunamadı.</div>;

    const percentUsed = (tender.currentSpent / tender.totalBudget) * 100;
    const remainingBudget = tender.totalBudget - tender.currentSpent;

    // --- Statistics Logic ---
    const protocolStats: Record<string, { count: number, totalPoints: number, totalPrice: number }> = {};
    
    patients.forEach(p => {
        const protoId = p.activeProtocolId || (p.assignedProtocolIds && p.assignedProtocolIds.length > 0 ? p.assignedProtocolIds[0] : null);
        
        if (protoId) {
            if (!protocolStats[protoId]) protocolStats[protoId] = { count: 0, totalPoints: 0, totalPrice: 0 };
            protocolStats[protoId].count += 1;

            const pEntries = allEntries.filter(e => e.patientId === p.id);
            const pPoints = pEntries.reduce((sum, e) => sum + (e.totalPoints || 0), 0);
            const pPrice = pEntries.reduce((sum, e) => sum + (e.totalPrice || 0), 0);

            protocolStats[protoId].totalPoints += pPoints;
            protocolStats[protoId].totalPrice += pPrice;
        }
    });

    const billedCounts: Record<string, number> = {};
    invoices.forEach(inv => {
        if (inv.billedProtocols) {
            inv.billedProtocols.forEach(item => {
                billedCounts[item.protocolId] = (billedCounts[item.protocolId] || 0) + item.count;
            });
        }
    });

    const comparisonData = (tender.protocolQuotas || []).map(q => {
        const stats = protocolStats[q.protocolId] || { count: 0, totalPoints: 0, totalPrice: 0 };
        const billed = billedCounts[q.protocolId] || 0;
        return {
            ...q,
            realized: stats.count,
            totalPoints: stats.totalPoints,
            totalPrice: stats.totalPrice,
            billed,
            diff: stats.count - billed
        };
    });

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">İhale Yönetimi ve Bütçe</h2>
                    <p className="text-gray-500">2025_453958 TNKÜ Pato NGS</p>
                </div>
            </header>

            {/* Main Stats Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    <div>
                        <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-2">Toplam Bütçe</p>
                        {isEditingBudget ? (
                            <div className="flex items-center justify-center gap-2">
                                <input 
                                    type="number" 
                                    className="border rounded p-1 w-32 text-center font-bold text-gray-900" 
                                    value={newBudget}
                                    onChange={e => setNewBudget(parseFloat(e.target.value))}
                                />
                                <button onClick={handleSaveBudget} className="bg-green-500 text-white px-2 py-1 rounded text-xs">Kaydet</button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2 group cursor-pointer" onClick={() => setIsEditingBudget(true)}>
                                <p className="text-3xl font-bold text-gray-900">{tender.totalBudget.toLocaleString('tr-TR')} ₺</p>
                                <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
                            </div>
                        )}
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-2">Harcanan</p>
                        <p className="text-3xl font-bold text-blue-600">{tender.currentSpent.toLocaleString('tr-TR')} ₺</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-2">Kalan</p>
                        <p className={`text-3xl font-bold ${remainingBudget < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {remainingBudget.toLocaleString('tr-TR')} ₺
                        </p>
                    </div>
                </div>
                
                <div className="mt-8">
                    <div className="flex justify-between text-sm font-medium text-gray-600 mb-2">
                        <span>Bütçe Kullanımı</span>
                        <span>%{percentUsed.toFixed(1)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ${percentUsed > 90 ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-teal-400'}`} 
                            style={{ width: `${Math.min(100, percentUsed)}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* PROTOCOL QUOTA MANAGEMENT */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800 text-lg">📝 İhale Protokol Kotaları</h3>
                    <button 
                        onClick={() => {
                            if(isEditingQuota) saveQuotasToTender();
                            else setIsEditingQuota(true);
                        }}
                        className={`px-4 py-2 rounded text-sm font-medium ${isEditingQuota ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                    >
                        {isEditingQuota ? 'Kotaları Kaydet' : 'Kotaları Düzenle'}
                    </button>
                </div>
                
                {isEditingQuota ? (
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                        <div className="flex gap-2 mb-2">
                            <select 
                                className="flex-1 border p-2 rounded"
                                value={selectedBreakdownProtocolId}
                                onChange={e => setSelectedBreakdownProtocolId(e.target.value)}
                            >
                                <option value="">Protokol Seç...</option>
                                {protocols.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <input 
                                type="number" 
                                className="w-24 border p-2 rounded"
                                placeholder="Adet"
                                value={breakdownCount}
                                onChange={e => setBreakdownCount(parseInt(e.target.value) || 0)}
                            />
                            <button onClick={handleAddQuota} className="bg-blue-600 text-white px-3 rounded">Ekle</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {tempQuotas.map(q => (
                                <span key={q.protocolId} className="bg-white border border-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                    {q.protocolName}: <b>{q.quota}</b>
                                    <button onClick={() => handleRemoveQuota(q.protocolId)} className="text-red-400 hover:text-red-600 font-bold">&times;</button>
                                </span>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {(tender.protocolQuotas || []).length === 0 && <span className="text-gray-400 italic text-sm">Tanımlı kota yok.</span>}
                        {(tender.protocolQuotas || []).map(q => (
                            <span key={q.protocolId} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium border border-blue-100">
                                {q.protocolName}: {q.quota} Adet
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* COMPARISON TABLE */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden lg:col-span-2">
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-bold text-gray-700">📊 Gerçekleşen vs Faturalanan (Protokol Analizi)</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 bg-gray-50 uppercase sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Protokol</th>
                                    <th className="px-4 py-3 text-center">İhale Kotası</th>
                                    <th className="px-4 py-3 text-center bg-blue-50 text-blue-800">Sahada (Adet)</th>
                                    <th className="px-4 py-3 text-center bg-orange-50 text-orange-800">Top. SUT Puanı</th>
                                    <th className="px-4 py-3 text-center bg-purple-50 text-purple-800">Top. SUT Tutarı</th>
                                    <th className="px-4 py-3 text-center bg-green-50 text-green-800">Faturalanan</th>
                                    <th className="px-4 py-3 text-center">Durum</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {comparisonData.map(row => (
                                    <tr key={row.protocolId} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-800">{row.protocolName}</td>
                                        <td className="px-4 py-3 text-center text-gray-500">{row.quota}</td>
                                        <td className="px-4 py-3 text-center font-bold text-blue-600">{row.realized}</td>
                                        <td className="px-4 py-3 text-center font-bold text-orange-600">{row.totalPoints.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center font-bold text-purple-600">{row.totalPrice.toLocaleString('tr-TR')} ₺</td>
                                        <td className="px-4 py-3 text-center font-bold text-green-600">{row.billed}</td>
                                        <td className="px-4 py-3 text-center">
                                            {row.diff > 0 ? (
                                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">
                                                    {row.diff} Adet Fatura Bekliyor
                                                </span>
                                            ) : row.diff < 0 ? (
                                                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-bold">
                                                    Fazla Fatura!
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">
                                                    Dengede
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {comparisonData.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-6 text-center text-gray-400">
                                            Karşılaştırma yapmak için önce yukarıdan İhale Kotalarını tanımlayınız.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Add Invoice Form */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-fit">
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-bold text-gray-700">Yeni Fatura Girişi</h3>
                    </div>
                    <form onSubmit={handleAddInvoice} className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tutar (TL)</label>
                            <input 
                                type="number" 
                                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0.00"
                                value={invAmount}
                                onChange={e => setInvAmount(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                            <input 
                                type="text" 
                                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Örn: Ekim Ayı Hakediş"
                                value={invDesc}
                                onChange={e => setInvDesc(e.target.value)}
                                required
                            />
                        </div>

                        {/* Breakdown Adder */}
                        <div className="bg-slate-50 p-3 rounded border border-slate-200">
                            <label className="block text-xs font-bold text-gray-500 mb-2">Fatura İçeriği (Protokol Adetleri)</label>
                            <div className="flex gap-2 mb-2">
                                <select 
                                    className="flex-1 text-sm border p-2 rounded"
                                    value={selectedBreakdownProtocolId}
                                    onChange={e => setSelectedBreakdownProtocolId(e.target.value)}
                                >
                                    <option value="">Protokol...</option>
                                    {protocols.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <input 
                                    type="number" 
                                    className="w-16 text-sm border p-2 rounded"
                                    placeholder="#"
                                    value={breakdownCount}
                                    onChange={e => setBreakdownCount(parseInt(e.target.value) || 0)}
                                />
                                <button type="button" onClick={addToBreakdown} className="bg-slate-600 text-white px-2 rounded">+</button>
                            </div>
                            <div className="space-y-1">
                                {invoiceBreakdown.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-xs bg-white p-1 rounded border border-slate-100">
                                        <span>{item.protocolName} (x{item.count})</span>
                                        <button type="button" onClick={() => removeFromBreakdown(idx)} className="text-red-500">&times;</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-3 rounded-lg transition-colors shadow-lg shadow-slate-900/20"
                        >
                            Faturayı Kaydet
                        </button>
                    </form>
                </div>

                {/* Invoice History */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-bold text-gray-700">Kesilen Faturalar</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 bg-gray-50 uppercase sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Tarih</th>
                                    <th className="px-4 py-3">Açıklama</th>
                                    <th className="px-4 py-3 text-right">Tutar</th>
                                    <th className="px-4 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {invoices.map(inv => (
                                    <React.Fragment key={inv.id}>
                                        <tr className="bg-white group">
                                            <td className="px-4 py-3 text-gray-600 border-b-0">{new Date(inv.date).toLocaleDateString('tr-TR')}</td>
                                            <td className="px-4 py-3 font-medium text-gray-800 border-b-0">{inv.description}</td>
                                            <td className="px-4 py-3 text-right text-gray-900 border-b-0">{inv.amount.toLocaleString('tr-TR')} ₺</td>
                                            <td className="px-4 py-3 text-right border-b-0">
                                                <button 
                                                    type="button"
                                                    onClick={(e) => handleDeleteInvoice(inv.id, e)}
                                                    className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-full transition-colors"
                                                    title="Faturayı Sil"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                        {inv.billedProtocols && inv.billedProtocols.length > 0 && (
                                            <tr className="bg-gray-50">
                                                <td colSpan={4} className="px-4 pb-2 pt-0 text-xs text-gray-500 italic">
                                                    Detay: {inv.billedProtocols.map(b => `${b.protocolName} (${b.count} adet)`).join(', ')}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                                {invoices.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-4 text-center text-gray-400">Henüz fatura girişi yok.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TenderTracker;