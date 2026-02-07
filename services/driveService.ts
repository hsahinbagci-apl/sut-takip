import { getAllData, restoreAllData, addLog } from "./storageService";

// Declare global types for Google APIs to fix window properties errors
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

// Access process.env directly. Vite replaces this with the defined object.
const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = process.env.VITE_GOOGLE_API_KEY;

const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

const DB_FILE_NAME = 'medisut_db.json';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

// Initialize GAPI and GIS
export const initGoogleDrive = (onInitComplete: (success: boolean) => void) => {
    // If keys are missing, we just log warning and stop, but don't crash app
    if (!CLIENT_ID || !API_KEY) {
        // Don't warn on every load if not configured, just silently disable drive features until configured
        // console.warn("Google Client ID or API Key missing.");
        onInitComplete(false);
        return;
    }

    const script1 = document.createElement('script');
    script1.src = "https://apis.google.com/js/api.js";
    script1.onload = () => {
        window.gapi.load('client', async () => {
            try {
                await window.gapi.client.init({
                    apiKey: API_KEY,
                    discoveryDocs: DISCOVERY_DOCS,
                });
                gapiInited = true;
                checkInit(onInitComplete);
            } catch (err) {
                console.error("GAPI Init Error", err);
            }
        });
    };
    document.body.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = "https://accounts.google.com/gsi/client";
    script2.onload = () => {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // defined at request time
        });
        gisInited = true;
        checkInit(onInitComplete);
    };
    document.body.appendChild(script2);
};

const checkInit = (cb: (s: boolean) => void) => {
    if (gapiInited && gisInited) cb(true);
};

export const handleDriveAuth = (): Promise<boolean> => {
    return new Promise((resolve) => {
        tokenClient.callback = async (resp: any) => {
            if (resp.error) {
                resolve(false);
                return;
            }
            resolve(true);
        };

        if (window.gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            tokenClient.requestAccessToken({prompt: ''});
        }
    });
};

// 1. Find or Create File
const getDbFileId = async (): Promise<string | null> => {
    try {
        const response = await window.gapi.client.drive.files.list({
            q: `name = '${DB_FILE_NAME}' and trashed = false`,
            fields: 'files(id, name)',
        });
        const files = response.result.files;
        if (files && files.length > 0) {
            return files[0].id;
        }
        return null;
    } catch (err) {
        console.error("Error finding file", err);
        return null;
    }
};

// 2. Download Data from Drive
export const syncFromDrive = async (): Promise<boolean> => {
    try {
        const fileId = await getDbFileId();
        if (!fileId) {
            console.log("No DB file found on Drive.");
            return true; // Nothing to sync, that's okay
        }

        const response = await window.gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });

        const data = response.result;
        if (data) {
            const success = restoreAllData(data);
            if (success) addLog("DRIVE_SYNC", "Veriler Google Drive'dan çekildi.");
            return success;
        }
        return false;
    } catch (err) {
        console.error("Sync From Drive Error", err);
        return false;
    }
};

// 3. Upload Data to Drive
export const syncToDrive = async (): Promise<boolean> => {
    try {
        const data = getAllData();
        const fileContent = JSON.stringify(data);
        const fileId = await getDbFileId();

        const fileMetadata = {
            name: DB_FILE_NAME,
            mimeType: 'application/json',
        };

        if (fileId) {
            // Update existing file
            await window.gapi.client.request({
                path: `/upload/drive/v3/files/${fileId}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                body: fileContent
            });
            addLog("DRIVE_SYNC", "Veriler Google Drive'a yedeklendi.");
        } else {
            // Create new file
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const close_delim = "\r\n--" + boundary + "--";

            const contentType = 'application/json';

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(fileMetadata) +
                delimiter +
                'Content-Type: ' + contentType + '\r\n\r\n' +
                fileContent +
                close_delim;

            await window.gapi.client.request({
                path: '/upload/drive/v3/files',
                method: 'POST',
                params: { uploadType: 'multipart' },
                headers: {
                    'Content-Type': 'multipart/related; boundary="' + boundary + '"'
                },
                body: multipartRequestBody
            });
            addLog("DRIVE_SYNC", "Yeni dosya Google Drive'da oluşturuldu.");
        }
        return true;
    } catch (err) {
        console.error("Sync To Drive Error", err);
        return false;
    }
};