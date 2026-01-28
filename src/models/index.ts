export interface Device {
    id: string;
    token: string;
    platform: string;
    created_at?: string;
}

export interface Country {
    id: string;
    name: string;
    code: string;
    cities_count?: number;
    servers_count?: number;
    servers_available?: number;
}

export interface City {
    id: string;
    name: string;
    servers_count?: number;
    servers_available?: number;
}

export interface Server {
    id: string;
    name: string;
    load?: number;
    country?: string;
    city?: string;
}

export interface Credentials {
    protocol: string;
    payload: string | null;
    uid: string | null;
    private_key?: string | null;
    server?: Server;
}

export interface IP {
    ip: string;
    information?: {
        latitude: number;
        longitude: number;
        city: string;
        country: string;
        country_code: string;
    };
}

export interface ApiResponse<T> {
    data: T;
    success?: boolean;
    message?: string;
}
