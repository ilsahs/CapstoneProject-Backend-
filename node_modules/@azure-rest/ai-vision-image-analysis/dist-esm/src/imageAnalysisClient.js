// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { getClient } from "@azure-rest/core-client";
import { logger } from "./logger";
/**
 * Initialize a new instance of `ImageAnalysisClient`
 * @param endpoint - Azure AI Computer Vision endpoint (protocol and hostname, for example:
 * https://<resource-name>.cognitiveservices.azure.com).
 * @param credentials - uniquely identify client credential
 * @param options - the parameter for all optional parameters
 */
export default function createClient(endpoint, credentials, options = {}) {
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
    const client = getClient(baseUrl, credentials, options);
    return client;
}
//# sourceMappingURL=imageAnalysisClient.js.map