"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystem = void 0;
const tslib_1 = require("tslib");
const pathe = tslib_1.__importStar(require("pathe"));
const Import_1 = require("./utils/Import");
const Runtime_1 = require("./utils/Runtime");
const DaytonaError_1 = require("./errors/DaytonaError");
const FileTransfer_1 = require("./utils/FileTransfer");
const otel_decorator_1 = require("./utils/otel.decorator");
/**
 * Provides file system operations within a Sandbox.
 *
 * @class
 */
class FileSystem {
    clientConfig;
    apiClient;
    constructor(clientConfig, apiClient) {
        this.clientConfig = clientConfig;
        this.apiClient = apiClient;
    }
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
    async createFolder(path, mode) {
        const response = await this.apiClient.createFolder(path, mode);
        return response.data;
    }
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
    async deleteFile(path, recursive) {
        const response = await this.apiClient.deleteFile(path, recursive);
        return response.data;
    }
    async downloadFile(src, dst, timeout = 30 * 60) {
        const remotePath = src;
        if (typeof dst !== 'string') {
            if (dst) {
                timeout = dst;
            }
            const response = await this.downloadFiles([{ source: remotePath }], timeout);
            if (response[0].error) {
                throw new DaytonaError_1.DaytonaError(response[0].error);
            }
            return response[0].result;
        }
        const response = await this.downloadFiles([{ source: remotePath, destination: dst }], timeout);
        if (response[0].error) {
            throw new DaytonaError_1.DaytonaError(response[0].error);
        }
    }
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
    async downloadFiles(files, timeoutSec = 30 * 60) {
        if (files.length === 0)
            return [];
        const isNonStreamingRuntime = Runtime_1.RUNTIME === Runtime_1.Runtime.BROWSER || Runtime_1.RUNTIME === Runtime_1.Runtime.SERVERLESS;
        // Prepare destinations and metadata
        const metadataMap = new Map();
        for (const f of files) {
            metadataMap.set(f.source, { destination: f.destination });
            if (f.destination) {
                const fs = await (0, Import_1.dynamicImport)('fs', 'Downloading files to local files is not supported: ');
                await fs.promises.mkdir(pathe.dirname(f.destination), { recursive: true });
            }
        }
        const response = await this.apiClient.downloadFiles({ paths: files.map((f) => f.source) }, {
            responseType: isNonStreamingRuntime ? 'arraybuffer' : 'stream',
            timeout: timeoutSec * 1000,
        });
        const stream = (0, FileTransfer_1.normalizeResponseStream)(response.data);
        // Node.js path: use busboy for efficient streaming
        if (isNonStreamingRuntime) {
            await (0, FileTransfer_1.processDownloadFilesResponseWithBuffered)(stream, response.headers, metadataMap);
        }
        else {
            await (0, FileTransfer_1.processDownloadFilesResponseWithBusboy)(stream, response.headers, metadataMap);
        }
        return files.map((f) => {
            const metadata = metadataMap.get(f.source);
            const error = metadata?.error || (!metadata?.result ? 'No data received for this file' : undefined);
            return {
                source: f.source,
                result: error ? undefined : metadata.result,
                error,
            };
        });
    }
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
    async findFiles(path, pattern) {
        const response = await this.apiClient.findInFiles(path, pattern);
        return response.data;
    }
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
    async getFileDetails(path) {
        const response = await this.apiClient.getFileInfo(path);
        return response.data;
    }
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
    async listFiles(path) {
        const response = await this.apiClient.listFiles(path);
        return response.data;
    }
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
    async moveFiles(source, destination) {
        const response = await this.apiClient.moveFile(source, destination);
        return response.data;
    }
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
    async replaceInFiles(files, pattern, newValue) {
        const replaceRequest = {
            files,
            newValue,
            pattern,
        };
        const response = await this.apiClient.replaceInFiles(replaceRequest);
        return response.data;
    }
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
    async searchFiles(path, pattern) {
        const response = await this.apiClient.searchFiles(path, pattern);
        return response.data;
    }
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
    async setFilePermissions(path, permissions) {
        const response = await this.apiClient.setFilePermissions(path, permissions.owner, permissions.group, permissions.mode);
        return response.data;
    }
    async uploadFile(src, dst, timeout = 30 * 60) {
        await this.uploadFiles([{ source: src, destination: dst }], timeout);
    }
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
    async uploadFiles(files, timeout = 30 * 60) {
        const isNonStreamingRuntime = Runtime_1.RUNTIME === Runtime_1.Runtime.DENO || Runtime_1.RUNTIME === Runtime_1.Runtime.BROWSER || Runtime_1.RUNTIME === Runtime_1.Runtime.SERVERLESS;
        const FormDataClass = isNonStreamingRuntime
            ? FormData
            : (await (0, Import_1.dynamicImport)('form-data', 'Uploading files is not supported: '));
        const form = new FormDataClass();
        for (const [i, { source, destination }] of files.entries()) {
            form.append(`files[${i}].path`, destination);
            const payload = await this.makeFilePayload(source);
            form.append(`files[${i}].file`, payload, destination);
        }
        if (isNonStreamingRuntime) {
            const url = `${this.clientConfig.basePath}/files/bulk-upload`;
            await fetch(url, {
                method: 'POST',
                headers: this.clientConfig.baseOptions.headers,
                body: form,
                signal: timeout ? AbortSignal.timeout(timeout * 1000) : undefined,
            });
        }
        else {
            await this.apiClient.uploadFiles({
                data: form,
                maxRedirects: 0,
                timeout: timeout * 1000,
            });
        }
    }
    async makeFilePayload(source) {
        // String = file path
        if (typeof source === 'string') {
            const fs = await (0, Import_1.dynamicImport)('fs', 'Uploading file from local file system is not supported: ');
            return fs.createReadStream(source);
        }
        // Blob
        if (Runtime_1.RUNTIME === Runtime_1.Runtime.BROWSER || Runtime_1.RUNTIME === Runtime_1.Runtime.SERVERLESS || Runtime_1.RUNTIME === Runtime_1.Runtime.DENO) {
            // Use .slice() to ensure we have a concrete ArrayBuffer, not ArrayBufferLike
            return new Blob([source.slice()], { type: 'application/octet-stream' });
        }
        // Readable stream
        const stream = await (0, Import_1.dynamicImport)('stream', 'Uploading file is not supported: ');
        return stream.Readable.from(source);
    }
}
exports.FileSystem = FileSystem;
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], FileSystem.prototype, "createFolder", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, Boolean]),
    tslib_1.__metadata("design:returntype", Promise)
], FileSystem.prototype, "deleteFile", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, Object, Number]),
    tslib_1.__metadata("design:returntype", Promise)
], FileSystem.prototype, "downloadFile", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Array, Number]),
    tslib_1.__metadata("design:returntype", Promise)
], FileSystem.prototype, "downloadFiles", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], FileSystem.prototype, "findFiles", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", Promise)
], FileSystem.prototype, "getFileDetails", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", Promise)
], FileSystem.prototype, "listFiles", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], FileSystem.prototype, "moveFiles", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Array, String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], FileSystem.prototype, "replaceInFiles", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], FileSystem.prototype, "searchFiles", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, Object]),
    tslib_1.__metadata("design:returntype", Promise)
], FileSystem.prototype, "setFilePermissions", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object, String, Number]),
    tslib_1.__metadata("design:returntype", Promise)
], FileSystem.prototype, "uploadFile", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Array, Number]),
    tslib_1.__metadata("design:returntype", Promise)
], FileSystem.prototype, "uploadFiles", null);
//# sourceMappingURL=FileSystem.js.map