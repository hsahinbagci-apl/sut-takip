// API Client for communicating with the sut-takip-api backend

const API_BASE_URL = '/api'; // Nginx proxies /api to localhost:3001

// --- DATA ENDPOINTS ---

/**
 * Fetches ALL application data from the backend.
 * Returns a map of { key: value } pairs.
 */
export const fetchAllData = async (): Promise<Record<string, any>> => {
    const res = await fetch(`${API_BASE_URL}/data`);
    if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
    return res.json();
};

/**
 * Saves a single data key to the backend.
 * @param key - The data key (e.g., 'medisut_patients')
 * @param value - The value to store (will be JSON.stringified by the backend)
 */
export const saveDataByKey = async (key: string, value: any): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/data/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
    });
    if (!res.ok) throw new Error(`API Save Error: ${res.status} ${res.statusText}`);
};

// --- AUTH ENDPOINTS ---

export interface ApiLoginResponse {
    user: {
        id: string;
        username: string;
        fullName: string;
        role: 'admin' | 'user';
    };
    token: string;
}

/**
 * Authenticates a user against the backend.
 */
export const apiLogin = async (username: string, password: string): Promise<ApiLoginResponse | null> => {
    try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
};

export const apiRegister = async (username: string, password: string, fullName: string, role: string): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, fullName, role }),
        });
        return res.ok;
    } catch {
        return false;
    }
};

export const apiGetUsers = async (): Promise<any[]> => {
    try {
        const res = await fetch(`${API_BASE_URL}/auth/users`);
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
};

export const apiDeleteUser = async (userId: string): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE_URL}/auth/users/${userId}`, {
            method: 'DELETE',
        });
        return res.ok;
    } catch {
        return false;
    }
};
