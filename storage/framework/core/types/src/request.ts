interface RequestData {
    [key: string]: string
}
  
type RouteParams = { [key: string]: string } | null

export interface RequestInstance {
    addQuery(url: URL): void;

    addParam(param: RouteParams): void;

    get(element: string): string | number | undefined;

    header(element: string): string | number | boolean | null

    Header(element: string): string | number | boolean | null

    all(): RequestData;

    has(element: string): boolean;

    isEmpty(): boolean;

    extractParamsFromRoute(routePattern: string, pathname: string): void;

    getParam(key: string): number | string | null;

    getParams(): RouteParams;

    getParamAsInt(key: string): number | null;
}