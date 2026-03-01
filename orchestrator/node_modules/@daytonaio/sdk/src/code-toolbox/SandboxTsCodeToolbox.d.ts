import { SandboxCodeToolbox } from '../Sandbox';
import { CodeRunParams } from '../Process';
export declare class SandboxTsCodeToolbox implements SandboxCodeToolbox {
    getRunCommand(code: string, params?: CodeRunParams): string;
}
