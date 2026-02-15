import { Patient, SUTEntry, Tender, Invoice, SUTCode, LogEntry, User, TestProtocol } from '../types';
import { INITIAL_TENDER, MOCK_SUT_CODES } from '../constants';

const KEYS = {
    PATIENTS: 'medisut_patients',
    ENTRIES: 'medisut_entries',
    TENDERS: 'medisut_tenders',
    INVOICES: 'medisut_invoices',
    SUT_CODES: 'medisut_sut_codes',
    DOCTORS: 'medisut_doctors',
    PROTOCOLS: 'medisut_protocols',
    LOGS: 'medisut_logs',
    USERS: 'medisut_users',
    CURRENT_USER: 'medisut_current_user_session'
};

// --- SAFE UUID GENERATOR ---
export const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Helpers
const get = <T>(key: string, defaultVal: T): T => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
};

const set = <T>(key: string, val: T) => {
    localStorage.setItem(key, JSON.stringify(val));
};

// --- BACKUP / RESTORE FOR DRIVE ---
export const getAllData = () => {
    return {
        patients: get(KEYS.PATIENTS, []),
        entries: get(KEYS.ENTRIES, []),
        tenders: get(KEYS.TENDERS, []),
        invoices: get(KEYS.INVOICES, []),
        sutCodes: get(KEYS.SUT_CODES, []),
        doctors: get(KEYS.DOCTORS, []),
        protocols: get(KEYS.PROTOCOLS, []),
        logs: get(KEYS.LOGS, []),
        users: get(KEYS.USERS, [])
    };
};

export const restoreAllData = (data: any) => {
    if (!data) return false;
    try {
        if (data.patients) set(KEYS.PATIENTS, data.patients);
        if (data.entries) set(KEYS.ENTRIES, data.entries);
        if (data.tenders) set(KEYS.TENDERS, data.tenders);
        if (data.invoices) set(KEYS.INVOICES, data.invoices);
        if (data.sutCodes) set(KEYS.SUT_CODES, data.sutCodes);
        if (data.doctors) set(KEYS.DOCTORS, data.doctors);
        if (data.protocols) set(KEYS.PROTOCOLS, data.protocols);
        if (data.logs) set(KEYS.LOGS, data.logs);
        if (data.users) set(KEYS.USERS, data.users);
        return true;
    } catch (e) {
        console.error("Veri geri yükleme hatası", e);
        return false;
    }
};

// --- AUTH SYSTEM ---
export const initializeUsers = () => {
    const users = get<User[]>(KEYS.USERS, []);
    if (users.length === 0) {
        const adminUser: User = {
            id: '1',
            username: 'admin',
            password: '123456',
            fullName: 'Sistem Yöneticisi',
            role: 'admin'
        };
        users.push(adminUser);
        set(KEYS.USERS, users);
    }
};

export const getUsers = (): User[] => get(KEYS.USERS, []);

export const saveUser = (user: User) => {
    const users = getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
        users[index] = user;
    } else {
        users.push(user);
    }
    set(KEYS.USERS, users);
    addLog('KULLANICI_YONETIMI', `Kullanıcı ${user.username} kaydedildi/güncellendi.`);
};

export const deleteUser = (userId: string) => {
    const users = getUsers();
    const filtered = users.filter(u => u.id !== userId);
    set(KEYS.USERS, filtered);
    addLog('KULLANICI_YONETIMI', `Kullanıcı ID: ${userId} silindi.`);
};

export const loginUser = (username: string, password: string): User | null => {
    initializeUsers();
    const users = getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
        addLog('OTURUM', `${user.fullName} giriş yaptı.`);
        return user;
    }
    return null;
};

export const logoutUser = () => {
    const user = getCurrentUser();
    if (user) {
        addLog('OTURUM', `${user.fullName} çıkış yaptı.`);
    }
    localStorage.removeItem(KEYS.CURRENT_USER);
};

export const getCurrentUser = (): User | null => {
    const item = localStorage.getItem(KEYS.CURRENT_USER);
    return item ? JSON.parse(item) : null;
};

// --- LOGGING SYSTEM ---
export const getLogs = (): LogEntry[] => get(KEYS.LOGS, []);

export const addLog = (action: string, details: string) => {
    try {
        const logs = getLogs();
        const currentUser = getCurrentUser();

        const newLog: LogEntry = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            user: currentUser ? currentUser.fullName : 'Sistem/Misafir',
            action,
            details
        };
        logs.unshift(newLog);
        if (logs.length > 1000) logs.pop();
        set(KEYS.LOGS, logs);
    } catch (error) {
        console.error("Loglama hatası:", error);
    }
};

// --- PATIENTS ---
export const getPatients = (): Patient[] => get(KEYS.PATIENTS, []);
export const savePatient = (patient: Patient) => {
    const patients = getPatients();
    const index = patients.findIndex(p => p.id === patient.id);
    let isUpdate = false;

    if (index >= 0) {
        patients[index] = patient;
        isUpdate = true;
    } else {
        // New patient - Initialize Protocol Step 0 if exists
        if (patient.activeProtocolId) {
            patient.currentStepIndex = 0;
            patient.nextScheduledDate = patient.admissionDate;
            patient.nextScheduledNote = "1. Adım (Başlangıç) Bekleniyor";
        }
        patients.push(patient);
    }
    set(KEYS.PATIENTS, patients);

    addLog(
        isUpdate ? 'HASTA_GUNCELLEME' : 'HASTA_KAYIT',
        `Protokol: ${patient.protocolNo} (${patient.testName}) ${isUpdate ? 'güncellendi' : 'kaydedildi'}.`
    );
};

export const deletePatient = (patientId: string) => {
    const patients = getPatients();
    const patientToDelete = patients.find(p => p.id === patientId);
    if (patientToDelete) {
        const updatedPatients = patients.filter(p => p.id !== patientId);
        set(KEYS.PATIENTS, updatedPatients);

        const entries = getEntries();
        const updatedEntries = entries.filter(e => e.patientId !== patientId);
        set(KEYS.ENTRIES, updatedEntries);

        addLog('HASTA_SILME', `Hasta Protokol: ${patientToDelete.protocolNo} silindi.`);
    }
};

// --- ENTRIES & SMART SCHEDULING ---
export const getEntries = (): SUTEntry[] => get(KEYS.ENTRIES, []);
export const saveEntry = (entry: SUTEntry) => {
    const entries = getEntries();
    entries.push(entry);
    set(KEYS.ENTRIES, entries);

    const patients = getPatients();
    const pIndex = patients.findIndex(p => p.id === entry.patientId);
    let protocolInfo = 'Bilinmeyen Hasta';

    if (pIndex >= 0) {
        const patient = patients[pIndex];
        patient.lastEntryDate = entry.date;
        protocolInfo = patient.protocolNo;

        // --- SMART PROTOCOL LOGIC ---
        if (patient.activeProtocolId) {
            const protocols = getTestProtocols();
            const protocol = protocols.find(p => p.id === patient.activeProtocolId);

            if (protocol && patient.currentStepIndex < protocol.steps.length) {
                const currentStep = protocol.steps[patient.currentStepIndex];

                const performedRequiredCode = entry.selectedCodes.some(c => c.code === currentStep.sutCode);

                if (performedRequiredCode) {
                    const nextStepIndex = patient.currentStepIndex + 1;
                    patient.currentStepIndex = nextStepIndex;

                    if (nextStepIndex < protocol.steps.length) {
                        const nextStep = protocol.steps[nextStepIndex];

                        const nextDate = new Date(entry.date);
                        nextDate.setDate(nextDate.getDate() + nextStep.daysAfterPrevious);

                        patient.nextScheduledDate = nextDate.toISOString().split('T')[0];
                        patient.nextScheduledNote = `${nextStepIndex + 1}. Adım: ${nextStep.description || nextStep.sutCode}`;
                    } else {
                        let nextProtocolId = null;
                        if (patient.assignedProtocolIds && patient.assignedProtocolIds.length > 0) {
                            const currentProtoIndex = patient.assignedProtocolIds.indexOf(patient.activeProtocolId);
                            if (currentProtoIndex >= 0 && currentProtoIndex < patient.assignedProtocolIds.length - 1) {
                                nextProtocolId = patient.assignedProtocolIds[currentProtoIndex + 1];
                            }
                        }

                        if (nextProtocolId) {
                            const nextProtocol = protocols.find(p => p.id === nextProtocolId);
                            const gapDays = patient.interProtocolGapDays || 11;

                            const nextDate = new Date(entry.date);
                            nextDate.setDate(nextDate.getDate() + gapDays);

                            patient.activeProtocolId = nextProtocolId;
                            patient.currentStepIndex = 0;

                            patient.nextScheduledDate = nextDate.toISOString().split('T')[0];
                            patient.nextScheduledNote = `Geçiş: ${nextProtocol?.name || 'Yeni Protokol'} (Bekleme Süresi)`;
                        } else {
                            patient.nextScheduledDate = undefined;
                            patient.nextScheduledNote = "Tüm Protokoller Tamamlandı";
                            patient.status = 'completed';
                        }
                    }
                }
            }
        } else {
            let maxNextDays = 0;
            entry.selectedCodes.forEach(c => {
                if (c.nextActionInDays && c.nextActionInDays > maxNextDays) {
                    maxNextDays = c.nextActionInDays;
                }
            });

            if (maxNextDays > 0) {
                const nextDate = new Date(entry.date);
                nextDate.setDate(nextDate.getDate() + maxNextDays);
                patient.nextScheduledDate = nextDate.toISOString().split('T')[0];
                patient.nextScheduledNote = `${maxNextDays} gün sonraki işlem periyodu`;
            } else {
                patient.nextScheduledDate = undefined;
                patient.nextScheduledNote = undefined;
            }
        }

        set(KEYS.PATIENTS, patients);
    }

    addLog(
        'SUT_GIRISI',
        `Protokol: ${protocolInfo} için ${entry.totalPoints} puanlık işlem girildi.`
    );
};

export const deleteEntry = (entryId: string) => {
    const entries = getEntries();
    const entryToDelete = entries.find(e => e.id === entryId);

    if (entryToDelete) {
        const updatedEntries = entries.filter(e => e.id !== entryId);
        set(KEYS.ENTRIES, updatedEntries);
        addLog('SUT_SILME', `Giriş ID: ${entryId.substring(0, 8)}... silindi.`);
    }
};

export const getEntriesByPatient = (patientId: string): SUTEntry[] => {
    return getEntries().filter(e => e.patientId === patientId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// --- TENDERS ---
export const initializeTenders = () => {
    const tenders = get<Tender[]>(KEYS.TENDERS, []);
    if (tenders.length === 0) {
        set(KEYS.TENDERS, [structuredClone(INITIAL_TENDER)]);
    }
};

export const getTenders = (): Tender[] => get<Tender[]>(KEYS.TENDERS, []);

const recalculateTenderSpent = (tenderId: string) => {
    const invoices = getInvoices();
    const totalSpent = invoices
        .filter(inv => inv.tenderId === tenderId)
        .reduce((sum, inv) => sum + inv.amount, 0);

    const tenders = getTenders();
    const tIndex = tenders.findIndex(t => t.id === tenderId);
    if (tIndex >= 0) {
        tenders[tIndex].currentSpent = totalSpent;
        set(KEYS.TENDERS, tenders);
    }
};

export const saveTender = (tender: Tender) => {
    const tenders = getTenders();
    const index = tenders.findIndex(t => t.id === tender.id);
    if (index >= 0) tenders[index] = tender;
    else tenders.push(tender);
    set(KEYS.TENDERS, tenders);
};

// --- INVOICES ---
export const getInvoices = (): Invoice[] => get(KEYS.INVOICES, []);
export const saveInvoice = (invoice: Invoice) => {
    const invoices = getInvoices();
    invoices.push(invoice);
    set(KEYS.INVOICES, invoices);

    recalculateTenderSpent(invoice.tenderId);
    addLog('FATURA_KESIM', `${invoice.amount} TL tutarında fatura eklendi: ${invoice.description}`);
};

export const deleteInvoice = (invoiceId: string) => {
    const invoices = getInvoices();
    const invoice = invoices.find(i => i.id === invoiceId);

    if (invoice) {
        const updatedInvoices = invoices.filter(i => i.id !== invoiceId);
        set(KEYS.INVOICES, updatedInvoices);
        recalculateTenderSpent(invoice.tenderId);
        addLog('FATURA_SILME', `${invoice.amount} TL tutarında fatura silindi.`);
    }
};

// --- SUT CODES ---
export const getSUTCodes = (): SUTCode[] => {
    const stored = get<SUTCode[] | null>(KEYS.SUT_CODES, null);
    return stored || MOCK_SUT_CODES;
};

export const saveSUTCode = (code: SUTCode) => {
    const codes = getSUTCodes();
    const index = codes.findIndex(c => c.code === code.code);
    let isUpdate = false;
    if (index >= 0) {
        codes[index] = code;
        isUpdate = true;
    } else {
        codes.push(code);
    }
    set(KEYS.SUT_CODES, codes);
    addLog('SUT_KODU_KAYIT', `Kod: ${code.code} ${isUpdate ? 'güncellendi' : 'eklendi'}.`);
};

export const deleteSUTCode = (codeValue: string) => {
    const codes = getSUTCodes();
    const newCodes = codes.filter(c => c.code !== codeValue);
    set(KEYS.SUT_CODES, newCodes);
    addLog('SUT_KODU_SILME', `Kod: ${codeValue} silindi.`);
};

// --- TEST PROTOCOLS ---
export const getTestProtocols = (): TestProtocol[] => get(KEYS.PROTOCOLS, []);

export const saveTestProtocol = (protocol: TestProtocol) => {
    const list = getTestProtocols();
    const index = list.findIndex(p => p.id === protocol.id);
    if (index >= 0) {
        list[index] = protocol;
    } else {
        list.push(protocol);
    }
    set(KEYS.PROTOCOLS, list);
    addLog('AYAR_PROTOKOL', `Protokol: ${protocol.name} kaydedildi.`);
};

export const deleteTestProtocol = (id: string) => {
    const list = getTestProtocols();
    set(KEYS.PROTOCOLS, list.filter(p => p.id !== id));
    addLog('AYAR_PROTOKOL_SIL', `Protokol ID: ${id} silindi.`);
};

// --- DOCTORS ---
export const getDoctors = (): string[] => get(KEYS.DOCTORS, []);
export const saveDoctor = (doctorName: string) => {
    const list = getDoctors();
    if (!list.includes(doctorName)) {
        list.push(doctorName);
        set(KEYS.DOCTORS, list);
        addLog('AYAR_DOKTOR_EKLE', `${doctorName} listeye eklendi.`);
    }
};
export const deleteDoctor = (doctorName: string) => {
    const list = getDoctors();
    set(KEYS.DOCTORS, list.filter(d => d !== doctorName));
    addLog('AYAR_DOKTOR_SIL', `${doctorName} listeden silindi.`);
};