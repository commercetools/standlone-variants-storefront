import fetch from 'node-fetch'
import { ClientBuilder } from '@commercetools/sdk-client-v2';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';

// From old version - for customer login
import SdkAuth from '@commercetools/sdk-auth';

// Reference API client credentials from environment variables (optional - can be set via UI)
const {
  REACT_APP_PROJECT_KEY,
  REACT_APP_CLIENT_SECRET,
  REACT_APP_CLIENT_ID,
  REACT_APP_AUTH_URL,
  REACT_APP_API_URL,
  REACT_APP_SCOPES,
} = process.env

// Default scopes if not provided
const DEFAULT_SCOPES = 'view_products view_standalone_variants view_standalone_prices view_stores view_channels view_customer_groups';

// Store current clients
let currentApiRoot = null;
let currentAuthClient = null;
let currentConfig = null;

// Helper to get scopes array
function getScopes(scopesStr) {
  if (!scopesStr) return DEFAULT_SCOPES.split(' ');
  return scopesStr.split(' ').filter(s => s.trim().length > 0);
}

// Initialize clients from config (can be called from context or env vars)
export function initializeClients(config = {}) {
  const projectKey = config.projectKey || REACT_APP_PROJECT_KEY;
  const clientId = config.clientId || REACT_APP_CLIENT_ID;
  const clientSecret = config.clientSecret || REACT_APP_CLIENT_SECRET;
  const authUrl = config.authUrl || REACT_APP_AUTH_URL;
  const apiUrl = config.apiUrl || REACT_APP_API_URL;
  const scopes = getScopes(config.scopes || REACT_APP_SCOPES);

  if (!projectKey || !clientId || !clientSecret || !authUrl || !apiUrl) {
    console.warn('commercetools: Missing required configuration. Please configure via the home screen.');
    return null;
  }

  // Store current config
  currentConfig = { projectKey, clientId, clientSecret, authUrl, apiUrl, scopes };

  // Create auth client
  currentAuthClient = new SdkAuth({
    host: authUrl,
  projectKey: projectKey,
  disableRefreshToken: false,
  credentials: {
      clientId: clientId,
      clientSecret: clientSecret,
  },
    scopes: scopes,
  });

  // Create API client
const authMiddlewareOptions = {
    host: authUrl,
  projectKey,
  credentials: {
      clientId: clientId,
      clientSecret: clientSecret,
  },
    scopes: scopes,
  fetch,
};

const httpMiddlewareOptions = {
    host: apiUrl,
  fetch,
};

  const ctpClient = new ClientBuilder()
  .withProjectKey(projectKey)
  .withAnonymousSessionFlow(authMiddlewareOptions)
  .withHttpMiddleware(httpMiddlewareOptions)
  .withLoggerMiddleware()
  .build();

  currentApiRoot = createApiBuilderFromCtpClient(ctpClient, apiUrl).withProjectKey({ projectKey: projectKey });

  // Update exported values
  updateExports();

  return { apiRoot: currentApiRoot, authClient: currentAuthClient };
}

// Export mutable objects that can be updated (define before any initialization)
const apiRootWrapper = { value: currentApiRoot };
const authClientWrapper = { value: currentAuthClient };

// Update the exports when clients are initialized
function updateExports() {
  apiRootWrapper.value = currentApiRoot;
  authClientWrapper.value = currentAuthClient;
}

// Try to initialize from env vars if available (for backward compatibility)
if (REACT_APP_PROJECT_KEY && REACT_APP_CLIENT_ID && REACT_APP_CLIENT_SECRET && REACT_APP_AUTH_URL && REACT_APP_API_URL) {
  initializeClients();
}

// Export getters that always return current values
export const apiRoot = new Proxy(apiRootWrapper, {
  get(target, prop) {
    if (prop === 'value') {
      return target.value;
    }
    if (target.value === null) {
      console.warn('commercetools apiRoot not initialized. Please configure and connect via the home screen.');
      // Return a no-op function if methods are called
      if (typeof prop === 'string') {
        return () => {
          throw new Error('commercetools apiRoot not initialized. Please configure and connect via the home screen.');
        };
      }
      return undefined;
    }
    return target.value[prop];
  }
});

export const authClient = new Proxy(authClientWrapper, {
  get(target, prop) {
    if (prop === 'value') {
      return target.value;
    }
    if (target.value === null) {
      console.warn('commercetools authClient not initialized. Please configure and connect via the home screen.');
      // Return a no-op function if methods are called
      if (typeof prop === 'string') {
        return () => {
          throw new Error('commercetools authClient not initialized. Please configure and connect via the home screen.');
        };
      }
      return undefined;
    }
    return target.value[prop];
  }
});

// For backward compatibility, also export functions that return current values
export function getApiRoot() {
  return currentApiRoot;
}

export function getAuthClient() {
  return currentAuthClient;
}

// Create a new client with the new token, and a new api Root
export function setAccessToken(token) {
  if (!currentConfig) {
    throw new Error('commercetools client not initialized. Please configure and connect via the home screen.');
  }

  const { projectKey, apiUrl } = currentConfig;

  const httpMiddlewareOptions = {
    host: apiUrl,
    fetch,
  };

  const ctpClient = new ClientBuilder()
  .withProjectKey(projectKey)
  .withExistingTokenFlow(`Bearer ${token}`, { force: true})
  .withHttpMiddleware(httpMiddlewareOptions)
  .withLoggerMiddleware()
  .build();

  currentApiRoot = createApiBuilderFromCtpClient(ctpClient, apiUrl).withProjectKey({ projectKey: projectKey });
  updateExports();
}