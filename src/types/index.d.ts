export type StarlingOptions = {
    url: string | URL;
    protocols?: string[];
    timeout: number;
    requestTimeout: number;
    parseMode: 'strict' | 'permissive' | 'passthrough';

}