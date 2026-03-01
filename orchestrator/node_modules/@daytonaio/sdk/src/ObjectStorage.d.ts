/**
 * Configuration for the ObjectStorage class.
 *
 * @interface
 * @property {string} endpointUrl - The endpoint URL for the object storage service.
 * @property {string} accessKeyId - The access key ID for the object storage service.
 * @property {string} secretAccessKey - The secret access key for the object storage service.
 * @property {string} [sessionToken] - The session token for the object storage service. Used for temporary credentials.
 * @property {string} [bucketName] - The name of the bucket to use.
 */
export interface ObjectStorageConfig {
    endpointUrl: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    bucketName?: string;
}
/**
 * ObjectStorage class for interacting with object storage services.
 *
 * @class
 * @param {ObjectStorageConfig} config - The configuration for the object storage service.
 */
export declare class ObjectStorage {
    private bucketName;
    private s3Client;
    constructor(config: ObjectStorageConfig);
    /**
     * Upload a file or directory to object storage.
     *
     * @param {string} path - The path to the file or directory to upload.
     * @param {string} organizationId - The organization ID to use for the upload.
     * @param {string} archiveBasePath - The base path to use for the archive.
     * @returns {Promise<string>} The hash of the uploaded file or directory.
     */
    upload(path: string, organizationId: string, archiveBasePath: string): Promise<string>;
    /**
     * Compute a hash for a file or directory.
     *
     * @param {string} pathStr - The path to the file or directory to hash.
     * @param {string} archiveBasePath - The base path to use for the archive.
     * @returns {Promise<string>} The hash of the file or directory.
     */
    private computeHashForPathMd5;
    /**
     * Recursively hash a directory and its contents.
     *
     * @param {string} dirPath - The path to the directory to hash.
     * @param {string} basePath - The base path to use for the hash.
     * @param {crypto.Hash} hasher - The hasher to use for the hash.
     * @returns {Promise<void>} A promise that resolves when the directory has been hashed.
     */
    private hashDirectory;
    /**
     * Hash a file.
     *
     * @param {string} filePath - The path to the file to hash.
     * @param {crypto.Hash} hasher - The hasher to use for the hash.
     * @returns {Promise<void>} A promise that resolves when the file has been hashed.
     */
    private hashFile;
    /**
     * Check if a prefix (folder) exists in S3.
     *
     * @param {string} prefix - The prefix to check.
     * @returns {Promise<boolean>} True if the prefix exists, false otherwise.
     */
    private folderExistsInS3;
    /**
     * Create a tar archive of the specified path and upload it to S3.
     *
     * @param {string} s3Key - The key to use for the uploaded file.
     * @param {string} sourcePath - The path to the file or directory to upload.
     * @param {string} archiveBasePath - The base path to use for the archive.
     */
    private uploadAsTar;
    private extractAwsRegion;
}
