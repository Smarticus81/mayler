import React from 'react';

export const BrandHeader: React.FC = () => {
    return (
        <div className="brand">
            <div className="brand-logo-container">
                <span className="brand-m">M</span>
                <span className="brand-ayler">ayler</span>
            </div>
            <p className="brand-tagline">your zen email assistant</p>
        </div>
    );
};
