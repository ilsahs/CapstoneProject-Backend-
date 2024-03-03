'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var coreClient = require('@azure-rest/core-client');
var logger$1 = require('@azure/logger');

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
const logger = logger$1.createClientLogger("ai-vision-image-analysis");

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
/**
 * Initialize a new instance of `ImageAnalysisClient`
 * @param endpoint - Azure AI Computer Vision endpoint (protocol and hostname, for example:
 * https://<resource-name>.cognitiveservices.azure.com).
 * @param credentials - uniquely identify client credential
 * @param options - the parameter for all optional parameters
 */
function createClient(endpoint, credentials, options = {}) {
    var _a, _b, _c, _d, _e, _f;
    const baseUrl = (_a = options.baseUrl) !== null && _a !== void 0 ? _a : `${endpoint}/computervision`;
    options.apiVersion = (_b = options.apiVersion) !== null && _b !== void 0 ? _b : "2023-10-01";
    const userAgentInfo = `azsdk-js-ai-vision-image-analysis-rest/1.0.0-beta.2`;
    const userAgentPrefix = options.userAgentOptions && options.userAgentOptions.userAgentPrefix
        ? `${options.userAgentOptions.userAgentPrefix} ${userAgentInfo}`
        : `${userAgentInfo}`;
    options = Object.assign(Object.assign({}, options), { userAgentOptions: {
            userAgentPrefix,
        }, loggingOptions: {
            logger: (_d = (_c = options.loggingOptions) === null || _c === void 0 ? void 0 : _c.logger) !== null && _d !== void 0 ? _d : logger.info,
        }, credentials: {
            apiKeyHeaderName: (_f = (_e = options.credentials) === null || _e === void 0 ? void 0 : _e.apiKeyHeaderName) !== null && _f !== void 0 ? _f : "Ocp-Apim-Subscription-Key",
        } });
    const client = coreClient.getClient(baseUrl, credentials, options);
    return client;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
const responseMap = {
    "POST /imageanalysis:analyze": ["200"],
};
function isUnexpected(response) {
    const lroOriginal = response.headers["x-ms-original-url"];
    const url = new URL(lroOriginal !== null && lroOriginal !== void 0 ? lroOriginal : response.request.url);
    const method = response.request.method;
    let pathDetails = responseMap[`${method} ${url.pathname}`];
    if (!pathDetails) {
        pathDetails = getParametrizedPathSuccess(method, url.pathname);
    }
    return !pathDetails.includes(response.status);
}
function getParametrizedPathSuccess(method, path) {
    var _a, _b, _c, _d;
    const pathParts = path.split("/");
    // Traverse list to match the longest candidate
    // matchedLen: the length of candidate path
    // matchedValue: the matched status code array
    let matchedLen = -1, matchedValue = [];
    // Iterate the responseMap to find a match
    for (const [key, value] of Object.entries(responseMap)) {
        // Extracting the path from the map key which is in format
        // GET /path/foo
        if (!key.startsWith(method)) {
            continue;
        }
        const candidatePath = getPathFromMapKey(key);
        // Get each part of the url path
        const candidateParts = candidatePath.split("/");
        // track if we have found a match to return the values found.
        let found = true;
        for (let i = candidateParts.length - 1, j = pathParts.length - 1; i >= 1 && j >= 1; i--, j--) {
            if (((_a = candidateParts[i]) === null || _a === void 0 ? void 0 : _a.startsWith("{")) && ((_b = candidateParts[i]) === null || _b === void 0 ? void 0 : _b.indexOf("}")) !== -1) {
                const start = candidateParts[i].indexOf("}") + 1, end = (_c = candidateParts[i]) === null || _c === void 0 ? void 0 : _c.length;
                // If the current part of the candidate is a "template" part
                // Try to use the suffix of pattern to match the path
                // {guid} ==> $
                // {guid}:export ==> :export$
                const isMatched = new RegExp(`${(_d = candidateParts[i]) === null || _d === void 0 ? void 0 : _d.slice(start, end)}`).test(pathParts[j] || "");
                if (!isMatched) {
                    found = false;
                    break;
                }
                continue;
            }
            // If the candidate part is not a template and
            // the parts don't match mark the candidate as not found
            // to move on with the next candidate path.
            if (candidateParts[i] !== pathParts[j]) {
                found = false;
                break;
            }
        }
        // We finished evaluating the current candidate parts
        // Update the matched value if and only if we found the longer pattern
        if (found && candidatePath.length > matchedLen) {
            matchedLen = candidatePath.length;
            matchedValue = value;
        }
    }
    return matchedValue;
}
function getPathFromMapKey(mapKey) {
    const pathStart = mapKey.indexOf("/");
    return mapKey.slice(pathStart);
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

exports.default = createClient;
exports.isUnexpected = isUnexpected;
//# sourceMappingURL=index.js.map
