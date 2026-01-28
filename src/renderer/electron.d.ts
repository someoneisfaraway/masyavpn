import { Device, Country, City, Server, Credentials, IP } from '../models';

export interface ElectronAPI {
    initDevice: () => Promise<Device | null>;
    getCountries: () => Promise<Country[]>;
    getCities: (countryId: string) => Promise<City[]>;
    getServers: (cityId: string) => Promise<Server[]>;
    createCredentials: (serverId: string) => Promise<Credentials>;
    getIP: () => Promise<IP>;
    connect: (credentials: Credentials) => Promise<boolean>;
    disconnect: () => Promise<boolean>;
    getStatus: () => Promise<string>;
    minimizeWindow: () => void;
    closeWindow: () => void;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

export { };
