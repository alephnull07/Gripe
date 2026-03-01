"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamicImport = dynamicImport;
exports.dynamicRequire = dynamicRequire;
const DaytonaError_1 = require("../errors/DaytonaError");
const Runtime_1 = require("./Runtime");
const loaderMap = {
    'fast-glob': () => import('fast-glob'),
    '@iarna/toml': () => import('@iarna/toml'),
    stream: () => import('stream'),
    tar: () => import('tar'),
    'expand-tilde': () => import('expand-tilde'),
    ObjectStorage: () => import('../ObjectStorage.js'),
    fs: () => import('fs'),
    'form-data': () => import('form-data'),
    util: () => import('util'),
};
const requireMap = {
    'fast-glob': () => require('fast-glob'),
    '@iarna/toml': () => require('@iarna/toml'),
    stream: () => require('stream'),
    tar: () => require('tar'),
    'expand-tilde': () => require('expand-tilde'),
    fs: () => require('fs'),
    'form-data': () => require('form-data'),
};
const validateMap = {
    'fast-glob': (mod) => typeof mod === 'function' && typeof mod?.sync === 'function',
    '@iarna/toml': (mod) => typeof mod.parse === 'function' && typeof mod.stringify === 'function',
    stream: (mod) => typeof mod.Readable === 'function' && typeof mod.Writable === 'function',
    tar: (mod) => typeof mod.extract === 'function' && typeof mod.create === 'function',
    'expand-tilde': (mod) => typeof mod === 'function',
    fs: (mod) => typeof mod.createReadStream === 'function' && typeof mod.readFile === 'function',
    'form-data': (mod) => typeof mod === 'function',
    util: (mod) => typeof mod.promisify === 'function',
};
async function dynamicImport(name, errorPrefix) {
    const loader = loaderMap[name];
    if (!loader) {
        throw new DaytonaError_1.DaytonaError(`${errorPrefix || ''} Unknown module "${name}"`);
    }
    let mod;
    try {
        mod = (await loader());
        mod = mod?.default ?? mod;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new DaytonaError_1.DaytonaError(`${errorPrefix || ''} Module "${name}" is not available in the "${Runtime_1.RUNTIME}" runtime: ${msg}`);
    }
    if (validateMap[name] && !validateMap[name](mod)) {
        throw new DaytonaError_1.DaytonaError(`${errorPrefix || ''} Module "${name}" didn't pass import validation in the "${Runtime_1.RUNTIME}" runtime`);
    }
    return mod;
}
function dynamicRequire(name, errorPrefix) {
    const loader = requireMap[name];
    if (!loader) {
        throw new DaytonaError_1.DaytonaError(`${errorPrefix || ''} Unknown module "${name}"`);
    }
    let mod;
    try {
        mod = loader();
        mod = mod?.default ?? mod;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new DaytonaError_1.DaytonaError(`${errorPrefix || ''} Module "${name}" is not available in the "${Runtime_1.RUNTIME}" runtime: ${msg}`);
    }
    if (validateMap[name] && !validateMap[name](mod)) {
        throw new DaytonaError_1.DaytonaError(`${errorPrefix || ''} Module "${name}" didn't pass import validation in the "${Runtime_1.RUNTIME}" runtime`);
    }
    return mod;
}
//# sourceMappingURL=Import.js.map