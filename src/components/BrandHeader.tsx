import React from 'react';

export const BrandHeader: React.FC = () => {
    return (
        <div className="brand">
            <div className="brand-logo-container">
                <svg viewBox="0 0 200 60" className="brand-svg" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#A8B5A0" />
                            <stop offset="100%" stopColor="#8A9A85" />
                        </linearGradient>
                    </defs>
                    {/* Zen Envelope Icon */}
                    <path
                        d="M40,25 
                           L55,38 
                           L70,25 
                           M40,25 
                           v22 
                           c0,4 3,6 6,6 
                           h18 
                           c3,0 6,-2 6,-6 
                           v-22 
                           M40,25 
                           L55,15 
                           L70,25"
                        fill="none"
                        stroke="url(#logoGradient)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        transform="translate(10, 2)"
                    />
                </svg>
                <div className="brand-text-container">
                    <span className="brand-m">m</span>
                    <span className="brand-ayler">ayler</span>
                </div>
            </div>
            <p className="brand-tagline">your zen email assistant</p>
        </div>
    );
};
