import { getData, setData } from '@/lib/storage';
import { jwtDecode } from 'jwt-decode';
import { AuthModel } from './models';

const AUTH_LOCAL_STORAGE_KEY = `${import.meta.env.VITE_APP_NAME}-auth-v${import.meta.env.VITE_APP_VERSION || '1.0'
  }`;

/**
 * Get stored auth information from local storage
 */
const getAuth = (): AuthModel | undefined => {
  if (!localStorage) {
    return undefined;
  }

  const lsValue: string | null = localStorage.getItem(AUTH_LOCAL_STORAGE_KEY);
  if (!lsValue) {
    return undefined;
  }

  try {
    const auth = getData(AUTH_LOCAL_STORAGE_KEY) as AuthModel | undefined;
    return auth;
  } catch (error) {
    console.error('AUTH LOCAL STORAGE PARSE ERROR', error);
  }
};

/**
 * Save auth information to local storage
 */
const setAuth = (auth: AuthModel) => {
  setData(AUTH_LOCAL_STORAGE_KEY, auth);
};

/**
 * Remove auth information from local storage
 */
const removeAuth = () => {
  if (!localStorage) {
    return;
  }

  try {
    localStorage.removeItem(AUTH_LOCAL_STORAGE_KEY);
  } catch (error) {
    console.error('AUTH LOCAL STORAGE REMOVE ERROR', error);
  }
};

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

type JwtPayload = {
  exp?: number;
  [key: string]: unknown;
};

/**
 * Returns `true` if the stored token is missing or expired.
 */
const isTokenExpired = (auth?: AuthModel): boolean => {
  if (!auth?.token) return true;

  try {
    const { exp } = jwtDecode<JwtPayload>(auth.token);
    if (!exp) return true; // no expiry claim

    // `exp` is in seconds since epoch
    return Date.now() >= exp * 1000;
  } catch (e) {
    console.error('jwt-decode failed', e);
    return true;
  }
};

/**
 * If the token is still valid, bump the `jwtExpire` field by `secs` seconds
 * (1000 by default) and persist the change.  Returns the updated auth object.
 */
const extendTokenExpiry = (
  auth: AuthModel,
  secs = 1000,
): AuthModel => {
  if (isTokenExpired(auth)) return auth;

  try {
    const { exp } = jwtDecode<JwtPayload>(auth.token);
    if (exp) {
      const newExpire = new Date(exp * 1000 + secs * 1000).toISOString();
      const updated: AuthModel = { ...auth, jwtExpire: newExpire };
      setAuth(updated);
      return updated;
    }
  } catch (e) {
    console.error('jwt-decode failed when extending expiry', e);
  }

  return auth;
};

export function setUpAxios(axiosInstance: any) {
  axiosInstance.defaults.headers.Accept = 'aplication/json';
  // Lets the browser send/store the HttpOnly refresh-token cookie the API
  // sets on /Auth/Mock/Login, /Auth/Token/Exchange and /Auth/Refresh — the
  // SPA and API are different origins (different ports) even in dev.
  axiosInstance.defaults.withCredentials = true;

  // ── Request: attach Bearer token ──────────────────────────────────────────
  axiosInstance.interceptors.request.use(
    (config: any) => {
      const auth = getAuth();
      if (auth && auth?.token) {
        config.headers['Authorization'] = `Bearer ${auth.token}`;
      }
      return config;
    },
    (error: any) => Promise.reject(error)
  );

  // ── Response: redirect to login on 401 (token expired / invalid) ──────────
  axiosInstance.interceptors.response.use(
    (response: any) => response,
    (error: any) => {
      if (error?.response?.status === 401) {
        removeAuth();
        window.location.replace('/auth/signin');
      }
      return Promise.reject(error);
    }
  );
}

interface Props<T> { storeKey: string; data?: T | T[]; }
function getStoreObject<T>(storeKey: string): T | undefined {
  if (!localStorage) {
    return undefined;
  }

  const encryptedValue = localStorage.getItem(storeKey);
  if (!encryptedValue) {
    return undefined;
  }

  try {
    const storedValue = localStorage.getItem(storeKey);
    if (storedValue) {
      return JSON.parse(storedValue) as T ;
    }
  } catch (error) {
    console.error(`Error parsing localStorage item ${storeKey}:`, error);
  }
  return undefined;
}

function setStoreObject<T>(props: Props<T>): void {
  if (!localStorage) {
    return undefined;
  }

  const { storeKey, data } = props;

  if (!localStorage) {
    return;
  }

  try {
    const stringValue = JSON.stringify(data);
    localStorage.setItem(storeKey, stringValue);
  } catch (error) {
    console.error(`Error setting localStorage item ${storeKey}:`, error);
  }
}

function removeStoreObject(storeKey: string): void {  
  if (!localStorage) {
    return;
  }

  try {
    localStorage.removeItem(storeKey);
  } catch (error) {
    console.error(`Error removing localStorage item ${storeKey}:`, error);
  }
}

export {
  AUTH_LOCAL_STORAGE_KEY,
  getAuth,
  removeAuth,
  setAuth,
  isTokenExpired,
  extendTokenExpiry,
  getStoreObject,
  setStoreObject,
  removeStoreObject,
};
