import { Buffer } from 'buffer';
/**
 * Converts various data types to Uint8Array
 */
export declare function toUint8Array(data: string | ArrayBuffer | ArrayBufferView): Uint8Array;
/**
 * Concatenates multiple Uint8Array chunks into a single Uint8Array
 */
export declare function concatUint8Arrays(parts: Uint8Array[]): Uint8Array;
/**
 * Converts Uint8Array to Buffer (uses polyfill in non-Node environments)
 */
export declare function toBuffer(data: Uint8Array): Buffer;
/**
 * Decodes Uint8Array to UTF-8 string
 */
export declare function utf8Decode(data: Uint8Array): string;
/**
 * Finds all occurrences of a pattern in a byte buffer
 */
export declare function findAllBytes(buffer: Uint8Array, pattern: Uint8Array): number[];
/**
 * Finds the first occurrence of a pattern in a byte buffer within a range
 */
export declare function findBytesInRange(buffer: Uint8Array, start: number, end: number, pattern: Uint8Array): number;
/**
 * Checks if a sequence starts at a given position in a byte buffer
 * Returns the position after the sequence if found, -1 otherwise
 */
export declare function indexAfterSequence(buffer: Uint8Array, start: number, sequence: Uint8Array): number;
/**
 * Collects all bytes from various stream types into a single Uint8Array
 */
export declare function collectStreamBytes(stream: any): Promise<Uint8Array>;
/**
 * Checks if value is a File object (browser environment)
 */
export declare function isFile(value: any): boolean;
