'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var universalUserAgent = require('universal-user-agent');
var request = require('@octokit/request');
var deprecation = require('deprecation');
var universalGithubAppJwt = require('universal-github-app-jwt');
var LRU = _interopDefault(require('lru-cache'));
var requestError = require('@octokit/request-error');

async function getAppAuthentication({
  appId,
  privateKey,
  timeDifference
}) {
  const appAuthentication = await universalGithubAppJwt.githubAppJwt({
    id: +appId,
    privateKey,
    now: timeDifference && Math.floor(Date.now() / 1000) + timeDifference
  });
  return {
    type: "app",
    token: appAuthentication.token,
    appId: appAuthentication.appId,
    expiresAt: new Date(appAuthentication.expiration * 1000).toISOString()
  };
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    });
    keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      ownKeys(Object(source), true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}

function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key, i;

  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }

  return target;
}

function _objectWithoutProperties(source, excluded) {
  if (source == null) return {};

  var target = _objectWithoutPropertiesLoose(source, excluded);

  var key, i;

  if (Object.getOwnPropertySymbols) {
    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

    for (i = 0; i < sourceSymbolKeys.length; i++) {
      key = sourceSymbolKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
      target[key] = source[key];
    }
  }

  return target;
}

// https://github.com/isaacs/node-lru-cache#readme
function getCache() {
  return new LRU({
    // cache max. 15000 tokens, that will use less than 10mb memory
    max: 15000,
    // Cache for 1 minute less than GitHub expiry
    maxAge: 1000 * 60 * 59
  });
}
async function get(cache, options) {
  const cacheKey = optionsToCacheKey(options);
  const result = await cache.get(cacheKey);

  if (!result) {
    return;
  }

  const [token, createdAt, expiresAt, repositorySelection, permissionsString, singleFileName] = result.split("|");
  const permissions = options.permissions || permissionsString.split(/,/).reduce((permissions, string) => {
    if (/!$/.test(string)) {
      permissions[string.slice(0, -1)] = "write";
    } else {
      permissions[string] = "read";
    }

    return permissions;
  }, {});
  return {
    token,
    createdAt,
    expiresAt,
    permissions,
    repositoryIds: options.repositoryIds,
    singleFileName,
    repositorySelection: repositorySelection
  };
}
async function set(cache, options, data) {
  const key = optionsToCacheKey(options);
  const permissionsString = options.permissions ? "" : Object.keys(data.permissions).map(name => `${name}${data.permissions[name] === "write" ? "!" : ""}`).join(",");
  const value = [data.token, data.createdAt, data.expiresAt, data.repositorySelection, permissionsString, data.singleFileName].join("|");
  await cache.set(key, value);
}

function optionsToCacheKey({
  installationId,
  permissions = {},
  repositoryIds = []
}) {
  const permissionsString = Object.keys(permissions).sort().map(name => permissions[name] === "read" ? name : `${name}!`).join(",");
  const repositoryIdsString = repositoryIds.sort().join(",");
  return [installationId, repositoryIdsString, permissionsString].filter(Boolean).join("|");
}

function toTokenAuthentication({
  installationId,
  token,
  createdAt,
  expiresAt,
  repositorySelection,
  permissions,
  repositoryIds,
  singleFileName
}) {
  return Object.assign({
    type: "token",
    tokenType: "installation",
    token,
    installationId,
    permissions,
    createdAt,
    expiresAt,
    repositorySelection
  }, repositoryIds ? {
    repositoryIds
  } : null, singleFileName ? {
    singleFileName
  } : null);
}

async function getInstallationAuthentication(state, options, customRequest) {
  const installationId = Number(options.installationId || state.installationId);

  if (!installationId) {
    throw new Error("[@octokit/auth-app] installationId option is required for installation authentication.");
  }

  if (options.factory) {
    const {
      type,
      factory
    } = options,
          factoryAuthOptions = _objectWithoutProperties(options, ["type", "factory"]); // @ts-ignore if `options.factory` is set, the return type for `auth()` should be `Promise<ReturnType<options.factory>>`


    return factory(Object.assign({}, state, factoryAuthOptions));
  }

  const optionsWithInstallationTokenFromState = Object.assign({
    installationId
  }, options);

  if (!options.refresh) {
    const result = await get(state.cache, optionsWithInstallationTokenFromState);

    if (result) {
      const {
        token,
        createdAt,
        expiresAt,
        permissions,
        repositoryIds,
        singleFileName,
        repositorySelection
      } = result;
      return toTokenAuthentication({
        installationId,
        token,
        createdAt,
        expiresAt,
        permissions,
        repositorySelection,
        repositoryIds,
        singleFileName
      });
    }
  }

  const appAuthentication = await getAppAuthentication(state);
  const request = customRequest || state.request;
  const {
    data: {
      token,
      expires_at: expiresAt,
      repositories,
      permissions,
      // @ts-ignore
      repository_selection: repositorySelection,
      // @ts-ignore
      single_file: singleFileName
    }
  } = await request("POST /app/installations/{installation_id}/access_tokens", {
    installation_id: installationId,
    repository_ids: options.repositoryIds,
    permissions: options.permissions,
    mediaType: {
      previews: ["machine-man"]
    },
    headers: {
      authorization: `bearer ${appAuthentication.token}`
    }
  });
  const repositoryIds = repositories ? repositories.map(r => r.id) : void 0;
  const createdAt = new Date().toISOString();
  await set(state.cache, optionsWithInstallationTokenFromState, {
    token,
    createdAt,
    expiresAt,
    repositorySelection,
    permissions,
    repositoryIds,
    singleFileName
  });
  return toTokenAuthentication({
    installationId,
    token,
    createdAt,
    expiresAt,
    repositorySelection,
    permissions,
    repositoryIds,
    singleFileName
  });
}

async function getOAuthAuthentication(state, options, customRequest) {
  const request = customRequest || state.request; // The "/login/oauth/access_token" is not part of the REST API hosted on api.github.com,
  // instead it’s using the github.com domain.

  const route = /^https:\/\/(api\.)?github\.com$/.test(state.request.endpoint.DEFAULTS.baseUrl) ? "POST https://github.com/login/oauth/access_token" : `POST ${state.request.endpoint.DEFAULTS.baseUrl.replace("/api/v3", "/login/oauth/access_token")}`;
  const parameters = {
    headers: {
      accept: `application/json`
    },
    client_id: state.clientId,
    client_secret: state.clientSecret,
    code: options.code,
    state: options.state,
    redirect_uri: options.redirectUrl
  };
  const response = await request(route, parameters);

  if (response.data.error !== undefined) {
    throw new requestError.RequestError(`${response.data.error_description} (${response.data.error})`, response.status, {
      headers: response.headers,
      request: request.endpoint(route, parameters)
    });
  }

  const {
    data: {
      access_token: token,
      scope
    }
  } = response;
  return {
    type: "token",
    tokenType: "oauth",
    token,
    scopes: scope.split(/,\s*/).filter(Boolean)
  };
}

async function auth(state, options) {
  if (options.type === "app") {
    return getAppAuthentication(state);
  }

  if (options.type === "installation") {
    return getInstallationAuthentication(state, options);
  }

  return getOAuthAuthentication(state, options);
}

const PATHS = ["/app", "/app/hook/config", "/app/installations", "/app/installations/{installation_id}", "/app/installations/{installation_id}/access_tokens", "/app/installations/{installation_id}/suspended", "/marketplace_listing/accounts/{account_id}", "/marketplace_listing/plan", "/marketplace_listing/plans", "/marketplace_listing/plans/{plan_id}/accounts", "/marketplace_listing/stubbed/accounts/{account_id}", "/marketplace_listing/stubbed/plan", "/marketplace_listing/stubbed/plans", "/marketplace_listing/stubbed/plans/{plan_id}/accounts", "/orgs/{org}/installation", "/repos/{owner}/{repo}/installation", "/users/{username}/installation"]; // CREDIT: Simon Grondin (https://github.com/SGrondin)
// https://github.com/octokit/plugin-throttling.js/blob/45c5d7f13b8af448a9dbca468d9c9150a73b3948/lib/route-matcher.js

function routeMatcher(paths) {
  // EXAMPLE. For the following paths:

  /* [
      "/orgs/{org}/invitations",
      "/repos/{owner}/{repo}/collaborators/{username}"
  ] */
  const regexes = paths.map(p => p.split("/").map(c => c.startsWith("{") ? "(?:.+?)" : c).join("/")); // 'regexes' would contain:

  /* [
      '/orgs/(?:.+?)/invitations',
      '/repos/(?:.+?)/(?:.+?)/collaborators/(?:.+?)'
  ] */

  const regex = `^(?:${regexes.map(r => `(?:${r})`).join("|")})[^/]*$`; // 'regex' would contain:

  /*
    ^(?:(?:\/orgs\/(?:.+?)\/invitations)|(?:\/repos\/(?:.+?)\/(?:.+?)\/collaborators\/(?:.+?)))[^\/]*$
       It may look scary, but paste it into https://www.debuggex.com/
    and it will make a lot more sense!
  */

  return new RegExp(regex, "i");
}

const REGEX = routeMatcher(PATHS);
function requiresAppAuth(url) {
  return !!url && REGEX.test(url);
}

const FIVE_SECONDS_IN_MS = 5 * 1000;

function isNotTimeSkewError(error) {
  return !(error.message.match(/'Expiration time' claim \('exp'\) must be a numeric value representing the future time at which the assertion expires/) || error.message.match(/'Issued at' claim \('iat'\) must be an Integer representing the time that the assertion was issued/));
}

async function hook(state, request, route, parameters) {
  let endpoint = request.endpoint.merge(route, parameters);

  if (requiresAppAuth(endpoint.url.replace(request.endpoint.DEFAULTS.baseUrl, ""))) {
    const {
      token
    } = await getAppAuthentication(state);
    endpoint.headers.authorization = `bearer ${token}`;
    let response;

    try {
      response = await request(endpoint);
    } catch (error) {
      // If there's an issue with the expiration, regenerate the token and try again.
      // Otherwise rethrow the error for upstream handling.
      if (isNotTimeSkewError(error)) {
        throw error;
      } // If the date header is missing, we can't correct the system time skew.
      // Throw the error to be handled upstream.


      if (typeof error.headers.date === "undefined") {
        throw error;
      }

      const diff = Math.floor((Date.parse(error.headers.date) - Date.parse(new Date().toString())) / 1000);
      state.log.warn(error.message);
      state.log.warn(`[@octokit/auth-app] GitHub API time and system time are different by ${diff} seconds. Retrying request with the difference accounted for.`);
      const {
        token
      } = await getAppAuthentication(_objectSpread2(_objectSpread2({}, state), {}, {
        timeDifference: diff
      }));
      endpoint.headers.authorization = `bearer ${token}`;
      return request(endpoint);
    }

    return response;
  }

  const {
    token,
    createdAt
  } = await getInstallationAuthentication(state, {}, request);
  endpoint.headers.authorization = `token ${token}`;
  return sendRequestWithRetries(state, request, endpoint, createdAt);
}
/**
 * Newly created tokens might not be accessible immediately after creation.
 * In case of a 401 response, we retry with an exponential delay until more
 * than five seconds pass since the creation of the token.
 *
 * @see https://github.com/octokit/auth-app.js/issues/65
 */

async function sendRequestWithRetries(state, request, options, createdAt, retries = 0) {
  const timeSinceTokenCreationInMs = +new Date() - +new Date(createdAt);

  try {
    return await request(options);
  } catch (error) {
    if (error.status !== 401) {
      throw error;
    }

    if (timeSinceTokenCreationInMs >= FIVE_SECONDS_IN_MS) {
      if (retries > 0) {
        error.message = `After ${retries} retries within ${timeSinceTokenCreationInMs / 1000}s of creating the installation access token, the response remains 401. At this point, the cause may be an authentication problem or a system outage. Please check https://www.githubstatus.com for status information`;
      }

      throw error;
    }

    ++retries;
    const awaitTime = retries * 1000;
    state.log.warn(`[@octokit/auth-app] Retrying after 401 response to account for token replication delay (retry: ${retries}, wait: ${awaitTime / 1000}s)`);
    await new Promise(resolve => setTimeout(resolve, awaitTime));
    return sendRequestWithRetries(state, request, options, createdAt, retries);
  }
}

const VERSION = "0.0.0-development";

const createAppAuth = function createAppAuth(options) {
  const log = Object.assign({
    warn: console.warn.bind(console)
  }, options.log);

  if ("id" in options) {
    log.warn(new deprecation.Deprecation('[@octokit/auth-app] "createAppAuth({ id })" is deprecated, use "createAppAuth({ appId })" instead'));
  }

  const state = Object.assign({
    request: request.request.defaults({
      headers: {
        "user-agent": `octokit-auth-app.js/${VERSION} ${universalUserAgent.getUserAgent()}`
      }
    }),
    cache: getCache()
  }, options, {
    appId: Number("appId" in options ? options.appId : options.id)
  }, options.installationId ? {
    installationId: Number(options.installationId)
  } : {}, {
    log
  });
  return Object.assign(auth.bind(null, state), {
    hook: hook.bind(null, state)
  });
};

exports.createAppAuth = createAppAuth;
//# sourceMappingURL=index.js.map
