import { useCallback, useEffect, useRef, useState } from 'react';

interface UsePollingOptions {
    intervalMs: number;
    cacheTtlMs: number;
    enabled?: boolean;
}

interface UsePollingResult<T> {
    data: T | null;
    error: string | null;
    isLoading: boolean;
    isFallback: boolean;
    refresh: () => void;
}

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function isFallbackSource(data: unknown): boolean {
    if (data && typeof data === 'object' && 'source' in data) {
        return (data as { source?: string }).source === 'live_failed_fallback_mock';
    }
    return false;
}

export function usePolling<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: UsePollingOptions,
): UsePollingResult<T> {
    const { intervalMs, cacheTtlMs, enabled = true } = options;
    const [data, setData] = useState<T | null>(() => {
        const entry = cache.get(key) as CacheEntry<T> | undefined;
        if (entry && Date.now() - entry.timestamp < cacheTtlMs) {
            return entry.data;
        }
        return null;
    });
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(!data);
    const [isFallback, setIsFallback] = useState(false);
    const activeRef = useRef(true);
    const inFlightRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const doFetch = useCallback(async () => {
        if (!activeRef.current || inFlightRef.current) return;

        inFlightRef.current = true;

        try {
            const result = await fetcher();
            if (!activeRef.current) return;

            cache.set(key, { data: result, timestamp: Date.now() });
            setData(result);
            setError(null);
            setIsFallback(isFallbackSource(result));
            setIsLoading(false);
        } catch (err) {
            if (!activeRef.current) return;

            const msg = err instanceof Error ? err.message : 'Unknown error';
            setError(msg);
            setIsLoading(false);

            // Keep stale data from cache if available
            const entry = cache.get(key) as CacheEntry<T> | undefined;
            if (entry) {
                setData(entry.data);
                setIsFallback(true);
            }
        } finally {
            inFlightRef.current = false;
        }
    }, [key, fetcher]);

    useEffect(() => {
        activeRef.current = true;

        if (!enabled) {
            return () => { activeRef.current = false; };
        }

        // Initial fetch
        void doFetch();

        // Set up polling interval
        timerRef.current = setInterval(() => {
            void doFetch();
        }, intervalMs);

        return () => {
            activeRef.current = false;
            inFlightRef.current = false;
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [doFetch, intervalMs, enabled]);

    const refresh = useCallback(() => {
        cache.delete(key);
        setIsLoading(true);
        void doFetch();
    }, [key, doFetch]);

    return { data, error, isLoading, isFallback, refresh };
}
