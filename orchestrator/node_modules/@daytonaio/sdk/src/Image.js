"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Image = void 0;
const tslib_1 = require("tslib");
const pathe = tslib_1.__importStar(require("pathe"));
const shell_quote_1 = require("shell-quote");
const DaytonaError_1 = require("./errors/DaytonaError");
const Import_1 = require("./utils/Import");
const SUPPORTED_PYTHON_SERIES = ['3.9', '3.10', '3.11', '3.12', '3.13'];
const LATEST_PYTHON_MICRO_VERSIONS = ['3.9.22', '3.10.17', '3.11.12', '3.12.10', '3.13.3'];
/**
 * Represents an image definition for a Daytona sandbox.
 * Do not construct this class directly. Instead use one of its static factory methods,
 * such as `Image.base()`, `Image.debianSlim()` or `Image.fromDockerfile()`.
 *
 * @class
 * @property {string} dockerfile - The Dockerfile content.
 * @property {Context[]} contextList - The list of context files to be added to the image.
 */
class Image {
    _dockerfile = '';
    _contextList = [];
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    constructor() { }
    get dockerfile() {
        return this._dockerfile;
    }
    get contextList() {
        return this._contextList;
    }
    /**
     * Adds commands to install packages using pip.
     *
     * @param {string | string[]} packages - The packages to install.
     * @param {Object} options - The options for the pip install command.
     * @param {string[]} options.findLinks - The find-links to use for the pip install command.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image.debianSlim('3.12').pipInstall('numpy', { findLinks: ['https://pypi.org/simple'] })
     */
    pipInstall(packages, options) {
        const pkgs = this.flattenStringArgs('pipInstall', 'packages', packages);
        if (!pkgs.length)
            return this;
        const extraArgs = this.formatPipInstallArgs(options);
        this._dockerfile += `RUN python -m pip install ${(0, shell_quote_1.quote)(pkgs.sort())}${extraArgs}\n`;
        return this;
    }
    /**
     * Installs dependencies from a requirements.txt file.
     *
     * @param {string} requirementsTxt - The path to the requirements.txt file.
     * @param {PipInstallOptions} options - The options for the pip install command.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image.debianSlim('3.12')
     * image.pipInstallFromRequirements('requirements.txt', { findLinks: ['https://pypi.org/simple'] })
     */
    pipInstallFromRequirements(requirementsTxt, options) {
        const importErrorPrefix = '"pipInstallFromRequirements" is not supported: ';
        const expandTilde = (0, Import_1.dynamicRequire)('expand-tilde', importErrorPrefix);
        const fs = (0, Import_1.dynamicRequire)('fs', importErrorPrefix);
        const expandedPath = expandTilde(requirementsTxt);
        if (!fs.existsSync(expandedPath)) {
            throw new Error(`Requirements file ${requirementsTxt} does not exist`);
        }
        const extraArgs = this.formatPipInstallArgs(options);
        this._contextList.push({ sourcePath: expandedPath, archivePath: expandedPath });
        this._dockerfile += `COPY ${expandedPath} /.requirements.txt\n`;
        this._dockerfile += `RUN python -m pip install -r /.requirements.txt${extraArgs}\n`;
        return this;
    }
    /**
     * Installs dependencies from a pyproject.toml file.
     *
     * @param {string} pyprojectToml - The path to the pyproject.toml file.
     * @param {PyprojectOptions} options - The options for the pip install command.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image.debianSlim('3.12')
     * image.pipInstallFromPyproject('pyproject.toml', { optionalDependencies: ['dev'] })
     */
    pipInstallFromPyproject(pyprojectToml, options) {
        const importErrorPrefix = '"pipInstallFromPyproject" is not supported: ';
        const expandTilde = (0, Import_1.dynamicRequire)('expand-tilde', importErrorPrefix);
        const toml = (0, Import_1.dynamicRequire)('@iarna/toml', importErrorPrefix);
        const fs = (0, Import_1.dynamicRequire)('fs', importErrorPrefix);
        const tomlData = toml.parse(fs.readFileSync(expandTilde(pyprojectToml), 'utf-8'));
        const dependencies = [];
        if (!tomlData || !tomlData.project || !Array.isArray(tomlData.project.dependencies)) {
            const msg = 'No [project.dependencies] section in pyproject.toml file. ' +
                'See https://packaging.python.org/en/latest/guides/writing-pyproject-toml ' +
                'for further file format guidelines.';
            throw new DaytonaError_1.DaytonaError(msg);
        }
        dependencies.push(...tomlData.project.dependencies);
        if (options?.optionalDependencies && tomlData.project['optional-dependencies']) {
            const optionalGroups = tomlData.project['optional-dependencies'];
            for (const group of options.optionalDependencies) {
                const deps = optionalGroups[group];
                if (Array.isArray(deps)) {
                    dependencies.push(...deps);
                }
            }
        }
        return this.pipInstall(dependencies, options);
    }
    /**
     * Adds a local file to the image.
     *
     * @param {string} localPath - The path to the local file.
     * @param {string} remotePath - The path of the file in the image.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image
     *  .debianSlim('3.12')
     *  .addLocalFile('requirements.txt', '/home/daytona/requirements.txt')
     */
    addLocalFile(localPath, remotePath) {
        const importErrorPrefix = '"addLocalFile" is not supported: ';
        const expandTilde = (0, Import_1.dynamicRequire)('expand-tilde', importErrorPrefix);
        if (remotePath.endsWith('/')) {
            remotePath = remotePath + pathe.basename(localPath);
        }
        const expandedPath = expandTilde(localPath);
        this._contextList.push({ sourcePath: expandedPath, archivePath: expandedPath });
        this._dockerfile += `COPY ${expandedPath} ${remotePath}\n`;
        return this;
    }
    /**
     * Adds a local directory to the image.
     *
     * @param {string} localPath - The path to the local directory.
     * @param {string} remotePath - The path of the directory in the image.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image
     *  .debianSlim('3.12')
     *  .addLocalDir('src', '/home/daytona/src')
     */
    addLocalDir(localPath, remotePath) {
        const importErrorPrefix = '"addLocalDir" is not supported: ';
        const expandTilde = (0, Import_1.dynamicRequire)('expand-tilde', importErrorPrefix);
        const expandedPath = expandTilde(localPath);
        this._contextList.push({ sourcePath: expandedPath, archivePath: expandedPath });
        this._dockerfile += `COPY ${expandedPath} ${remotePath}\n`;
        return this;
    }
    /**
     * Runs commands in the image.
     *
     * @param {string | string[]} commands - The commands to run.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image
     *  .debianSlim('3.12')
     *  .runCommands(
     *    'echo "Hello, world!"',
     *    ['bash', '-c', 'echo Hello, world, again!']
     *  )
     */
    runCommands(...commands) {
        for (const command of commands) {
            if (Array.isArray(command)) {
                this._dockerfile += `RUN ${command.map((c) => `"${c.replace(/"/g, '\\\\\\"').replace(/'/g, "\\'")}"`).join(' ')}\n`;
            }
            else {
                this._dockerfile += `RUN ${command}\n`;
            }
        }
        return this;
    }
    /**
     * Sets environment variables in the image.
     *
     * @param {Record<string, string>} envVars - The environment variables to set.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image
     *  .debianSlim('3.12')
     *  .env({ FOO: 'bar' })
     */
    env(envVars) {
        const nonStringKeys = Object.entries(envVars)
            .filter(([, value]) => typeof value !== 'string')
            .map(([key]) => key);
        if (nonStringKeys.length) {
            throw new Error(`Image ENV variables must be strings. Invalid keys: ${nonStringKeys}`);
        }
        for (const [key, val] of Object.entries(envVars)) {
            this._dockerfile += `ENV ${key}=${(0, shell_quote_1.quote)([val])}\n`;
        }
        return this;
    }
    /**
     * Sets the working directory in the image.
     *
     * @param {string} dirPath - The path to the working directory.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image
     *  .debianSlim('3.12')
     *  .workdir('/home/daytona')
     */
    workdir(dirPath) {
        this._dockerfile += `WORKDIR ${(0, shell_quote_1.quote)([dirPath])}\n`;
        return this;
    }
    /**
     * Sets the entrypoint for the image.
     *
     * @param {string[]} entrypointCommands - The commands to set as the entrypoint.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image
     *  .debianSlim('3.12')
     *  .entrypoint(['/bin/bash'])
     */
    entrypoint(entrypointCommands) {
        if (!Array.isArray(entrypointCommands) || !entrypointCommands.every((x) => typeof x === 'string')) {
            throw new Error('entrypoint_commands must be a list of strings');
        }
        const argsStr = entrypointCommands.map((arg) => `"${arg}"`).join(', ');
        this._dockerfile += `ENTRYPOINT [${argsStr}]\n`;
        return this;
    }
    /**
     * Sets the default command for the image.
     *
     * @param {string[]} cmd - The command to set as the default command.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image
     *  .debianSlim('3.12')
     *  .cmd(['/bin/bash'])
     */
    cmd(cmd) {
        if (!Array.isArray(cmd) || !cmd.every((x) => typeof x === 'string')) {
            throw new Error('Image CMD must be a list of strings');
        }
        const cmdStr = cmd.map((arg) => `"${arg}"`).join(', ');
        this._dockerfile += `CMD [${cmdStr}]\n`;
        return this;
    }
    /**
     * Extends an image with arbitrary Dockerfile-like commands.
     *
     * @param {string | string[]} dockerfileCommands - The commands to add to the Dockerfile.
     * @param {string} contextDir - The path to the context directory.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image
     *  .debianSlim('3.12')
     *  .dockerfileCommands(['RUN echo "Hello, world!"'])
     */
    dockerfileCommands(dockerfileCommands, contextDir) {
        if (contextDir) {
            const importErrorPrefix = '"dockerfileCommands" is not supported: ';
            const expandTilde = (0, Import_1.dynamicRequire)('expand-tilde', importErrorPrefix);
            const fs = (0, Import_1.dynamicRequire)('fs', importErrorPrefix);
            const expandedPath = expandTilde(contextDir);
            if (!fs.existsSync(expandedPath) || !fs.statSync(expandedPath).isDirectory()) {
                throw new Error(`Context directory ${contextDir} does not exist`);
            }
        }
        for (const [contextPath, originalPath] of Image.extractCopySources(dockerfileCommands.join('\n'), contextDir || '')) {
            let archiveBasePath = contextPath;
            if (contextDir && !originalPath.startsWith(contextDir)) {
                archiveBasePath = contextPath.substring(contextDir.length);
                // Remove leading separators
                // eslint-disable-next-line no-useless-escape
                archiveBasePath = archiveBasePath.replace(/^[\/\\]+/, '');
            }
            this._contextList.push({ sourcePath: contextPath, archivePath: archiveBasePath });
        }
        this._dockerfile += dockerfileCommands.join('\n') + '\n';
        return this;
    }
    /**
     * Creates an Image from an existing Dockerfile.
     *
     * @param {string} path - The path to the Dockerfile.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image.fromDockerfile('Dockerfile')
     */
    static fromDockerfile(path) {
        const importErrorPrefix = '"fromDockerfile" is not supported: ';
        const expandTilde = (0, Import_1.dynamicRequire)('expand-tilde', importErrorPrefix);
        const fs = (0, Import_1.dynamicRequire)('fs', importErrorPrefix);
        const expandedPath = pathe.resolve(expandTilde(path));
        if (!fs.existsSync(expandedPath)) {
            throw new Error(`Dockerfile ${path} does not exist`);
        }
        const dockerfileContent = fs.readFileSync(expandedPath, 'utf-8');
        const img = new Image();
        img._dockerfile = dockerfileContent;
        // Remove dockerfile filename from path to get the path prefix
        const pathPrefix = pathe.dirname(expandedPath) + pathe.sep;
        for (const [contextPath, originalPath] of Image.extractCopySources(dockerfileContent, pathPrefix)) {
            let archiveBasePath = contextPath;
            if (!originalPath.startsWith(pathPrefix)) {
                // Remove the path prefix from the context path to get the archive path
                archiveBasePath = contextPath.substring(pathPrefix.length);
                // Remove leading separators
                // eslint-disable-next-line no-useless-escape
                archiveBasePath = archiveBasePath.replace(/^[\/\\]+/, '');
            }
            img._contextList.push({ sourcePath: contextPath, archivePath: archiveBasePath });
        }
        return img;
    }
    /**
     * Creates an Image from an existing base image.
     *
     * @param {string} image - The base image to use.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image.base('python:3.12-slim-bookworm')
     */
    static base(image) {
        const img = new Image();
        img._dockerfile = `FROM ${image}\n`;
        return img;
    }
    /**
     * Creates a Debian slim image based on the official Python Docker image.
     *
     * @param {string} pythonVersion - The Python version to use.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image.debianSlim('3.12')
     */
    static debianSlim(pythonVersion) {
        const version = Image.processPythonVersion(pythonVersion);
        const img = new Image();
        const commands = [
            `FROM python:${version}-slim-bookworm`,
            'RUN apt-get update',
            'RUN apt-get install -y gcc gfortran build-essential',
            'RUN pip install --upgrade pip',
            // Set debian front-end to non-interactive to avoid users getting stuck with input prompts.
            "RUN echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections",
        ];
        img._dockerfile = commands.join('\n') + '\n';
        return img;
    }
    /**
     * Formats pip install arguments in a single string.
     *
     * @param {PipInstallOptions} options - The options for the pip install command.
     * @returns {string} The formatted pip install arguments.
     */
    formatPipInstallArgs(options) {
        if (!options)
            return '';
        let extraArgs = '';
        if (options.findLinks) {
            for (const findLink of options.findLinks) {
                extraArgs += ` --find-links ${(0, shell_quote_1.quote)([findLink])}`;
            }
        }
        if (options.indexUrl) {
            extraArgs += ` --index-url ${(0, shell_quote_1.quote)([options.indexUrl])}`;
        }
        if (options.extraIndexUrls) {
            for (const extraIndexUrl of options.extraIndexUrls) {
                extraArgs += ` --extra-index-url ${(0, shell_quote_1.quote)([extraIndexUrl])}`;
            }
        }
        if (options.pre) {
            extraArgs += ' --pre';
        }
        if (options.extraOptions) {
            extraArgs += ` ${options.extraOptions.trim()}`;
        }
        return extraArgs;
    }
    /**
     * Flattens a string argument.
     *
     * @param {string} functionName - The name of the function.
     * @param {string} argName - The name of the argument.
     * @param {any} args - The argument to flatten.
     * @returns {string[]} The flattened argument.
     */
    flattenStringArgs(functionName, argName, args) {
        const result = [];
        const flatten = (arg) => {
            if (typeof arg === 'string') {
                result.push(arg);
            }
            else if (Array.isArray(arg)) {
                for (const item of arg) {
                    flatten(item);
                }
            }
            else {
                throw new Error(`${functionName}: ${argName} must only contain strings`);
            }
        };
        flatten(args);
        return result;
    }
    /**
     * Processes the Python version.
     *
     * @param {string} pythonVersion - The Python version to use.
     * @returns {string} The processed Python version.
     */
    static processPythonVersion(pythonVersion) {
        if (!pythonVersion) {
            // Default to latest
            pythonVersion = SUPPORTED_PYTHON_SERIES[SUPPORTED_PYTHON_SERIES.length - 1];
        }
        if (!SUPPORTED_PYTHON_SERIES.includes(pythonVersion)) {
            throw new Error(`Unsupported Python version: ${pythonVersion}. ` +
                `Daytona supports the following series: ${SUPPORTED_PYTHON_SERIES.join(', ')}`);
        }
        // Map series to latest micro version
        const seriesMap = Object.fromEntries(LATEST_PYTHON_MICRO_VERSIONS.map((v) => {
            const [major, minor, micro] = v.split('.');
            return [`${major}.${minor}`, micro];
        }));
        const micro = seriesMap[pythonVersion];
        return `${pythonVersion}.${micro}`;
    }
    /**
     * Extracts source files from COPY commands in a Dockerfile.
     *
     * @param {string} dockerfileContent - The content of the Dockerfile.
     * @param {string} pathPrefix - The path prefix to use for the sources.
     * @returns {Array<[string, string]>} The list of the actual file path and its corresponding COPY-command source path.
     */
    static extractCopySources(dockerfileContent, pathPrefix = '') {
        const sources = [];
        const lines = dockerfileContent.split('\n');
        for (const line of lines) {
            // Skip empty lines and comments
            if (!line.trim() || line.trim().startsWith('#')) {
                continue;
            }
            // Check if the line contains a COPY command
            if (/^\s*COPY\s+(?!.*--from=)/i.test(line)) {
                // Skip COPY instructions that use heredoc syntax (inline content, not file references)
                if (line.includes('<<')) {
                    continue;
                }
                const importErrorPrefix = '"extractCopySources" is not supported: ';
                const fg = (0, Import_1.dynamicRequire)('fast-glob', importErrorPrefix);
                const commandParts = this.parseCopyCommand(line);
                if (commandParts) {
                    // Get source paths from the parsed command parts
                    for (const source of commandParts.sources) {
                        // Handle absolute and relative paths differently
                        const fullPathPattern = pathe.isAbsolute(source) ? source : pathe.join(pathPrefix, source);
                        const matchingFiles = fg.sync([fullPathPattern], { dot: true });
                        if (matchingFiles.length > 0) {
                            for (const matchingFile of matchingFiles) {
                                sources.push([matchingFile, source]);
                            }
                        }
                        else {
                            sources.push([fullPathPattern, source]);
                        }
                    }
                }
            }
        }
        return sources;
    }
    /**
     * Parses a COPY command to extract sources and destination.
     *
     * @param {string} line - The line to parse.
     * @returns {Object} The parsed sources and destination.
     */
    static parseCopyCommand(line) {
        // Remove initial "COPY" and strip whitespace
        const parts = line.trim().substring(4).trim();
        // Handle JSON array format: COPY ["src1", "src2", "dest"]
        if (parts.startsWith('[')) {
            try {
                // Parse the JSON-like array format
                const elements = (0, shell_quote_1.parse)(parts.replace('[', '').replace(']', '')).filter((x) => typeof x === 'string');
                if (elements.length < 2) {
                    return null;
                }
                return {
                    sources: elements.slice(0, -1),
                    dest: elements[elements.length - 1],
                };
            }
            catch {
                return null;
            }
        }
        // Handle regular format with possible flags
        const splitParts = (0, shell_quote_1.parse)(parts).filter((x) => typeof x === 'string');
        // Extract flags like --chown, --chmod, --from
        let sourcesStartIdx = 0;
        for (let i = 0; i < splitParts.length; i++) {
            const part = splitParts[i];
            if (part.startsWith('--')) {
                // Skip the flag and its value if it has one
                if (!part.includes('=') && i + 1 < splitParts.length && !splitParts[i + 1].startsWith('--')) {
                    sourcesStartIdx = i + 2;
                }
                else {
                    sourcesStartIdx = i + 1;
                }
            }
            else {
                break;
            }
        }
        // After skipping flags, we need at least one source and one destination
        if (splitParts.length - sourcesStartIdx < 2) {
            return null;
        }
        return {
            sources: splitParts.slice(sourcesStartIdx, -1),
            dest: splitParts[splitParts.length - 1],
        };
    }
}
exports.Image = Image;
//# sourceMappingURL=Image.js.map