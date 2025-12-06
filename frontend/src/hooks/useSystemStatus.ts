import { useState, useEffect } from "react";

const BASE_URL = (typeof process !== "undefined" && process.env && typeof process.env.NEXT_PUBLIC_API_BASE_URL === "string" && process.env.NEXT_PUBLIC_API_BASE_URL.trim())
    ? String(process.env.NEXT_PUBLIC_API_BASE_URL).trim()
    : "http://127.0.0.1:8000";

interface SystemStatus {
    backend: boolean;
    sd: boolean;
    loading: boolean;
}

export function useSystemStatus() {
    const [status, setStatus] = useState<SystemStatus>({
        backend: false,
        sd: false,
        loading: true,
    });

    const checkStatus = async () => {
        let backend = false;
        let sd = false;

        try {
            // 1. Check Backend
            const resBackend = await fetch(`${BASE_URL}/`, { method: 'GET' });
            if (resBackend.ok) {
                backend = true;
                // 2. Check SD (only if backend is up)
                // We use /reforge/options as a lightweight ping for SD connection
                const resSD = await fetch(`${BASE_URL}/reforge/options`, { method: 'GET' });
                if (resSD.ok) {
                    sd = true;
                }
            }
        } catch (error) {
            // Silent fail
        }

        setStatus({ backend, sd, loading: false });
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 30000); // 30s
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return status;
}
