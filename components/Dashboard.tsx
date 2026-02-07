import React, { useEffect, useState } from 'react';
import { Patient, Tender, ViewState } from '../types';
import { getPatients, getTenders } from '../services/storageService';

interface DashboardProps {
    changeView: (view: ViewState, patientId?: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ changeView }) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [activeTender, setActiveTender] = useState<Tender | null>(null);

    useEffect(() => {
        const allPatients = getPatients();
        setPatients(allPatients);
        const tenders = getTenders();
        setActiveTender(tenders.find(t => t.active) || null);
    }, []);

    // Calculate Due Patients
    const today = new Date();
    today.setHours(0,0,0,0); 

    const duePatients = patients.filter(p => {
        // FILTER: Only show active patients in the To-Do list.
        if (p.status !== 'active') return false;

        // 1. Priority: Check Specific Scheduled Date (Smart Protocol)
        if (p.nextScheduledDate) {
            const scheduled = new Date(p.nextScheduledDate);
            scheduled.setHours(0,0,0,0);
            return scheduled <= today;
        }

        // 2. Fallback: Generic Frequency
        if (!p.lastEntryDate) return true; 
        const lastDate = new Date(p.lastEntryDate);
        lastDate.setHours(0,0,0,0);
        
        const diffTime = Math.abs(today.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= p.entryFrequencyDays;
    });

    // Quick Stats
    const activePatientsCount = patients.filter(p => p.status === 'active').length;
    const hospitalizedCount = patients.filter(p => p.status === 'hospitalized').length;

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-2xl font-bold text-gray-800">Genel Bakış</h2>
                <p className="text-gray-500">Bugünün iş listesi ve durum özeti.</p>
            </header>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Aktif Hasta</p>
                        <div className="flex items-baseline gap-2">
                             <p className="text-3xl font-bold text-gray-800">{activePatientsCount}</p>
                             {hospitalizedCount > 0 && <span className="text-xs text-purple-600 font-medium">(+{hospitalizedCount} Yatışta)</span>}
                        </div>
                    </div>
                    <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl">👥</div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Bugün SUT Girilecek</p>
                        <p className="text-3xl font-bold text-orange-600">{duePatients.length}</p>
                    </div>
                    <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 text-xl">⚠️</div>
                </div>
            </div>

            {/* Critical List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">SUT Girişi Bekleyen Hastalar</h3>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {duePatients.length} Kişi
                    </span>
                </div>
                
                {duePatients.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        🎉 Harika! Bugün için bekleyen SUT girişi yok.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Protokol No</th>
                                    <th className="px-6 py-3 font-medium">Test / Protokol</th>
                                    <th className="px-6 py-3 font-medium">Son Giriş</th>
                                    <th className="px-6 py-3 font-medium">Planlanan</th>
                                    <th className="px-6 py-3 font-medium text-right">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {duePatients.map(patient => (
                                    <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-3 text-blue-700 font-mono font-bold">{patient.protocolNo || '-'}</td>
                                        <td className="px-6 py-3 font-medium text-gray-800">
                                            {patient.testName || '-'}
                                        </td>
                                        <td className="px-6 py-3 text-gray-500">
                                            {patient.lastEntryDate ? new Date(patient.lastEntryDate).toLocaleDateString('tr-TR') : 'Hiç Yok'}
                                        </td>
                                        <td className="px-6 py-3">
                                            {patient.nextScheduledDate ? (
                                                <div>
                                                    <span className="text-red-600 font-bold block">{new Date(patient.nextScheduledDate).toLocaleDateString('tr-TR')}</span>
                                                    <span className="text-xs text-gray-500">{patient.nextScheduledNote}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-500 italic">Periyodik ({patient.entryFrequencyDays} gün)</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <button 
                                                onClick={() => changeView(ViewState.SUT_ENTRY, patient.id)}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors shadow-sm"
                                            >
                                                Giriş Yap
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;