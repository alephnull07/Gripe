export interface MultipartPart {
    name: string | undefined;
    filename: string | undefined;
    headers: Record<string, string>;
    data: Uint8Array;
}
/**
 * Extracts the boundary from a Content-Type header
 */
export declare function extractBoundary(contentType: string): string | null;
/**
 * Parses multipart/form-data or multipart/mixed response body
 */
export declare function parseMultipart(body: Uint8Array, boundary: string): MultipartPart[];
/**
 * Parses multipart response using browser's native FormData API
 * This is more reliable than manual parsing when available
 */
export declare function parseMultipartWithFormData(bodyBytes: Uint8Array, contentType: string): Promise<Map<string, {
    filename: string;
    data: Uint8Array;
}>>;
/**
 * Extracts a header value from response headers (case-insensitive)
 */
export declare function getHeader(headers: any, key: string): string | undefined;
