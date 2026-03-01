/**
 * @module Errors
 */
import type { AxiosHeaders } from 'axios';
type ResponseHeaders = InstanceType<typeof AxiosHeaders>;
/**
 * Base error for Daytona SDK.
 */
export declare class DaytonaError extends Error {
    /** HTTP status code if available */
    statusCode?: number;
    /** Response headers if available */
    headers?: ResponseHeaders;
    constructor(message: string, statusCode?: number, headers?: ResponseHeaders);
}
export declare class DaytonaNotFoundError extends DaytonaError {
    constructor(message: string, statusCode?: number, headers?: ResponseHeaders);
}
/**
 * Error thrown when rate limit is exceeded.
 */
export declare class DaytonaRateLimitError extends DaytonaError {
    constructor(message: string, statusCode?: number, headers?: ResponseHeaders);
}
/**
 * Error thrown when a timeout occurs.
 */
export declare class DaytonaTimeoutError extends DaytonaError {
    constructor(message: string, statusCode?: number, headers?: ResponseHeaders);
}
export {};
