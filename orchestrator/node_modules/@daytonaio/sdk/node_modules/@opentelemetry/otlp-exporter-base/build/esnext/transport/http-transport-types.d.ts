export interface HttpRequestParameters {
    url: string;
    headers: () => Record<string, string>;
    compression: 'gzip' | 'none';
    userAgent?: string;
}
//# sourceMappingURL=http-transport-types.d.ts.map