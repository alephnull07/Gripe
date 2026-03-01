import { ComputerUseApi, MousePositionResponse, MouseClickResponse, MouseDragResponse, ScreenshotResponse, DisplayInfoResponse, WindowsResponse, ComputerUseStartResponse, ComputerUseStopResponse, ComputerUseStatusResponse, ProcessStatusResponse, ProcessRestartResponse, ProcessLogsResponse, ProcessErrorsResponse, Recording, ListRecordingsResponse } from '@daytonaio/toolbox-api-client';
/**
 * Interface for region coordinates used in screenshot operations
 */
export interface ScreenshotRegion {
    x: number;
    y: number;
    width: number;
    height: number;
}
/**
 * Interface for screenshot compression options
 */
export interface ScreenshotOptions {
    showCursor?: boolean;
    format?: string;
    quality?: number;
    scale?: number;
}
/**
 * Mouse operations for computer use functionality
 */
export declare class Mouse {
    private readonly apiClient;
    constructor(apiClient: ComputerUseApi);
    /**
     * Gets the current mouse cursor position
     *
     * @returns {Promise<MousePositionResponse>} Current mouse position with x and y coordinates
     *
     * @example
     * ```typescript
     * const position = await sandbox.computerUse.mouse.getPosition();
     * console.log(`Mouse is at: ${position.x}, ${position.y}`);
     * ```
     */
    getPosition(): Promise<MousePositionResponse>;
    /**
     * Moves the mouse cursor to the specified coordinates
     *
     * @param {number} x - The x coordinate to move to
     * @param {number} y - The y coordinate to move to
     * @returns {Promise<MousePositionResponse>} Position after move
     *
     * @example
     * ```typescript
     * const result = await sandbox.computerUse.mouse.move(100, 200);
     * console.log(`Mouse moved to: ${result.x}, ${result.y}`);
     * ```
     */
    move(x: number, y: number): Promise<MousePositionResponse>;
    /**
     * Clicks the mouse at the specified coordinates
     *
     * @param {number} x - The x coordinate to click at
     * @param {number} y - The y coordinate to click at
     * @param {string} [button='left'] - The mouse button to click ('left', 'right', 'middle')
     * @param {boolean} [double=false] - Whether to perform a double-click
     * @returns {Promise<MouseClickResponse>} Click operation result
     *
     * @example
     * ```typescript
     * // Single left click
     * const result = await sandbox.computerUse.mouse.click(100, 200);
     *
     * // Double click
     * const doubleClick = await sandbox.computerUse.mouse.click(100, 200, 'left', true);
     *
     * // Right click
     * const rightClick = await sandbox.computerUse.mouse.click(100, 200, 'right');
     * ```
     */
    click(x: number, y: number, button?: string, double?: boolean): Promise<MouseClickResponse>;
    /**
     * Drags the mouse from start coordinates to end coordinates
     *
     * @param {number} startX - The starting x coordinate
     * @param {number} startY - The starting y coordinate
     * @param {number} endX - The ending x coordinate
     * @param {number} endY - The ending y coordinate
     * @param {string} [button='left'] - The mouse button to use for dragging
     * @returns {Promise<MouseDragResponse>} Drag operation result
     *
     * @example
     * ```typescript
     * const result = await sandbox.computerUse.mouse.drag(50, 50, 150, 150);
     * console.log(`Dragged from ${result.from.x},${result.from.y} to ${result.to.x},${result.to.y}`);
     * ```
     */
    drag(startX: number, startY: number, endX: number, endY: number, button?: string): Promise<MouseDragResponse>;
    /**
     * Scrolls the mouse wheel at the specified coordinates
     *
     * @param {number} x - The x coordinate to scroll at
     * @param {number} y - The y coordinate to scroll at
     * @param {'up' | 'down'} direction - The direction to scroll
     * @param {number} [amount=1] - The amount to scroll
     * @returns {Promise<boolean>} Whether the scroll operation was successful
     *
     * @example
     * ```typescript
     * // Scroll up
     * const scrollUp = await sandbox.computerUse.mouse.scroll(100, 200, 'up', 3);
     *
     * // Scroll down
     * const scrollDown = await sandbox.computerUse.mouse.scroll(100, 200, 'down', 5);
     * ```
     */
    scroll(x: number, y: number, direction: 'up' | 'down', amount?: number): Promise<boolean>;
}
/**
 * Keyboard operations for computer use functionality
 */
export declare class Keyboard {
    private readonly apiClient;
    constructor(apiClient: ComputerUseApi);
    /**
     * Types the specified text
     *
     * @param {string} text - The text to type
     * @param {number} [delay=0] - Delay between characters in milliseconds
     * @throws {DaytonaError} If the type operation fails
     *
     * @example
     * ```typescript
     * try {
     *   await sandbox.computerUse.keyboard.type('Hello, World!');
     *   console.log('Operation success');
     * } catch (e) {
     *   console.log('Operation failed:', e);
     * }
     *
     * // With delay between characters
     * try {
     *   await sandbox.computerUse.keyboard.type('Slow typing', 100);
     *   console.log('Operation success');
     * } catch (e) {
     *   console.log('Operation failed:', e);
     * }
     * ```
     */
    type(text: string, delay?: number): Promise<void>;
    /**
     * Presses a key with optional modifiers
     *
     * @param {string} key - The key to press (e.g., 'Enter', 'Escape', 'Tab', 'a', 'A')
     * @param {string[]} [modifiers=[]] - Modifier keys ('ctrl', 'alt', 'meta', 'shift')
     * @throws {DaytonaError} If the press operation fails
     *
     * @example
     * ```typescript
     * // Press Enter
     * try {
     *   await sandbox.computerUse.keyboard.press('Return');
     *   console.log('Operation success');
     * } catch (e) {
     *   console.log('Operation failed:', e);
     * }
     *
     * // Press Ctrl+C
     * try {
     *   await sandbox.computerUse.keyboard.press('c', ['ctrl']);
     *   console.log('Operation success');
     * } catch (e) {
     *   console.log('Operation failed:', e);
     * }
     *
     * // Press Ctrl+Shift+T
     * try {
     *   await sandbox.computerUse.keyboard.press('t', ['ctrl', 'shift']);
     *   console.log('Operation success');
     * } catch (e) {
     *   console.log('Operation failed:', e);
     * }
     * ```
     */
    press(key: string, modifiers?: string[]): Promise<void>;
    /**
     * Presses a hotkey combination
     *
     * @param {string} keys - The hotkey combination (e.g., 'ctrl+c', 'alt+tab', 'cmd+shift+t')
     * @throws {DaytonaError} If the hotkey operation fails
     *
     * @example
     * ```typescript
     * // Copy
     * try {
     *   await sandbox.computerUse.keyboard.hotkey('ctrl+c');
     *   console.log('Operation success');
     * } catch (e) {
     *   console.log('Operation failed:', e);
     * }
     *
     * // Paste
     * try {
     *   await sandbox.computerUse.keyboard.hotkey('ctrl+v');
     *   console.log('Operation success');
     * } catch (e) {
     *   console.log('Operation failed:', e);
     * }
     *
     * // Alt+Tab
     * try {
     *   await sandbox.computerUse.keyboard.hotkey('alt+tab');
     *   console.log('Operation success');
     * } catch (e) {
     *   console.log('Operation failed:', e);
     * }
     * ```
     */
    hotkey(keys: string): Promise<void>;
}
/**
 * Screenshot operations for computer use functionality
 */
export declare class Screenshot {
    private readonly apiClient;
    constructor(apiClient: ComputerUseApi);
    /**
     * Takes a screenshot of the entire screen
     *
     * @param {boolean} [showCursor=false] - Whether to show the cursor in the screenshot
     * @returns {Promise<ScreenshotResponse>} Screenshot data with base64 encoded image
     *
     * @example
     * ```typescript
     * const screenshot = await sandbox.computerUse.screenshot.takeFullScreen();
     * console.log(`Screenshot size: ${screenshot.width}x${screenshot.height}`);
     *
     * // With cursor visible
     * const withCursor = await sandbox.computerUse.screenshot.takeFullScreen(true);
     * ```
     */
    takeFullScreen(showCursor?: boolean): Promise<ScreenshotResponse>;
    /**
     * Takes a screenshot of a specific region
     *
     * @param {ScreenshotRegion} region - The region to capture
     * @param {boolean} [showCursor=false] - Whether to show the cursor in the screenshot
     * @returns {Promise<RegionScreenshotResponse>} Screenshot data with base64 encoded image
     *
     * @example
     * ```typescript
     * const region = { x: 100, y: 100, width: 300, height: 200 };
     * const screenshot = await sandbox.computerUse.screenshot.takeRegion(region);
     * console.log(`Captured region: ${screenshot.region.width}x${screenshot.region.height}`);
     * ```
     */
    takeRegion(region: ScreenshotRegion, showCursor?: boolean): Promise<ScreenshotResponse>;
    /**
     * Takes a compressed screenshot of the entire screen
     *
     * @param {ScreenshotOptions} [options={}] - Compression and display options
     * @returns {Promise<CompressedScreenshotResponse>} Compressed screenshot data
     *
     * @example
     * ```typescript
     * // Default compression
     * const screenshot = await sandbox.computerUse.screenshot.takeCompressed();
     *
     * // High quality JPEG
     * const jpeg = await sandbox.computerUse.screenshot.takeCompressed({
     *   format: 'jpeg',
     *   quality: 95,
     *   showCursor: true
     * });
     *
     * // Scaled down PNG
     * const scaled = await sandbox.computerUse.screenshot.takeCompressed({
     *   format: 'png',
     *   scale: 0.5
     * });
     * ```
     */
    takeCompressed(options?: ScreenshotOptions): Promise<ScreenshotResponse>;
    /**
     * Takes a compressed screenshot of a specific region
     *
     * @param {ScreenshotRegion} region - The region to capture
     * @param {ScreenshotOptions} [options={}] - Compression and display options
     * @returns {Promise<CompressedScreenshotResponse>} Compressed screenshot data
     *
     * @example
     * ```typescript
     * const region = { x: 0, y: 0, width: 800, height: 600 };
     * const screenshot = await sandbox.computerUse.screenshot.takeCompressedRegion(region, {
     *   format: 'webp',
     *   quality: 80,
     *   showCursor: true
     * });
     * console.log(`Compressed size: ${screenshot.size_bytes} bytes`);
     * ```
     */
    takeCompressedRegion(region: ScreenshotRegion, options?: ScreenshotOptions): Promise<ScreenshotResponse>;
}
/**
 * Display operations for computer use functionality
 */
export declare class Display {
    private readonly apiClient;
    constructor(apiClient: ComputerUseApi);
    /**
     * Gets information about the displays
     *
     * @returns {Promise<DisplayInfoResponse>} Display information including primary display and all available displays
     *
     * @example
     * ```typescript
     * const info = await sandbox.computerUse.display.getInfo();
     * console.log(`Primary display: ${info.primary_display.width}x${info.primary_display.height}`);
     * console.log(`Total displays: ${info.total_displays}`);
     * info.displays.forEach((display, index) => {
     *   console.log(`Display ${index}: ${display.width}x${display.height} at ${display.x},${display.y}`);
     * });
     * ```
     */
    getInfo(): Promise<DisplayInfoResponse>;
    /**
     * Gets the list of open windows
     *
     * @returns {Promise<WindowsResponse>} List of open windows with their IDs and titles
     *
     * @example
     * ```typescript
     * const windows = await sandbox.computerUse.display.getWindows();
     * console.log(`Found ${windows.count} open windows:`);
     * windows.windows.forEach(window => {
     *   console.log(`- ${window.title} (ID: ${window.id})`);
     * });
     * ```
     */
    getWindows(): Promise<WindowsResponse>;
}
/**
 * Recording operations for computer use functionality.
 */
export declare class RecordingService {
    private readonly apiClient;
    constructor(apiClient: ComputerUseApi);
    /**
     * Starts a new screen recording session
     *
     * @param {string} [label] - Optional custom label for the recording
     * @returns {Promise<Recording>} Started recording details
     *
     * @example
     * ```typescript
     * // Start a recording with a label
     * const recording = await sandbox.computerUse.recording.start('my-test-recording');
     * console.log(`Recording started: ${recording.id}`);
     * console.log(`File: ${recording.filePath}`);
     * ```
     */
    start(label?: string): Promise<Recording>;
    /**
     * Stops an active screen recording session
     *
     * @param {string} id - The ID of the recording to stop
     * @returns {Promise<Recording>} Stopped recording details
     *
     * @example
     * ```typescript
     * const result = await sandbox.computerUse.recording.stop(recording.id);
     * console.log(`Recording stopped: ${result.durationSeconds} seconds`);
     * console.log(`Saved to: ${result.filePath}`);
     * ```
     */
    stop(id: string): Promise<Recording>;
    /**
     * Lists all recordings (active and completed)
     *
     * @returns {Promise<ListRecordingsResponse>} List of all recordings
     *
     * @example
     * ```typescript
     * const recordings = await sandbox.computerUse.recording.list();
     * console.log(`Found ${recordings.recordings.length} recordings`);
     * recordings.recordings.forEach(rec => {
     *   console.log(`- ${rec.fileName}: ${rec.status}`);
     * });
     * ```
     */
    list(): Promise<ListRecordingsResponse>;
    /**
     * Gets details of a specific recording by ID
     *
     * @param {string} id - The ID of the recording to retrieve
     * @returns {Promise<Recording>} Recording details
     *
     * @example
     * ```typescript
     * const recording = await sandbox.computerUse.recording.get(recordingId);
     * console.log(`Recording: ${recording.fileName}`);
     * console.log(`Status: ${recording.status}`);
     * console.log(`Duration: ${recording.durationSeconds} seconds`);
     * ```
     */
    get(id: string): Promise<Recording>;
    /**
     * Deletes a recording by ID
     *
     * @param {string} id - The ID of the recording to delete
     *
     * @example
     * ```typescript
     * await sandbox.computerUse.recording.delete(recordingId);
     * console.log('Recording deleted');
     * ```
     */
    delete(id: string): Promise<void>;
    /**
     * Downloads a recording file and saves it to a local path
     *
     * The file is streamed directly to disk without loading the entire content into memory.
     *
     * @param {string} id - The ID of the recording to download
     * @param {string} localPath - Path to save the recording file locally
     *
     * @example
     * ```typescript
     * // Download recording to file
     * await sandbox.computerUse.recording.download(recordingId, 'local_recording.mp4');
     * console.log('Recording downloaded');
     * ```
     */
    download(id: string, localPath: string): Promise<void>;
}
/**
 * Computer Use functionality for interacting with the desktop environment.
 *
 * Provides access to mouse, keyboard, screenshot, display, and recording operations
 * for automating desktop interactions within a sandbox.
 *
 * @property {Mouse} mouse - Mouse operations interface
 * @property {Keyboard} keyboard - Keyboard operations interface
 * @property {Screenshot} screenshot - Screenshot operations interface
 * @property {Display} display - Display operations interface
 * @property {RecordingService} recording - Screen recording operations interface
 *
 * @class
 */
export declare class ComputerUse {
    private readonly apiClient;
    readonly mouse: Mouse;
    readonly keyboard: Keyboard;
    readonly screenshot: Screenshot;
    readonly display: Display;
    readonly recording: RecordingService;
    constructor(apiClient: ComputerUseApi);
    /**
     * Starts all computer use processes (Xvfb, xfce4, x11vnc, novnc)
     *
     * @returns {Promise<ComputerUseStartResponse>} Computer use start response
     *
     * @example
     * ```typescript
     * const result = await sandbox.computerUse.start();
     * console.log('Computer use processes started:', result.message);
     * ```
     */
    start(): Promise<ComputerUseStartResponse>;
    /**
     * Stops all computer use processes
     *
     * @returns {Promise<ComputerUseStopResponse>} Computer use stop response
     *
     * @example
     * ```typescript
     * const result = await sandbox.computerUse.stop();
     * console.log('Computer use processes stopped:', result.message);
     * ```
     */
    stop(): Promise<ComputerUseStopResponse>;
    /**
     * Gets the status of all computer use processes
     *
     * @returns {Promise<ComputerUseStatusResponse>} Status information about all VNC desktop processes
     *
     * @example
     * ```typescript
     * const status = await sandbox.computerUse.getStatus();
     * console.log('Computer use status:', status.status);
     * ```
     */
    getStatus(): Promise<ComputerUseStatusResponse>;
    /**
     * Gets the status of a specific VNC process
     *
     * @param {string} processName - Name of the process to check
     * @returns {Promise<ProcessStatusResponse>} Status information about the specific process
     *
     * @example
     * ```typescript
     * const xvfbStatus = await sandbox.computerUse.getProcessStatus('xvfb');
     * const noVncStatus = await sandbox.computerUse.getProcessStatus('novnc');
     * ```
     */
    getProcessStatus(processName: string): Promise<ProcessStatusResponse>;
    /**
     * Restarts a specific VNC process
     *
     * @param {string} processName - Name of the process to restart
     * @returns {Promise<ProcessRestartResponse>} Process restart response
     *
     * @example
     * ```typescript
     * const result = await sandbox.computerUse.restartProcess('xfce4');
     * console.log('XFCE4 process restarted:', result.message);
     * ```
     */
    restartProcess(processName: string): Promise<ProcessRestartResponse>;
    /**
     * Gets logs for a specific VNC process
     *
     * @param {string} processName - Name of the process to get logs for
     * @returns {Promise<ProcessLogsResponse>} Process logs
     *
     * @example
     * ```typescript
     * const logsResp = await sandbox.computerUse.getProcessLogs('novnc');
     * console.log('NoVNC logs:', logsResp.logs);
     * ```
     */
    getProcessLogs(processName: string): Promise<ProcessLogsResponse>;
    /**
     * Gets error logs for a specific VNC process
     *
     * @param {string} processName - Name of the process to get error logs for
     * @returns {Promise<ProcessErrorsResponse>} Process error logs
     *
     * @example
     * ```typescript
     * const errorsResp = await sandbox.computerUse.getProcessErrors('x11vnc');
     * console.log('X11VNC errors:', errorsResp.errors);
     * ```
     */
    getProcessErrors(processName: string): Promise<ProcessErrorsResponse>;
}
