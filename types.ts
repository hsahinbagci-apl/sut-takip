
export interface SUTCode {
  code: string;
  description: string;
  points: number;
  price: number;
  relatedTestName?: string;
  nextActionInDays?: number; // Deprecated in favor of Protocol Steps, kept for legacy
}

export interface TestStep {
  stepNumber: number;
  sutCode: string; // The code required for this step
  sutDescription?: string; // Helper for UI
  daysAfterPrevious: number; // How many days after the PREVIOUS step should this happen?
  description?: string; // Internal note like "1. Doz", "Kontrol", etc.
}

export interface TestProtocol {
  id: string;
  name: string; // e.g. "Genetik Tarama Paneli"
  steps: TestStep[];
}

export interface SUTEntry {
  id: string;
  patientId: string;
  date: string; // ISO date string
  selectedCodes: SUTCode[];
  totalPoints: number;
  totalPrice: number;
  notes: string;
  type?: 'sut' | 'status_change'; // Type of entry to distinguish between medical entries and status updates
}

export type PatientStatus = 'active' | 'archived' | 'completed' | 'ex' | 'hospitalized' | 'paused';

// New interface for tracking dates specific to a protocol
export interface ProtocolProcess {
  protocolId: string;
  protocolName: string; // Cached name for display
  workStartDate?: string;
  dataShareDate?: string;
  preAnalysisDate?: string;
  reportDate?: string;
  isRepeated?: boolean;
  repeatWorkDate?: string;
  isRepeatedSecond?: boolean;
  repeatWorkDateSecond?: string;
}

export interface Patient {
  id: string;
  protocolNo: string;
  tissueType: string;
  testName: string; // Display name of the CURRENT protocol or combined info
  requestingDoctor: string;

  admissionDate: string;
  diagnoseqSubmissionDate?: string; // Deprecated

  // Legacy top-level dates (kept for backward compatibility, but UI will prefer protocolProcesses)
  workStartDate?: string;
  dataShareDate?: string;
  preAnalysisDate?: string;
  reportDate?: string;
  isRepeated?: boolean;
  repeatWorkDate?: string;
  isRepeatedSecond?: boolean;
  repeatWorkDateSecond?: string;

  // New Structure for Multi-Protocol Date Tracking
  protocolProcesses?: ProtocolProcess[];

  notes: string;

  // Protocol Tracking
  activeProtocolId?: string; // The ID of the currently running protocol
  assignedProtocolIds?: string[]; // List of ALL protocols assigned to this patient in order
  interProtocolGapDays?: number; // Mandatory wait days between protocols (default 10)

  currentStepIndex: number; // 0-based index. 0 = Waiting for Step 1.

  entryFrequencyDays: number; // Fallback frequency
  lastEntryDate: string | null;

  nextScheduledDate?: string;
  nextScheduledNote?: string;

  // Status Management
  status: PatientStatus;
  statusReason?: string; // Why is it paused/ex?
  statusDate?: string; // When did the status change?
}

export interface ProtocolQuota {
  protocolId: string;
  protocolName: string;
  quota: number;
}

export interface BilledProtocolItem {
  protocolId: string;
  protocolName: string;
  count: number;
}

export interface Tender {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalBudget: number;
  totalPatientQuota: number; // General quota
  protocolQuotas?: ProtocolQuota[]; // Specific quotas per protocol
  currentSpent: number;
  active: boolean;
}

export interface Invoice {
  id: string;
  tenderId: string;
  date: string;
  amount: number;
  description: string;
  billedProtocols?: BilledProtocolItem[]; // Breakdown of what was billed
}

export interface LogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface User {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: 'admin' | 'user';
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  PATIENTS = 'PATIENTS',
  SUT_ENTRY = 'SUT_ENTRY',
  ANALYSIS = 'ANALYSIS',
  TENDERS = 'TENDERS',
  SETTINGS = 'SETTINGS'
}