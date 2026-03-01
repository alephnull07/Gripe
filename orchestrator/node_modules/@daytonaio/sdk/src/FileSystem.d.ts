import { Configuration, FileInfo, Match, ReplaceResult, SearchFilesResponse } from '@daytonaio/toolbox-api-client';
import { FileSystemApi } from '@daytonaio/toolbox-api-client';
/**
 * Parameters for setting file permissions in the Sandbox.
 *
 * @interface
 * @property {string} [mode] - File mode/permissions in octal format (e.g. "644")
 * @property {string} [owner] - User owner of the file
 * @property {string} [group] - Group owner of the file
 *
 * @example
 * const permissions: FilePermissionsParams = {
 *   mode: '644',
 *   owner: 'daytona',
 *   group: 'users'
 * };
 */
export type FilePermissionsParams = {
    /** Group owner of the file */
    group?: string;
    /** File mode/permissions in octal format (e.g. "644") */
    mode?: string;
    /** User owner of the file */
    owner?: string;
};
/**
 * Represents a file to be uploaded to the Sandbox.
 *
 * @interface
 * @property {string | Buffer} source - File to upload. If a Buffer, it is interpreted as the file content which is loaded into memory.
 * Make sure it fits into memory, otherwise use the local file path which content will be streamed to the Sandbox.
 * @property {string} destination - Absolute destination path in the Sandbox. Relative paths are resolved based on the sandbox working directory.
 */
export interface FileUpload {
    source: string | Buffer;
    destination: string;
}
/**
 * Represents a request to download a single file from the Sandbox.
 *
 * @interface
 * @property {string} source - Source path in the Sandbox. Relative paths are resolved based on the user's
 * root directory.
 * @property {string} [destination] - Destination path in the local filesystem where the file content will be
 * streamed to. If not provided, the file will be downloaded in the bytes buffer (might cause memory issues if the file is large).
 */
export interface FileDownloadRequest {
    source: string;
    destination?: string;
}
/**
 * Represents the response to a single file download request.
 *
 * @interface
 * @property {string} source - The original source path requested for download.
 * @property {Buffer | string | undefined} [result] - The download result - file path (if destination provided in the request)
 * or bytes content (if no destination in the request), undefined if failed or no data received.
 * @property {string | undefined} [error] - Error message if the download failed, undefined if successful.
 */
export interface FileDownloadResponse {
    source: string;
    result?: Buffer | string;
    error?: string;
}
/**
 * Represents metadata for a file download operation.
 *
 * @interface
 * @property {string | undefined} [destination] - Destination path in the local filesystem where the file content will be streamed to.
 * @property {string | undefined} [error] - Error message if the download failed, undefined if successful.
 * @property {Buffer | string | Uint8Array | undefined} [result] - The download result - file path (if destination provided in the request)
 * or bytes content (if no destination in the request), undefined if failed or no data received.
 */
export interface DownloadMetadata {
    destination?: string;
    error?: string;
    result?: Buffer | string | Uint8Array;
}
/**
 * Provides file system operations within a Sandbox.
 *
 * @class
 */
export declare class FileSystem {
    private readonly clientConfig;
    private readonly apiClient;
    constructor(clientConfig: Configuration, apiClient: FileSystemApi);
    /**
     * Create a new directory in the Sandbox with specified permissions.
     *
     * @param {string} path - Path where the directory should be created. Relative paths are resolved based on the sandbox working directory.
     * @param {string} mode - Directory permissions in octal format (e.g. "755")
     * @returns {Promise<void>}
     *
     * @example
     * // Create a directory with standard permissions
     * await fs.createFolder('app/data', '755');
     */
    createFolder(path: string, mode: string): Promise<void>;
    /**
     * Deletes a file or directory from the Sandbox.
     *
     * @param {string} path - Path to the file or directory to delete. Relative paths are resolved based on the sandbox working directory.
     * @param {boolean} [recursive] - If the file is a directory, this must be true to delete it.
     * @returns {Promise<void>}
     *
     * @example
     * // Delete a file
     * await fs.deleteFile('app/temp.log');
     */
    deleteFile(path: string, recursive?: boolean): Promise<void>;
    /**
     * Downloads a file from the Sandbox. This method loads the entire file into memory, so it is not recommended
     * for downloading large files.
     *
     * @param {string} remotePath - Path to the file to download. Relative paths are resolved based on the sandbox working directory.
     * @param {number} [timeout] - Timeout for the download operation in seconds. 0 means no timeout.
     * Default is 30 minutes.
     * @returns {Promise<Buffer>} The file contents as a Buffer.
     *
     * @example
     * // Download and process a file
     * const fileBuffer = await fs.downloadFile('tmp/data.json');
     * console.log('File content:', fileBuffer.toString());
     */
    downloadFile(remotePath: string, timeout?: number): Promise<Buffer>;
    /**
     * Downloads a file from the Sandbox and saves it to a local file. This method uses streaming to download the file,
     * so it is recommended for downloading larger files.
     *
     * @param {string} remotePath - Path to the file to download in the Sandbox. Relative paths are resolved based on the sandbox working directory.
     * @param {string} localPath - Path to save the downloaded file.
     * @param {number} [timeout] - Timeout for the download operation in seconds. 0 means no timeout.
     * Default is 30 minutes.
     * @returns {Promise<void>}
     *
     * @example
     * // Download and save a file
     * await fs.downloadFile('tmp/data.json', 'local_file.json');
     */
    downloadFile(remotePath: string, localPath: string, timeout?: number): Promise<void>;
    /**
     * Downloads multiple files from the Sandbox. If the files already exist locally, they will be overwritten.
     *
     * @param {FileDownloadRequest[]} files - Array of file download requests.
     * @param {number} [timeoutSec] - Timeout for the download operation in seconds. 0 means no timeout.
     * Default is 30 minutes.
     * @returns {Promise<FileDownloadResponse[]>} Array of download results.
     *
     * @throws {DaytonaError} If the request itself fails (network issues, invalid request/response, etc.). Individual
     * file download errors are returned in the `FileDownloadResponse.error` field.
     *
     * @example
     * // Download multiple files
     * const results = await fs.downloadFiles([
     *   { source: 'tmp/data.json' },
     *   { source: 'tmp/config.json', destination: 'local_config.json' }
     * ]);
     * results.forEach(result => {
     *   if (result.error) {
     *     console.error(`Error downloading ${result.source}: ${result.error}`);
     *   } else if (result.result) {
     *     console.log(`Downloaded ${result.source} to ${result.result}`);
     *   }
     * });
     */
    downloadFiles(files: FileDownloadRequest[], timeoutSec?: number): Promise<FileDownloadResponse[]>;
    /**
     * Searches for text patterns within files in the Sandbox.
     *
     * @param {string} path - Directory to search in. Relative paths are resolved based on the sandbox working directory.
     * @param {string} pattern - Search pattern
     * @returns {Promise<Array<Match>>} Array of matches with file and line information
     *
     * @example
     * // Find all TODO comments in TypeScript files
     * const matches = await fs.findFiles('app/src', 'TODO:');
     * matches.forEach(match => {
     *   console.log(`${match.file}:${match.line}: ${match.content}`);
     * });
     */
    findFiles(path: string, pattern: string): Promise<Array<Match>>;
    /**
     * Retrieves detailed information about a file or directory.
     *
     * @param {string} path - Path to the file or directory. Relative paths are resolved based on the sandbox working directory.
     * @returns {Promise<FileInfo>} Detailed file information including size, permissions, modification time
     *
     * @example
     * // Get file details
     * const info = await fs.getFileDetails('app/config.json');
     * console.log(`Size: ${info.size}, Modified: ${info.modTime}`);
     */
    getFileDetails(path: string): Promise<FileInfo>;
    /**
     * Lists contents of a directory in the Sandbox.
     *
     * @param {string} path - Directory path to list. Relative paths are resolved based on the sandbox working directory.
     * @returns {Promise<FileInfo[]>} Array of file and directory information
     *
     * @example
     * // List directory contents
     * const files = await fs.listFiles('app/src');
     * files.forEach(file => {
     *   console.log(`${file.name} (${file.size} bytes)`);
     * });
     */
    listFiles(path: string): Promise<FileInfo[]>;
    /**
     * Moves or renames a file or directory.
     *
     * @param {string} source - Source path. Relative paths are resolved based on the sandbox working directory.
     * @param {string} destination - Destination path. Relative paths are resolved based on the sandbox working directory.
     * @returns {Promise<void>}
     *
     * @example
     * // Move a file to a new location
     * await fs.moveFiles('app/temp/data.json', 'app/data/data.json');
     */
    moveFiles(source: string, destination: string): Promise<void>;
    /**
     * Replaces text content in multiple files.
     *
     * @param {string[]} files - Array of file paths to process. Relative paths are resolved based on the sandbox working directory.
     * @param {string} pattern - Pattern to replace
     * @param {string} newValue - Replacement text
     * @returns {Promise<Array<ReplaceResult>>} Results of the replace operation for each file
     *
     * @example
     * // Update version number across multiple files
     * const results = await fs.replaceInFiles(
     *   ['app/package.json', 'app/version.ts'],
     *   '"version": "1.0.0"',
     *   '"version": "1.1.0"'
     * );
     */
    replaceInFiles(files: string[], pattern: string, newValue: string): Promise<Array<ReplaceResult>>;
    /**
     * Searches for files and directories by name pattern in the Sandbox.
     *
     * @param {string} path - Directory to search in. Relative paths are resolved based on the sandbox working directory.
     * @param {string} pattern - File name pattern (supports globs)
     * @returns {Promise<SearchFilesResponse>} Search results with matching files
     *
     * @example
     * // Find all TypeScript files
     * const result = await fs.searchFiles('app', '*.ts');
     * result.files.forEach(file => console.log(file));
     */
    searchFiles(path: string, pattern: string): Promise<SearchFilesResponse>;
    /**
     * Sets permissions and ownership for a file or directory.
     *
     * @param {string} path - Path to the file or directory. Relative paths are resolved based on the sandbox working directory.
     * @param {FilePermissionsParams} permissions - Permission settings
     * @returns {Promise<void>}
     *
     * @example
     * // Set file permissions and ownership
     * await fs.setFilePermissions('app/script.sh', {
     *   owner: 'daytona',
     *   group: 'users',
     *   mode: '755'  // Execute permission for shell script
     * });
     */
    setFilePermissions(path: string, permissions: FilePermissionsParams): Promise<void>;
    /**
     * Uploads a file to the Sandbox. This method loads the entire file into memory, so it is not recommended
     * for uploading large files.
     *
     * @param {Buffer} file - Buffer of the file to upload.
     * @param {string} remotePath - Destination path in the Sandbox. Relative paths are resolved based on the sandbox working directory.
     * @param {number} [timeout] - Timeout for the upload operation in seconds. 0 means no timeout.
     * Default is 30 minutes.
     * @returns {Promise<void>}
     *
     * @example
     * // Upload a configuration file
     * await fs.uploadFile(Buffer.from('{"setting": "value"}'), 'tmp/config.json');
     */
    uploadFile(file: Buffer, remotePath: string, timeout?: number): Promise<void>;
    /**
     * Uploads a file from the local file system to the Sandbox. This method uses streaming to upload the file,
     * so it is recommended for uploading larger files.
     *
     * @param {string} localPath - Path to the local file to upload.
     * @param {string} remotePath - Destination path in the Sandbox. Relative paths are resolved based on the sandbox working directory.
     * @param {number} [timeout] - Timeout for the upload operation in seconds. 0 means no timeout.
     * Default is 30 minutes.
     * @returns {Promise<void>}
     *
     * @example
     * // Upload a local file
     * await fs.uploadFile('local_file.txt', 'tmp/file.txt');
     */
    uploadFile(localPath: string, remotePath: string, timeout?: number): Promise<void>;
    /**
     * Uploads multiple files to the Sandbox. If files already exist at the destination paths,
     * they will be overwritten.
     *
     * @param {FileUpload[]} files - Array of files to upload.
     * @param {number} [timeout] - Timeout for the upload operation in seconds. 0 means no timeout.
     * Default is 30 minutes.
     * @returns {Promise<void>}
     *
     * @example
     * // Upload multiple text files
     * const files = [
     *   {
     *     source: Buffer.from('Content of file 1'),
     *     destination: '/tmp/file1.txt'
     *   },
     *   {
     *     source: 'app/data/file2.txt',
     *     destination: '/tmp/file2.txt'
     *   },
     *   {
     *     source: Buffer.from('{"key": "value"}'),
     *     destination: '/tmp/config.json'
     *   }
     * ];
     * await fs.uploadFiles(files);
     */
    uploadFiles(files: FileUpload[], timeout?: number): Promise<void>;
    private makeFilePayload;
}
