"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Git = void 0;
const tslib_1 = require("tslib");
const otel_decorator_1 = require("./utils/otel.decorator");
/**
 * Provides Git operations within a Sandbox.
 *
 * @class
 */
class Git {
    apiClient;
    constructor(apiClient) {
        this.apiClient = apiClient;
    }
    /**
     * Stages the specified files for the next commit, similar to
     * running 'git add' on the command line.
     *
     * @param {string} path - Path to the Git repository root. Relative paths are resolved based on the sandbox working directory.
     * @param {string[]} files - List of file paths or directories to stage, relative to the repository root
     * @returns {Promise<void>}
     *
     * @example
     * // Stage a single file
     * await git.add('workspace/repo', ['file.txt']);
     *
     * @example
     * // Stage whole repository
     * await git.add('workspace/repo', ['.']);
     */
    async add(path, files) {
        await this.apiClient.addFiles({
            path,
            files,
        });
    }
    /**
     * List branches in the repository.
     *
     * @param {string} path - Path to the Git repository root. Relative paths are resolved based on the sandbox working directory.
     * @returns {Promise<ListBranchResponse>} List of branches in the repository
     *
     * @example
     * const response = await git.branches('workspace/repo');
     * console.log(`Branches: ${response.branches}`);
     */
    async branches(path) {
        const response = await this.apiClient.listBranches(path);
        return response.data;
    }
    /**
     * Create branch in the repository.
     *
     * @param {string} path - Path to the Git repository root. Relative paths are resolved based on the sandbox working directory.
     * @param {string} name - Name of the new branch to create
     * @returns {Promise<void>}
     *
     * @example
     * await git.createBranch('workspace/repo', 'new-feature');
     */
    async createBranch(path, name) {
        await this.apiClient.createBranch({
            path,
            name,
        });
        return;
    }
    /**
     * Delete branche in the repository.
     *
     * @param {string} path - Path to the Git repository root. Relative paths are resolved based on the sandbox working directory.
     * @param {string} name - Name of the branch to delete
     * @returns {Promise<void>}
     *
     * @example
     * await git.deleteBranch('workspace/repo', 'new-feature');
     */
    async deleteBranch(path, name) {
        await this.apiClient.deleteBranch({
            path,
            name,
        });
        return;
    }
    /**
     * Checkout branche in the repository.
     *
     * @param {string} path - Path to the Git repository root. Relative paths are resolved based on the sandbox working directory.
     * @param {string} branch - Name of the branch to checkout
     * @returns {Promise<void>}
     *
     * @example
     * await git.checkoutBranch('workspace/repo', 'new-feature');
     */
    async checkoutBranch(path, branch) {
        await this.apiClient.checkoutBranch({
            path,
            branch,
        });
        return;
    }
    /**
     * Clones a Git repository into the specified path. It supports
     * cloning specific branches or commits, and can authenticate with the remote
     * repository if credentials are provided.
     *
     * @param {string} url - Repository URL to clone from
     * @param {string} path - Path where the repository should be cloned. Relative paths are resolved based on the sandbox working directory.
     * @param {string} [branch] - Specific branch to clone. If not specified, clones the default branch
     * @param {string} [commitId] - Specific commit to clone. If specified, the repository will be left in a detached HEAD state at this commit
     * @param {string} [username] - Git username for authentication
     * @param {string} [password] - Git password or token for authentication
     * @returns {Promise<void>}
     *
     * @example
     * // Clone the default branch
     * await git.clone(
     *   'https://github.com/user/repo.git',
     *   'workspace/repo'
     * );
     *
     * @example
     * // Clone a specific branch with authentication
     * await git.clone(
     *   'https://github.com/user/private-repo.git',
     *   'workspace/private',
     *   branch='develop',
     *   username='user',
     *   password='token'
     * );
     *
     * @example
     * // Clone a specific commit
     * await git.clone(
     *   'https://github.com/user/repo.git',
     *   'workspace/repo-old',
     *   commitId='abc123'
     * );
     */
    async clone(url, path, branch, commitId, username, password) {
        await this.apiClient.cloneRepository({
            url: url,
            branch: branch,
            path,
            username,
            password,
            commit_id: commitId,
        });
    }
    /**
     * Commits staged changes.
     *
     * @param {string} path - Path to the Git repository root. Relative paths are resolved based on the sandbox working directory.
     * @param {string} message - Commit message describing the changes
     * @param {string} author - Name of the commit author
     * @param {string} email - Email address of the commit author
     * @param {boolean} [allowEmpty] - Allow creating an empty commit when no changes are staged
     * @returns {Promise<void>}
     *
     * @example
     * // Stage and commit changes
     * await git.add('workspace/repo', ['README.md']);
     * await git.commit(
     *   'workspace/repo',
     *   'Update documentation',
     *   'John Doe',
     *   'john@example.com',
     *   true
     * );
     *
     */
    async commit(path, message, author, email, allowEmpty) {
        const response = await this.apiClient.commitChanges({
            path,
            message,
            author,
            email,
            allow_empty: allowEmpty,
        });
        return {
            sha: response.data.hash,
        };
    }
    /**
     * Push local changes to the remote repository.
     *
     * @param {string} path - Path to the Git repository root. Relative paths are resolved based on the sandbox working directory.
     * @param {string} [username] - Git username for authentication
     * @param {string} [password] - Git password or token for authentication
     * @returns {Promise<void>}
     *
     * @example
     * // Push to a public repository
     * await git.push('workspace/repo');
     *
     * @example
     * // Push to a private repository
     * await git.push(
     *   'workspace/repo',
     *   'user',
     *   'token'
     * );
     */
    async push(path, username, password) {
        await this.apiClient.pushChanges({
            path,
            username,
            password,
        });
    }
    /**
     * Pulls changes from the remote repository.
     *
     * @param {string} path - Path to the Git repository root. Relative paths are resolved based on the sandbox working directory.
     * @param {string} [username] - Git username for authentication
     * @param {string} [password] - Git password or token for authentication
     * @returns {Promise<void>}
     *
     * @example
     * // Pull from a public repository
     * await git.pull('workspace/repo');
     *
     * @example
     * // Pull from a private repository
     * await git.pull(
     *   'workspace/repo',
     *   'user',
     *   'token'
     * );
     */
    async pull(path, username, password) {
        await this.apiClient.pullChanges({
            path,
            username,
            password,
        });
    }
    /**
     * Gets the current status of the Git repository.
     *
     * @param {string} path - Path to the Git repository root. Relative paths are resolved based on the sandbox working directory.
     * @returns {Promise<GitStatus>} Current repository status including:
     *                               - currentBranch: Name of the current branch
     *                               - ahead: Number of commits ahead of the remote branch
     *                               - behind: Number of commits behind the remote branch
     *                               - branchPublished: Whether the branch has been published to the remote repository
     *                               - fileStatus: List of file statuses
     *
     * @example
     * const status = await sandbox.git.status('workspace/repo');
     * console.log(`Current branch: ${status.currentBranch}`);
     * console.log(`Commits ahead: ${status.ahead}`);
     * console.log(`Commits behind: ${status.behind}`);
     */
    async status(path) {
        const response = await this.apiClient.getStatus(path);
        return response.data;
    }
}
exports.Git = Git;
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, Array]),
    tslib_1.__metadata("design:returntype", Promise)
], Git.prototype, "add", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", Promise)
], Git.prototype, "branches", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], Git.prototype, "createBranch", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], Git.prototype, "deleteBranch", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], Git.prototype, "checkoutBranch", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, String, String, String, String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], Git.prototype, "clone", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, String, String, String, Boolean]),
    tslib_1.__metadata("design:returntype", Promise)
], Git.prototype, "commit", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], Git.prototype, "push", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, String, String]),
    tslib_1.__metadata("design:returntype", Promise)
], Git.prototype, "pull", null);
tslib_1.__decorate([
    (0, otel_decorator_1.WithInstrumentation)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", Promise)
], Git.prototype, "status", null);
//# sourceMappingURL=Git.js.map