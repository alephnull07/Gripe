"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnapshotService = void 0;
const tslib_1 = require("tslib");
const api_client_1 = require("@daytonaio/api-client");
const DaytonaError_1 = require("./errors/DaytonaError");
const Image_1 = require("./Image");
const Stream_1 = require("./utils/Stream");
const Import_1 = require("./utils/Import");
const otel_decorator_1 = require("./utils/otel.decorator");
/**
 * Service for managing Daytona Snapshots. Can be used to list, get, create and delete Snapshots.
 *
 * @class
 */
class SnapshotService {
    clientConfig;
    snapshotsApi;
    objectStorageApi;
    defaultRegionId;
    constructor(clientConfig, snapshotsApi, objectStorageApi, defaultRegionId) {
        this.clientConfig = clientConfig;
        this.snapshotsApi = snapshotsApi;
        this.objectStorageApi = objectStorageApi;
        this.defaultRegionId = defaultRegionId;
    }
    /**
     * List paginated list of Snapshots.
     *
     * @param {number} [page] - Page number for pagination (starting from 1)
     * @param {number} [limit] - Maximum number of items per page
     * @returns {Promise<PaginatedSnapshots>} Paginated list of Snapshots
     *
     * @example
     * const daytona = new Daytona();
     * const result = await daytona.snapshot.list(2, 10);
     * console.log(`Found ${result.total} snapshots`);
     * result.items.forEach(snapshot => console.log(`${snapshot.name} (${snapshot.imageName})`));
     */
    async list(page, limit) {
        const response = await this.snapshotsApi.getAllSnapshots(undefined, page, limit);
        return {
            items: response.data.items.map((snapshot) => snapshot),
            total: response.data.total,
            page: response.data.page,
            totalPages: response.data.totalPages,
        };
    }
    /**
     * Gets a Snapshot by its name.
     *
     * @param {string} name - Name of the Snapshot to retrieve
     * @returns {Promise<Snapshot>} The requested Snapshot
     * @throws {Error} If the Snapshot does not exist or cannot be accessed
     *
     * @example
     * const daytona = new Daytona();
     * const snapshot = await daytona.snapshot.get("snapshot-name");
     * console.log(`Snapshot ${snapshot.name} is in state ${snapshot.state}`);
     */
    async get(name) {
        const response = await this.snapshotsApi.getSnapshot(name);
        return response.data;
    }
    /**
     * Deletes a Snapshot.
     *
     * @param {Snapshot} snapshot - Snapshot to delete
     * @returns {Promise<void>}
     * @throws {Error} If the Snapshot does not exist or cannot be deleted
     *
     * @example
     * const daytona = new Daytona();
     * const snapshot = await daytona.snapshot.get("snapshot-name");
     * await daytona.snapshot.delete(snapshot);
     * console.log("Snapshot deleted successfully");
     */
    async delete(snapshot) {
        await this.snapshotsApi.removeSnapshot(snapshot.id);
    }
    /**
     * Creates and registers a new snapshot from the given Image definition.
     *
     * @param {CreateSnapshotParams} params - Parameters for snapshot creation.
     * @param {object} options - Options for the create operation.
     * @param {boolean} options.onLogs - This callback function handles snapshot creation logs.
     * @param {number} options.timeout - Default is no timeout. Timeout in seconds (0 means no timeout).
     * @returns {Promise<void>}
     *
     * @example
     * const image = Image.debianSlim('3.12').pipInstall('numpy');
     * await daytona.snapshot.create({ name: 'my-snapshot', image: image }, { onLogs: console.log });
     */
    async create(params, options = {}) {
        const createSnapshotReq = {
            name: params.name,
        };
        if (typeof params.image === 'string') {
            createSnapshotReq.imageName = params.image;
            createSnapshotReq.entrypoint = params.entrypoint;
        }
        else {
            const contextHashes = await SnapshotService.processImageContext(this.objectStorageApi, params.image);
            createSnapshotReq.buildInfo = {
                contextHashes,
                dockerfileContent: params.entrypoint
                    ? params.image.entrypoint(params.entrypoint).dockerfile
                    : params.image.dockerfile,
            };
        }
        if (params.resources) {
            createSnapshotReq.cpu = params.resources.cpu;
            createSnapshotReq.gpu = params.resources.gpu;
            createSnapshotReq.memory = params.resources.memory;
            createSnapshotReq.disk = params.resources.disk;
        }
        createSnapshotReq.regionId = params.regionId || this.defaultRegionId;
        let createdSnapshot = (await this.snapshotsApi.createSnapshot(createSnapshotReq, undefined, {
            timeout: (options.timeout || 0) * 1000,
        })).data;
        if (!createdSnapshot) {
            throw new DaytonaError_1.DaytonaError("Failed to create snapshot. Didn't receive a snapshot from the server API.");
        }
        const terminalStates = [api_client_1.SnapshotState.ACTIVE, api_client_1.SnapshotState.ERROR, api_client_1.SnapshotState.BUILD_FAILED];
        const snapshotRef = { createdSnapshot: createdSnapshot };
        let streamPromise;
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        const startLogStreaming = async (onChunk = () => { }) => {
            if (!streamPromise) {
                const response = await this.snapshotsApi.getSnapshotBuildLogsUrl(createdSnapshot.id);
                const url = `${response.data.url}?follow=true`;
                streamPromise = (0, Stream_1.processStreamingResponse)(() => fetch(url, { method: 'GET', headers: this.clientConfig.baseOptions.headers }), (chunk) => onChunk(chunk.trimEnd()), async () => terminalStates.includes(snapshotRef.createdSnapshot.state));
            }
        };
        if (options.onLogs) {
            options.onLogs(`Creating snapshot ${createdSnapshot.name} (${createdSnapshot.state})`);
            if (createSnapshotReq.buildInfo &&
                createdSnapshot.state !== api_client_1.SnapshotState.PENDING &&
                !terminalStates.includes(createdSnapshot.state)) {
                await startLogStreaming(options.onLogs);
            }
        }
        let previousState = createdSnapshot.state;
        while (!terminalStates.includes(createdSnapshot.state)) {
            if (options.onLogs && previousState !== createdSnapshot.state) {
                if (createSnapshotReq.buildInfo && createdSnapshot.state !== api_client_1.SnapshotState.PENDING && !streamPromise) {
                    await startLogStreaming(options.onLogs);
                }
                options.onLogs(`Creating snapshot ${createdSnapshot.name} (${createdSnapshot.state})`);
                previousState = createdSnapshot.state;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
            createdSnapshot = await this.get(createdSnapshot.name);
            snapshotRef.createdSnapshot = createdSnapshot;
        }
        if (options.onLogs) {
            if (streamPromise) {
                await streamPromise;
            }
            if (createdSnapshot.state === api_client_1.SnapshotState.ACTIVE) {
                options.onLogs(`Created snapshot ${createdSnapshot.name} (${createdSnapshot.state})`);
            }
        }
        if (createdSnapshot.state === api_client_1.SnapshotState.ERROR || createdSnapshot.state === api_client_1.SnapshotState.BUILD_FAILED) {
            const errMsg = `Failed to create snapshot. Name: ${createdSnapshot.name} Reason: ${createdSnapshot.errorReason}`;
            throw new DaytonaError_1.DaytonaError(errMsg);
        }
        return createdSnapshot;
    }
    /**
     * Activates a snapshot.
     *
     * @param {Snapshot} snapshot - Snapshot to activate
     * @returns {Promise<Snapshot>} The activated Snapshot instance
     */
    async activate(snapshot) {
        return (await this.snapshotsApi.activateSnapshot(snapshot.id)).data;
    }
    /**
     * Processes the image contexts by uploading them to object storage
     *
     * @private
     * @param {Image} image - The Image instance.
     * @returns {Promise<string[]>} The list of context hashes stored in object storage.
     */
    static async processImageContext(objectStorageApi, image) {
        if (!image.contextList || !image.contextList.length) {
            return [];
        }
        const ObjectStorageModule = await (0, Import_1.dynamicImport)('ObjectStorage', '"processImageContext" is not supported: ');
        const pushAccessCreds = (await objectStorageApi.getPushAccess()).data;
        const objectStorage = new ObjectStorageModule.ObjectStorage({
            endpointUrl: pushAccessCreds.storageUrl,
            accessKeyId: pushAccessCreds.accessKey,
            secretAccessKey: pushAccessCreds.secret,
            sessionToken: pushAccessCreds.sessionToken,
            bucketName: pushAccessCreds.bucket,
        });
        const contextHashes = [];
        for (const context of image.contextList) {
            const contextHash = await objectStorage.upload(context.sourcePath, pushAccessCreds.organizationId, context.archivePath);
            contextHashes.push(contextHash);
        }
        return contextHashes;
    }
}
exports.SnapshotService = SnapshotService;
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Number, Number]),
    tslib_1.__metadata("design:returntype", Promise)
], SnapshotService.prototype, "list", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", Promise)
], SnapshotService.prototype, "get", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], SnapshotService.prototype, "delete", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object, Object]),
    tslib_1.__metadata("design:returntype", Promise)
], SnapshotService.prototype, "create", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], SnapshotService.prototype, "activate", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [api_client_1.ObjectStorageApi, Image_1.Image]),
    tslib_1.__metadata("design:returntype", Promise)
], SnapshotService, "processImageContext", null);
//# sourceMappingURL=Snapshot.js.map