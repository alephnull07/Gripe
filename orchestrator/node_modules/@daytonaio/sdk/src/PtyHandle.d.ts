import WebSocket from 'isomorphic-ws';
import { PtyResult } from './types/Pty';
import { PtySessionInfo } from '@daytonaio/toolbox-api-client';
/**
 * PTY session handle for managing a single PTY session.
 *
 * Provides methods for sending input, resizing the terminal, waiting for completion,
 * and managing the WebSocket connection to a PTY session.
 *
 * @example
 * ```typescript
 * // Create a PTY session
 * const ptyHandle = await process.createPty({
 *   id: 'my-session',
 *   cols: 120,
 *   rows: 30,
 *   onData: (data) => {
 *     const text = new TextDecoder().decode(data);
 *     process.stdout.write(text);
 *   },
 * });
 *
 *
 * // Send commands
 * await ptyHandle.sendInput('ls -la\n');
 * await ptyHandle.sendInput('exit\n');
 *
 * // Wait for completion
 * const result = await ptyHandle.wait();
 * console.log(`PTY exited with code: ${result.exitCode}`);
 *
 * // Clean up
 * await ptyHandle.disconnect();
 * ```
 */
export declare class PtyHandle {
    private readonly ws;
    private readonly handleResize;
    private readonly handleKill;
    private readonly onPty;
    readonly sessionId: string;
    private _exitCode?;
    private _error?;
    private connected;
    private connectionEstablished;
    constructor(ws: WebSocket, handleResize: (cols: number, rows: number) => Promise<PtySessionInfo>, handleKill: () => Promise<void>, onPty: (data: Uint8Array) => void | Promise<void>, sessionId: string);
    /**
     * Exit code of the PTY process (if terminated)
     */
    get exitCode(): number | undefined;
    /**
     * Error message if the PTY failed
     */
    get error(): string | undefined;
    /**
     * Check if connected to the PTY session
     */
    isConnected(): boolean;
    /**
     * Wait for the WebSocket connection to be established.
     *
     * This method ensures the PTY session is ready to receive input and send output.
     * It waits for the server to confirm the connection is established.
     *
     * @throws {Error} If connection times out (10 seconds) or connection fails
     */
    waitForConnection(): Promise<void>;
    /**
     * Send input data to the PTY session.
     *
     * Sends keyboard input or commands to the terminal session. The data will be
     * processed as if it was typed in the terminal.
     *
     * @param {string | Uint8Array} data - Input data to send (commands, keystrokes, etc.)
     * @throws {Error} If PTY is not connected or sending fails
     *
     * @example
     * // Send a command
     * await ptyHandle.sendInput('ls -la\n');
     *
     * // Send raw bytes
     * await ptyHandle.sendInput(new Uint8Array([3])); // Ctrl+C
     */
    sendInput(data: string | Uint8Array): Promise<void>;
    /**
     * Resize the PTY terminal dimensions.
     *
     * Changes the terminal size which will notify terminal applications
     * about the new dimensions via SIGWINCH signal.
     *
     * @param {number} cols - New number of terminal columns
     * @param {number} rows - New number of terminal rows
     *
     * @example
     * // Resize to 120x30
     * await ptyHandle.resize(120, 30);
     */
    resize(cols: number, rows: number): Promise<PtySessionInfo>;
    /**
     * Disconnect from the PTY session and clean up resources.
     *
     * Closes the WebSocket connection and releases any associated resources.
     * Should be called when done with the PTY session.
     *
     * @example
     * // Always clean up when done
     * try {
     *   // ... use PTY session
     * } finally {
     *   await ptyHandle.disconnect();
     * }
     */
    disconnect(): Promise<void>;
    /**
     * Wait for the PTY process to exit and return the result.
     *
     * This method blocks until the PTY process terminates and returns
     * information about how it exited.
     *
     * @returns {Promise<PtyResult>} Result containing exit code and error information
     *
     * @example
     * // Wait for process to complete
     * const result = await ptyHandle.wait();
     *
     * if (result.exitCode === 0) {
     *   console.log('Process completed successfully');
     * } else {
     *   console.log(`Process failed with code: ${result.exitCode}`);
     *   if (result.error) {
     *     console.log(`Error: ${result.error}`);
     *   }
     * }
     */
    wait(): Promise<PtyResult>;
    /**
     * Kill the PTY process and terminate the session.
     *
     * Forcefully terminates the PTY session and its associated process.
     * This operation is irreversible and will cause the PTY to exit immediately.
     *
     * @throws {Error} If the kill operation fails
     *
     * @example
     * // Kill a long-running process
     * await ptyHandle.kill();
     *
     * // Wait to confirm termination
     * const result = await ptyHandle.wait();
     * console.log(`Process terminated with exit code: ${result.exitCode}`);
     */
    kill(): Promise<void>;
    private setupWebSocketHandlers;
}
