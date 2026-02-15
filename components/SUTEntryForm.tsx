import React, { useState, useEffect, useMemo } from 'react';
import { Patient, SUTCode, SUTEntry, TestProtocol } from '../types';
import { getPatients, getSUTCodes, saveEntry, getTestProtocols, generateId } from '../services/storageService';

interface SUTEntryFormProps {
    preSelectedPatientId?: string;
    onComplete: () => void;
}

const SUTEntryForm: React.FC<SUTEntryFormProps> = ({ preSelectedPatientId, onComplete }) => {
    // Data Sources
    const [patients, setPatients] = useState<Patient[]>([]);
    const [allSutCodes, setAllSutCodes] = useState<SUTCode[]>([]);
    const [protocols, setProtocols] = useState<TestProtocol[]>([]);

    // Form State
    const [selectedPatientId, setSelectedPatientId] = useState<string>(preSelectedPatientId || '');
    const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');

    // Basket State
    const [basket, setBasket] = useState<SUTCode[]>([]);
    const [selectedCodeToAddToBasket, setSelectedCodeToAddToBasket] = useState<string>('');

    useEffect(() => {
        setPatients(getPatients());
        setAllSutCodes(getSUTCodes());
        setProtocols(getTestProtocols());
    }, []);

    // Derived Data
    const selectedPatient = useMemo(() =>
        patients.find(p => p.id === selectedPatientId),
        [patients, selectedPatientId]);

    // LOGIC: Check if entry date is earlier than nextScheduledDate (Prevent premature entry)
    const isDatePremature = useMemo(() => {
        if (!selectedPatient || !selectedPatient.nextScheduledDate || !entryDate) return false;
        const scheduled = new Date(selectedPatient.nextScheduledDate);
        const selected = new Date(entryDate);
        // Compare dates (ignoring time)
        scheduled.setHours(0, 0, 0, 0);
        selected.setHours(0, 0, 0, 0);

        return selected < scheduled;
    }, [selectedPatient, entryDate]);

    // BLOCKING LOGIC: Check if patient is active
    const isEntryBlocked = useMemo(() => {
        if (!selectedPatient) return false;
        // Block if not active (Hospitalized, Ex, Paused, Completed, etc.)
        return selectedPatient.status !== 'active';
    }, [selectedPatient]);

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'active': return 'Aktif';
            case 'completed': return 'Tamamlandı';
            case 'ex': return 'EX (Vefat)';
            case 'hospitalized': return 'Servis Yatışında';
            case 'paused': return 'Durduruldu';
            case 'archived': return 'Arşivlenmiş';
            default: return status;
        }
    };

    // Active Protocol Logic
    const activeProtocolStep = useMemo(() => {
        if (!selectedPatient || !selectedPatient.activeProtocolId) return null;
        const protocol = protocols.find(p => p.id === selectedPatient.activeProtocolId);
        if (!protocol) return null;

        if (selectedPatient.currentStepIndex < protocol.steps.length) {
            return protocol.steps[selectedPatient.currentStepIndex];
        }
        return null; // Completed
    }, [selectedPatient, protocols]);

    // Available Codes
    const availableCodes = useMemo(() => {
        // If there's a protocol, user can still select ANY code, but we highlight the expected one.
        // If manual test name (legacy), filter by test name.
        if (selectedPatient?.activeProtocolId) {
            return allSutCodes;
        }

        if (!selectedPatient) return [];
        return allSutCodes.filter(c => c.relatedTestName === selectedPatient.testName || !c.relatedTestName);
    }, [allSutCodes, selectedPatient]);

    const addCodeToBasket = (codeString: string) => {
        if (isEntryBlocked) return;
        const codeOriginal = allSutCodes.find(c => c.code === codeString);
        if (codeOriginal) {
            const codeSnapshot: SUTCode = { ...codeOriginal };
            setBasket([...basket, codeSnapshot]);
        }
    };

    const handleAddCode = () => {
        if (!selectedCodeToAddToBasket || isEntryBlocked) return;
        addCodeToBasket(selectedCodeToAddToBasket);
        setSelectedCodeToAddToBasket('');
    };

    const handleRemoveFromBasket = (index: number) => {
        const newBasket = [...basket];
        newBasket.splice(index, 1);
        setBasket(newBasket);
    };

    const handleSave = () => {
        if (!selectedPatientId || basket.length === 0 || isEntryBlocked || isDatePremature) return;

        const totalPoints = basket.reduce((sum, item) => sum + item.points, 0);
        const totalPrice = basket.reduce((sum, item) => sum + item.price, 0);

        const newEntry: SUTEntry = {
            id: generateId(),
            patientId: selectedPatientId,
            date: entryDate,
            selectedCodes: basket,
            totalPoints,
            totalPrice,
            notes
        };

        saveEntry(newEntry);
        onComplete();
    };

    // Totals
    const basketTotalPoints = basket.reduce((sum, item) => sum + item.points, 0);
    const basketTotalPrice = basket.reduce((sum, item) => sum + item.price, 0);

    return (
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Yeni SUT İşlemi Girişi</h2>
                <button onClick={onComplete} className="text-gray-500 hover:text-gray-700">&times;</button>
            </div>

            <div className="p-6 space-y-6">
                {/* Header Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hasta Seçimi</label>
                        <select
                            className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            value={selectedPatientId}
                            onChange={(e) => {
                                setSelectedPatientId(e.target.value);
                                setBasket([]);
                            }}
                        >
                            <option value="">Hasta Seçiniz...</option>
                            {patients.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.protocolNo} - {p.testName} {p.status !== 'active' ? `(${getStatusLabel(p.status)})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">İşlem Tarihi (Onay Tarihi)</label>
                        <input
                            type="date"
                            className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                            value={entryDate}
                            onChange={e => setEntryDate(e.target.value)}
                            disabled={isEntryBlocked}
                        />
                        <p className="text-xs text-gray-500 mt-1">Sistem bu tarihi baz alarak bir sonraki adımı hesaplar.</p>
                    </div>
                </div>

                {/* BLOCKING ALERT */}
                {isEntryBlocked && selectedPatient && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 animate-pulse">
                        <div className="text-2xl">⛔</div>
                        <div>
                            <h3 className="font-bold text-red-800">İşlem Kısıtlaması</h3>
                            <p className="text-sm text-red-700 mt-1">
                                Bu hasta şu an <b>{getStatusLabel(selectedPatient.status)}</b> durumundadır.
                                SUT girişi yapabilmek için hasta kartından durumunu tekrar <b>Aktif</b> hale getirmeniz gerekmektedir.
                            </p>
                            {selectedPatient.statusReason && (
                                <p className="text-xs text-red-600 mt-2 bg-red-100 p-2 rounded">
                                    Sebep: {selectedPatient.statusReason}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* DATE PREMATURE ALERT */}
                {!isEntryBlocked && isDatePremature && selectedPatient && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
                        <div className="text-2xl">⏳</div>
                        <div>
                            <h3 className="font-bold text-orange-800">Erken Giriş Uyarısı</h3>
                            <p className="text-sm text-orange-700 mt-1">
                                Bu hasta için planlanan işlem tarihi <b>{new Date(selectedPatient.nextScheduledDate!).toLocaleDateString('tr-TR')}</b> tarihidir.
                                Seçtiğiniz tarih bu tarihten önce olduğu için protokol bozulmaması adına <b>giriş yapılamaz.</b>
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                                Lütfen işlem tarihini kontrol ediniz veya planlanan tarihin gelmesini bekleyiniz.
                            </p>
                        </div>
                    </div>
                )}

                {/* Smart Suggestion Box */}
                {selectedPatient && activeProtocolStep && !isEntryBlocked && !isDatePremature && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between shadow-sm">
                        <div>
                            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">SIRADAKİ BEKLENEN İŞLEM</p>
                            <p className="font-bold text-gray-800 text-lg">{activeProtocolStep.sutCode}</p>
                            <p className="text-sm text-gray-600">{activeProtocolStep.sutDescription || activeProtocolStep.description}</p>
                        </div>
                        <button
                            onClick={() => addCodeToBasket(activeProtocolStep.sutCode)}
                            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors"
                        >
                            Listeye Ekle
                        </button>
                    </div>
                )}
                {selectedPatient && !activeProtocolStep && selectedPatient.activeProtocolId && !isEntryBlocked && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center text-green-700 font-medium">
                        ✅ Bu hastanın protokol süreci tamamlanmıştır. Manuel ekleme yapabilirsiniz.
                    </div>
                )}

                <hr className="border-gray-100" />

                {/* Manual Code Selection */}
                <div className={`space-y-4 ${isEntryBlocked || isDatePremature ? 'opacity-50 pointer-events-none' : ''}`}>
                    <h3 className="font-semibold text-gray-800">Manuel Ekleme</h3>

                    <div className="flex flex-col sm:flex-row gap-2">
                        <select
                            className="flex-1 min-w-0 border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            value={selectedCodeToAddToBasket}
                            onChange={e => setSelectedCodeToAddToBasket(e.target.value)}
                            disabled={!selectedPatientId || isEntryBlocked}
                        >
                            <option value="">SUT Kodu Seç...</option>
                            {availableCodes.map(c => (
                                <option key={c.code} value={c.code}>
                                    {c.code} - {c.description} ({c.points} Puan / {c.price} ₺)
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={handleAddCode}
                            disabled={!selectedCodeToAddToBasket || isEntryBlocked}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                        >
                            Ekle
                        </button>
                    </div>

                    {/* Basket Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 border-b">
                                <tr>
                                    <th className="px-4 py-2">Kod</th>
                                    <th className="px-4 py-2">Açıklama</th>
                                    <th className="px-4 py-2 text-right">Puan</th>
                                    <th className="px-4 py-2 text-right">Fiyat</th>
                                    <th className="px-4 py-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {basket.map((item, index) => (
                                    <tr key={index} className="bg-white">
                                        <td className="px-4 py-2 font-mono">{item.code}</td>
                                        <td className="px-4 py-2">{item.description}</td>
                                        <td className="px-4 py-2 text-right">{item.points}</td>
                                        <td className="px-4 py-2 text-right">{item.price} ₺</td>
                                        <td className="px-4 py-2 text-right">
                                            <button onClick={() => handleRemoveFromBasket(index)} className="text-red-500 hover:text-red-700">&times;</button>
                                        </td>
                                    </tr>
                                ))}
                                {basket.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-4 text-center text-gray-400">Henüz kalem eklenmedi.</td>
                                    </tr>
                                )}
                            </tbody>
                            {basket.length > 0 && (
                                <tfoot className="bg-gray-50 font-bold text-gray-800">
                                    <tr>
                                        <td colSpan={2} className="px-4 py-3 text-right">Toplam:</td>
                                        <td className="px-4 py-3 text-right">{basketTotalPoints}</td>
                                        <td className="px-4 py-3 text-right">{basketTotalPrice} ₺</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                <div className={`${isEntryBlocked || isDatePremature ? 'opacity-50 pointer-events-none' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
                    <textarea
                        className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="İşlem ile ilgili notlar..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        disabled={isEntryBlocked}
                    ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button
                        onClick={onComplete}
                        className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                    >
                        İptal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={basket.length === 0 || isEntryBlocked || isDatePremature}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                    >
                        Kaydet ve Tamamla
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SUTEntryForm;