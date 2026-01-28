import React from 'react';

const TitleBar: React.FC = () => {
    const handleMinimize = () => {
        window.electronAPI.minimizeWindow();
    };

    const handleClose = () => {
        window.electronAPI.closeWindow();
    };

    return (
        <div className="title-bar">
            <div className="title-bar__logo">
                <span>⚡</span>
                <span>masyavpn</span>
            </div>

            <div className="title-bar__controls">
                <button className="title-bar__btn" onClick={handleMinimize}>
                    —
                </button>
                <button className="title-bar__btn title-bar__btn--close" onClick={handleClose}>
                    ✕
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
