import React, { useRef, useState, useCallback } from 'react';

interface CameraCaptureProps {
    onCapture: (images: string[]) => void;
    onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [captures, setCaptures] = useState<string[]>([]);
    const [isActive, setIsActive] = useState(false);

    const startCamera = useCallback(async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera on mobile
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setStream(mediaStream);
            setIsActive(true);
        } catch (error) {
            console.error('Failed to start camera:', error);
            alert('Could not access camera. Please check permissions.');
        }
    }, []);

    const captureImage = useCallback(() => {
        if (!videoRef.current) return;

        const canvas = document.createElement('canvas');
        const video = videoRef.current;

        // Set canvas size to video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw current video frame
        ctx.drawImage(video, 0, 0);

        // Compress and convert to base64
        const maxDim = 1024; // Max dimension for cost optimization
        const scale = Math.min(maxDim / canvas.width, maxDim / canvas.height, 1);

        if (scale < 1) {
            const scaledCanvas = document.createElement('canvas');
            scaledCanvas.width = canvas.width * scale;
            scaledCanvas.height = canvas.height * scale;
            const scaledCtx = scaledCanvas.getContext('2d');
            scaledCtx?.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
            const base64 = scaledCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            setCaptures([...captures, base64]);
        } else {
            const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            setCaptures([...captures, base64]);
        }
    }, [captures]);

    const removeCapture = useCallback((index: number) => {
        setCaptures(captures.filter((_, i) => i !== index));
    }, [captures]);

    const stopCamera = useCallback(() => {
        stream?.getTracks().forEach(track => track.stop());
        setStream(null);
        setIsActive(false);
    }, [stream]);

    const handleAnalyze = useCallback(() => {
        if (captures.length === 0) {
            alert('Please capture at least one image');
            return;
        }
        stopCamera();
        onCapture(captures);
    }, [captures, stopCamera, onCapture]);

    const handleClose = useCallback(() => {
        stopCamera();
        onClose();
    }, [stopCamera, onClose]);

    return (
        <div className="camera-capture-modal">
            <div className="camera-capture-overlay" onClick={handleClose} />
            <div className="camera-capture-content">
                <div className="camera-header">
                    <h3>📸 Capture Documents</h3>
                    <button className="close-btn" onClick={handleClose}>✕</button>
                </div>

                {!isActive && (
                    <div className="camera-start">
                        <button className="primary-btn" onClick={startCamera}>
                            Start Camera
                        </button>
                    </div>
                )}

                {isActive && (
                    <>
                        <div className="camera-view">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                            />
                        </div>

                        <div className="camera-controls">
                            <button className="capture-btn" onClick={captureImage}>
                                📷 Capture
                            </button>
                            <button className="secondary-btn" onClick={stopCamera}>
                                Stop Camera
                            </button>
                        </div>
                    </>
                )}

                {captures.length > 0 && (
                    <div className="captures-preview">
                        <h4>Captured Images ({captures.length})</h4>
                        <div className="captures-grid">
                            {captures.map((capture, index) => (
                                <div key={index} className="capture-item">
                                    <img src={`data:image/jpeg;base64,${capture}`} alt={`Capture ${index + 1}`} />
                                    <button
                                        className="remove-btn"
                                        onClick={() => removeCapture(index)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button className="primary-btn analyze-btn" onClick={handleAnalyze}>
                            🔍 Analyze {captures.length} Image{captures.length > 1 ? 's' : ''}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
