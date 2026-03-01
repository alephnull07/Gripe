"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxTsCodeToolbox = void 0;
const buffer_1 = require("buffer");
class SandboxTsCodeToolbox {
    getRunCommand(code, params) {
        const base64Code = buffer_1.Buffer.from(code).toString('base64');
        const argv = params?.argv ? params.argv.join(' ') : '';
        // eslint-disable-next-line no-useless-escape
        return `sh -c 'echo ${base64Code} | base64 --decode | npx ts-node -O "{\\\"module\\\":\\\"CommonJS\\\"}" -e "$(cat)" x ${argv} 2>&1 | grep -vE "npm notice"'`;
    }
}
exports.SandboxTsCodeToolbox = SandboxTsCodeToolbox;
//# sourceMappingURL=SandboxTsCodeToolbox.js.map