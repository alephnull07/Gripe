import { DownloadMetadata } from '../FileSystem';
/**
 * Safely aborts a stream
 */
export declare function abortStream(stream: any): void;
/**
 * Normalizes response data to extract the actual stream
 */
export declare function normalizeResponseStream(responseData: any): any;
/**
 * Processes multipart response using busboy (Node.js path)
 */
export declare function processDownloadFilesResponseWithBusboy(stream: any, headers: Record<string, string>, metadataMap: Map<string, DownloadMetadata>): Promise<void>;
export declare function processDownloadFilesResponseWithBuffered(stream: any, headers: Record<string, string>, metadataMap: Map<string, DownloadMetadata>): Promise<void>;
