import { InterpreterApi, InterpreterContext } from '@daytonaio/toolbox-api-client';
import { Configuration } from '@daytonaio/api-client';
import { ExecutionResult, RunCodeOptions } from './types/CodeInterpreter';
/**
 * Handles Python code interpretation and execution within a Sandbox.
 *
 * Provides methods to execute code (currently only Python) in isolated interpreter contexts,
 * manage contexts, and stream execution output via callbacks.
 *
 * For other languages, use the `codeRun` method from the `Process` interface, or execute the appropriate command directly in the sandbox terminal.
 */
export declare class CodeInterpreter {
    private readonly clientConfig;
    private readonly apiClient;
    private readonly getPreviewToken;
    constructor(clientConfig: Configuration, apiClient: InterpreterApi, getPreviewToken: () => Promise<string>);
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
    runCode(code: string, options?: RunCodeOptions): Promise<ExecutionResult>;
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
    createContext(cwd?: string): Promise<InterpreterContext>;
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
    listContexts(): Promise<InterpreterContext[]>;
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
    deleteContext(context: InterpreterContext): Promise<void>;
    private extractMessageText;
    private normalizeCloseEvent;
    private createCloseError;
}
