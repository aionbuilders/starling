export type SessionRecoveryOptions = {
    enabled?: boolean;
    autoRecover?: boolean;
    storage?: {
        save: (token: string) => Promise<void>;
        load: () => Promise<string | null>;
        clear: () => Promise<void>;
    };
};

export type StarlingOptions = {
    url: string | URL;
    protocols?: string[];
    timeout: number;
    requestTimeout: number;
    parseMode: 'strict' | 'permissive' | 'passthrough';
    sessionRecovery?: SessionRecoveryOptions;
}