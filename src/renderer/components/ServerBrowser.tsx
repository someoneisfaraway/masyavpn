import React from 'react';
import { Country, City, Server } from '../../models';

// Country code to flag emoji mapping
const getFlagEmoji = (countryCode: string): string => {
    if (!countryCode || countryCode.length !== 2) return '🌍';

    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map((char) => 127397 + char.charCodeAt(0));

    return String.fromCodePoint(...codePoints);
};

// Get load level class
const getLoadLevel = (load: number = 0): 'low' | 'medium' | 'high' => {
    if (load < 50) return 'low';
    if (load < 80) return 'medium';
    return 'high';
};

interface ServerBrowserProps {
    viewLevel: 'countries' | 'cities' | 'servers';
    items: (Country | City | Server)[];
    selected: {
        country?: Country;
        city?: City;
        server?: Server;
    };
    isLoading: boolean;
    onCountrySelect: (country: Country) => void;
    onCitySelect: (city: City) => void;
    onServerSelect: (server: Server) => void;
    onBack: () => void;
}

const ServerBrowser: React.FC<ServerBrowserProps> = ({
    viewLevel,
    items,
    selected,
    isLoading,
    onCountrySelect,
    onCitySelect,
    onServerSelect,
    onBack,
}) => {
    const getTitle = () => {
        switch (viewLevel) {
            case 'countries':
                return 'Select Country';
            case 'cities':
                return `Cities in ${selected.country?.name || 'Country'}`;
            case 'servers':
                return `Servers in ${selected.city?.name || 'City'}`;
        }
    };

    const renderItem = (item: Country | City | Server, index: number) => {
        if (viewLevel === 'countries') {
            const country = item as Country;
            return (
                <div
                    key={country.id}
                    className={`server-item ${selected.country?.id === country.id ? 'server-item--active' : ''}`}
                    onClick={() => onCountrySelect(country)}
                    style={{ animationDelay: `${index * 0.05}s` }}
                >
                    <span className="server-item__flag">{getFlagEmoji(country.code)}</span>
                    <div className="server-item__info">
                        <div className="server-item__name">{country.name}</div>
                        <div className="server-item__meta">
                            {country.servers_available ?? country.servers_count ?? 0} servers
                        </div>
                    </div>
                </div>
            );
        }

        if (viewLevel === 'cities') {
            const city = item as City;
            return (
                <div
                    key={city.id}
                    className={`server-item ${selected.city?.id === city.id ? 'server-item--active' : ''}`}
                    onClick={() => onCitySelect(city)}
                    style={{ animationDelay: `${index * 0.05}s` }}
                >
                    <span className="server-item__flag">🏙️</span>
                    <div className="server-item__info">
                        <div className="server-item__name">{city.name}</div>
                        <div className="server-item__meta">
                            {city.servers_available ?? city.servers_count ?? 0} servers
                        </div>
                    </div>
                </div>
            );
        }

        const server = item as Server;
        const loadLevel = getLoadLevel(server.load);
        return (
            <div
                key={server.id}
                className={`server-item ${selected.server?.id === server.id ? 'server-item--active' : ''}`}
                onClick={() => onServerSelect(server)}
                style={{ animationDelay: `${index * 0.05}s` }}
            >
                <span className="server-item__flag">🖥️</span>
                <div className="server-item__info">
                    <div className="server-item__name">{server.name}</div>
                    <div className="server-item__meta">V2Ray</div>
                </div>
                <div className="server-item__load">
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{server.load || 0}%</span>
                    <div className="server-item__load-bar">
                        <div
                            className={`server-item__load-fill server-item__load-fill--${loadLevel}`}
                            style={{ width: `${server.load || 0}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="sidebar">
            <div className="sidebar__header">
                {viewLevel !== 'countries' && (
                    <button className="back-button" onClick={onBack}>
                        ← Back
                    </button>
                )}
                <div className="sidebar__title">{getTitle()}</div>
            </div>

            <div className="sidebar__content">
                {isLoading ? (
                    <div className="loading">
                        <div className="loading__spinner" />
                        <div className="loading__text">Loading...</div>
                    </div>
                ) : items.length === 0 ? (
                    <div className="loading">
                        <div className="loading__text">No items found</div>
                    </div>
                ) : (
                    <div className="server-list">
                        {items.map((item, index) => renderItem(item, index))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ServerBrowser;
