import React from 'react';

export const BrandHeader: React.FC = () => {
    return (
        <div className="brand">
            <img src="/mayler-logo.png" alt="Mayler" className="brand-logo" />
            <h1 className="brand-name">mayler</h1>
            <p className="brand-tagline">your zen email assistant</p>
        </div>
    );
};
