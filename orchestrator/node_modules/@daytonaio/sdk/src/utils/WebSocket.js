"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSandboxWebSocket = createSandboxWebSocket;
const tslib_1 = require("tslib");
const isomorphic_ws_1 = tslib_1.__importDefault(require("isomorphic-ws"));
const Runtime_1 = require("./Runtime");
/**
 * Creates an authenticated WebSocket connection to the sandbox toolbox.
 *
 * @param url - The websocket URL (ws[s]://...)
 * @param headers - Headers to forward when running in Node environments
 * @param getPreviewToken - Lazy getter for preview tokens (required for browser/serverless runtimes)
 */
async function createSandboxWebSocket(url, headers, getPreviewToken) {
    if (Runtime_1.RUNTIME === Runtime_1.Runtime.BROWSER || Runtime_1.RUNTIME === Runtime_1.Runtime.DENO || Runtime_1.RUNTIME === Runtime_1.Runtime.SERVERLESS) {
        const previewToken = await getPreviewToken();
        const separator = url.includes('?') ? '&' : '?';
        return new isomorphic_ws_1.default(`${url}${separator}DAYTONA_SANDBOX_AUTH_KEY=${previewToken}`, `X-Daytona-SDK-Version~${String(headers['X-Daytona-SDK-Version'] ?? '')}`);
    }
    return new isomorphic_ws_1.default(url, { headers });
}
//# sourceMappingURL=WebSocket.js.map