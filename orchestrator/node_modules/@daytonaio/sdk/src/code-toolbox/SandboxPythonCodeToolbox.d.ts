import { SandboxCodeToolbox } from '../Sandbox';
import { CodeRunParams } from '../Process';
export declare class SandboxPythonCodeToolbox implements SandboxCodeToolbox {
    getRunCommand(code: string, params?: CodeRunParams): string;
    /**
     * Checks if matplotlib is imported in the given Python code string.
     * @param codeString Python code as a string
     * @returns True if matplotlib is imported, false otherwise
     */
    private static isMatplotlibImported;
}
