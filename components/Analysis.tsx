
import React, { useState, useEffect } from 'react';
import { Patient, PatientStatus, ProtocolProcess } from '../types';
import { getPatients } from '../services/storageService';

interface FlatProcessRow {
    patientId: string;
    protocolNo: string;
    admissionDate: string;
    testName: string; // Combined: Patient Test Name + Protocol Name
    workStartDate?: string;
    dataShareDate?: string;
    preAnalysisDate?: string;
    reportDate?: string;
    isRepeated?: boolean;
    repeatWorkDate?: string;
    isRepeatedSecond?: boolean;
    repeatWorkDateSecond?: string;
    status: string;
    protocolName?: string; // Specific protocol name
}

const Analysis: React.FC = () => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [flatRows, setFlatRows] = useState<FlatProcessRow[]>([]);

    useEffect(() => {
        const data = getPatients();
        setPatients(data);

        // Flatten patients into process rows
        const rows: FlatProcessRow[] = [];
        data.forEach(p => {
            if (p.protocolProcesses && p.protocolProcesses.length > 0) {
                // If we have detailed process tracking per protocol
                p.protocolProcesses.forEach(proc => {
                    rows.push({
                        patientId: p.id,
                        protocolNo: p.protocolNo,
                        admissionDate: p.admissionDate,
                        testName: p.assignedProtocolIds && p.assignedProtocolIds.length > 1 ? `${p.testName} (${proc.protocolName})` : p.testName,
                        workStartDate: proc.workStartDate,
                        dataShareDate: proc.dataShareDate,
                        preAnalysisDate: proc.preAnalysisDate,
                        reportDate: proc.reportDate,
                        isRepeated: proc.isRepeated,
                        repeatWorkDate: proc.repeatWorkDate,
                        isRepeatedSecond: proc.isRepeatedSecond,
                        repeatWorkDateSecond: proc.repeatWorkDateSecond,
                        status: p.status,
                        protocolName: proc.protocolName
                    });
                });
            } else {
                // Fallback for legacy data or patients with no specific protocol tracking yet
                rows.push({
                    patientId: p.id,
                    protocolNo: p.protocolNo,
                    admissionDate: p.admissionDate,
                    testName: p.testName,
                    workStartDate: p.workStartDate,
                    dataShareDate: p.dataShareDate,
                    preAnalysisDate: p.preAnalysisDate,
                    reportDate: p.reportDate,
                    isRepeated: p.isRepeated,
                    repeatWorkDate: p.repeatWorkDate,
                    isRepeatedSecond: p.isRepeatedSecond,
                    repeatWorkDateSecond: p.repeatWorkDateSecond,
                    status: p.status,
                    protocolName: 'Genel'
                });
            }
        });

        // Sort by Admission Date descending
        rows.sort((a, b) => new Date(b.admissionDate).getTime() - new Date(a.admissionDate).getTime());
        setFlatRows(rows);
    }, []);

    // Statistics Calculation
    const totalPatients = flatRows.length; // Count total processes instead of unique patients

    // Count active processes
    const activePatients = flatRows.filter(r => r.status === 'active').length;

    const reportedProcesses = flatRows.filter(r => r.reportDate).length;
    const dataSharedProcesses = flatRows.filter(r => r.dataShareDate).length;
    const preAnalysisProcesses = flatRows.filter(r => r.preAnalysisDate).length;
    const exPatients = patients.filter(p => (p.status as string) === 'ex').length;


    // Helper to format date
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('tr-TR');
    };

    // Helper for Row Styling based on Status and Reporting
    const getRowStyle = (row: FlatProcessRow) => {
        const status = row.status;

        if (status === 'ex') {
            return 'bg-red-50 text-red-900 border-l-4 border-l-red-500';
        }
        if (status === 'hospitalized' || status === 'paused') {
            return 'bg-gray-100 text-gray-500 border-l-4 border-l-gray-400';
        }
        if (row.reportDate && status !== 'ex') {
            return 'bg-green-50 text-green-900 border-l-4 border-l-green-500';
        }
        return 'bg-white hover:bg-slate-50 border-l-4 border-l-transparent';
    };

    const handleExportExcel = () => {
        if (flatRows.length === 0) {
            alert('Aktarılacak veri yok.');
            return;
        }

        // CSV Header
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Add BOM for Excel UTF-8 support
        csvContent += "Protokol No;Giriş Tarihi;Test / Protokol;Çalışma Başlangıcı;Data Paylaşım;Ön Analiz;Raporlama;Durum;1. Tekrar?;1. Tekrar Tarihi;2. Tekrar?;2. Tekrar Tarihi\n";

        // CSV Rows
        flatRows.forEach(r => {
            const row = [
                r.protocolNo,
                formatDate(r.admissionDate),
                r.testName,
                formatDate(r.workStartDate),
                formatDate(r.dataShareDate),
                formatDate(r.preAnalysisDate),
                formatDate(r.reportDate),
                r.status === 'ex' ? 'EX' :
                    r.status === 'hospitalized' ? 'Yatışta' :
                        r.status === 'paused' ? 'Durdu' :
                            r.status === 'completed' ? 'Tamamlandı' : 'Aktif',
                r.isRepeated ? 'Evet' : 'Hayır',
                r.isRepeated ? formatDate(r.repeatWorkDate) : '-',
                r.isRepeatedSecond ? 'Evet' : 'Hayır',
                r.isRepeatedSecond ? formatDate(r.repeatWorkDateSecond) : '-'
            ].join(';');
            csvContent += row + "\n";
        });

        // Trigger Download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `medisut_analiz_detayli_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Analiz ve Süreç Takibi</h2>
                    <p className="text-gray-500">Hasta süreçlerinin genel durumu ve detaylı tarih analizi.</p>
                </div>
            </header>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
                    <p className="text-xs font-bold text-gray-500 uppercase">Toplam Süreç</p>
                    <p className="text-2xl font-bold text-blue-600">{totalPatients}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
                    <p className="text-xs font-bold text-gray-500 uppercase">Aktif Süreç</p>
                    <p className="text-2xl font-bold text-emerald-600">{activePatients}</p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
                    <p className="text-xs font-bold text-gray-500 uppercase">Data Paylaşım (Süreç)</p>
                    <p className="text-2xl font-bold text-indigo-600">{dataSharedProcesses}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
                    <p className="text-xs font-bold text-gray-500 uppercase">Ön Analiz (Süreç)</p>
                    <p className="text-2xl font-bold text-pink-600">{preAnalysisProcesses}</p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
                    <p className="text-xs font-bold text-gray-500 uppercase">Raporlanan (Süreç)</p>
                    <p className="text-2xl font-bold text-green-600">{reportedProcesses}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
                    <p className="text-xs font-bold text-gray-500 uppercase">EX (Vefat)</p>
                    <p className="text-2xl font-bold text-red-600">{exPatients}</p>
                </div>
            </div>

            {/* Analysis Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700">Detaylı Süreç Tablosu (Protokol Bazlı)</h3>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                        <span>📥</span> Excel'e Aktar
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                                <th className="px-6 py-3">Protokol No</th>
                                <th className="px-6 py-3">Giriş Tarihi</th>
                                <th className="px-6 py-3">Test / Protokol</th>
                                <th className="px-6 py-3">Çalışma Başlangıcı</th>
                                <th className="px-6 py-3">Data Paylaşım</th>
                                <th className="px-6 py-3">Ön Analiz</th>
                                <th className="px-6 py-3">Raporlama</th>
                                <th className="px-6 py-3">Tekrar?</th>
                                <th className="px-6 py-3">Durum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {flatRows.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-8 text-center text-gray-400">
                                        Kayıtlı süreç bulunamadı.
                                    </td>
                                </tr>
                            ) : (
                                flatRows.map((row, idx) => (
                                    <tr key={`${row.patientId}-${idx}`} className={`transition-colors ${getRowStyle(row)}`}>
                                        <td className="px-6 py-3 font-mono font-bold">{row.protocolNo}</td>
                                        <td className="px-6 py-3 text-gray-600 font-medium">{formatDate(row.admissionDate)}</td>
                                        <td className="px-6 py-3 font-medium">{row.testName}</td>
                                        <td className="px-6 py-3">{formatDate(row.workStartDate)}</td>
                                        <td className="px-6 py-3">{formatDate(row.dataShareDate)}</td>
                                        <td className="px-6 py-3">{formatDate(row.preAnalysisDate)}</td>
                                        <td className="px-6 py-3 font-bold">{formatDate(row.reportDate)}</td>
                                        <td className="px-6 py-3 text-center">
                                            {row.isRepeated ? (
                                                <span title={`Tekrar Başlama: ${formatDate(row.repeatWorkDate)}`} className="cursor-help font-bold text-purple-600">✓ Evet</span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3">
                                            {(row.status as string) === 'ex' && <span className="bg-red-200 text-red-800 text-[10px] px-2 py-1 rounded font-bold">EX</span>}
                                            {(row.status as string) === 'hospitalized' && <span className="bg-purple-200 text-purple-800 text-[10px] px-2 py-1 rounded font-bold">Yatışta</span>}
                                            {(row.status as string) === 'paused' && <span className="bg-yellow-200 text-yellow-800 text-[10px] px-2 py-1 rounded font-bold">Durdu</span>}
                                            {row.status === 'completed' && <span className="bg-blue-200 text-blue-800 text-[10px] px-2 py-1 rounded font-bold">Bitti</span>}
                                            {row.status === 'active' && <span className="bg-green-200 text-green-800 text-[10px] px-2 py-1 rounded font-bold">Aktif</span>}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Analysis;