"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithSpan = WithSpan;
exports.WithMetric = WithMetric;
exports.WithInstrumentation = WithInstrumentation;
const api_1 = require("@opentelemetry/api");
// Lazy initialization to ensure SDK is started before getting tracer/meter
const getTracer = () => api_1.trace.getTracer('');
const getMeter = () => api_1.metrics.getMeter('');
const executionHistograms = new Map();
/**
 * Converts a string to snake_case for Prometheus-friendly metric names
 */
function toSnakeCase(str) {
    return str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '')
        .replace(/\./g, '_');
}
/**
 * Decorator for instrumenting methods with OpenTelemetry spans (traces only)
 *
 * @param config - Configuration object or string name for the span
 *
 */
function WithSpan(config) {
    return (target, propertyKey, descriptor) => {
        const originalMethod = descriptor.value;
        const methodName = String(propertyKey);
        descriptor.value = async function (...args) {
            const cfg = typeof config === 'string' ? { name: config } : config || {};
            const { name, attributes = {} } = cfg;
            const spanName = name || `${target.constructor.name}.${methodName}`;
            const allAttributes = {
                component: target.constructor.name,
                method: methodName,
                ...attributes,
            };
            const span = getTracer().startSpan(spanName, {
                attributes: allAttributes,
            }, api_1.context.active());
            return api_1.context.with(api_1.trace.setSpan(api_1.context.active(), span), async () => {
                try {
                    const result = await originalMethod.apply(this, args);
                    span.setStatus({ code: api_1.SpanStatusCode.OK });
                    return result;
                }
                catch (error) {
                    span.setStatus({
                        code: api_1.SpanStatusCode.ERROR,
                        message: error instanceof Error ? error.message : String(error),
                    });
                    span.recordException(error instanceof Error ? error : new Error(String(error)));
                    throw error;
                }
                finally {
                    span.end();
                }
            });
        };
    };
}
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
function WithMetric(config) {
    return (target, propertyKey, descriptor) => {
        const originalMethod = descriptor.value;
        const methodName = String(propertyKey);
        descriptor.value = async function (...args) {
            const cfg = typeof config === 'string' ? { name: config } : config || {};
            const { name, description, labels = {} } = cfg;
            const metricName = toSnakeCase(name || `${target.constructor.name}.${methodName}`);
            const allLabels = {
                component: target.constructor.name,
                method: methodName,
                ...labels,
            };
            // Get or create histogram for this method
            if (!executionHistograms.has(metricName)) {
                executionHistograms.set(metricName, getMeter().createHistogram(`${metricName}_duration`, {
                    description: description || `Duration of executions for ${metricName}`,
                    unit: 'ms',
                }));
            }
            const histogram = executionHistograms.get(metricName);
            if (!histogram) {
                throw new Error(`Histogram not found for metric: ${metricName}`);
            }
            const startTime = Date.now();
            let status = 'success';
            try {
                const result = await originalMethod.apply(this, args);
                return result;
            }
            catch (error) {
                status = 'error';
                throw error;
            }
            finally {
                const duration = Date.now() - startTime;
                histogram.record(duration, { ...allLabels, status });
            }
        };
    };
}
/**
 * Decorator for instrumenting methods with both OpenTelemetry traces and metrics
 *
 * This decorator composes @WithSpan and @WithMetric to provide both trace and metric collection.
 * You can selectively enable/disable traces or metrics using the config options.
 *
 * @param config - Configuration object or string name for the instrumentation
 */
function WithInstrumentation(config) {
    const cfg = typeof config === 'string' ? { name: config } : config || {};
    const { enableTraces = true, enableMetrics = true, name, description, labels } = cfg;
    const decorators = [];
    if (enableTraces) {
        decorators.push(WithSpan({ name, attributes: labels }));
    }
    if (enableMetrics) {
        decorators.push(WithMetric({ name, description, labels }));
    }
    return (target, propertyKey, descriptor) => {
        decorators.forEach((decorator) => decorator(target, propertyKey, descriptor));
    };
}
//# sourceMappingURL=otel.decorator.js.map