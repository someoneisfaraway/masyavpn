import { contextBridge, ipcRenderer } from 'electron';
import { Device, Country, City, Server, Credentials, IP } from './models';

export interface ElectronAPI {
    // API methods
    initDevice: () => Promise<Device | null>;
    getCountries: () => Promise<Country[]>;
    getCities: (countryId: string) => Promise<City[]>;
    getServers: (cityId: string) => Promise<Server[]>;
    createCredentials: (serverId: string) => Promise<Credentials>;
    getIP: () => Promise<IP>;

    // VPN methods
    connect: (credentials: Credentials) => Promise<boolean>;
    disconnect: () => Promise<boolean>;
    getStatus: () => Promise<string>;

    // Window methods
    minimizeWindow: () => void;
    closeWindow: () => void;
}

const electronAPI: ElectronAPI = {
    // API methods
    initDevice: () => ipcRenderer.invoke('api:init-device'),
    getCountries: () => ipcRenderer.invoke('api:get-countries'),
    getCities: (countryId: string) => ipcRenderer.invoke('api:get-cities', countryId),
    getServers: (cityId: string) => ipcRenderer.invoke('api:get-servers', cityId),
    createCredentials: (serverId: string) => ipcRenderer.invoke('api:create-credentials', serverId),
    getIP: () => ipcRenderer.invoke('api:get-ip'),

    // VPN methods
    connect: (credentials: Credentials) => ipcRenderer.invoke('vpn:connect', credentials),
    disconnect: () => ipcRenderer.invoke('vpn:disconnect'),
    getStatus: () => ipcRenderer.invoke('vpn:get-status'),

    // Window methods
    minimizeWindow: () => ipcRenderer.send('window:minimize'),
    closeWindow: () => ipcRenderer.send('window:close'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
