import WebSocket from 'isomorphic-ws';
/**
 * Creates an authenticated WebSocket connection to the sandbox toolbox.
 *
 * @param url - The websocket URL (ws[s]://...)
 * @param headers - Headers to forward when running in Node environments
 * @param getPreviewToken - Lazy getter for preview tokens (required for browser/serverless runtimes)
 */
export declare function createSandboxWebSocket(url: string, headers: Record<string, any>, getPreviewToken: () => Promise<string>): Promise<WebSocket>;
