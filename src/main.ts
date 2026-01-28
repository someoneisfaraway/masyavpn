import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { spawn } from 'child_process';

console.log('Main process starting...');
console.log('Electron app object available:', !!app);
console.log('Electron ipcMain object available:', !!ipcMain);

import { registerApiHandlers } from './ipc/api';
import { registerVpnHandlers } from './ipc/vpn';

// Check if running as administrator
function isAdmin(): boolean {
    try {
        const fs = require('fs');
        const testPath = path.join(process.env.WINDIR || 'C:\\Windows', 'temp', 'masyavpn-admin-test');
        fs.writeFileSync(testPath, 'test');
        fs.unlinkSync(testPath);
        return true;
    } catch (error) {
        return false;
    }
}

// Restart app with admin privileges
async function restartAsAdmin(): Promise<void> {
    try {
        const execPath = process.execPath;
        const psScript = `Start-Process -FilePath "${execPath}" -Verb RunAs -WorkingDirectory "${process.cwd()}"`;

        spawn('powershell.exe', ['-Command', psScript], {
            detached: true,
            stdio: 'ignore',
        });

        app.quit();
    } catch (error) {
        console.error('Failed to restart as admin:', error);
    }
}

// Show admin required dialog
async function showAdminRequiredDialog(): Promise<boolean> {
    const result = await dialog.showMessageBox({
        type: 'warning',
        title: 'Administrator Privileges Required',
        message: 'masyavpn requires administrator privileges to create VPN tunnels and manage network settings.',
        detail: 'Click "Restart as Admin" to continue, or "Continue Anyway" to run with limited functionality.',
        buttons: ['Restart as Admin', 'Continue Anyway', 'Exit'],
        defaultId: 0,
        cancelId: 2,
    });

    switch (result.response) {
        case 0:
            await restartAsAdmin();
            return false;
        case 1:
            return true;
        case 2:
        default:
            app.quit();
            return false;
    }
}

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        titleBarStyle: 'hidden',
        width: 960,
        height: 640,
        minWidth: 960,
        minHeight: 640,
        maximizable: false,
        resizable: false,
        frame: false,
        backgroundColor: '#0d0221',
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Load the app
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://127.0.0.1:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    return mainWindow;
};

// Window control handlers
ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
});

ipcMain.on('window:close', () => {
    app.quit();
});

ipcMain.handle('check-admin-status', () => {
    return process.platform === 'win32' ? isAdmin() : true;
});

app.on('ready', async () => {
    console.log('App ready');

    // Register IPC handlers after app is ready
    registerApiHandlers();
    registerVpnHandlers();

    // Check for admin privileges on Windows
    if (process.platform === 'win32') {
        const hasAdmin = isAdmin();
        console.log(`Running with admin privileges: ${hasAdmin}`);

        if (!hasAdmin) {
            // Don't block dev mode
            if (process.env.NODE_ENV !== 'development') {
                const shouldContinue = await showAdminRequiredDialog();
                if (!shouldContinue) {
                    return;
                }
            }
        }
    }

    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
