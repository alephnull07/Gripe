"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolumeService = void 0;
const tslib_1 = require("tslib");
const DaytonaError_1 = require("./errors/DaytonaError");
const otel_decorator_1 = require("./utils/otel.decorator");
/**
 * Service for managing Daytona Volumes.
 *
 * This service provides methods to list, get, create, and delete Volumes.
 *
 * Volumes can be mounted to Sandboxes with an optional subpath parameter to mount
 * only a specific S3 prefix within the volume. When no subpath is specified,
 * the entire volume is mounted.
 *
 * @class
 */
class VolumeService {
    volumesApi;
    constructor(volumesApi) {
        this.volumesApi = volumesApi;
    }
    /**
     * Lists all available Volumes.
     *
     * @returns {Promise<Volume[]>} List of all Volumes accessible to the user
     *
     * @example
     * const daytona = new Daytona();
     * const volumes = await daytona.volume.list();
     * console.log(`Found ${volumes.length} volumes`);
     * volumes.forEach(vol => console.log(`${vol.name} (${vol.id})`));
     */
    async list() {
        const response = await this.volumesApi.listVolumes();
        return response.data;
    }
    /**
     * Gets a Volume by its name.
     *
     * @param {string} name - Name of the Volume to retrieve
     * @param {boolean} create - Whether to create the Volume if it does not exist
     * @returns {Promise<Volume>} The requested Volume
     * @throws {Error} If the Volume does not exist or cannot be accessed
     *
     * @example
     * const daytona = new Daytona();
     * const volume = await daytona.volume.get("volume-name", true);
     * console.log(`Volume ${volume.name} is in state ${volume.state}`);
     */
    async get(name, create = false) {
        try {
            const response = await this.volumesApi.getVolumeByName(name);
            return response.data;
        }
        catch (error) {
            if (error instanceof DaytonaError_1.DaytonaNotFoundError && create) {
                return await this.create(name);
            }
            throw error;
        }
    }
    /**
     * Creates a new Volume with the specified name.
     *
     * @param {string} name - Name for the new Volume
     * @returns {Promise<Volume>} The newly created Volume
     * @throws {Error} If the Volume cannot be created
     *
     * @example
     * const daytona = new Daytona();
     * const volume = await daytona.volume.create("my-data-volume");
     * console.log(`Created volume ${volume.name} with ID ${volume.id}`);
     */
    async create(name) {
        const response = await this.volumesApi.createVolume({ name });
        return response.data;
    }
    /**
     * Deletes a Volume.
     *
     * @param {Volume} volume - Volume to delete
     * @returns {Promise<void>}
     * @throws {Error} If the Volume does not exist or cannot be deleted
     *
     * @example
     * const daytona = new Daytona();
     * const volume = await daytona.volume.get("volume-name");
     * await daytona.volume.delete(volume);
     * console.log("Volume deleted successfully");
     */
    async delete(volume) {
        await this.volumesApi.deleteVolume(volume.id);
    }
}
exports.VolumeService = VolumeService;
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, Object]),
    tslib_1.__metadata("design:returntype", Promise)
], VolumeService.prototype, "get", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", Promise)
], VolumeService.prototype, "create", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], VolumeService.prototype, "delete", null);
//# sourceMappingURL=Volume.js.map