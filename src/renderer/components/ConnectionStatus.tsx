import React from 'react';
import { Server, Country, IP } from '../../models';

interface ConnectionStatusProps {
    status: 'disconnected' | 'connecting' | 'connected' | 'disconnecting';
    selectedServer?: Server;
    selectedCountry?: Country;
    currentIP?: IP | null;
    onConnect: () => void;
    onDisconnect: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
    status,
    selectedServer,
    selectedCountry,
    currentIP,
    onConnect,
    onDisconnect,
}) => {
    const getStatusText = () => {
        switch (status) {
            case 'connected':
                return 'Connected';
            case 'connecting':
                return 'Connecting...';
            case 'disconnecting':
                return 'Disconnecting...';
            default:
                return 'Disconnected';
        }
    };

    const getStatusIcon = () => {
        switch (status) {
            case 'connected':
                return '🔒';
            case 'connecting':
                return '⏳';
            case 'disconnecting':
                return '⏳';
            default:
                return '🔓';
        }
    };

    const isConnecting = status === 'connecting' || status === 'disconnecting';
    const isConnected = status === 'connected';
    const canConnect = selectedServer && status === 'disconnected';

    return (
        <div className="connection-status">
            <div className={`connection-ring connection-ring--${status}`}>
                <div className="connection-ring__outer" />
                <div className="connection-ring__inner">
                    <span className="connection-ring__icon">{getStatusIcon()}</span>
                    <span className="connection-ring__status">{getStatusText()}</span>
                    {isConnected && selectedServer && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            {selectedServer.name}
                        </span>
                    )}
                </div>
            </div>

            {selectedServer && !isConnected && (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Selected Server</div>
                    <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 18,
                        fontWeight: 600,
                        color: 'var(--neon-blue)',
                        marginTop: 4
                    }}>
                        {selectedServer.name}
                    </div>
                    {selectedCountry && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            {selectedCountry.name}
                        </div>
                    )}
                </div>
            )}

            {!selectedServer && status === 'disconnected' && (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        Select a server from the list to connect
                    </div>
                </div>
            )}

            <button
                className={`connect-button ${isConnected ? 'connect-button--disconnect' :
                        isConnecting ? 'connect-button--connecting' : ''
                    }`}
                onClick={isConnected ? onDisconnect : onConnect}
                disabled={!canConnect && !isConnected}
            >
                {isConnecting ? 'Please wait...' : isConnected ? 'Disconnect' : 'Connect'}
            </button>

            {currentIP && (
                <div className="ip-display">
                    <div className="ip-display__label">Your IP</div>
                    <div className="ip-display__value">{currentIP.ip}</div>
                    {currentIP.information && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {currentIP.information.city}, {currentIP.information.country}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ConnectionStatus;
