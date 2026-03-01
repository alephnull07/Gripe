"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxJsCodeToolbox = void 0;
const buffer_1 = require("buffer");
class SandboxJsCodeToolbox {
    getRunCommand(code, params) {
        const base64Code = buffer_1.Buffer.from(code).toString('base64');
        const argv = params?.argv ? params.argv.join(' ') : '';
        return `sh -c 'echo ${base64Code} | base64 --decode | node -e "$(cat)" ${argv} 2>&1 | grep -vE "npm notice"'`;
    }
}
exports.SandboxJsCodeToolbox = SandboxJsCodeToolbox;
//# sourceMappingURL=SandboxJsCodeToolbox.js.map