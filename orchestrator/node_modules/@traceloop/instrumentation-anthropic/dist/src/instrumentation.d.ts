import { InstrumentationBase, InstrumentationModuleDefinition } from "@opentelemetry/instrumentation";
import { AnthropicInstrumentationConfig } from "./types";
import type * as anthropic from "@anthropic-ai/sdk";
export declare class AnthropicInstrumentation extends InstrumentationBase {
    protected _config: AnthropicInstrumentationConfig;
    constructor(config?: AnthropicInstrumentationConfig);
    setConfig(config?: AnthropicInstrumentationConfig): void;
    manuallyInstrument(module: typeof anthropic): void;
    protected init(): InstrumentationModuleDefinition;
    private patch;
    private unpatch;
    private patchAnthropic;
    private startSpan;
    private _streamingWrapPromise;
    private _wrapPromise;
    private _endSpan;
    private _shouldSendPrompts;
}
//# sourceMappingURL=instrumentation.d.ts.map