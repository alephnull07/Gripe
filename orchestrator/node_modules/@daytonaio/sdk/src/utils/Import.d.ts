declare const loaderMap: {
    'fast-glob': () => Promise<{
        default: typeof import("fast-glob");
        sync(source: import("fast-glob/out/types").Pattern | import("fast-glob/out/types").Pattern[], options: import("fast-glob/out/settings").Options & ({
            objectMode: true;
        } | {
            stats: true;
        })): import("fast-glob/out/types").Entry[];
        sync(source: import("fast-glob/out/types").Pattern | import("fast-glob/out/types").Pattern[], options?: import("fast-glob/out/settings").Options): string[];
        stream(source: import("fast-glob/out/types").Pattern | import("fast-glob/out/types").Pattern[], options?: import("fast-glob/out/settings").Options): NodeJS.ReadableStream;
        generateTasks(source: import("fast-glob/out/types").Pattern | import("fast-glob/out/types").Pattern[], options?: import("fast-glob/out/settings").Options): import("fast-glob").Task[];
        isDynamicPattern(source: import("fast-glob/out/types").Pattern, options?: import("fast-glob/out/settings").Options): boolean;
        escapePath(source: string): import("fast-glob/out/types").Pattern;
        convertPathToPattern(source: string): import("fast-glob/out/types").Pattern;
        glob: typeof import("fast-glob");
        globSync: typeof import("fast-glob").sync;
        globStream: typeof import("fast-glob").stream;
        async: typeof import("fast-glob");
        posix: typeof import("fast-glob").posix;
        win32: typeof import("fast-glob").win32;
    }>;
    '@iarna/toml': () => Promise<{
        default: typeof import("@iarna/toml");
        parse: import("@iarna/toml").FuncParse;
        stringify: import("@iarna/toml").FuncStringify;
    }>;
    stream: () => Promise<{
        default: typeof import("stream");
        Stream: typeof import("stream");
        promises: typeof import("node:stream/promises");
        duplexPair(options?: import("stream").DuplexOptions): [import("stream").Duplex, import("stream").Duplex];
        addAbortSignal<T extends import("stream")>(signal: AbortSignal, stream: T): T;
        getDefaultHighWaterMark(objectMode: boolean): number;
        setDefaultHighWaterMark(objectMode: boolean, value: number): void;
        finished: typeof import("stream").finished;
        pipeline: typeof import("stream").pipeline;
        isErrored(stream: import("stream").Readable | import("stream").Writable | NodeJS.ReadableStream | NodeJS.WritableStream): boolean;
        isReadable(stream: import("stream").Readable | NodeJS.ReadableStream): boolean;
        Readable: typeof import("stream").Readable;
        Writable: typeof import("stream").Writable;
        Duplex: typeof import("stream").Duplex;
        Transform: typeof import("stream").Transform;
        PassThrough: typeof import("stream").PassThrough;
        errorMonitor: typeof import("events").errorMonitor;
        captureRejectionSymbol: typeof import("events").captureRejectionSymbol;
        captureRejections: boolean;
        defaultMaxListeners: number;
        EventEmitter: typeof import("events");
        EventEmitterAsyncResource: typeof import("events").EventEmitterAsyncResource;
    }>;
    tar: () => Promise<typeof import("tar", { with: { "resolution-mode": "import" } })>;
    'expand-tilde': () => Promise<any>;
    ObjectStorage: () => Promise<{
        default: typeof import("../ObjectStorage");
        ObjectStorage: typeof import("../ObjectStorage").ObjectStorage;
    }>;
    fs: () => Promise<typeof import("fs")>;
    'form-data': () => Promise<{
        default: typeof import("form-data");
        Stream: typeof import("stream");
        promises: typeof import("node:stream/promises");
        duplexPair(options?: import("stream").DuplexOptions): [import("stream").Duplex, import("stream").Duplex];
        addAbortSignal<T extends import("stream")>(signal: AbortSignal, stream: T): T;
        getDefaultHighWaterMark(objectMode: boolean): number;
        setDefaultHighWaterMark(objectMode: boolean, value: number): void;
        finished: typeof import("stream").finished;
        pipeline: typeof import("stream").pipeline;
        isErrored(stream: import("stream").Readable | import("stream").Writable | NodeJS.ReadableStream | NodeJS.WritableStream): boolean;
        isReadable(stream: import("stream").Readable | NodeJS.ReadableStream): boolean;
        Readable: typeof import("stream").Readable;
        Writable: typeof import("stream").Writable;
        Duplex: typeof import("stream").Duplex;
        Transform: typeof import("stream").Transform;
        PassThrough: typeof import("stream").PassThrough;
        errorMonitor: typeof import("events").errorMonitor;
        captureRejectionSymbol: typeof import("events").captureRejectionSymbol;
        captureRejections: boolean;
        defaultMaxListeners: number;
        EventEmitter: typeof import("events");
        EventEmitterAsyncResource: typeof import("events").EventEmitterAsyncResource;
    }>;
    util: () => Promise<typeof import("util")>;
};
declare const requireMap: {
    'fast-glob': () => any;
    '@iarna/toml': () => any;
    stream: () => any;
    tar: () => any;
    'expand-tilde': () => any;
    fs: () => any;
    'form-data': () => any;
};
type ModuleMap = typeof loaderMap;
export declare function dynamicImport<K extends keyof ModuleMap>(name: K, errorPrefix?: string): Promise<Awaited<ReturnType<ModuleMap[K]>>>;
type RequireMap = typeof requireMap;
export declare function dynamicRequire<K extends keyof RequireMap>(name: K, errorPrefix?: string): ReturnType<RequireMap[K]>;
export {};
