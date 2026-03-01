declare const SUPPORTED_PYTHON_SERIES: readonly ["3.9", "3.10", "3.11", "3.12", "3.13"];
type SupportedPythonSeries = (typeof SUPPORTED_PYTHON_SERIES)[number];
/**
 * Represents a context file to be added to the image.
 *
 * @interface
 * @property {string} sourcePath - The path to the source file or directory.
 * @property {string} archivePath - The path inside the archive file in object storage.
 */
export interface Context {
    sourcePath: string;
    archivePath: string;
}
/**
 * Options for the pip install command.
 *
 * @interface
 * @property {string[]} findLinks - The find-links to use for the pip install command.
 * @property {string} indexUrl - The index URL to use for the pip install command.
 * @property {string[]} extraIndexUrls - The extra index URLs to use for the pip install command.
 * @property {boolean} pre - Whether to install pre-release versions.
 * @property {string} extraOptions - The extra options to use for the pip install command. Given string is passed directly to the pip install command.
 */
export interface PipInstallOptions {
    findLinks?: string[];
    indexUrl?: string;
    extraIndexUrls?: string[];
    pre?: boolean;
    extraOptions?: string;
}
/**
 * Options for the pip install command from a pyproject.toml file.
 *
 * @interface
 * @property {string[]} optionalDependencies - The optional dependencies to install.
 *
 * @extends {PipInstallOptions}
 */
export interface PyprojectOptions extends PipInstallOptions {
    optionalDependencies?: string[];
}
/**
 * Represents an image definition for a Daytona sandbox.
 * Do not construct this class directly. Instead use one of its static factory methods,
 * such as `Image.base()`, `Image.debianSlim()` or `Image.fromDockerfile()`.
 *
 * @class
 * @property {string} dockerfile - The Dockerfile content.
 * @property {Context[]} contextList - The list of context files to be added to the image.
 */
export declare class Image {
    private _dockerfile;
    private _contextList;
    private constructor();
    get dockerfile(): string;
    get contextList(): Context[];
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
    pipInstall(packages: string | string[], options?: PipInstallOptions): Image;
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
    pipInstallFromRequirements(requirementsTxt: string, options?: PipInstallOptions): Image;
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
    pipInstallFromPyproject(pyprojectToml: string, options?: PyprojectOptions): Image;
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
    addLocalFile(localPath: string, remotePath: string): Image;
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
    addLocalDir(localPath: string, remotePath: string): Image;
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
    runCommands(...commands: (string | string[])[]): Image;
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
    env(envVars: Record<string, string>): Image;
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
    workdir(dirPath: string): Image;
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
    entrypoint(entrypointCommands: string[]): Image;
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
    cmd(cmd: string[]): Image;
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
    dockerfileCommands(dockerfileCommands: string[], contextDir?: string): Image;
    /**
     * Creates an Image from an existing Dockerfile.
     *
     * @param {string} path - The path to the Dockerfile.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image.fromDockerfile('Dockerfile')
     */
    static fromDockerfile(path: string): Image;
    /**
     * Creates an Image from an existing base image.
     *
     * @param {string} image - The base image to use.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image.base('python:3.12-slim-bookworm')
     */
    static base(image: string): Image;
    /**
     * Creates a Debian slim image based on the official Python Docker image.
     *
     * @param {string} pythonVersion - The Python version to use.
     * @returns {Image} The Image instance.
     *
     * @example
     * const image = Image.debianSlim('3.12')
     */
    static debianSlim(pythonVersion?: SupportedPythonSeries): Image;
    /**
     * Formats pip install arguments in a single string.
     *
     * @param {PipInstallOptions} options - The options for the pip install command.
     * @returns {string} The formatted pip install arguments.
     */
    private formatPipInstallArgs;
    /**
     * Flattens a string argument.
     *
     * @param {string} functionName - The name of the function.
     * @param {string} argName - The name of the argument.
     * @param {any} args - The argument to flatten.
     * @returns {string[]} The flattened argument.
     */
    private flattenStringArgs;
    /**
     * Processes the Python version.
     *
     * @param {string} pythonVersion - The Python version to use.
     * @returns {string} The processed Python version.
     */
    private static processPythonVersion;
    /**
     * Extracts source files from COPY commands in a Dockerfile.
     *
     * @param {string} dockerfileContent - The content of the Dockerfile.
     * @param {string} pathPrefix - The path prefix to use for the sources.
     * @returns {Array<[string, string]>} The list of the actual file path and its corresponding COPY-command source path.
     */
    private static extractCopySources;
    /**
     * Parses a COPY command to extract sources and destination.
     *
     * @param {string} line - The line to parse.
     * @returns {Object} The parsed sources and destination.
     */
    private static parseCopyCommand;
}
export {};
