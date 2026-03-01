import { ObjectStorageApi, SnapshotDto, SnapshotsApi, Configuration, PaginatedSnapshots as PaginatedSnapshotsDto } from '@daytonaio/api-client';
import { Image } from './Image';
import { Resources } from './Daytona';
/**
 * Represents a Daytona Snapshot which is a pre-configured sandbox.
 *
 * @property {string} id - Unique identifier for the Snapshot.
 * @property {string} organizationId - Organization ID that owns the Snapshot.
 * @property {boolean} general - Whether the Snapshot is general.
 * @property {string} name - Name of the Snapshot.
 * @property {string} imageName - Name of the Image of the Snapshot.
 * @property {SnapshotState} state - Current state of the Snapshot.
 * @property {number} size - Size of the Snapshot.
 * @property {string[]} entrypoint - Entrypoint of the Snapshot.
 * @property {number} cpu - CPU of the Snapshot.
 * @property {number} gpu - GPU of the Snapshot.
 * @property {number} mem - Memory of the Snapshot in GiB.
 * @property {number} disk - Disk of the Snapshot in GiB.
 * @property {string} errorReason - Error reason of the Snapshot.
 * @property {Date} createdAt - Timestamp when the Snapshot was created.
 * @property {Date} updatedAt - Timestamp when the Snapshot was last updated.
 * @property {Date} lastUsedAt - Timestamp when the Snapshot was last used.
 */
export type Snapshot = SnapshotDto & {
    __brand: 'Snapshot';
};
/**
 * Represents a paginated list of Daytona Snapshots.
 *
 * @property {Snapshot[]} items - List of Snapshot instances in the current page.
 * @property {number} total - Total number of Snapshots across all pages.
 * @property {number} page - Current page number.
 * @property {number} totalPages - Total number of pages available.
 */
export interface PaginatedSnapshots extends Omit<PaginatedSnapshotsDto, 'items'> {
    items: Snapshot[];
}
/**
 * Parameters for creating a new snapshot.
 *
 * @property {string} name - Name of the snapshot.
 * @property {string | Image} image - Image of the snapshot. If a string is provided, it should be available on some registry.
 * If an Image instance is provided, it will be used to create a new image in Daytona.
 * @property {Resources} resources - Resources of the snapshot.
 * @property {string[]} entrypoint - Entrypoint of the snapshot.
 * @property {string} regionId - ID of the region where the snapshot will be available. Defaults to organization default region if not specified.
 */
export type CreateSnapshotParams = {
    name: string;
    image: string | Image;
    resources?: Resources;
    entrypoint?: string[];
    regionId?: string;
};
/**
 * Service for managing Daytona Snapshots. Can be used to list, get, create and delete Snapshots.
 *
 * @class
 */
export declare class SnapshotService {
    private clientConfig;
    private snapshotsApi;
    private objectStorageApi;
    private defaultRegionId?;
    constructor(clientConfig: Configuration, snapshotsApi: SnapshotsApi, objectStorageApi: ObjectStorageApi, defaultRegionId?: string);
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
    list(page?: number, limit?: number): Promise<PaginatedSnapshots>;
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
    get(name: string): Promise<Snapshot>;
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
    delete(snapshot: Snapshot): Promise<void>;
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
    create(params: CreateSnapshotParams, options?: {
        onLogs?: (chunk: string) => void;
        timeout?: number;
    }): Promise<Snapshot>;
    /**
     * Activates a snapshot.
     *
     * @param {Snapshot} snapshot - Snapshot to activate
     * @returns {Promise<Snapshot>} The activated Snapshot instance
     */
    activate(snapshot: Snapshot): Promise<Snapshot>;
    /**
     * Processes the image contexts by uploading them to object storage
     *
     * @private
     * @param {Image} image - The Image instance.
     * @returns {Promise<string[]>} The list of context hashes stored in object storage.
     */
    static processImageContext(objectStorageApi: ObjectStorageApi, image: Image): Promise<string[]>;
}
