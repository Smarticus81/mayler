import { useCallback } from 'react';
import { useMayler } from '../context/MaylerContext';

export const useAuth = () => {
    const { setGoogleStatus, setError } = useMayler();

    const checkGoogleStatus = useCallback(async () => {
        try {
            const response = await fetch('/api/status');
            if (response.ok) {
                const data = await response.json();
                setGoogleStatus(data.gmail ? 'available' : 'unavailable');
            }
        } catch {
            setGoogleStatus('unknown');
        }
    }, [setGoogleStatus]);

    const triggerGoogleAuth = useCallback(async () => {
        try {
            const response = await fetch('/api/gmail/auth-url');
            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Failed to initiate Google authentication');
                return;
            }

            if (data.authUrl) {
                const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                    (window.navigator as any).standalone === true;

                if (isStandalone) {
                    window.location.href = data.authUrl;
                    return;
                }

                const width = 600;
                const height = 700;
                const left = window.screenX + (window.outerWidth - width) / 2;
                const top = window.screenY + (window.outerHeight - height) / 2;

                window.open(
                    data.authUrl,
                    'Google Authentication',
                    `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
                );
            }
        } catch (error) {
            console.error('Error triggering Google auth:', error);
            setError('Failed to initiate Google authentication');
        }
    }, [setError]);

    return {
        checkGoogleStatus,
        triggerGoogleAuth,
    };
};
