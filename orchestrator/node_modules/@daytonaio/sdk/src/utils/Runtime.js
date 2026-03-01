"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RUNTIME = exports.Runtime = void 0;
exports.getEnvVar = getEnvVar;
exports.isServerlessRuntime = isServerlessRuntime;
var Runtime;
(function (Runtime) {
    Runtime["NODE"] = "node";
    Runtime["DENO"] = "deno";
    Runtime["BUN"] = "bun";
    Runtime["BROWSER"] = "browser";
    Runtime["SERVERLESS"] = "serverless";
    Runtime["UNKNOWN"] = "unknown";
})(Runtime || (exports.Runtime = Runtime = {}));
exports.RUNTIME = typeof Deno !== 'undefined'
    ? Runtime.DENO
    : typeof Bun !== 'undefined' && !!Bun.version
        ? Runtime.BUN
        : isServerlessRuntime()
            ? Runtime.SERVERLESS
            : typeof window !== 'undefined'
                ? Runtime.BROWSER
                : typeof process !== 'undefined' && !!process.versions?.node
                    ? Runtime.NODE
                    : Runtime.UNKNOWN;
function getEnvVar(name) {
    if (exports.RUNTIME === Runtime.NODE || exports.RUNTIME === Runtime.BUN) {
        return process.env[name];
    }
    if (exports.RUNTIME === Runtime.DENO) {
        return Deno.env.get(name);
    }
    return undefined;
}
function isServerlessRuntime() {
    // Safely grab env vars, even if `process` is undeclared
    const env = typeof process !== 'undefined' ? process.env : {};
    // Worker-specific globals
    const globalObj = globalThis;
    return Boolean(
    // Cloudflare Workers (V8 isolate API)
    typeof globalObj.WebSocketPair === 'function' ||
        // Cloudflare Pages
        env.CF_PAGES === '1' ||
        // AWS Lambda (incl. SAM local)
        env.AWS_EXECUTION_ENV?.startsWith('AWS_Lambda') ||
        env.LAMBDA_TASK_ROOT !== undefined ||
        env.AWS_SAM_LOCAL === 'true' ||
        // Azure Functions
        env.FUNCTIONS_WORKER_RUNTIME !== undefined ||
        // Google Cloud Functions / Cloud Run
        (env.FUNCTION_TARGET !== undefined && env.FUNCTION_SIGNATURE_TYPE !== undefined) ||
        // Vercel
        env.VERCEL === '1' ||
        // Netlify Functions
        env.SITE_NAME !== undefined);
}
//# sourceMappingURL=Runtime.js.map