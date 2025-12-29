import { useToast } from '../hooks/useToast';

export const ToastContainer = () => {
    const { toasts, hideToast } = useToast();

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`toast toast-${toast.type}`}
                    onClick={() => hideToast(toast.id)}
                >
                    <div className="toast-icon">
                        {toast.type === 'error' && '❌'}
                        {toast.type === 'success' && '✅'}
                        {toast.type === 'warning' && '⚠️'}
                        {toast.type === 'info' && 'ℹ️'}
                    </div>
                    <div className="toast-message">{toast.message}</div>
                    <button className="toast-close" onClick={() => hideToast(toast.id)}>
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
};
