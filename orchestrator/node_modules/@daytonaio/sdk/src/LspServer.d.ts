import { CompletionList, LspSymbol, LspApi } from '@daytonaio/toolbox-api-client';
/**
 * Supported language server types.
 */
export declare enum LspLanguageId {
    PYTHON = "python",
    TYPESCRIPT = "typescript",
    JAVASCRIPT = "javascript"
}
/**
 * Represents a zero-based position within a text document,
 * specified by line number and character offset.
 *
 * @interface
 * @property {number} line - Zero-based line number in the document
 * @property {number} character - Zero-based character offset on the line
 *
 * @example
 * const position: Position = {
 *   line: 10,     // Line 11 (zero-based)
 *   character: 15  // Character 16 on the line (zero-based)
 * };
 */
export type Position = {
    /** Zero-based line number */
    line: number;
    /** Zero-based character offset */
    character: number;
};
/**
 * Provides Language Server Protocol functionality for code intelligence to provide
 * IDE-like features such as code completion, symbol search, and more.
 *
 * @property {LspLanguageId} languageId - The language server type (e.g., "typescript")
 * @property {string} pathToProject - Path to the project root directory. Relative paths are resolved based on the sandbox working directory.
 * @property {LspApi} apiClient - API client for Sandbox lsp operations
 * @property {SandboxInstance} instance - The Sandbox instance this server belongs to
 *
 * @class
 */
export declare class LspServer {
    private readonly languageId;
    private readonly pathToProject;
    private readonly apiClient;
    constructor(languageId: LspLanguageId, pathToProject: string, apiClient: LspApi);
    /**
     * Starts the language server, must be called before using any other LSP functionality.
     * It initializes the language server for the specified language and project.
     *
     * @returns {Promise<void>}
     *
     * @example
     * const lsp = await sandbox.createLspServer('typescript', 'workspace/project');
     * await lsp.start();  // Initialize the server
     * // Now ready for LSP operations
     */
    start(): Promise<void>;
    /**
     * Stops the language server, should be called when the LSP server is no longer needed to
     * free up system resources.
     *
     * @returns {Promise<void>}
     *
     * @example
     * // When done with LSP features
     * await lsp.stop();  // Clean up resources
     */
    stop(): Promise<void>;
    /**
     * Notifies the language server that a file has been opened, enabling
     * language features like diagnostics and completions for that file. The server
     * will begin tracking the file's contents and providing language features.
     *
     * @param {string} path - Path to the opened file. Relative paths are resolved based on the sandbox working directory.
     * @returns {Promise<void>}
     *
     * @example
     * // When opening a file for editing
     * await lsp.didOpen('workspace/project/src/index.ts');
     * // Now can get completions, symbols, etc. for this file
     */
    didOpen(path: string): Promise<void>;
    /**
     * Notifies the language server that a file has been closed, should be called when a file is closed
     * in the editor to allow the language server to clean up any resources associated with that file.
     *
     * @param {string} path - Path to the closed file. Relative paths are resolved based on the project path
     * set in the LSP server constructor.
     * @returns {Promise<void>}
     *
     * @example
     * // When done editing a file
     * await lsp.didClose('workspace/project/src/index.ts');
     */
    didClose(path: string): Promise<void>;
    /**
     * Get symbol information (functions, classes, variables, etc.) from a document.
     *
     * @param {string} path - Path to the file to get symbols from. Relative paths are resolved based on the project path
     * set in the LSP server constructor.
     * @returns {Promise<LspSymbol[]>} List of symbols in the document. Each symbol includes:
     *                                 - name: The symbol's name
     *                                 - kind: The symbol's kind (function, class, variable, etc.)
     *                                 - location: The location of the symbol in the file
     *
     * @example
     * // Get all symbols in a file
     * const symbols = await lsp.documentSymbols('workspace/project/src/index.ts');
     * symbols.forEach(symbol => {
     *   console.log(`${symbol.kind} ${symbol.name}: ${symbol.location}`);
     * });
     */
    documentSymbols(path: string): Promise<LspSymbol[]>;
    /**
     * Searches for symbols matching the query string across the entire Sandbox.
     *
     * @param {string} query - Search query to match against symbol names
     * @returns {Promise<LspSymbol[]>} List of matching symbols from all files. Each symbol includes:
     *                                 - name: The symbol's name
     *                                 - kind: The symbol's kind (function, class, variable, etc.)
     *                                 - location: The location of the symbol in the file
     *
     * @deprecated Use `sandboxSymbols` instead. This method will be removed in a future version.
     */
    workspaceSymbols(query: string): Promise<LspSymbol[]>;
    /**
     * Searches for symbols matching the query string across the entire Sandbox.
     *
     * @param {string} query - Search query to match against symbol names
     * @returns {Promise<LspSymbol[]>} List of matching symbols from all files. Each symbol includes:
     *                                 - name: The symbol's name
     *                                 - kind: The symbol's kind (function, class, variable, etc.)
     *                                 - location: The location of the symbol in the file
     *
     * @example
     * // Search for all symbols containing "User"
     * const symbols = await lsp.sandboxSymbols('User');
     * symbols.forEach(symbol => {
     *   console.log(`${symbol.name} (${symbol.kind}) in ${symbol.location}`);
     * });
     */
    sandboxSymbols(query: string): Promise<LspSymbol[]>;
    /**
     * Gets completion suggestions at a position in a file.
     *
     * @param {string} path - Path to the file. Relative paths are resolved based on the project path
     * set in the LSP server constructor.
     * @param {Position} position - The position in the file where completion was requested
     * @returns {Promise<CompletionList>} List of completion suggestions. The list includes:
     *                                    - isIncomplete: Whether more items might be available
     *                                    - items: List of completion items, each containing:
     *                                      - label: The text to insert
     *                                      - kind: The kind of completion
     *                                      - detail: Additional details about the item
     *                                      - documentation: Documentation for the item
     *                                      - sortText: Text used to sort the item in the list
     *                                      - filterText: Text used to filter the item
     *                                      - insertText: The actual text to insert (if different from label)
     *
     * @example
     * // Get completions at a specific position
     * const completions = await lsp.completions('workspace/project/src/index.ts', {
     *   line: 10,
     *   character: 15
     * });
     * completions.items.forEach(item => {
     *   console.log(`${item.label} (${item.kind}): ${item.detail}`);
     * });
     */
    completions(path: string, position: Position): Promise<CompletionList>;
}
