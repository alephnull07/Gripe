"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractBoundary = extractBoundary;
exports.parseMultipart = parseMultipart;
exports.parseMultipartWithFormData = parseMultipartWithFormData;
exports.getHeader = getHeader;
const Binary_1 = require("./Binary");
/**
 * Extracts the boundary from a Content-Type header
 */
function extractBoundary(contentType) {
    const match = /boundary="?([^";]+)"?/i.exec(contentType || '');
    return match ? match[1] : null;
}
/**
 * Extracts a parameter value from Content-Disposition header
 */
function getDispositionParam(disposition, paramName) {
    const match = disposition.match(new RegExp(`${paramName}\\*?=([^;]+)`, 'i'));
    if (!match)
        return undefined;
    return match[1].replace(/^"|"$/g, '').trim();
}
/**
 * Parses multipart/form-data or multipart/mixed response body
 */
function parseMultipart(body, boundary) {
    const encoder = new TextEncoder();
    const dashBoundary = encoder.encode(`--${boundary}`);
    const crlf = encoder.encode('\r\n');
    const boundaryLine = (0, Binary_1.concatUint8Arrays)([dashBoundary, crlf]);
    const boundaryPositions = (0, Binary_1.findAllBytes)(body, dashBoundary);
    if (boundaryPositions.length === 0)
        return [];
    const parts = [];
    for (let i = 0; i < boundaryPositions.length; i++) {
        const start = boundaryPositions[i];
        // Headers start after "--boundary\r\n"
        const headerStart = (0, Binary_1.indexAfterSequence)(body, start, boundaryLine);
        if (headerStart < 0)
            continue;
        // Part ends before next boundary
        const nextBoundary = boundaryPositions[i + 1] ?? body.length;
        let partEnd = nextBoundary - 2; // Remove trailing CRLF
        if (partEnd < headerStart)
            partEnd = headerStart;
        // Find headers/body separator (\r\n\r\n)
        const separator = (0, Binary_1.findBytesInRange)(body, headerStart, partEnd, encoder.encode('\r\n\r\n'));
        if (separator < 0)
            continue;
        // Parse headers
        const headersText = (0, Binary_1.utf8Decode)(body.subarray(headerStart, separator));
        const headers = {};
        headersText.split(/\r\n/).forEach((line) => {
            const [key, ...valueParts] = line.split(':');
            if (valueParts.length > 0) {
                headers[key.trim().toLowerCase()] = valueParts.join(':').trim();
            }
        });
        // Extract body
        const dataStart = separator + 4;
        const data = body.subarray(dataStart, partEnd);
        // Extract name and filename from Content-Disposition
        const disposition = headers['content-disposition'] || '';
        const name = getDispositionParam(disposition, 'name');
        const filename = getDispositionParam(disposition, 'filename');
        parts.push({ name, filename, headers, data });
    }
    return parts;
}
/**
 * Parses multipart response using browser's native FormData API
 * This is more reliable than manual parsing when available
 */
async function parseMultipartWithFormData(bodyBytes, contentType) {
    const result = new Map();
    // Create a Blob and parse with FormData API
    const blob = new Blob([bodyBytes.slice()], { type: contentType });
    const formData = await new Response(blob).formData();
    // Process FormData entries (forEach is more universally supported than entries())
    const filePromises = [];
    formData.forEach((value, fieldName) => {
        if ((0, Binary_1.isFile)(value)) {
            filePromises.push((async () => {
                const file = value;
                const arrayBuffer = await file.arrayBuffer();
                result.set(fieldName, {
                    filename: file.name,
                    data: new Uint8Array(arrayBuffer),
                });
            })());
        }
    });
    await Promise.all(filePromises);
    return result;
}
/**
 * Extracts a header value from response headers (case-insensitive)
 */
function getHeader(headers, key) {
    if (!headers)
        return undefined;
    const headerKey = Object.keys(headers).find((h) => h.toLowerCase() === key.toLowerCase());
    if (!headerKey)
        return undefined;
    const value = headers[headerKey];
    return Array.isArray(value) ? value[0] : value;
}
//# sourceMappingURL=Multipart.js.map