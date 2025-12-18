import React from 'react';
import { MaylerProvider } from './context/MaylerContext';
import { MainLayout } from './layout/MainLayout';

const App: React.FC = () => {
    return (
        <MaylerProvider>
            <MainLayout />
        </MaylerProvider>
    );
};

export default App;
