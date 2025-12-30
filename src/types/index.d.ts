export type SessionRecoveryOptions = {
    enabled?: boolean;
    autoRecover?: boolean;
    autoRefresh?: boolean;
    refreshInterval?: number | null;
    storage?: {
        save: (token: string) => Promise<void>;
        load: () => Promise<string | null>;
        clear: () => Promise<void>;
    };
};

export type HealthCheckOptions = {
    enabled?: boolean;
    onPing?: () => void;
};

export type StarlingOptions = {
    url: string | URL;
    protocols?: string[];
    timeout: number;
    requestTimeout: number;
    parseMode: 'strict' | 'permissive' | 'passthrough';
    sessionRecovery?: SessionRecoveryOptions;
    healthCheck?: HealthCheckOptions;
}