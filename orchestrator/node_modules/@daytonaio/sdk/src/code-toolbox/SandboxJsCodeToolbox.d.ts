import { SandboxCodeToolbox } from '../Sandbox';
import { CodeRunParams } from '../Process';
export declare class SandboxJsCodeToolbox implements SandboxCodeToolbox {
    getRunCommand(code: string, params?: CodeRunParams): string;
}
