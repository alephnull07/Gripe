"use strict";
/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChartType = void 0;
exports.parseChart = parseChart;
/**
 * Chart types
 */
var ChartType;
(function (ChartType) {
    ChartType["LINE"] = "line";
    ChartType["SCATTER"] = "scatter";
    ChartType["BAR"] = "bar";
    ChartType["PIE"] = "pie";
    ChartType["BOX_AND_WHISKER"] = "box_and_whisker";
    ChartType["COMPOSITE_CHART"] = "composite_chart";
    ChartType["UNKNOWN"] = "unknown";
})(ChartType || (exports.ChartType = ChartType = {}));
function parseChart(data) {
    switch (data.type) {
        case ChartType.LINE:
            return { ...data };
        case ChartType.SCATTER:
            return { ...data };
        case ChartType.BAR:
            return { ...data };
        case ChartType.PIE:
            return { ...data };
        case ChartType.BOX_AND_WHISKER:
            return { ...data };
        case ChartType.COMPOSITE_CHART:
            // eslint-disable-next-line no-case-declarations
            const charts = data.elements.map((g) => parseChart(g));
            delete data.data;
            return {
                ...data,
                data: charts,
            };
        default:
            return { ...data, type: ChartType.UNKNOWN };
    }
}
//# sourceMappingURL=Charts.js.map