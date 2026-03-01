"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toUint8Array = toUint8Array;
exports.concatUint8Arrays = concatUint8Arrays;
exports.toBuffer = toBuffer;
exports.utf8Decode = utf8Decode;
exports.findAllBytes = findAllBytes;
exports.findBytesInRange = findBytesInRange;
exports.indexAfterSequence = indexAfterSequence;
exports.collectStreamBytes = collectStreamBytes;
exports.isFile = isFile;
const buffer_1 = require("buffer");
const DaytonaError_1 = require("../errors/DaytonaError");
/**
 * Converts various data types to Uint8Array
 */
function toUint8Array(data) {
    if (typeof data === 'string') {
        return new TextEncoder().encode(data);
    }
    if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    }
    if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    throw new DaytonaError_1.DaytonaError('Unsupported data type for byte conversion.');
}
/**
 * Concatenates multiple Uint8Array chunks into a single Uint8Array
 */
function concatUint8Arrays(parts) {
    const size = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const result = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.byteLength;
    }
    return result;
}
/**
 * Converts Uint8Array to Buffer (uses polyfill in non-Node environments)
 */
function toBuffer(data) {
    return buffer_1.Buffer.from(data);
}
/**
 * Decodes Uint8Array to UTF-8 string
 */
function utf8Decode(data) {
    return new TextDecoder('utf-8').decode(data);
}
/**
 * Finds all occurrences of a pattern in a byte buffer
 */
function findAllBytes(buffer, pattern) {
    const results = [];
    let i = 0;
    while (i <= buffer.length - pattern.length) {
        let match = true;
        for (let j = 0; j < pattern.length; j++) {
            if (buffer[i + j] !== pattern[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            results.push(i);
            i += pattern.length;
        }
        else {
            i++;
        }
    }
    return results;
}
/**
 * Finds the first occurrence of a pattern in a byte buffer within a range
 */
function findBytesInRange(buffer, start, end, pattern) {
    let i = start;
    while (i <= end - pattern.length) {
        let match = true;
        for (let j = 0; j < pattern.length; j++) {
            if (buffer[i + j] !== pattern[j]) {
                match = false;
                break;
            }
        }
        if (match)
            return i;
        i++;
    }
    return -1;
}
/**
 * Checks if a sequence starts at a given position in a byte buffer
 * Returns the position after the sequence if found, -1 otherwise
 */
function indexAfterSequence(buffer, start, sequence) {
    for (let j = 0; j < sequence.length; j++) {
        if (buffer[start + j] !== sequence[j])
            return -1;
    }
    return start + sequence.length;
}
/**
 * Collects all bytes from various stream types into a single Uint8Array
 */
async function collectStreamBytes(stream) {
    if (!stream)
        return new Uint8Array(0);
    // ReadableStream (WHATWG)
    if (typeof stream.getReader === 'function') {
        const reader = stream.getReader();
        const chunks = [];
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                if (value?.byteLength) {
                    chunks.push(value);
                }
            }
        }
        finally {
            await reader.cancel();
        }
        return concatUint8Arrays(chunks);
    }
    // AsyncIterable
    if (stream?.[Symbol.asyncIterator]) {
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(toUint8Array(chunk));
        }
        return concatUint8Arrays(chunks);
    }
    // Direct data types
    if (typeof stream === 'string' || stream instanceof ArrayBuffer || ArrayBuffer.isView(stream)) {
        return toUint8Array(stream);
    }
    // Blob
    if (typeof Blob !== 'undefined' && stream instanceof Blob) {
        const arrayBuffer = await stream.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    }
    // Response
    if (typeof Response !== 'undefined' && stream instanceof Response) {
        const arrayBuffer = await stream.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    }
    throw new DaytonaError_1.DaytonaError('Unsupported stream type for byte collection.');
}
/**
 * Checks if value is a File object (browser environment)
 */
function isFile(value) {
    const FileConstructor = globalThis.File;
    return typeof FileConstructor !== 'undefined' && value instanceof FileConstructor;
}
//# sourceMappingURL=Binary.js.map