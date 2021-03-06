import * as OctokitTypes from "@octokit/types";
import * as LRUCache from "lru-cache";
export declare type AnyResponse = OctokitTypes.OctokitResponse<any>;
export declare type EndpointDefaults = OctokitTypes.EndpointDefaults;
export declare type EndpointOptions = OctokitTypes.EndpointOptions;
export declare type RequestParameters = OctokitTypes.RequestParameters;
export declare type Route = OctokitTypes.Route;
export declare type RequestInterface = OctokitTypes.RequestInterface;
export declare type StrategyInterface = OctokitTypes.StrategyInterface<[
    StrategyOptions
], [
    AuthOptions
], Authentication>;
export declare type Cache = LRUCache<string, string> | {
    get: (key: string) => string;
    set: (key: string, value: string) => any;
};
export interface AppAuthStrategy {
    (options?: StrategyOptions): AppAuth;
}
export interface AppAuth {
    (options: AuthOptions): Promise<Authentication>;
}
export declare type APP_TYPE = "app";
export declare type TOKEN_TYPE = "token";
export declare type INSTALLATION_TOKEN_TYPE = "installation";
export declare type OAUTH_TOKEN_TYPE = "oauth";
export declare type REPOSITORY_SELECTION = "all" | "selected";
export declare type JWT = string;
export declare type ACCESS_TOKEN = string;
export declare type UTC_TIMESTAMP = string;
export declare type AppAuthentication = {
    type: APP_TYPE;
    token: JWT;
    appId: number;
    expiresAt: string;
};
export declare type InstallationAccessTokenData = {
    token: ACCESS_TOKEN;
    createdAt: UTC_TIMESTAMP;
    expiresAt: UTC_TIMESTAMP;
    permissions: Permissions;
    repositorySelection: REPOSITORY_SELECTION;
    repositoryIds?: number[];
    singleFileName?: string;
};
export declare type CacheData = InstallationAccessTokenData;
export declare type InstallationAccessTokenAuthentication = InstallationAccessTokenData & {
    type: TOKEN_TYPE;
    tokenType: INSTALLATION_TOKEN_TYPE;
};
export declare type OAuthAccesTokenAuthentication = {
    type: TOKEN_TYPE;
    tokenType: OAUTH_TOKEN_TYPE;
    token: ACCESS_TOKEN;
    scopes: string[];
};
export declare type Authentication = AppAuthentication | InstallationAccessTokenAuthentication | OAuthAccesTokenAuthentication;
declare type OAuthStrategyOptions = {
    clientId?: string;
    clientSecret?: string;
};
declare type CommonStrategyOptions = {
    privateKey: string;
    installationId?: number | string;
    request?: OctokitTypes.RequestInterface;
    cache?: Cache;
    log?: {
        warn: (message: string, additionalInfo?: object) => any;
        [key: string]: any;
    };
};
declare type DeprecatedStrategyOptions = OAuthStrategyOptions & CommonStrategyOptions & {
    /**
     * @deprecated id is deprecated, use appId instead
     */
    id: number | string;
};
declare type CurrentStrategyOptions = OAuthStrategyOptions & CommonStrategyOptions & {
    appId: number | string;
};
export declare type StrategyOptions = (DeprecatedStrategyOptions | CurrentStrategyOptions) & {
    [key: string]: unknown;
};
export declare type FactoryOptions = Required<Omit<CurrentStrategyOptions, keyof State>> & State;
export declare type StrategyOptionsWithDefaults = CurrentStrategyOptions & Required<Omit<CurrentStrategyOptions, keyof OAuthStrategyOptions | "installationId">>;
export declare type Permissions = {
    [name: string]: string;
};
export declare type InstallationAuthOptions = {
    installationId?: number | string;
    repositoryIds?: number[];
    permissions?: Permissions;
    refresh?: boolean;
    factory?: (options: FactoryOptions) => unknown;
    [key: string]: unknown;
};
export declare type OAuthOptions = {
    code?: string;
    redirectUrl?: string;
    state?: string;
};
export declare type AuthOptions = InstallationAuthOptions & OAuthOptions & {
    type: "app" | "installation" | "oauth";
};
export declare type WithInstallationId = {
    installationId: number;
};
export declare type State = StrategyOptionsWithDefaults & {
    timeDifference: number;
};
export {};
