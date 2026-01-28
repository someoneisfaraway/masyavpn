import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Device, Country, City, Server, Credentials, IP, ApiResponse } from '../models';

const API_BASE_URL = 'https://api.dvpnsdk.com';
const APP_TOKEN = '3zdgo5l8tsgl8j0m6zsil2rmohu2s46q';

class ApiService {
    private client: AxiosInstance;
    private deviceToken: string | null = null;

    constructor() {
        this.client = axios.create({
            baseURL: API_BASE_URL,
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
    }

    setDeviceToken(token: string) {
        this.deviceToken = token;
    }

    getDeviceToken(): string | null {
        return this.deviceToken;
    }

    private getAuthHeaders(): AxiosRequestConfig {
        if (!this.deviceToken) {
            return {};
        }
        return {
            headers: {
                'x-device-token': this.deviceToken,
            },
        };
    }

    async createDevice(platform: string = 'WINDOWS'): Promise<Device> {
        const response = await this.client.post<ApiResponse<Device>>('/device', {
            platform,
            app_token: APP_TOKEN,
        });
        return response.data.data;
    }

    async getDevice(): Promise<Device> {
        const response = await this.client.get<ApiResponse<Device>>('/device', this.getAuthHeaders());
        return response.data.data;
    }

    async getCountries(filter: string = 'V2RAY'): Promise<Country[]> {
        const response = await this.client.get<ApiResponse<Country[]>>(`/country?filter=${filter}`, this.getAuthHeaders());
        return response.data.data;
    }

    async getCities(countryId: string, filter: string = 'V2RAY'): Promise<City[]> {
        const response = await this.client.get<ApiResponse<City[]>>(
            `/country/${countryId}/city?filter=${filter}`,
            this.getAuthHeaders()
        );
        return response.data.data;
    }

    async getServers(cityId: string, filter: string = 'V2RAY'): Promise<Server[]> {
        const response = await this.client.get<ApiResponse<Server[]>>(
            `/city/${cityId}/server?filter=${filter}&sort=CURRENT_LOAD`,
            this.getAuthHeaders()
        );
        return response.data.data;
    }

    async createServerCredentials(serverId: string): Promise<Credentials> {
        const response = await this.client.post<ApiResponse<Credentials>>(
            `/server/${serverId}/credentials`,
            { protocol: 'V2RAY' },
            this.getAuthHeaders()
        );
        return response.data.data;
    }

    async createCityCredentials(cityId: string): Promise<Credentials> {
        const response = await this.client.post<ApiResponse<Credentials>>(
            `/city/${cityId}/credentials`,
            { protocol: 'V2RAY' },
            this.getAuthHeaders()
        );
        return response.data.data;
    }

    async createCountryCredentials(countryId: string): Promise<Credentials> {
        const response = await this.client.post<ApiResponse<Credentials>>(
            `/country/${countryId}/credentials`,
            { protocol: 'V2RAY' },
            this.getAuthHeaders()
        );
        return response.data.data;
    }

    async getIP(): Promise<IP> {
        const response = await this.client.get<ApiResponse<IP>>('/ip', this.getAuthHeaders());
        return response.data.data;
    }
}

export const api = new ApiService();
export default api;
