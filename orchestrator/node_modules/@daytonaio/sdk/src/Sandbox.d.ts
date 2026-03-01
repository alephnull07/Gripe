import { SandboxState, SandboxApi, Sandbox as SandboxDto, PaginatedSandboxes as PaginatedSandboxesDto, PortPreviewUrl, SandboxVolume, BuildInfo, SandboxBackupStateEnum, Configuration, SshAccessDto, SshAccessValidationDto, SignedPortPreviewUrl } from '@daytonaio/api-client';
import { Resources } from './Daytona';
import { FileSystem } from './FileSystem';
import { Git } from './Git';
import { CodeRunParams, Process } from './Process';
import { LspLanguageId, LspServer } from './LspServer';
import { ComputerUse } from './ComputerUse';
import { AxiosInstance } from 'axios';
import { CodeInterpreter } from './CodeInterpreter';
/**
 * Interface defining methods that a code toolbox must implement
 * @interface
 */
export interface SandboxCodeToolbox {
    /** Generates a command to run the provided code */
    getRunCommand(code: string, params?: CodeRunParams): string;
}
/**
 * Represents a Daytona Sandbox.
 *
 * @property {FileSystem} fs - File system operations interface
 * @property {Git} git - Git operations interface
 * @property {Process} process - Process execution interface
 * @property {CodeInterpreter} codeInterpreter - Stateful interpreter interface for executing code.
 *   Currently supports only Python. For other languages, use the `process.codeRun` method.
 * @property {ComputerUse} computerUse - Computer use operations interface for desktop automation
 * @property {string} id - Unique identifier for the Sandbox
 * @property {string} organizationId - Organization ID of the Sandbox
 * @property {string} [snapshot] - Daytona snapshot used to create the Sandbox
 * @property {string} user - OS user running in the Sandbox
 * @property {Record<string, string>} env - Environment variables set in the Sandbox
 * @property {Record<string, string>} labels - Custom labels attached to the Sandbox
 * @property {boolean} public - Whether the Sandbox is publicly accessible
 * @property {string} target - Target location of the runner where the Sandbox runs
 * @property {number} cpu - Number of CPUs allocated to the Sandbox
 * @property {number} gpu - Number of GPUs allocated to the Sandbox
 * @property {number} memory - Amount of memory allocated to the Sandbox in GiB
 * @property {number} disk - Amount of disk space allocated to the Sandbox in GiB
 * @property {SandboxState} state - Current state of the Sandbox (e.g., "started", "stopped")
 * @property {string} [errorReason] - Error message if Sandbox is in error state
 * @property {boolean} [recoverable] - Whether the Sandbox error is recoverable.
 * @property {SandboxBackupStateEnum} [backupState] - Current state of Sandbox backup
 * @property {string} [backupCreatedAt] - When the backup was created
 * @property {number} [autoStopInterval] - Auto-stop interval in minutes
 * @property {number} [autoArchiveInterval] - Auto-archive interval in minutes
 * @property {number} [autoDeleteInterval] - Auto-delete interval in minutes
 * @property {Array<SandboxVolume>} [volumes] - Volumes attached to the Sandbox
 * @property {BuildInfo} [buildInfo] - Build information for the Sandbox if it was created from dynamic build
 * @property {string} [createdAt] - When the Sandbox was created
 * @property {string} [updatedAt] - When the Sandbox was last updated
 * @property {boolean} networkBlockAll - Whether to block all network access for the Sandbox
 * @property {string} [networkAllowList] - Comma-separated list of allowed CIDR network addresses for the Sandbox
 *
 * @class
 */
export declare class Sandbox implements SandboxDto {
    private readonly clientConfig;
    private readonly axiosInstance;
    private readonly sandboxApi;
    private readonly codeToolbox;
    readonly fs: FileSystem;
    readonly git: Git;
    readonly process: Process;
    readonly computerUse: ComputerUse;
    readonly codeInterpreter: CodeInterpreter;
    id: string;
    name: string;
    organizationId: string;
    snapshot?: string;
    user: string;
    env: Record<string, string>;
    labels: Record<string, string>;
    public: boolean;
    target: string;
    cpu: number;
    gpu: number;
    memory: number;
    disk: number;
    state?: SandboxState;
    errorReason?: string;
    recoverable?: boolean;
    backupState?: SandboxBackupStateEnum;
    backupCreatedAt?: string;
    autoStopInterval?: number;
    autoArchiveInterval?: number;
    autoDeleteInterval?: number;
    volumes?: Array<SandboxVolume>;
    buildInfo?: BuildInfo;
    createdAt?: string;
    updatedAt?: string;
    networkBlockAll: boolean;
    networkAllowList?: string;
    toolboxProxyUrl: string;
    private infoApi;
    /**
     * Creates a new Sandbox instance
     *
     * @param {SandboxDto} sandboxDto - The API Sandbox instance
     * @param {SandboxApi} sandboxApi - API client for Sandbox operations
     * @param {InfoApi} infoApi - API client for info operations
     * @param {SandboxCodeToolbox} codeToolbox - Language-specific toolbox implementation
     */
    constructor(sandboxDto: SandboxDto, clientConfig: Configuration, axiosInstance: AxiosInstance, sandboxApi: SandboxApi, codeToolbox: SandboxCodeToolbox);
    /**
     * Gets the user's home directory path for the logged in user inside the Sandbox.
     *
     * @returns {Promise<string | undefined>} The absolute path to the Sandbox user's home directory for the logged in user
     *
     * @example
     * const userHomeDir = await sandbox.getUserHomeDir();
     * console.log(`Sandbox user home: ${userHomeDir}`);
     */
    getUserHomeDir(): Promise<string | undefined>;
    /**
     * @deprecated Use `getUserHomeDir` instead. This method will be removed in a future version.
     */
    getUserRootDir(): Promise<string | undefined>;
    /**
     * Gets the working directory path inside the Sandbox.
     *
     * @returns {Promise<string | undefined>} The absolute path to the Sandbox working directory. Uses the WORKDIR specified
     * in the Dockerfile if present, or falling back to the user's home directory if not.
     *
     * @example
     * const workDir = await sandbox.getWorkDir();
     * console.log(`Sandbox working directory: ${workDir}`);
     */
    getWorkDir(): Promise<string | undefined>;
    /**
     * Creates a new Language Server Protocol (LSP) server instance.
     *
     * The LSP server provides language-specific features like code completion,
     * diagnostics, and more.
     *
     * @param {LspLanguageId} languageId - The language server type (e.g., "typescript")
     * @param {string} pathToProject - Path to the project root directory. Relative paths are resolved based on the sandbox working directory.
     * @returns {LspServer} A new LSP server instance configured for the specified language
     *
     * @example
     * const lsp = await sandbox.createLspServer('typescript', 'workspace/project');
     */
    createLspServer(languageId: LspLanguageId | string, pathToProject: string): Promise<LspServer>;
    /**
     * Sets labels for the Sandbox.
     *
     * Labels are key-value pairs that can be used to organize and identify Sandboxes.
     *
     * @param {Record<string, string>} labels - Dictionary of key-value pairs representing Sandbox labels
     * @returns {Promise<void>}
     *
     * @example
     * // Set sandbox labels
     * await sandbox.setLabels({
     *   project: 'my-project',
     *   environment: 'development',
     *   team: 'backend'
     * });
     */
    setLabels(labels: Record<string, string>): Promise<Record<string, string>>;
    /**
     * Start the Sandbox.
     *
     * This method starts the Sandbox and waits for it to be ready.
     *
     * @param {number} [timeout] - Maximum time to wait in seconds. 0 means no timeout.
     *                            Defaults to 60-second timeout.
     * @returns {Promise<void>}
     * @throws {DaytonaError} - `DaytonaError` - If Sandbox fails to start or times out
     *
     * @example
     * const sandbox = await daytona.getCurrentSandbox('my-sandbox');
     * await sandbox.start(40);  // Wait up to 40 seconds
     * console.log('Sandbox started successfully');
     */
    start(timeout?: number): Promise<void>;
    /**
     * Recover the Sandbox from a recoverable error and wait for it to be ready.
     *
     * @param {number} [timeout] - Maximum time to wait in seconds. 0 means no timeout.
     *                            Defaults to 60-second timeout.
     * @returns {Promise<void>}
     * @throws {DaytonaError} - `DaytonaError` - If Sandbox fails to recover or times out
     *
     * @example
     * const sandbox = await daytona.get('my-sandbox-id');
     * await sandbox.recover();
     * console.log('Sandbox recovered successfully');
     */
    recover(timeout?: number): Promise<void>;
    /**
     * Stops the Sandbox.
     *
     * This method stops the Sandbox and waits for it to be fully stopped.
     *
     * @param {number} [timeout] - Maximum time to wait in seconds. 0 means no timeout.
     *                            Defaults to 60-second timeout.
     * @returns {Promise<void>}
     *
     * @example
     * const sandbox = await daytona.get('my-sandbox-id');
     * await sandbox.stop();
     * console.log('Sandbox stopped successfully');
     */
    stop(timeout?: number): Promise<void>;
    /**
     * Deletes the Sandbox.
     * @returns {Promise<void>}
     */
    delete(timeout?: number): Promise<void>;
    /**
     * Waits for the Sandbox to reach the 'started' state.
     *
     * This method polls the Sandbox status until it reaches the 'started' state
     * or encounters an error.
     *
     * @param {number} [timeout] - Maximum time to wait in seconds. 0 means no timeout.
     *                               Defaults to 60 seconds.
     * @returns {Promise<void>}
     * @throws {DaytonaError} - `DaytonaError` - If the sandbox ends up in an error state or fails to start within the timeout period.
     */
    waitUntilStarted(timeout?: number): Promise<void>;
    /**
     * Wait for Sandbox to reach 'stopped' state.
     *
     * This method polls the Sandbox status until it reaches the 'stopped' state
     * or encounters an error.
     *
     * @param {number} [timeout] - Maximum time to wait in seconds. 0 means no timeout.
     *                               Defaults to 60 seconds.
     * @returns {Promise<void>}
     * @throws {DaytonaError} - `DaytonaError` - If the sandbox fails to stop within the timeout period.
     */
    waitUntilStopped(timeout?: number): Promise<void>;
    /**
     * Refreshes the Sandbox data from the API.
     *
     * @returns {Promise<void>}
     *
     * @example
     * await sandbox.refreshData();
     * console.log(`Sandbox ${sandbox.id}:`);
     * console.log(`State: ${sandbox.state}`);
     * console.log(`Resources: ${sandbox.cpu} CPU, ${sandbox.memory} GiB RAM`);
     */
    refreshData(): Promise<void>;
    /**
     * Refreshes the sandbox activity to reset the timer for automated lifecycle management actions.
     *
     * This method updates the sandbox's last activity timestamp without changing its state.
     * It is useful for keeping long-running sessions alive while there is still user activity.
     *
     * @returns {Promise<void>}
     *
     * @example
     * // Keep sandbox activity alive
     * await sandbox.refreshActivity();
     */
    refreshActivity(): Promise<void>;
    /**
     * Set the auto-stop interval for the Sandbox.
     *
     * The Sandbox will automatically stop after being idle (no new events) for the specified interval.
     * Events include any state changes or interactions with the Sandbox through the sdk.
     * Interactions using Sandbox Previews are not included.
     *
     * @param {number} interval - Number of minutes of inactivity before auto-stopping.
     *                           Set to 0 to disable auto-stop. Default is 15 minutes.
     * @returns {Promise<void>}
     * @throws {DaytonaError} - `DaytonaError` - If interval is not a non-negative integer
     *
     * @example
     * // Auto-stop after 1 hour
     * await sandbox.setAutostopInterval(60);
     * // Or disable auto-stop
     * await sandbox.setAutostopInterval(0);
     */
    setAutostopInterval(interval: number): Promise<void>;
    /**
     * Set the auto-archive interval for the Sandbox.
     *
     * The Sandbox will automatically archive after being continuously stopped for the specified interval.
     *
     * @param {number} interval - Number of minutes after which a continuously stopped Sandbox will be auto-archived.
     *                           Set to 0 for the maximum interval. Default is 7 days.
     * @returns {Promise<void>}
     * @throws {DaytonaError} - `DaytonaError` - If interval is not a non-negative integer
     *
     * @example
     * // Auto-archive after 1 hour
     * await sandbox.setAutoArchiveInterval(60);
     * // Or use the maximum interval
     * await sandbox.setAutoArchiveInterval(0);
     */
    setAutoArchiveInterval(interval: number): Promise<void>;
    /**
     * Set the auto-delete interval for the Sandbox.
     *
     * The Sandbox will automatically delete after being continuously stopped for the specified interval.
     *
     * @param {number} interval - Number of minutes after which a continuously stopped Sandbox will be auto-deleted.
     *                           Set to negative value to disable auto-delete. Set to 0 to delete immediately upon stopping.
     *                           By default, auto-delete is disabled.
     * @returns {Promise<void>}
     *
     * @example
     * // Auto-delete after 1 hour
     * await sandbox.setAutoDeleteInterval(60);
     * // Or delete immediately upon stopping
     * await sandbox.setAutoDeleteInterval(0);
     * // Or disable auto-delete
     * await sandbox.setAutoDeleteInterval(-1);
     */
    setAutoDeleteInterval(interval: number): Promise<void>;
    /**
     * Retrieves the preview link for the sandbox at the specified port. If the port is closed,
     * it will be opened automatically. For private sandboxes, a token is included to grant access
     * to the URL.
     *
     * @param {number} port - The port to open the preview link on.
     * @returns {PortPreviewUrl} The response object for the preview link, which includes the `url`
     * and the `token` (to access private sandboxes).
     *
     * @example
     * const previewLink = await sandbox.getPreviewLink(3000);
     * console.log(`Preview URL: ${previewLink.url}`);
     * console.log(`Token: ${previewLink.token}`);
     */
    getPreviewLink(port: number): Promise<PortPreviewUrl>;
    /**
     * Retrieves a signed preview url for the sandbox at the specified port.
     *
     * @param {number} port - The port to open the preview link on.
     * @param {number} [expiresInSeconds] - The number of seconds the signed preview url will be valid for. Defaults to 60 seconds.
     * @returns {Promise<SignedPortPreviewUrl>} The response object for the signed preview url.
     */
    getSignedPreviewUrl(port: number, expiresInSeconds?: number): Promise<SignedPortPreviewUrl>;
    /**
     * Expires a signed preview url for the sandbox at the specified port.
     *
     * @param {number} port - The port to expire the signed preview url on.
     * @param {string} token - The token to expire the signed preview url on.
     * @returns {Promise<void>}
     */
    expireSignedPreviewUrl(port: number, token: string): Promise<void>;
    /**
     * Archives the sandbox, making it inactive and preserving its state. When sandboxes are archived, the entire filesystem
     * state is moved to cost-effective object storage, making it possible to keep sandboxes available for an extended period.
     * The tradeoff between archived and stopped states is that starting an archived sandbox takes more time, depending on its size.
     * Sandbox must be stopped before archiving.
     */
    archive(): Promise<void>;
    /**
     * Resizes the Sandbox resources.
     *
     * Changes the CPU, memory, or disk allocation for the Sandbox. Hot resize (on running
     * sandbox) only allows CPU/memory increases. Disk resize requires a stopped sandbox.
     *
     * @param {Resources} resources - New resource configuration. Only specified fields will be updated.
     *   - cpu: Number of CPU cores (minimum: 1). For hot resize, can only be increased.
     *   - memory: Memory in GiB (minimum: 1). For hot resize, can only be increased.
     *   - disk: Disk space in GiB (can only be increased, requires stopped sandbox).
     * @param {number} [timeout=60] - Timeout in seconds for the resize operation. 0 means no timeout.
     * @returns {Promise<void>}
     * @throws {DaytonaError} - If hot resize constraints are violated, disk resize attempted on running sandbox,
     *   disk size decrease is attempted, no resource changes are specified, or resize operation times out.
     *
     * @example
     * // Increase CPU/memory on running sandbox (hot resize)
     * await sandbox.resize({ cpu: 4, memory: 8 });
     *
     * // Change disk (sandbox must be stopped)
     * await sandbox.stop();
     * await sandbox.resize({ cpu: 2, memory: 4, disk: 30 });
     */
    resize(resources: Resources, timeout?: number): Promise<void>;
    /**
     * Waits for the Sandbox resize operation to complete.
     *
     * This method polls the Sandbox status until the state is no longer 'resizing'.
     *
     * @param {number} [timeout=60] - Maximum time to wait in seconds. 0 means no timeout.
     * @returns {Promise<void>}
     * @throws {DaytonaError} - If the sandbox ends up in an error state or resize times out.
     */
    waitForResizeComplete(timeout?: number): Promise<void>;
    /**
     * Creates an SSH access token for the sandbox.
     *
     * @param {number} expiresInMinutes - The number of minutes the SSH access token will be valid for.
     * @returns {Promise<SshAccessDto>} The SSH access token.
     */
    createSshAccess(expiresInMinutes?: number): Promise<SshAccessDto>;
    /**
     * Revokes an SSH access token for the sandbox.
     *
     * @param {string} token - The token to revoke.
     * @returns {Promise<void>}
     */
    revokeSshAccess(token: string): Promise<void>;
    /**
     * Validates an SSH access token for the sandbox.
     *
     * @param {string} token - The token to validate.
     * @returns {Promise<SshAccessValidationDto>} The SSH access validation result.
     */
    validateSshAccess(token: string): Promise<SshAccessValidationDto>;
    /**
     * Assigns the API sandbox data to the Sandbox object.
     *
     * @param {SandboxDto} sandboxDto - The API sandbox instance to assign data from
     * @returns {void}
     */
    private processSandboxDto;
    /**
     * Refreshes the Sandbox data from the API, but does not throw an error if the sandbox has been deleted.
     * Instead, it sets the state to destroyed.
     *
     * @returns {Promise<void>}
     */
    private refreshDataSafe;
}
export interface PaginatedSandboxes extends Omit<PaginatedSandboxesDto, 'items'> {
    items: Sandbox[];
}
