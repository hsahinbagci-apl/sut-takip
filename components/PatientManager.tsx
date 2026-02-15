import React, { useState, useEffect, useCallback } from 'react';
import { Patient, SUTEntry, TestProtocol, TestStep, ProtocolProcess } from '../types';
import { getPatients, savePatient, getDoctors, getTestProtocols, getEntriesByPatient, addLog, saveEntry, deleteEntry, getCurrentUser, deletePatient, generateId } from '../services/storageService';

const PatientManager: React.FC = () => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const currentUser = getCurrentUser();

    // Main Form (Basic Info) State
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Process Dates Modal State
    const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);

    // New structure for Process Modal to support multiple protocols
    const [processModalData, setProcessModalData] = useState<{
        patientId: string;
        protocolNo: string;
        selectedProtocolId: string; // The specific protocol we are editing dates for

        // Form fields
        workStartDate: string;
        dataShareDate: string;
        preAnalysisDate: string;
        reportDate: string;
        isRepeated: boolean;
        repeatWorkDate: string;
    }>({
        patientId: '',
        protocolNo: '',
        selectedProtocolId: '',
        workStartDate: '',
        dataShareDate: '',
        preAnalysisDate: '',
        reportDate: '',
        isRepeated: false,
        repeatWorkDate: ''
    });

    // Status Change Modal State
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [statusFormData, setStatusFormData] = useState<{
        patientId: string;
        currentStatus: string;
        newStatus: Patient['status'];
        reason: string;
        actionDate: string;
    }>({
        patientId: '',
        currentStatus: '',
        newStatus: 'active',
        reason: '',
        actionDate: new Date().toISOString().split('T')[0]
    });

    // History Modal State
    const [viewingHistoryPatient, setViewingHistoryPatient] = useState<Patient | null>(null);
    const [historyEntries, setHistoryEntries] = useState<SUTEntry[]>([]);

    // Timeline Modal State
    const [timelinePatient, setTimelinePatient] = useState<Patient | null>(null);

    // Settings Data
    const [availableDoctors, setAvailableDoctors] = useState<string[]>([]);
    const [availableProtocols, setAvailableProtocols] = useState<TestProtocol[]>([]);

    // Form Specific States for Multi-Protocol
    const [selectedProtocols, setSelectedProtocols] = useState<TestProtocol[]>([]);
    const [protocolToAddId, setProtocolToAddId] = useState<string>('');
    const [startProtocolId, setStartProtocolId] = useState<string>('');

    // Filters
    const [filters, setFilters] = useState({
        protocol: '',
        testName: '',
        doctor: ''
    });

    // Define clean initial state
    const getInitialFormState = (): Partial<Patient> => ({
        protocolNo: '',
        tissueType: '',
        testName: '',
        requestingDoctor: '',
        admissionDate: new Date().toISOString().split('T')[0],
        notes: '',
        entryFrequencyDays: 30,
        interProtocolGapDays: 11,
        status: 'active',
        assignedProtocolIds: [],
        activeProtocolId: '',
        protocolProcesses: []
    });

    const [formData, setFormData] = useState<Partial<Patient>>(getInitialFormState());

    // Centralized Data Fetching
    const refreshData = useCallback(() => {
        setPatients(getPatients());
        setAvailableDoctors(getDoctors());
        setAvailableProtocols(getTestProtocols());
    }, []);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    // Helper to sync local protocol state when editing
    useEffect(() => {
        if (formData.id && formData.assignedProtocolIds && availableProtocols.length > 0) {
            const assigned = formData.assignedProtocolIds
                .map(id => availableProtocols.find(p => p.id === id))
                .filter(p => p !== undefined) as TestProtocol[];
            setSelectedProtocols(assigned);
            setStartProtocolId(formData.activeProtocolId || (assigned.length > 0 ? assigned[0].id : ''));
        }
    }, [formData.id, availableProtocols]);


    // Protocol List Management
    const handleAddProtocol = () => {
        if (!protocolToAddId) return;
        const protocol = availableProtocols.find(p => p.id === protocolToAddId);
        if (protocol && !selectedProtocols.find(p => p.id === protocol.id)) {
            const newList = [...selectedProtocols, protocol];
            setSelectedProtocols(newList);
            // If first one added, make it start by default
            if (newList.length === 1) setStartProtocolId(protocol.id);
        }
        setProtocolToAddId('');
    };

    const handleRemoveProtocol = (id: string) => {
        const newList = selectedProtocols.filter(p => p.id !== id);
        setSelectedProtocols(newList);
        if (startProtocolId === id) {
            setStartProtocolId(newList.length > 0 ? newList[0].id : '');
        }
    };

    // --- BUTTON HANDLER: New Patient ---
    const handleNewPatient = () => {
        refreshData(); // Ensure fresh lists
        setSelectedProtocols([]);
        setStartProtocolId('');
        setProtocolToAddId('');
        setFormData(getInitialFormState());
        setIsFormOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.protocolNo) return;

        // Duplicate Protocol Check
        const normalizedProtocol = formData.protocolNo.trim().toLowerCase();
        const duplicate = patients.find(p =>
            p.protocolNo.trim().toLowerCase() === normalizedProtocol &&
            p.id !== formData.id // Exclude self if editing
        );

        if (duplicate) {
            alert(`Dikkat! "${formData.protocolNo}" protokol numarası zaten sistemde kayıtlı. Lütfen farklı bir numara giriniz.`);
            return;
        }

        let finalTestName = formData.testName || 'Manuel Test';
        if (selectedProtocols.length > 0) {
            finalTestName = selectedProtocols.map(p => p.name).join(' + ');
        }

        const assignedIds = selectedProtocols.map(p => p.id);
        const existingPatient = patients.find(p => p.id === formData.id);

        // Preserve existing protocolProcesses if editing, or initialize empty
        let existingProcesses = existingPatient?.protocolProcesses || [];

        const newPatient: Patient = {
            id: formData.id || generateId(),
            protocolNo: formData.protocolNo,
            tissueType: formData.tissueType || '',
            testName: finalTestName,

            assignedProtocolIds: assignedIds,
            activeProtocolId: existingPatient ? formData.activeProtocolId : startProtocolId,
            interProtocolGapDays: formData.interProtocolGapDays || 11,

            currentStepIndex: existingPatient ? existingPatient.currentStepIndex : 0,

            requestingDoctor: formData.requestingDoctor || '',
            admissionDate: formData.admissionDate || new Date().toISOString(),

            // Legacy Date Fields (Preserved but moving towards protocolProcesses)
            workStartDate: existingPatient?.workStartDate,
            dataShareDate: existingPatient?.dataShareDate,
            preAnalysisDate: existingPatient?.preAnalysisDate,
            reportDate: existingPatient?.reportDate,
            isRepeated: existingPatient?.isRepeated,
            repeatWorkDate: existingPatient?.repeatWorkDate,

            protocolProcesses: existingProcesses,

            notes: formData.notes || '',
            entryFrequencyDays: formData.entryFrequencyDays || 30,
            status: existingPatient ? existingPatient.status : 'active',
            statusReason: existingPatient ? existingPatient.statusReason : '',
            statusDate: existingPatient ? existingPatient.statusDate : '',

            lastEntryDate: existingPatient ? existingPatient.lastEntryDate : null,
            nextScheduledDate: existingPatient ? existingPatient.nextScheduledDate : undefined,
            nextScheduledNote: existingPatient ? existingPatient.nextScheduledNote : undefined,
        };

        savePatient(newPatient);
        refreshData();
        setIsFormOpen(false);
        setFormData(getInitialFormState());
        setSelectedProtocols([]);
    };

    // --- PROCESS MODAL LOGIC ---

    // Open Modal
    const handleOpenProcessModal = (patient: Patient) => {
        // Determine initial protocol to show
        // Priority: Active Protocol -> First Assigned Protocol -> "Legacy/Main" (if no protocols assigned)
        let initialProtocolId = patient.activeProtocolId || '';
        if (!initialProtocolId && patient.assignedProtocolIds && patient.assignedProtocolIds.length > 0) {
            initialProtocolId = patient.assignedProtocolIds[0];
        }

        // Try to find existing process data for this protocol
        const existingProcess = patient.protocolProcesses?.find(p => p.protocolId === initialProtocolId);

        // If not found in new structure, fallback to legacy top-level fields (for backward compatibility or if single protocol)
        const workStartDate = existingProcess?.workStartDate || (initialProtocolId ? '' : patient.workStartDate) || '';
        const dataShareDate = existingProcess?.dataShareDate || (initialProtocolId ? '' : patient.dataShareDate) || '';
        const preAnalysisDate = existingProcess?.preAnalysisDate || (initialProtocolId ? '' : patient.preAnalysisDate) || '';
        const reportDate = existingProcess?.reportDate || (initialProtocolId ? '' : patient.reportDate) || '';
        const isRepeated = existingProcess?.isRepeated !== undefined ? existingProcess.isRepeated : (initialProtocolId ? false : !!patient.isRepeated);
        const repeatWorkDate = existingProcess?.repeatWorkDate || (initialProtocolId ? '' : patient.repeatWorkDate) || '';

        setProcessModalData({
            patientId: patient.id,
            protocolNo: patient.protocolNo,
            selectedProtocolId: initialProtocolId,
            workStartDate,
            dataShareDate,
            preAnalysisDate,
            reportDate,
            isRepeated,
            repeatWorkDate
        });
        setIsProcessModalOpen(true);
    };

    // When Dropdown Changes in Modal
    const handleProcessProtocolChange = (protocolId: string) => {
        const patient = patients.find(p => p.id === processModalData.patientId);
        if (!patient) return;

        const existingProcess = patient.protocolProcesses?.find(p => p.protocolId === protocolId);

        setProcessModalData(prev => ({
            ...prev,
            selectedProtocolId: protocolId,
            workStartDate: existingProcess?.workStartDate || '',
            dataShareDate: existingProcess?.dataShareDate || '',
            preAnalysisDate: existingProcess?.preAnalysisDate || '',
            reportDate: existingProcess?.reportDate || '',
            isRepeated: !!existingProcess?.isRepeated,
            repeatWorkDate: existingProcess?.repeatWorkDate || ''
        }));
    };

    const handleSaveProcessDates = (e: React.FormEvent) => {
        e.preventDefault();
        const patientIndex = patients.findIndex(p => p.id === processModalData.patientId);
        if (patientIndex === -1) return;

        const patient = patients[patientIndex];
        const protocolId = processModalData.selectedProtocolId;

        // VALIDATION: Work Start Date vs Admission Date
        if (processModalData.workStartDate && patient.admissionDate) {
            if (processModalData.workStartDate < patient.admissionDate) {
                alert(`Hata: Çalışma Başlangıcı tarihi (${new Date(processModalData.workStartDate).toLocaleDateString('tr-TR')}), Geliş Tarihinden (${new Date(patient.admissionDate).toLocaleDateString('tr-TR')}) önce olamaz.`);
                return;
            }
        }

        // Create new patient object copy
        const updatedPatient = { ...patient };

        // Ensure array exists
        if (!updatedPatient.protocolProcesses) {
            updatedPatient.protocolProcesses = [];
        }

        if (protocolId) {
            // Find existing entry index
            const procIndex = updatedPatient.protocolProcesses.findIndex(p => p.protocolId === protocolId);
            const protocolName = availableProtocols.find(p => p.id === protocolId)?.name || 'Bilinmeyen Protokol';

            const newProcessData: ProtocolProcess = {
                protocolId,
                protocolName,
                workStartDate: processModalData.workStartDate,
                dataShareDate: processModalData.dataShareDate,
                preAnalysisDate: processModalData.preAnalysisDate,
                reportDate: processModalData.reportDate,
                isRepeated: processModalData.isRepeated,
                repeatWorkDate: processModalData.repeatWorkDate
            };

            if (procIndex >= 0) {
                updatedPatient.protocolProcesses[procIndex] = newProcessData;
            } else {
                updatedPatient.protocolProcesses.push(newProcessData);
            }
        } else {
            // Fallback for manual patients without assigned protocols (update legacy fields)
            updatedPatient.workStartDate = processModalData.workStartDate;
            updatedPatient.dataShareDate = processModalData.dataShareDate;
            updatedPatient.preAnalysisDate = processModalData.preAnalysisDate;
            updatedPatient.reportDate = processModalData.reportDate;
            updatedPatient.isRepeated = processModalData.isRepeated;
            updatedPatient.repeatWorkDate = processModalData.repeatWorkDate;
        }

        savePatient(updatedPatient);
        refreshData();
        setIsProcessModalOpen(false);
    };

    const handleEdit = (patient: Patient) => {
        setFormData({
            ...patient,
            interProtocolGapDays: patient.interProtocolGapDays || 11
        });
        refreshData(); // Ensure fresh lists for dropdowns
        setIsFormOpen(true);
    };

    const handleDeletePatient = (e: React.MouseEvent, patientId: string) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent row click

        if (window.confirm('DİKKAT! Bu hasta ve tüm verileri kalıcı olarak silinecek. Emin misiniz?')) {
            // Optimistic UI Update: Remove from screen immediately
            setPatients(prev => prev.filter(p => p.id !== patientId));

            try {
                // Perform actual delete
                deletePatient(patientId);
                // Explicitly refresh to be safe
                refreshData();
            } catch (error) {
                console.error("Silme hatası:", error);
                alert("Silme işlemi sırasında bir hata oluştu.");
                refreshData(); // Revert on error
            }
        }
    };

    const handleOpenStatusModal = (patient: Patient) => {
        setStatusFormData({
            patientId: patient.id,
            currentStatus: patient.status,
            newStatus: patient.status,
            reason: patient.statusReason || '',
            actionDate: new Date().toISOString().split('T')[0]
        });
        setIsStatusModalOpen(true);
    };

    const handleOpenTimeline = (patient: Patient) => {
        setTimelinePatient(patient);
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'active': return 'Aktif';
            case 'completed': return 'Tamamlandı';
            case 'ex': return 'EX';
            case 'hospitalized': return 'Yatışta';
            case 'paused': return 'Durduruldu';
            case 'archived': return 'Arşiv';
            default: return status;
        }
    };

    const handleSaveStatus = (e: React.FormEvent) => {
        e.preventDefault();
        const patient = patients.find(p => p.id === statusFormData.patientId);
        if (!patient) return;

        const updatedPatient = { ...patient };
        const oldStatus = patient.status;
        updatedPatient.status = statusFormData.newStatus;
        updatedPatient.statusReason = statusFormData.reason;
        updatedPatient.statusDate = statusFormData.actionDate;

        const statusEntry: SUTEntry = {
            id: generateId(),
            patientId: patient.id,
            date: statusFormData.actionDate,
            selectedCodes: [],
            totalPoints: 0,
            totalPrice: 0,
            type: 'status_change',
            notes: `DURUM GÜNCELLEME: ${getStatusLabel(oldStatus)} -> ${getStatusLabel(statusFormData.newStatus)} | Sebep: ${statusFormData.reason}`
        };
        saveEntry(statusEntry);

        if (statusFormData.newStatus === 'ex') {
            updatedPatient.nextScheduledDate = undefined;
            updatedPatient.nextScheduledNote = "Hasta EX oldu. Süreç iptal.";

            if (updatedPatient.assignedProtocolIds && updatedPatient.activeProtocolId) {
                const currentIndex = updatedPatient.assignedProtocolIds.indexOf(updatedPatient.activeProtocolId);
                if (currentIndex >= 0) {
                    updatedPatient.assignedProtocolIds = updatedPatient.assignedProtocolIds.slice(0, currentIndex + 1);
                    updatedPatient.notes += ` \n[SİSTEM]: Hasta Ex olduğu için sonraki protokoller iptal edildi.`;
                }
            }
        } else if (statusFormData.newStatus === 'hospitalized' || statusFormData.newStatus === 'paused') {
            if (updatedPatient.nextScheduledNote && !updatedPatient.nextScheduledNote.includes('[DURAKLATILDI]')) {
                updatedPatient.nextScheduledNote = `[DURAKLATILDI] ${updatedPatient.nextScheduledNote}`;
            }
        } else if (statusFormData.newStatus === 'active' && oldStatus !== 'active') {
            updatedPatient.nextScheduledNote = (updatedPatient.nextScheduledNote || '').replace('[DURAKLATILDI] ', '');
            if (!updatedPatient.nextScheduledDate && updatedPatient.lastEntryDate) {
                updatedPatient.nextScheduledDate = new Date().toISOString().split('T')[0];
                updatedPatient.nextScheduledNote = "Süreç tekrar aktif edildi. Kontrol ediniz.";
            }
        }

        savePatient(updatedPatient);
        addLog('DURUM_DEGISTIRME', `Hasta ${patient.protocolNo} durumu ${statusFormData.newStatus} olarak güncellendi.`);

        refreshData();
        setIsStatusModalOpen(false);
    };

    const handleViewHistory = (patient: Patient) => {
        const entries = getEntriesByPatient(patient.id);
        setHistoryEntries(entries);
        setViewingHistoryPatient(patient);
    };

    const handleDeleteHistoryEntry = (entryId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (window.confirm('Bu SUT giriş kaydı silinecek. Puanlar geri alınacak ancak hasta protokol ilerlemesi (adım sayısı) otomatik geri alınmaz. Devam edilsin mi?')) {
            // Optimistic UI Update
            setHistoryEntries(prev => prev.filter(entry => entry.id !== entryId));

            try {
                deleteEntry(entryId);
                // No need for immediate re-fetch if optimistic update matches.
            } catch (error) {
                console.error("Giriş silme hatası:", error);
                alert("İşlem sırasında hata oluştu.");
                if (viewingHistoryPatient) {
                    // Revert on error
                    setHistoryEntries(getEntriesByPatient(viewingHistoryPatient.id));
                }
            }
        }
    };

    const handleExportCSV = () => {
        if (patients.length === 0) return alert('İndirilecek veri yok.');

        let csv = "data:text/csv;charset=utf-8,\uFEFF";
        csv += "Protokol No;Durum;Test;Uzman;Girilen SUT Kodlari;Notlar;Tekrar?\n";

        filteredPatients.forEach(p => {
            // Fetch SUT codes for this patient
            const pEntries = getEntriesByPatient(p.id);

            // Format: "Code1 + Code2 | Code3"
            const sutCodesString = pEntries.map(entry =>
                entry.selectedCodes.map(sc => sc.code).join(' + ')
            ).join(' | ');

            // Clean notes to avoid breaking CSV format
            const cleanNotes = (p.notes || '').replace(/;/g, ' - ').replace(/\n/g, ' ');

            csv += `${p.protocolNo};${getStatusLabel(p.status)};${p.testName};${p.requestingDoctor};${sutCodesString};${cleanNotes};${p.isRepeated ? 'Evet' : 'Hayır'}\n`;
        });

        const encodedUri = encodeURI(csv);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `hasta_listesi_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredPatients = patients.filter(p => {
        const protocolMatch = p.protocolNo ? p.protocolNo.toLowerCase().includes(filters.protocol.toLowerCase()) : true;
        const testMatch = p.testName ? p.testName.toLowerCase().includes(filters.testName.toLowerCase()) : true;
        const doctorMatch = p.requestingDoctor ? p.requestingDoctor.toLowerCase().includes(filters.doctor.toLowerCase()) : true;
        return protocolMatch && testMatch && doctorMatch;
    }).sort((a, b) => {
        // Sort by Admission Date (Newest First)
        const dateA = new Date(a.admissionDate || 0).getTime();
        const dateB = new Date(b.admissionDate || 0).getTime();
        return dateB - dateA;
    });

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('tr-TR');
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">Aktif</span>;
            case 'completed': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold">Tamamlandı</span>;
            case 'ex': return <span className="bg-black text-white px-2 py-1 rounded-full text-xs font-bold">EX</span>;
            case 'hospitalized': return <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-bold">Yatışta</span>;
            case 'paused': return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-bold">Durduruldu</span>;
            case 'archived': return <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-xs font-bold">Arşiv</span>;
            default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">Bilinmiyor</span>;
        }
    };

    // Helper to get active patient for process modal context
    const processModalPatient = patients.find(p => p.id === processModalData.patientId);

    // Identify assigned protocols for the current patient in the modal
    const processModalAssignedProtocols = processModalPatient?.assignedProtocolIds?.map(id =>
        availableProtocols.find(p => p.id === id)
    ).filter(Boolean) as TestProtocol[] || [];

    return (
        <div className="space-y-6 h-full flex flex-col">
            <header className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Hasta Takip Listesi</h2>
                    <p className="text-gray-500">Laboratuvar süreçleri ve hasta detayları.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExportCSV}
                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
                        title="Listeyi Excel(CSV) olarak indir"
                    >
                        📥 Liste İndir
                    </button>
                    <button
                        type="button"
                        onClick={handleNewPatient}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-md transition-all flex items-center space-x-2"
                    >
                        <span>+ Yeni Hasta Girişi</span>
                    </button>
                </div>
            </header>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                <input
                    type="text"
                    placeholder="🔍 Protokol No Ara..."
                    className="border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                    value={filters.protocol}
                    onChange={e => setFilters({ ...filters, protocol: e.target.value })}
                />
                <input
                    type="text"
                    placeholder="Test Adı"
                    className="border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                    value={filters.testName}
                    onChange={e => setFilters({ ...filters, testName: e.target.value })}
                />
                <input
                    type="text"
                    placeholder="İstemi Yapan Uzman"
                    className="border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                    value={filters.doctor}
                    onChange={e => setFilters({ ...filters, doctor: e.target.value })}
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 border-b">Protokol No</th>
                                <th className="px-4 py-3 border-b">Durum</th>
                                <th className="px-4 py-3 border-b">Uygulanan Protokoller</th>
                                <th className="px-4 py-3 border-b">Uzman</th>
                                <th className="px-4 py-3 border-b text-center">Planlanan İşlem</th>
                                <th className="px-4 py-3 border-b text-center">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredPatients.map(patient => (
                                <tr key={patient.id} className={`hover:bg-blue-50 transition-colors cursor-default group ${patient.status === 'ex' ? 'bg-gray-50 opacity-70' : ''}`}>
                                    <td
                                        className="px-4 py-3 font-mono font-bold text-blue-700 text-base cursor-pointer hover:underline hover:text-blue-900 relative"
                                        onClick={() => handleOpenTimeline(patient)}
                                        title="Zaman Çizelgesini Görüntüle"
                                    >
                                        {patient.protocolNo || '-'}
                                        {patient.isRepeated && <span className="ml-2 bg-purple-100 text-purple-700 text-[10px] px-1 rounded border border-purple-200">Tekrar</span>}
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-xs">🕒</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col items-start gap-1">
                                            {getStatusBadge(patient.status)}
                                            {patient.status !== 'active' && patient.status !== 'completed' && (
                                                <span className="text-[10px] text-red-500 max-w-[100px] truncate" title={patient.statusReason}>
                                                    {patient.statusReason}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-gray-900 font-medium">{patient.testName || '-'}</div>
                                        {patient.assignedProtocolIds && patient.assignedProtocolIds.length > 1 && (
                                            <div className="flex gap-1 mt-1">
                                                {patient.assignedProtocolIds.map((pid, idx) => {
                                                    const isCurrent = pid === patient.activeProtocolId;
                                                    return (
                                                        <span key={idx} className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-blue-600 animate-pulse' : 'bg-gray-300'}`} title={`Protokol ${idx + 1}`}></span>
                                                    )
                                                })}
                                            </div>
                                        )}
                                        <div className="text-xs text-gray-500 mt-0.5">{patient.tissueType}</div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">{patient.requestingDoctor || '-'}</td>
                                    <td className="px-4 py-3 text-center">
                                        {patient.nextScheduledDate ? (
                                            <div className="flex flex-col items-center">
                                                <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${new Date(patient.nextScheduledDate) <= new Date() ? 'bg-red-50 text-red-700 border-red-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                                                    {formatDate(patient.nextScheduledDate)}
                                                </span>
                                                <span className="text-[10px] text-gray-400 mt-1 max-w-[150px] truncate">{patient.nextScheduledNote}</span>
                                            </div>
                                        ) : (
                                            patient.status === 'completed' ?
                                                <span className="text-green-500 font-bold text-xs">Tamamlandı</span> :
                                                (patient.status === 'ex' || patient.status === 'hospitalized' || patient.status === 'paused') ?
                                                    <span className="text-gray-400 text-xs italic">Süreç Duraklatıldı</span> :
                                                    <span className="text-gray-400 text-xs">Plan Yok</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center space-x-2">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenStatusModal(patient)}
                                                className="text-gray-600 hover:text-purple-600 p-1.5 rounded hover:bg-purple-50 transition-colors"
                                                title="Durum Değiştir (Yatış/Ex)"
                                            >
                                                🚩
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenProcessModal(patient)}
                                                className="text-orange-500 hover:text-orange-700 p-1.5 rounded hover:bg-orange-50 transition-colors border border-orange-200"
                                                title="Süreç Takip Tarihleri"
                                            >
                                                📅
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleEdit(patient)}
                                                className="text-gray-500 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition-colors"
                                                title="Düzenle"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleViewHistory(patient)}
                                                className="text-blue-600 hover:text-blue-800 text-xs font-medium underline"
                                            >
                                                Geçmiş
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDeletePatient(e, patient.id)}
                                                className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors"
                                                title="Hastayı Sil"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* TIMELINE MODAL (PROTOKOL ZAMAN ÇİZELGESİ) */}
            {timelinePatient && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[90] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-gray-100 bg-slate-50 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    🕒 Protokol Zaman Çizelgesi
                                </h3>
                                <p className="text-sm text-slate-500 font-mono mt-1">
                                    {timelinePatient.protocolNo} - <span className="text-slate-700 font-semibold">{timelinePatient.testName}</span>
                                </p>
                            </div>
                            <button onClick={() => setTimelinePatient(null)} className="text-gray-400 hover:text-gray-700 text-2xl transition-colors">&times;</button>
                        </div>

                        <div className="overflow-y-auto p-6 bg-slate-50 flex-1">
                            {(!timelinePatient.assignedProtocolIds || timelinePatient.assignedProtocolIds.length === 0) ? (
                                <div className="text-center py-10 text-gray-400">
                                    Bu hasta için tanımlanmış çoklu protokol akışı bulunamadı.
                                </div>
                            ) : (
                                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:w-0.5 before:-translate-x-px before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                                    {timelinePatient.assignedProtocolIds.map((protoId, idx) => {
                                        const protocol = availableProtocols.find(p => p.id === protoId);
                                        const isActive = protoId === timelinePatient.activeProtocolId;

                                        // Determine phase: Past (Completed), Current (Active), Future (Pending)
                                        // We assume ordered list matches execution order
                                        const activeIndex = timelinePatient.assignedProtocolIds!.indexOf(timelinePatient.activeProtocolId || '');
                                        const isPast = activeIndex > -1 && idx < activeIndex;
                                        const isFuture = activeIndex > -1 && idx > activeIndex;

                                        if (!protocol) return null;

                                        return (
                                            <div key={idx} className="relative pl-10 group">
                                                {/* Dot on Line */}
                                                <div className={`absolute left-0 top-3 w-10 h-10 rounded-full border-4 flex items-center justify-center bg-white z-10 
                                                    ${isPast ? 'border-green-500 text-green-500' :
                                                        isActive ? 'border-blue-500 text-blue-500 animate-pulse' : 'border-gray-300 text-gray-300'}`}>
                                                    {isPast ? '✓' : (idx + 1)}
                                                </div>

                                                <div className={`bg-white rounded-xl border p-4 shadow-sm transition-all
                                                    ${isActive ? 'border-blue-300 ring-4 ring-blue-50 shadow-md' :
                                                        isPast ? 'border-green-200 bg-green-50/30 opacity-80' : 'border-gray-200 bg-gray-50 opacity-60'}`}>

                                                    <div className="flex justify-between items-start mb-2">
                                                        <h4 className={`font-bold text-lg ${isActive ? 'text-blue-800' : isPast ? 'text-green-800' : 'text-gray-600'}`}>
                                                            {protocol.name}
                                                        </h4>
                                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase 
                                                            ${isActive ? 'bg-blue-100 text-blue-700' : isPast ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                                                            {isActive ? 'Aktif Süreç' : isPast ? 'Tamamlandı' : 'Planlanıyor'}
                                                        </span>
                                                    </div>

                                                    {/* Steps Visualization for Active Protocol */}
                                                    {isActive && (
                                                        <div className="mt-4 space-y-3 pl-2 border-l-2 border-blue-100">
                                                            {
                                                                (() => {
                                                                    // Initialize cumulative date calculation based on the CURRENT scheduled date
                                                                    const currentDateCalc = timelinePatient.nextScheduledDate ? new Date(timelinePatient.nextScheduledDate) : new Date();

                                                                    return protocol.steps.map((step, stepIdx) => {
                                                                        const isStepDone = stepIdx < timelinePatient.currentStepIndex;
                                                                        const isStepCurrent = stepIdx === timelinePatient.currentStepIndex;

                                                                        // Calculate estimated date for future steps in ACTIVE protocol
                                                                        let displayDate = null;
                                                                        if (isStepCurrent) {
                                                                            // Current step is exactly the nextScheduledDate
                                                                            displayDate = timelinePatient.nextScheduledDate;
                                                                        } else if (stepIdx > timelinePatient.currentStepIndex && timelinePatient.nextScheduledDate) {
                                                                            // For future steps, we add the gap to the running total (cumulative)
                                                                            currentDateCalc.setDate(currentDateCalc.getDate() + step.daysAfterPrevious);
                                                                            displayDate = currentDateCalc.toISOString().split('T')[0];
                                                                        }

                                                                        return (
                                                                            <div key={stepIdx} className="flex items-center gap-3 text-sm">
                                                                                <div className={`w-2 h-2 rounded-full ${isStepDone ? 'bg-green-500' : isStepCurrent ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                                                                                <div className="flex-1">
                                                                                    <span className={`font-medium ${isStepDone ? 'text-green-700 line-through decoration-green-300' : isStepCurrent ? 'text-blue-700' : 'text-gray-500'}`}>
                                                                                        {stepIdx + 1}. {step.sutCode}
                                                                                    </span>
                                                                                    <span className="text-xs text-gray-400 ml-2">({step.daysAfterPrevious} gün sonra)</span>
                                                                                </div>
                                                                                {displayDate && (
                                                                                    <div className={`text-xs font-bold px-2 py-1 rounded ${isStepCurrent ? 'bg-orange-100 text-orange-700' : 'text-gray-400 bg-gray-100'}`}>
                                                                                        {isStepCurrent ? 'Planlanan:' : 'Tahmini:'} {formatDate(displayDate)}
                                                                                    </div>
                                                                                )}
                                                                                {isStepDone && <span className="text-xs text-green-600 font-bold">Tamamlandı</span>}
                                                                            </div>
                                                                        );
                                                                    });
                                                                })()
                                                            }
                                                        </div>
                                                    )}

                                                    {/* Summary for Past Protocols */}
                                                    {isPast && (
                                                        <div className="mt-2 text-xs text-green-700 flex items-center gap-2">
                                                            <span>✅ Tüm adımlar tamamlandı.</span>
                                                        </div>
                                                    )}

                                                    {/* Info for Future Protocols */}
                                                    {isFuture && (
                                                        <div className="mt-2 text-xs text-gray-500 italic">
                                                            Bu protokol, önceki süreç tamamlandıktan {timelinePatient.interProtocolGapDays || 11} gün sonra başlayacaktır.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-200 text-right">
                            <button onClick={() => setTimelinePatient(null)} className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900">Kapat</button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {viewingHistoryPatient && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Hasta İşlem Geçmişi</h3>
                                <p className="text-sm text-gray-500">{viewingHistoryPatient.protocolNo} - {viewingHistoryPatient.testName}</p>
                            </div>
                            <button onClick={() => setViewingHistoryPatient(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-4">
                            {historyEntries.length === 0 ? (
                                <div className="text-center text-gray-400 py-10">
                                    <span className="text-4xl block mb-2">📂</span>
                                    Bu hasta için henüz SUT girişi veya durum değişikliği yapılmamış.
                                </div>
                            ) : (
                                historyEntries.map(entry => {
                                    if (entry.type === 'status_change') {
                                        return (
                                            <div key={entry.id} className="bg-orange-50 rounded-xl border border-orange-200 shadow-sm p-4 flex items-start gap-3">
                                                <div className="text-2xl">🚩</div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold text-orange-800">Durum Değişikliği</span>
                                                        <span className="text-xs text-orange-600 font-mono">{new Date(entry.date).toLocaleDateString('tr-TR')}</span>
                                                    </div>
                                                    <p className="text-sm text-orange-700">{entry.notes}</p>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={entry.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden group">
                                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                                                <span className="font-bold text-gray-700">{new Date(entry.date).toLocaleDateString('tr-TR')}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-gray-500">ID: {entry.id.slice(0, 8)}...</span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDeleteHistoryEntry(entry.id, e)}
                                                        className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded"
                                                        title="Girişi Sil"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <table className="w-full text-sm text-left mb-3">
                                                    <thead className="text-xs text-gray-500 uppercase">
                                                        <tr>
                                                            <th className="py-1">Kod</th>
                                                            <th className="py-1">Açıklama</th>
                                                            <th className="py-1 text-right">Kayıtlı Puan</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-dashed divide-gray-100">
                                                        {entry.selectedCodes.map((code, idx) => (
                                                            <tr key={idx}>
                                                                <td className="py-2 font-mono text-xs">{code.code}</td>
                                                                <td className="py-2 text-gray-600">{code.description}</td>
                                                                <td className="py-2 text-right">{code.points}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                                    <div className="text-xs text-gray-400 italic">Not: {entry.notes || 'Yok'}</div>
                                                    <div className="text-right">
                                                        <span className="text-sm font-bold text-gray-800">{entry.totalPoints} Puan</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* PROCESS DATES MODAL */}
            {isProcessModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[65] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-gray-100 bg-orange-50 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-orange-900">Süreç Takip Tarihleri</h3>
                                <p className="text-xs text-orange-700">{processModalData.protocolNo} - {processModalData.selectedProtocolId ? (availableProtocols.find(p => p.id === processModalData.selectedProtocolId)?.name || 'Protokol') : 'Genel Süreç'}</p>
                            </div>
                            <button onClick={() => setIsProcessModalOpen(false)} className="text-orange-400 hover:text-orange-600 text-xl">&times;</button>
                        </div>
                        <form onSubmit={handleSaveProcessDates} className="p-6 space-y-4">

                            {/* PROTOCOL SELECTOR FOR MULTI-PROTOCOL PATIENTS */}
                            {processModalAssignedProtocols.length > 0 && (
                                <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 mb-2">
                                    <label className="block text-xs font-bold text-orange-800 mb-1">İşlem Yapılan Protokol</label>
                                    <select
                                        className="w-full border-orange-200 border rounded p-2 text-sm bg-white"
                                        value={processModalData.selectedProtocolId}
                                        onChange={(e) => handleProcessProtocolChange(e.target.value)}
                                    >
                                        {processModalAssignedProtocols.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-orange-600 mt-1">Lütfen tarihleri girmek istediğiniz protokolü seçiniz.</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Çalışma Başlangıcı</label>
                                <input
                                    type="date"
                                    min={processModalPatient?.admissionDate}
                                    className="w-full border p-2 rounded focus:ring-blue-500 outline-none text-sm"
                                    value={processModalData.workStartDate}
                                    onChange={e => setProcessModalData({ ...processModalData, workStartDate: e.target.value })}
                                />
                                {processModalPatient?.admissionDate && (
                                    <p className="text-[10px] text-gray-400 mt-0.5">Kayıt: {formatDate(processModalPatient.admissionDate)}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Data Paylaşım</label>
                                <input type="date" className="w-full border p-2 rounded focus:ring-blue-500 outline-none text-sm"
                                    value={processModalData.dataShareDate} onChange={e => setProcessModalData({ ...processModalData, dataShareDate: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Ön Analiz</label>
                                <input type="date" className="w-full border p-2 rounded focus:ring-blue-500 outline-none text-sm"
                                    value={processModalData.preAnalysisDate} onChange={e => setProcessModalData({ ...processModalData, preAnalysisDate: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Raporlama</label>
                                <input type="date" className="w-full border p-2 rounded focus:ring-blue-500 outline-none text-sm"
                                    value={processModalData.reportDate} onChange={e => setProcessModalData({ ...processModalData, reportDate: e.target.value })} />
                            </div>

                            <div className="pt-2 border-t border-gray-100">
                                <label className="flex items-center gap-2 cursor-pointer mb-2">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                        checked={processModalData.isRepeated}
                                        onChange={e => setProcessModalData({ ...processModalData, isRepeated: e.target.checked })}
                                    />
                                    <span className="text-sm font-bold text-gray-700">Örnek tekrara girdi mi?</span>
                                </label>

                                {processModalData.isRepeated && (
                                    <div className="ml-6 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Tekrar Çalışmaya Alınma Tarihi</label>
                                        <input type="date" className="w-full border p-2 rounded focus:ring-orange-500 outline-none text-sm border-orange-200 bg-orange-50"
                                            value={processModalData.repeatWorkDate} onChange={e => setProcessModalData({ ...processModalData, repeatWorkDate: e.target.value })} />
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsProcessModalOpen(false)} className="flex-1 border p-2 rounded text-gray-600 hover:bg-gray-50">Kapat</button>
                                <button type="submit" className="flex-1 bg-orange-600 text-white p-2 rounded hover:bg-orange-700 font-medium">Kaydet</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MAIN FORM MODAL */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <h3 className="text-xl font-bold text-gray-800">{formData.id ? 'Temel Bilgileri Düzenle' : 'Yeni Hasta Kaydı'}</h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Protokol No *</label>
                                    <input type="text" className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-lg"
                                        placeholder="Örn: M-105/2026"
                                        value={formData.protocolNo} onChange={e => setFormData({ ...formData, protocolNo: e.target.value })} required />
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-4">
                                <h4 className="text-sm font-bold text-gray-900 mb-3 bg-gray-50 p-2 rounded">Tıbbi Süreç Planlama</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Doku / Hastalık Tipi</label>
                                        <input type="text" className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.tissueType} onChange={e => setFormData({ ...formData, tissueType: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">İstemi Yapan Uzman</label>
                                        <select
                                            className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                            value={formData.requestingDoctor}
                                            onChange={e => setFormData({ ...formData, requestingDoctor: e.target.value })}
                                        >
                                            <option value="">Seçiniz...</option>
                                            {availableDoctors.map((d, i) => <option key={i} value={d}>{d}</option>)}
                                        </select>
                                    </div>

                                    <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
                                        <label className="block text-sm font-bold text-blue-900 mb-2">Uygulanacak Protokoller (Sıralı)</label>

                                        <div className="flex gap-2 mb-3">
                                            <select
                                                className="flex-1 border p-2 rounded text-sm bg-white"
                                                value={protocolToAddId}
                                                onChange={e => setProtocolToAddId(e.target.value)}
                                            >
                                                <option value="">Protokol Seçiniz...</option>
                                                {availableProtocols.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={handleAddProtocol}
                                                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
                                            >
                                                Ekle
                                            </button>
                                        </div>

                                        <div className="space-y-2 mb-4">
                                            {selectedProtocols.map((p, index) => (
                                                <div key={p.id} className="flex justify-between items-center bg-white p-2 rounded border border-blue-100 shadow-sm">
                                                    <span className="flex items-center gap-2">
                                                        <span className="bg-blue-200 text-blue-800 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">{index + 1}</span>
                                                        <span className="text-sm font-medium text-gray-700">{p.name}</span>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveProtocol(p.id)}
                                                        className="text-red-400 hover:text-red-600 text-xs px-2"
                                                    >
                                                        Kaldır
                                                    </button>
                                                </div>
                                            ))}
                                            {selectedProtocols.length === 0 && <p className="text-xs text-gray-400 italic text-center py-2">Henüz protokol eklenmedi.</p>}
                                        </div>

                                        {selectedProtocols.length > 1 && (
                                            <div className="bg-white p-3 rounded border border-gray-200">
                                                <label className="block text-xs font-bold text-gray-500 mb-2">Başlangıç Protokolü:</label>
                                                <select
                                                    className="w-full border p-2 rounded text-sm"
                                                    value={startProtocolId}
                                                    onChange={e => setStartProtocolId(e.target.value)}
                                                >
                                                    {selectedProtocols.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                                <p className="text-[10px] text-gray-400 mt-1">Süreç bu protokol ile başlayacaktır.</p>
                                            </div>
                                        )}

                                        <div className="mt-3">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">Protokoller Arası Bekleme (Gün)</label>
                                            <input
                                                type="number"
                                                className="w-full max-w-[100px] border p-2 rounded text-sm"
                                                value={formData.interProtocolGapDays}
                                                onChange={e => setFormData({ ...formData, interProtocolGapDays: parseInt(e.target.value) || 0 })}
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1">Bir protokol bittiğinde, diğeri başlamadan önce beklenecek süre.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-4">
                                <h4 className="text-sm font-bold text-gray-900 mb-3 bg-gray-50 p-2 rounded">Kayıt Tarihleri</h4>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Geliş Tarihi (Kayıt)</label>
                                    <input type="date" className="w-full border p-2 rounded focus:ring-blue-500 outline-none text-sm"
                                        value={formData.admissionDate} onChange={e => setFormData({ ...formData, admissionDate: e.target.value })} />
                                    <p className="text-xs text-gray-400 mt-1">Diagnoseq, Çalışma Başlangıcı gibi detay tarihleri hasta listesinden "Süreç Takip" butonuna tıklayarak girebilirsiniz.</p>
                                </div>
                            </div>

                            <div className="flex space-x-3 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setIsFormOpen(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">
                                    İptal
                                </button>
                                <button type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm">
                                    {formData.id ? 'Güncelle' : 'Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* STATUS CHANGE MODAL */}
            {isStatusModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
                    <div className="bg-white rounded-xl w-full max-w-md shadow-2xl p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Hasta Durumu Güncelle</h3>
                        <form onSubmit={handleSaveStatus} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">İşlem Tarihi</label>
                                <input
                                    type="date"
                                    className="w-full border p-2 rounded bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                    value={statusFormData.actionDate}
                                    onChange={e => setStatusFormData({ ...statusFormData, actionDate: e.target.value })}
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">Yatışın verildiği veya tekrar aktif olduğu tarihi seçiniz.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Yeni Durum</label>
                                <select
                                    className="w-full border p-2 rounded bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                    value={statusFormData.newStatus}
                                    onChange={e => setStatusFormData({ ...statusFormData, newStatus: e.target.value as any })}
                                >
                                    <option value="active">Aktif (Devam Ediyor)</option>
                                    <option value="hospitalized">Servis Yatışı (Durdur)</option>
                                    <option value="paused">Diğer Sebepler (Durdur)</option>
                                    <option value="ex">EX (Vefat - İptal)</option>
                                    <option value="completed">Tamamlandı</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama / Sebep</label>
                                <textarea
                                    className="w-full border p-2 rounded h-24 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Örn: Yoğun bakıma alındı, işlemler durduruldu."
                                    value={statusFormData.reason}
                                    onChange={e => setStatusFormData({ ...statusFormData, reason: e.target.value })}
                                    required={statusFormData.newStatus !== 'active' && statusFormData.newStatus !== 'completed'}
                                ></textarea>
                            </div>

                            {statusFormData.newStatus === 'ex' && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                                    ⚠️ <b>DİKKAT:</b> Hasta EX olarak işaretlendiğinde, sırada bekleyen tüm protokolleri iptal edilir.
                                </div>
                            )}

                            {statusFormData.newStatus === 'hospitalized' && (
                                <div className="p-3 bg-purple-50 border border-purple-200 text-purple-700 text-xs rounded">
                                    ℹ️ Süreç durdurulur, ancak planlanan tarihler SİLİNMEZ. Hasta tekrar aktif edildiğinde, eğer tarih geçmişse hemen işlem yapılması istenir.
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsStatusModalOpen(false)} className="flex-1 border p-2 rounded text-gray-600">İptal</button>
                                <button type="submit" className="flex-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700 font-medium">Güncelle</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientManager;