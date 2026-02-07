import { SUTCode, Tender } from './types';

// Mock SUT Codes database - Empty by default
export const MOCK_SUT_CODES: SUTCode[] = [];

export const INITIAL_TENDER: Tender = {
  id: 'tender-001',
  name: '2025_453958 TNKÜ Pato NGS',
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  totalBudget: 1000000,
  totalPatientQuota: 500,
  protocolQuotas: [],
  currentSpent: 0,
  active: true,
};