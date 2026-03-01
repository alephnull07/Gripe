import { ExecutionArtifacts } from '../types/ExecuteResponse';
/**
 * Utility class for parsing artifacts from command output
 */
export declare class ArtifactParser {
    /**
     * Parses artifacts from command output text
     *
     * @param output - Raw output from command execution
     * @returns Parsed artifacts including stdout and charts
     */
    static parseArtifacts(output: string): ExecutionArtifacts;
}
