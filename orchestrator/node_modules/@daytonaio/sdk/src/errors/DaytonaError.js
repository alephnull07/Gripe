"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DaytonaTimeoutError = exports.DaytonaRateLimitError = exports.DaytonaNotFoundError = exports.DaytonaError = void 0;
/**
 * Base error for Daytona SDK.
 */
class DaytonaError extends Error {
    /** HTTP status code if available */
    statusCode;
    /** Response headers if available */
    headers;
    constructor(message, statusCode, headers) {
        super(message);
        this.name = 'DaytonaError';
        this.statusCode = statusCode;
        this.headers = headers;
    }
}
exports.DaytonaError = DaytonaError;
class DaytonaNotFoundError extends DaytonaError {
    constructor(message, statusCode, headers) {
        super(message, statusCode, headers);
        this.name = 'DaytonaNotFoundError';
    }
}
exports.DaytonaNotFoundError = DaytonaNotFoundError;
/**
 * Error thrown when rate limit is exceeded.
 */
class DaytonaRateLimitError extends DaytonaError {
    constructor(message, statusCode, headers) {
        super(message, statusCode, headers);
        this.name = 'DaytonaRateLimitError';
    }
}
exports.DaytonaRateLimitError = DaytonaRateLimitError;
/**
 * Error thrown when a timeout occurs.
 */
class DaytonaTimeoutError extends DaytonaError {
    constructor(message, statusCode, headers) {
        super(message, statusCode, headers);
        this.name = 'DaytonaTimeoutError';
    }
}
exports.DaytonaTimeoutError = DaytonaTimeoutError;
//# sourceMappingURL=DaytonaError.js.map