import { ipcMain } from 'electron';
import Store from 'electron-store';
import api from '../api';
import { Device, Country, City, Server, Credentials, IP } from '../models';

const store = new Store();

// Initialize device on app start
async function initDevice(): Promise<Device | null> {
    try {
        store.delete('deviceToken');
        const device = await api.createDevice('WINDOWS');
        api.setDeviceToken(device.token);
        store.set('deviceToken', device.token);
        console.log('New device created:', device.id);
        return device;
    } catch (error) {
        console.error('Failed to initialize device:', error);
        return null;
    }
}

// Export a function to register handlers
export function registerApiHandlers() {
    ipcMain.handle('api:init-device', async (): Promise<Device | null> => {
        return await initDevice();
    });

    ipcMain.handle('api:get-countries', async (): Promise<Country[]> => {
        try {
            console.log('Fetching countries...');
            const countries = await api.getCountries('V2RAY');
            console.log(`Fetched ${countries.length} countries`);
            return countries;
        } catch (error) {
            console.error('Failed to get countries:', error);
            throw error;
        }
    });

    ipcMain.handle('api:get-cities', async (_event, countryId: string): Promise<City[]> => {
        try {
            console.log(`Fetching cities for country ${countryId}...`);
            const cities = await api.getCities(countryId, 'V2RAY');
            console.log(`Fetched ${cities.length} cities`);
            return cities;
        } catch (error) {
            console.error('Failed to get cities:', error);
            throw error;
        }
    });

    ipcMain.handle('api:get-servers', async (_event, cityId: string): Promise<Server[]> => {
        try {
            console.log(`Fetching servers for city ${cityId}...`);
            const servers = await api.getServers(cityId, 'V2RAY');
            console.log(`Fetched ${servers.length} servers`);
            return servers;
        } catch (error) {
            console.error('Failed to get servers:', error);
            throw error;
        }
    });

    ipcMain.handle('api:create-credentials', async (_event, serverId: string): Promise<Credentials> => {
        try {
            console.log(`Creating credentials for server ${serverId}...`);
            const credentials = await api.createServerCredentials(serverId);
            console.log('Credentials created');
            return credentials;
        } catch (error) {
            console.error('Failed to create credentials:', error);
            throw error;
        }
    });

    ipcMain.handle('api:get-ip', async (): Promise<IP> => {
        try {
            return await api.getIP();
        } catch (error) {
            console.error('Failed to get IP:', error);
            throw error;
        }
    });
}
