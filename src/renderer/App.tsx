import React, { useState, useEffect, useCallback } from 'react';
import { Country, City, Server, Credentials, IP } from '../models';
import TitleBar from './components/TitleBar';
import ServerBrowser from './components/ServerBrowser';
import ConnectionStatus from './components/ConnectionStatus';

type ViewLevel = 'countries' | 'cities' | 'servers';

interface SelectedLocation {
    country?: Country;
    city?: City;
    server?: Server;
}

const App: React.FC = () => {
    // const [isInitialized, setIsInitialized] = useState(false); // Removed unused state
    const [, setIsInitialized] = useState(false); // Valid workaround if setter is needed, or just remove if logic permits. 
    // BETTER: Logic uses setIsInitialized but not isInitialized value.
    const [error, setError] = useState<string | null>(null);

    const [countries, setCountries] = useState<Country[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const [servers, setServers] = useState<Server[]>([]);

    const [viewLevel, setViewLevel] = useState<ViewLevel>('countries');
    const [selected, setSelected] = useState<SelectedLocation>({});
    const [isLoading, setIsLoading] = useState(false);

    const [vpnStatus, setVpnStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'disconnecting'>('disconnected');
    // const [currentCredentials, setCurrentCredentials] = useState<Credentials | null>(null); // Removed unused state
    const [, setCurrentCredentials] = useState<Credentials | null>(null);
    const [currentIP, setCurrentIP] = useState<IP | null>(null);

    // Initialize app
    useEffect(() => {
        const init = async () => {
            try {
                await window.electronAPI.initDevice();
                const countries = await window.electronAPI.getCountries();
                setCountries(countries);
                setIsInitialized(true);

                // Get initial IP
                try {
                    const ip = await window.electronAPI.getIP();
                    setCurrentIP(ip);
                } catch (e) {
                    console.log('Could not fetch initial IP');
                }
            } catch (err) {
                setError('Failed to initialize. Please check your connection.');
                console.error(err);
            }
        };
        init();
    }, []);

    // Fetch cities when country is selected
    const handleCountrySelect = useCallback(async (country: Country) => {
        setIsLoading(true);
        setSelected({ country });
        try {
            const cities = await window.electronAPI.getCities(country.id);
            setCities(cities);
            setViewLevel('cities');
        } catch (err) {
            setError('Failed to load cities');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch servers when city is selected
    const handleCitySelect = useCallback(async (city: City) => {
        setIsLoading(true);
        setSelected((prev) => ({ ...prev, city }));
        try {
            const servers = await window.electronAPI.getServers(city.id);
            setServers(servers);
            setViewLevel('servers');
        } catch (err) {
            setError('Failed to load servers');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Select server
    const handleServerSelect = useCallback((server: Server) => {
        setSelected((prev) => ({ ...prev, server }));
    }, []);

    // Go back
    const handleBack = useCallback(() => {
        if (viewLevel === 'servers') {
            setViewLevel('cities');
            setSelected((prev) => ({ ...prev, server: undefined }));
        } else if (viewLevel === 'cities') {
            setViewLevel('countries');
            setSelected(() => ({ country: undefined, city: undefined }));
        }
    }, [viewLevel]);

    // Connect to VPN
    const handleConnect = useCallback(async () => {
        if (!selected.server) return;

        setVpnStatus('connecting');
        try {
            const credentials = await window.electronAPI.createCredentials(selected.server.id);
            setCurrentCredentials(credentials);

            await window.electronAPI.connect(credentials);
            setVpnStatus('connected');

            // Update IP after connection
            setTimeout(async () => {
                try {
                    const ip = await window.electronAPI.getIP();
                    setCurrentIP(ip);
                } catch (e) {
                    console.log('Could not fetch IP');
                }
            }, 2000);
        } catch (err: any) {
            console.error('Connection failed:', err);
            setVpnStatus('disconnected');
            const errorMessage = err.message || 'Unknown error';
            setError(`Connection failed: ${errorMessage}`);
        }
    }, [selected.server]);

    // Disconnect from VPN
    const handleDisconnect = useCallback(async () => {
        setVpnStatus('disconnecting');
        try {
            await window.electronAPI.disconnect();
            setVpnStatus('disconnected');
            setCurrentCredentials(null);

            // Update IP after disconnection
            setTimeout(async () => {
                try {
                    const ip = await window.electronAPI.getIP();
                    setCurrentIP(ip);
                } catch (e) {
                    console.log('Could not fetch IP');
                }
            }, 2000);
        } catch (err) {
            console.error('Disconnection failed:', err);
            setVpnStatus('disconnected');
        }
    }, []);

    const getListData = () => {
        switch (viewLevel) {
            case 'countries':
                return countries;
            case 'cities':
                return cities;
            case 'servers':
                return servers;
            default:
                return [];
        }
    };

    return (
        <>
            <div className="grid-background" />
            <TitleBar />

            <div className="main-container">
                <ServerBrowser
                    viewLevel={viewLevel}
                    items={getListData()}
                    selected={selected}
                    isLoading={isLoading}
                    onCountrySelect={handleCountrySelect}
                    onCitySelect={handleCitySelect}
                    onServerSelect={handleServerSelect}
                    onBack={handleBack}
                />

                <div className="content">
                    {error && (
                        <div className="error" style={{ marginBottom: 24 }}>
                            {error}
                            <button
                                onClick={() => setError(null)}
                                style={{ marginLeft: 12, background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    <ConnectionStatus
                        status={vpnStatus}
                        selectedServer={selected.server}
                        selectedCountry={selected.country}
                        currentIP={currentIP}
                        onConnect={handleConnect}
                        onDisconnect={handleDisconnect}
                    />
                </div>
            </div>
        </>
    );
};

export default App;
