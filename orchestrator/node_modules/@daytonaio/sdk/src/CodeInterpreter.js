"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeInterpreter = void 0;
const tslib_1 = require("tslib");
/**
 * @module code-interpreter
 */
const isomorphic_ws_1 = tslib_1.__importDefault(require("isomorphic-ws"));
const DaytonaError_1 = require("./errors/DaytonaError");
const WebSocket_1 = require("./utils/WebSocket");
const WEBSOCKET_TIMEOUT_CODE = 4008;
/**
 * Handles Python code interpretation and execution within a Sandbox.
 *
 * Provides methods to execute code (currently only Python) in isolated interpreter contexts,
 * manage contexts, and stream execution output via callbacks.
 *
 * For other languages, use the `codeRun` method from the `Process` interface, or execute the appropriate command directly in the sandbox terminal.
 */
class CodeInterpreter {
    clientConfig;
    apiClient;
    getPreviewToken;
    constructor(clientConfig, apiClient, getPreviewToken) {
        this.clientConfig = clientConfig;
        this.apiClient = apiClient;
        this.getPreviewToken = getPreviewToken;
    }
    /**
     * Run Python code in the sandbox.
     *
     * @param {string} code - Code to run.
     * @param {RunCodeOptions} options - Execution options (context, envs, callbacks, timeout).
     * @returns {Promise<ExecutionResult>} ExecutionResult containing stdout, stderr and optional error info.
     *
     * @example
     * ```ts
     * const handleStdout = (msg: OutputMessage) => process.stdout.write(`STDOUT: ${msg.output}`)
     * const handleStderr = (msg: OutputMessage) => process.stdout.write(`STDERR: ${msg.output}`)
     * const handleError = (err: ExecutionError) =>
     *   console.error(`ERROR: ${err.name}: ${err.value}\n${err.traceback ?? ''}`)
     *
     * const code = `
     * import sys
     * import time
     * for i in range(5):
     *     print(i)
     *     time.sleep(1)
     * sys.stderr.write("Counting done!")
     * `
     *
     * const result = await codeInterpreter.runCode(code, {
     *   onStdout: handleStdout,
     *   onStderr: handleStderr,
     *   onError: handleError,
     *   timeout: 10,
     * })
     * ```
     */
    async runCode(code, options = {}) {
        if (!code || !code.trim()) {
            throw new DaytonaError_1.DaytonaError('Code is required for execution');
        }
        const url = `${this.clientConfig.basePath.replace(/^http/, 'ws')}/process/interpreter/execute`;
        const ws = await (0, WebSocket_1.createSandboxWebSocket)(url, this.clientConfig.baseOptions?.headers || {}, this.getPreviewToken);
        const result = { stdout: '', stderr: '' };
        return new Promise((resolve, reject) => {
            let settled = false;
            const cleanup = () => {
                detach();
                try {
                    if (ws.readyState === isomorphic_ws_1.default.OPEN || ws.readyState === isomorphic_ws_1.default.CONNECTING) {
                        ws.close();
                    }
                }
                catch {
                    /* ignore */
                }
            };
            const fail = (error) => {
                if (settled)
                    return;
                settled = true;
                cleanup();
                reject(error);
            };
            const succeed = () => {
                if (settled)
                    return;
                settled = true;
                cleanup();
                resolve(result);
            };
            const handleOpen = () => {
                const payload = { code };
                const context = options.context;
                if (context?.id) {
                    payload.contextId = context.id;
                }
                if (options.envs) {
                    payload.envs = options.envs;
                }
                payload.timeout = options.timeout;
                ws.send(JSON.stringify(payload));
            };
            const handleMessage = async (event) => {
                try {
                    const text = await this.extractMessageText(event);
                    if (!text) {
                        return;
                    }
                    const chunk = JSON.parse(text);
                    const chunkType = chunk.type;
                    if (chunkType === 'stdout') {
                        const stdout = chunk.text ?? '';
                        result.stdout += stdout;
                        if (options.onStdout) {
                            await options.onStdout({ output: stdout });
                        }
                    }
                    else if (chunkType === 'stderr') {
                        const stderr = chunk.text ?? '';
                        result.stderr += stderr;
                        if (options.onStderr) {
                            await options.onStderr({ output: stderr });
                        }
                    }
                    else if (chunkType === 'error') {
                        const error = {
                            name: chunk.name ?? '',
                            value: chunk.value ?? '',
                            traceback: chunk.traceback ?? '',
                        };
                        result.error = error;
                        if (options.onError) {
                            await options.onError(error);
                        }
                    }
                    else if (chunkType === 'control') {
                        const controlText = chunk.text ?? '';
                        if (controlText === 'completed' || controlText === 'interrupted') {
                            succeed();
                        }
                    }
                }
                catch {
                    // Ignore invalid JSON payloads
                }
            };
            const handleClose = (event, reason) => {
                if (settled)
                    return;
                const { code, message } = this.normalizeCloseEvent(event, reason);
                if (code !== 1000 && code !== 1001) {
                    fail(this.createCloseError(code, message));
                    return;
                }
                succeed();
            };
            const handleError = (error) => {
                fail(new DaytonaError_1.DaytonaError(`Failed to execute code: ${error.message ?? String(error)}`));
            };
            const detach = () => {
                if ('removeEventListener' in ws) {
                    ws.removeEventListener('open', handleOpen);
                    ws.removeEventListener('message', handleMessage);
                    ws.removeEventListener('close', handleClose);
                    ws.removeEventListener('error', handleError);
                }
                if ('off' in ws) {
                    ;
                    ws.off('open', handleOpen);
                    ws.off('message', handleMessage);
                    ws.off('close', handleClose);
                    ws.off('error', handleError);
                }
                else if ('removeListener' in ws) {
                    ;
                    ws.removeListener('open', handleOpen);
                    ws.removeListener('message', handleMessage);
                    ws.removeListener('close', handleClose);
                    ws.removeListener('error', handleError);
                }
            };
            if ('addEventListener' in ws) {
                ws.addEventListener('open', handleOpen);
                ws.addEventListener('message', handleMessage);
                ws.addEventListener('close', handleClose);
                ws.addEventListener('error', handleError);
            }
            else if ('on' in ws) {
                ;
                ws.on('open', handleOpen);
                ws.on('message', handleMessage);
                ws.on('close', handleClose);
                ws.on('error', handleError);
            }
            else {
                throw new DaytonaError_1.DaytonaError('Unsupported WebSocket implementation');
            }
        });
    }
    /**
     * Create a new isolated interpreter context.
     *
     * @param {string} [cwd] - Working directory for the context. Uses sandbox working directory if omitted.
     *
     * @returns {Promise<InterpreterContext>} The created context.
     *
     * @example
     * ```ts
     * const ctx = await sandbox.codeInterpreter.createContext()
     * await sandbox.codeInterpreter.runCode('x = 10', { context: ctx })
     * await sandbox.codeInterpreter.deleteContext(ctx.id!)
     * ```
     */
    async createContext(cwd) {
        return (await this.apiClient.createInterpreterContext({ cwd })).data;
    }
    /**
     * List all user-created interpreter contexts (default context is excluded).
     *
     * @returns {Promise<InterpreterContext[]>} List of contexts.
     *
     * @example
     * ```ts
     * const contexts = await sandbox.codeInterpreter.listContexts()
     * for (const ctx of contexts) {
     *   console.log(ctx.id, ctx.language, ctx.cwd)
     * }
     * ```
     */
    async listContexts() {
        return (await this.apiClient.listInterpreterContexts()).data.contexts ?? [];
    }
    /**
     * Delete an interpreter context and shut down its worker process.
     *
     * @param {InterpreterContext} context - Context to delete.
     *
     * @example
     * ```ts
     * const ctx = await sandbox.codeInterpreter.createContext()
     * // ... use context ...
     * await sandbox.codeInterpreter.deleteContext(ctx)
     * ```
     */
    async deleteContext(context) {
        await this.apiClient.deleteInterpreterContext(context.id);
    }
    async extractMessageText(event) {
        const data = event && typeof event === 'object' && 'data' in event ? event.data : event;
        if (typeof data === 'string') {
            return data;
        }
        if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) {
            return new TextDecoder('utf-8').decode(new Uint8Array(data));
        }
        if (typeof Blob !== 'undefined' && data instanceof Blob) {
            return await data.text();
        }
        if (ArrayBuffer.isView(data)) {
            return new TextDecoder('utf-8').decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
        }
        if (data == null) {
            return '';
        }
        return data.toString();
    }
    normalizeCloseEvent(event, reason) {
        if (typeof event === 'number') {
            return {
                code: event,
                message: reason ? reason.toString('utf-8') : '',
            };
        }
        return {
            code: event.code,
            message: event.reason,
        };
    }
    createCloseError(code, message) {
        if (code === WEBSOCKET_TIMEOUT_CODE) {
            return new DaytonaError_1.DaytonaTimeoutError('Execution timed out: operation exceeded the configured `timeout`. Provide a larger value if needed.');
        }
        if (message) {
            return new DaytonaError_1.DaytonaError(message + ` (close code ${code})`);
        }
        return new DaytonaError_1.DaytonaError(`Code execution failed: WebSocket closed with code ${code}`);
    }
}
exports.CodeInterpreter = CodeInterpreter;
//# sourceMappingURL=CodeInterpreter.js.map