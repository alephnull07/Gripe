import WebSocket from 'isomorphic-ws';
/**
 * Process a streaming response from fetch(), where getStream() returns a Fetch Response.
 *
 * @param getStream – zero-arg function that does `await fetch(...)` and returns the Response
 * @param onChunk – called with each decoded UTF-8 chunk
 * @param shouldTerminate – pollable; if true for two consecutive timeouts (or once if requireConsecutiveTermination=false), the loop breaks
 * @param chunkTimeout – milliseconds to wait for a new chunk before calling shouldTerminate()
 * @param requireConsecutiveTermination – whether you need two time-outs in a row to break
 */
export declare function processStreamingResponse(getStream: () => Promise<Response>, onChunk: (chunk: string) => void, shouldTerminate: () => Promise<boolean>, chunkTimeout?: number, requireConsecutiveTermination?: boolean): Promise<void>;
/**
 * Demultiplexes a WebSocket stream into separate stdout and stderr streams.
 *
 * @param socket - The WebSocket instance to demultiplex.
 * @param onStdout - Callback function for stdout messages.
 * @param onStderr - Callback function for stderr messages.
 */
export declare function stdDemuxStream(ws: WebSocket, onStdout: (data: string) => void, onStderr: (data: string) => void): Promise<void>;
