/**
 * Configuration options for span instrumentation
 */
export interface SpanConfig {
    /**
     * Custom name for the span. If not provided, uses `ClassName.methodName` format
     */
    name?: string;
    /**
     * Additional attributes to attach to the span
     */
    attributes?: Record<string, string>;
}
/**
 * Configuration options for metric instrumentation
 */
export interface MetricConfig {
    /**
     * Custom name for the metric. If not provided, uses `ClassName.methodName` format
     */
    name?: string;
    /**
     * Description for the metrics being collected
     */
    description?: string;
    /**
     * Additional labels to attach to the metrics
     */
    labels?: Record<string, string>;
}
/**
 * Configuration options for the combined instrumentation decorator
 */
export interface InstrumentationConfig {
    /**
     * Custom name for the span and metric. If not provided, uses `ClassName.methodName` format
     */
    name?: string;
    /**
     * Description for the metrics being collected
     */
    description?: string;
    /**
     * Additional labels/attributes to attach to spans and metrics
     */
    labels?: Record<string, string>;
    /**
     * Enable trace collection (default: true)
     */
    enableTraces?: boolean;
    /**
     * Enable metrics collection (default: true)
     */
    enableMetrics?: boolean;
}
/**
 * Decorator for instrumenting methods with OpenTelemetry spans (traces only)
 *
 * @param config - Configuration object or string name for the span
 *
 */
export declare function WithSpan(config?: string | SpanConfig): (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => void;
/**
 * Decorator for instrumenting methods with OpenTelemetry metrics (metrics only)
 *
 * Collects two metrics:
 * - Counter: `{name}_executions` - tracks number of executions with status (success/error)
 * - Histogram: `{name}_duration` - tracks execution duration in milliseconds
 *
 * @param config - Configuration object or string name for the metric
 *
 */
export declare function WithMetric(config?: string | MetricConfig): (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => void;
/**
 * Decorator for instrumenting methods with both OpenTelemetry traces and metrics
 *
 * This decorator composes @WithSpan and @WithMetric to provide both trace and metric collection.
 * You can selectively enable/disable traces or metrics using the config options.
 *
 * @param config - Configuration object or string name for the instrumentation
 */
export declare function WithInstrumentation(config?: string | InstrumentationConfig): MethodDecorator;
