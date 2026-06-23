import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ICONS } from '../../constants';

interface CameraScannerProps {
    onResult: (text: string) => void;
    onClose: () => void;
}

type ScanState = 'idle' | 'scanning' | 'success' | 'error';

const CameraScanner: React.FC<CameraScannerProps> = ({ onResult, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const readerRef = useRef<any>(null);
    const [scanState, setScanState] = useState<ScanState>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [lastResult, setLastResult] = useState('');
    const [cameras, setCameras] = useState<{ deviceId: string; label: string }[]>([]);
    const [selectedCamera, setSelectedCamera] = useState('');

    const stopScanner = useCallback(() => {
        if (readerRef.current) {
            try { readerRef.current.reset(); } catch (_) {}
            readerRef.current = null;
        }
    }, []);

    const startScanner = useCallback(async (deviceId?: string) => {
        if (!videoRef.current) return;
        setScanState('scanning');
        setErrorMsg('');

        try {
            const { BrowserMultiFormatReader } = await import('@zxing/browser');
            stopScanner();
            const reader = new BrowserMultiFormatReader();
            readerRef.current = reader;

            reader.decodeFromVideoDevice(
                deviceId || undefined,
                videoRef.current,
                (result, err) => {
                    if (result) {
                        const text = result.getText();
                        setLastResult(text);
                        setScanState('success');
                        stopScanner();
                        onResult(text);
                    } else if (err && !err.message?.includes('No MultiFormat Readers')) {
                        // Non-fatal scan errors (nothing in frame) are normal — ignore them
                    }
                }
            );
        } catch (err: any) {
            setScanState('error');
            if (err.name === 'NotAllowedError') {
                setErrorMsg('Camera permission denied. Please allow camera access and try again.');
            } else if (err.name === 'NotFoundError') {
                setErrorMsg('No camera found on this device.');
            } else {
                setErrorMsg(err.message || 'Failed to start camera.');
            }
        }
    }, [onResult, stopScanner]);

    useEffect(() => {
        // Enumerate cameras on mount
        (async () => {
            try {
                const { BrowserMultiFormatReader } = await import('@zxing/browser');
                const devices = await BrowserMultiFormatReader.listVideoInputDevices();
                const mapped = devices.map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 6)}` }));
                setCameras(mapped);
                if (mapped.length > 0) setSelectedCamera(mapped[0].deviceId);
            } catch (_) {}
        })();

        startScanner();

        return () => { stopScanner(); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCameraChange = (deviceId: string) => {
        setSelectedCamera(deviceId);
        startScanner(deviceId);
    };

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="QR / Barcode Scanner"
        >
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <ICONS.QrCode className="w-5 h-5 text-blue-600" />
                        <h3 className="font-bold text-slate-800 dark:text-white">Scan QR / Barcode</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close scanner"
                        className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ICONS.X className="w-5 h-5" />
                    </button>
                </div>

                {/* Viewfinder */}
                <div className="relative bg-black aspect-[4/3] w-full overflow-hidden">
                    <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        autoPlay
                        muted
                        playsInline
                    />

                    {/* Aiming reticle */}
                    {scanState === 'scanning' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="relative w-48 h-48">
                                <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                                <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                                <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                                <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                                <span className="absolute inset-x-0 top-1/2 h-0.5 bg-blue-400/60 animate-pulse" />
                            </div>
                        </div>
                    )}

                    {/* Error overlay */}
                    {scanState === 'error' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 p-6 text-center">
                            <ICONS.AlertCircle className="w-12 h-12 text-red-400 mb-3" />
                            <p className="text-white text-sm">{errorMsg}</p>
                            <button
                                type="button"
                                onClick={() => startScanner(selectedCamera)}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* Success flash */}
                    {scanState === 'success' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-950/80 p-6 text-center">
                            <ICONS.CheckCircle className="w-14 h-14 text-green-400 mb-3" />
                            <p className="text-white text-sm font-semibold">Scanned successfully</p>
                            <p className="text-green-300 text-xs mt-1 font-mono break-all max-w-xs">{lastResult}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 space-y-3">
                    {cameras.length > 1 && (
                        <select
                            value={selectedCamera}
                            onChange={e => handleCameraChange(e.target.value)}
                            title="Select camera"
                            className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 dark:text-white"
                        >
                            {cameras.map(c => (
                                <option key={c.deviceId} value={c.deviceId}>{c.label}</option>
                            ))}
                        </select>
                    )}
                    <p className="text-xs text-center text-slate-400">
                        Hold a QR code or barcode in front of the camera
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CameraScanner;
