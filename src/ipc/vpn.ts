import { ipcMain } from 'electron';
import { Credentials } from '../models';
import vpnManager from '../vpn/VPNManager';

export function registerVpnHandlers() {
    ipcMain.handle('vpn:connect', async (_event, credentials: Credentials): Promise<boolean> => {
        try {
            if (!credentials.payload || !credentials.uid) {
                throw new Error('Invalid credentials: missing payload or uid');
            }
            return await vpnManager.connect(credentials.payload, credentials.uid);
        } catch (error) {
            console.error('VPN connection failed:', error);
            throw error;
        }
    });

    ipcMain.handle('vpn:disconnect', async (): Promise<boolean> => {
        try {
            return await vpnManager.disconnect();
        } catch (error) {
            console.error('VPN disconnection failed:', error);
            throw error;
        }
    });

    ipcMain.handle('vpn:get-status', async (): Promise<string> => {
        return vpnManager.getStatus();
    });
}
