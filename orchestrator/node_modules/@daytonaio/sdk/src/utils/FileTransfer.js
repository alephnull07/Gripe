"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.abortStream = abortStream;
exports.normalizeResponseStream = normalizeResponseStream;
exports.processDownloadFilesResponseWithBusboy = processDownloadFilesResponseWithBusboy;
exports.processDownloadFilesResponseWithBuffered = processDownloadFilesResponseWithBuffered;
const tslib_1 = require("tslib");
const buffer_1 = require("buffer");
const busboy_1 = tslib_1.__importDefault(require("busboy"));
const DaytonaError_1 = require("../errors/DaytonaError");
const Import_1 = require("./Import");
const Binary_1 = require("./Binary");
const Multipart_1 = require("./Multipart");
const Multipart_2 = require("./Multipart");
/**
 * Safely aborts a stream
 */
function abortStream(stream) {
    if (stream && typeof stream.destroy === 'function') {
        stream.destroy();
    }
    else if (stream && typeof stream.cancel === 'function') {
        stream.cancel();
    }
}
/**
 * Normalizes response data to extract the actual stream
 */
function normalizeResponseStream(responseData) {
    if (!responseData || typeof responseData !== 'object') {
        return responseData;
    }
    // WHATWG ReadableStream
    if (responseData.body && typeof responseData.body.getReader === 'function') {
        return responseData.body;
    }
    // Some adapters use .stream
    if (responseData.stream) {
        return responseData.stream;
    }
    return responseData;
}
/**
 * Processes multipart response using busboy (Node.js path)
 */
async function processDownloadFilesResponseWithBusboy(stream, headers, metadataMap) {
    const fileTasks = [];
    await new Promise((resolve, reject) => {
        const bb = (0, busboy_1.default)({
            headers,
            preservePath: true,
        });
        bb.on('file', (fieldName, fileStream, fileInfo) => {
            const source = fileInfo?.filename;
            if (!source) {
                abortStream(stream);
                reject(new DaytonaError_1.DaytonaError(`Received unexpected file "${fileInfo?.filename}".`));
                return;
            }
            const metadata = metadataMap.get(source);
            if (!metadata) {
                abortStream(stream);
                reject(new DaytonaError_1.DaytonaError(`Target metadata missing for valid source: ${source}`));
                return;
            }
            if (fieldName === 'error') {
                // Collect error message
                const chunks = [];
                fileStream.on('data', (chunk) => chunks.push(chunk));
                fileStream.on('end', () => {
                    metadata.error = buffer_1.Buffer.concat(chunks).toString('utf-8').trim();
                });
                fileStream.on('error', (err) => {
                    metadata.error = `Stream error: ${err.message}`;
                });
            }
            else if (fieldName === 'file') {
                if (metadata.destination) {
                    // Stream to file
                    fileTasks.push(new Promise((resolveTask) => {
                        (0, Import_1.dynamicImport)('fs', 'Downloading files to local files is not supported: ').then((fs) => {
                            const writeStream = fs.createWriteStream(metadata.destination, { autoClose: true });
                            fileStream.pipe(writeStream);
                            writeStream.on('finish', () => {
                                metadata.result = metadata.destination;
                                resolveTask();
                            });
                            writeStream.on('error', (err) => {
                                metadata.error = `Write stream failed: ${err.message}`;
                                resolveTask();
                            });
                            fileStream.on('error', (err) => {
                                metadata.error = `Read stream failed: ${err.message}`;
                            });
                        });
                    }));
                }
                else {
                    // Collect to buffer
                    const chunks = [];
                    fileStream.on('data', (chunk) => {
                        chunks.push(buffer_1.Buffer.isBuffer(chunk) ? chunk : buffer_1.Buffer.from(chunk));
                    });
                    fileStream.on('end', () => {
                        metadata.result = buffer_1.Buffer.concat(chunks);
                    });
                    fileStream.on('error', (err) => {
                        metadata.error = `Read failed: ${err.message}`;
                    });
                }
            }
            else {
                // Unknown field, drain it
                fileStream.resume();
            }
        });
        bb.on('error', (err) => {
            abortStream(stream);
            reject(err);
        });
        bb.on('finish', resolve);
        // Feed stream into busboy
        feedStreamToBusboy(stream, bb).catch((err) => bb.destroy(err));
    });
    await Promise.all(fileTasks);
}
/**
 * Feeds various stream types into busboy
 */
async function feedStreamToBusboy(stream, bb) {
    // Node.js stream (piping)
    if (typeof stream?.pipe === 'function') {
        stream.pipe(bb);
        return;
    }
    // Direct buffer-like data
    if (typeof stream === 'string' || stream instanceof ArrayBuffer || ArrayBuffer.isView(stream)) {
        const data = (0, Binary_1.toUint8Array)(stream);
        bb.write(buffer_1.Buffer.from(data));
        bb.end();
        return;
    }
    // WHATWG ReadableStream
    if (typeof stream?.getReader === 'function') {
        const reader = stream.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            bb.write(buffer_1.Buffer.from(value));
        }
        bb.end();
        return;
    }
    // AsyncIterable
    if (stream?.[Symbol.asyncIterator]) {
        for await (const chunk of stream) {
            const buffer = buffer_1.Buffer.isBuffer(chunk) ? chunk : buffer_1.Buffer.from((0, Binary_1.toUint8Array)(chunk));
            bb.write(buffer);
        }
        bb.end();
        return;
    }
    // Unsupported stream type
    throw new DaytonaError_1.DaytonaError(`Unsupported stream type: ${stream?.constructor?.name || typeof stream}`);
}
async function processDownloadFilesResponseWithBuffered(stream, headers, metadataMap) {
    const contentType = (0, Multipart_1.getHeader)(headers, 'content-type') || '';
    const bodyBytes = await (0, Binary_1.collectStreamBytes)(stream);
    // Try native FormData parsing for multipart/form-data
    if (/^multipart\/form-data/i.test(contentType) && typeof Response !== 'undefined') {
        try {
            const formDataMap = await (0, Multipart_1.parseMultipartWithFormData)(bodyBytes, contentType);
            formDataMap.forEach((value, fieldName) => {
                const metadata = metadataMap.get(value.filename);
                if (!metadata)
                    return;
                if (fieldName.includes('error')) {
                    metadata.error = new TextDecoder('utf-8').decode(value.data).trim();
                }
                else {
                    metadata.result = (0, Binary_1.toBuffer)(value.data);
                }
            });
            return;
        }
        catch {
            // Fall through to manual parsing
        }
    }
    // Manual multipart parsing (handles multipart/mixed, etc.)
    const boundary = (0, Multipart_1.extractBoundary)(contentType);
    if (!boundary) {
        throw new DaytonaError_1.DaytonaError(`Missing multipart boundary in Content-Type: "${contentType}"`);
    }
    const parts = (0, Multipart_2.parseMultipart)(bodyBytes, boundary);
    for (const part of parts) {
        if (!part.filename)
            continue;
        const metadata = metadataMap.get(part.filename);
        if (!metadata)
            continue;
        if (part.name === 'error') {
            metadata.error = new TextDecoder('utf-8').decode(part.data).trim();
        }
        else if (part.name === 'file') {
            metadata.result = (0, Binary_1.toBuffer)(part.data);
        }
    }
    return;
}
//# sourceMappingURL=FileTransfer.js.map