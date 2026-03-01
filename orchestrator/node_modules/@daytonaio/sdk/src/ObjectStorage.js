"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectStorage = void 0;
const tslib_1 = require("tslib");
const client_s3_1 = require("@aws-sdk/client-s3");
const lib_storage_1 = require("@aws-sdk/lib-storage");
const crypto = tslib_1.__importStar(require("crypto"));
const pathe = tslib_1.__importStar(require("pathe"));
const DaytonaError_1 = require("./errors/DaytonaError");
const Import_1 = require("./utils/Import");
const otel_decorator_1 = require("./utils/otel.decorator");
/**
 * ObjectStorage class for interacting with object storage services.
 *
 * @class
 * @param {ObjectStorageConfig} config - The configuration for the object storage service.
 */
class ObjectStorage {
    bucketName;
    s3Client;
    constructor(config) {
        this.bucketName = config.bucketName || 'daytona-volume-builds';
        this.s3Client = new client_s3_1.S3Client({
            region: this.extractAwsRegion(config.endpointUrl) || 'us-east-1',
            endpoint: config.endpointUrl,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
                sessionToken: config.sessionToken,
            },
            forcePathStyle: true,
        });
    }
    /**
     * Upload a file or directory to object storage.
     *
     * @param {string} path - The path to the file or directory to upload.
     * @param {string} organizationId - The organization ID to use for the upload.
     * @param {string} archiveBasePath - The base path to use for the archive.
     * @returns {Promise<string>} The hash of the uploaded file or directory.
     */
    async upload(path, organizationId, archiveBasePath) {
        const fs = await (0, Import_1.dynamicImport)('fs', '"upload" is not supported: ');
        if (!fs.existsSync(path)) {
            const errMsg = `Path does not exist: ${path}`;
            throw new DaytonaError_1.DaytonaError(errMsg);
        }
        // Compute hash for the path
        const pathHash = await this.computeHashForPathMd5(path, archiveBasePath);
        // Define the S3 prefix
        const prefix = `${organizationId}/${pathHash}/`;
        const s3Key = `${prefix}context.tar`;
        // Check if it already exists in S3
        if (await this.folderExistsInS3(prefix)) {
            return pathHash;
        }
        // Upload to S3
        await this.uploadAsTar(s3Key, path, archiveBasePath);
        return pathHash;
    }
    /**
     * Compute a hash for a file or directory.
     *
     * @param {string} pathStr - The path to the file or directory to hash.
     * @param {string} archiveBasePath - The base path to use for the archive.
     * @returns {Promise<string>} The hash of the file or directory.
     */
    async computeHashForPathMd5(pathStr, archiveBasePath) {
        const fs = await (0, Import_1.dynamicImport)('fs', '"computeHashForPathMd5" is not supported: ');
        const md5Hasher = crypto.createHash('md5');
        const absPathStr = pathe.resolve(pathStr);
        md5Hasher.update(archiveBasePath);
        if (fs.statSync(absPathStr).isFile()) {
            // For files, hash the content
            await this.hashFile(absPathStr, md5Hasher);
        }
        else {
            // For directories, recursively hash all files and their paths
            await this.hashDirectory(absPathStr, pathStr, md5Hasher);
        }
        return md5Hasher.digest('hex');
    }
    /**
     * Recursively hash a directory and its contents.
     *
     * @param {string} dirPath - The path to the directory to hash.
     * @param {string} basePath - The base path to use for the hash.
     * @param {crypto.Hash} hasher - The hasher to use for the hash.
     * @returns {Promise<void>} A promise that resolves when the directory has been hashed.
     */
    async hashDirectory(dirPath, basePath, hasher) {
        const fs = await (0, Import_1.dynamicImport)('fs', '"hashDirectory" is not supported: ');
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const hasSubdirs = entries.some((e) => e.isDirectory());
        const hasFiles = entries.some((e) => e.isFile());
        if (!hasSubdirs && !hasFiles) {
            // Empty directory
            const relDir = pathe.relative(basePath, dirPath);
            hasher.update(relDir);
        }
        for (const entry of entries) {
            const fullPath = pathe.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                await this.hashDirectory(fullPath, basePath, hasher);
            }
            else if (entry.isFile()) {
                const relPath = pathe.relative(basePath, fullPath);
                hasher.update(relPath);
                await this.hashFile(fullPath, hasher);
            }
        }
    }
    /**
     * Hash a file.
     *
     * @param {string} filePath - The path to the file to hash.
     * @param {crypto.Hash} hasher - The hasher to use for the hash.
     * @returns {Promise<void>} A promise that resolves when the file has been hashed.
     */
    async hashFile(filePath, hasher) {
        const fs = await (0, Import_1.dynamicImport)('fs', '"hashFile" is not supported: ');
        await new Promise((resolve, reject) => {
            const stream = fs.createReadStream(filePath, { highWaterMark: 8192 });
            stream.on('data', (chunk) => hasher.update(chunk));
            stream.on('end', resolve);
            stream.on('error', reject);
        });
    }
    /**
     * Check if a prefix (folder) exists in S3.
     *
     * @param {string} prefix - The prefix to check.
     * @returns {Promise<boolean>} True if the prefix exists, false otherwise.
     */
    async folderExistsInS3(prefix) {
        const response = await this.s3Client.send(new client_s3_1.ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: prefix,
            MaxKeys: 1,
        }));
        return !!response.Contents && response.Contents.length > 0;
    }
    /**
     * Create a tar archive of the specified path and upload it to S3.
     *
     * @param {string} s3Key - The key to use for the uploaded file.
     * @param {string} sourcePath - The path to the file or directory to upload.
     * @param {string} archiveBasePath - The base path to use for the archive.
     */
    async uploadAsTar(s3Key, sourcePath, archiveBasePath) {
        const importErrorPrefix = '"uploadAsTar" is not supported: ';
        const tar = await (0, Import_1.dynamicImport)('tar', importErrorPrefix);
        const stream = await (0, Import_1.dynamicImport)('stream', importErrorPrefix);
        sourcePath = pathe.resolve(sourcePath);
        const normalizedSourcePath = pathe.normalize(sourcePath);
        const normalizedArchiveBasePath = pathe.normalize(archiveBasePath);
        let basePrefix;
        if (normalizedArchiveBasePath === '.') {
            // When archiveBasePath is empty (normalized to '.'), use the normalizedSourcePath as cwd and the '.' as target
            basePrefix = normalizedSourcePath;
        }
        else {
            // Normal case: extract the base prefix by removing archiveBasePath from the end
            basePrefix = normalizedSourcePath.slice(0, normalizedSourcePath.length - normalizedArchiveBasePath.length);
        }
        const tarStream = tar.create({
            cwd: basePrefix,
            portable: true,
            gzip: false,
        }, [normalizedArchiveBasePath]);
        const pass = new stream.PassThrough();
        tarStream.pipe(pass);
        const uploader = new lib_storage_1.Upload({
            client: this.s3Client,
            params: {
                Bucket: this.bucketName,
                Key: s3Key,
                Body: pass,
            },
        });
        await uploader.done();
    }
    extractAwsRegion(endpoint) {
        const match = endpoint.match(/s3[.-]([a-z0-9-]+)\.amazonaws\.com/);
        return match?.[1];
    }
}
exports.ObjectStorage = ObjectStorage;
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], ObjectStorage.prototype, "upload", null);
//# sourceMappingURL=ObjectStorage.js.map