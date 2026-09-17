import axios from "axios";
import { AppUserModel, AuthRequest, AuthResponse, TokenResponse } from "./models";

const API_BASE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL_LOCAL
  : import.meta.env.VITE_API_URL;

export const LOGIN_URL = `${API_BASE_URL}/auth/Login`;
export const ME_URL = `${API_BASE_URL}/Auth/Me`;
export const MOCK_ROLES_URL = `${API_BASE_URL}/Auth/Mock/Roles`;
export const MOCK_LOGIN_URL = `${API_BASE_URL}/Auth/Mock/Login`;

export function login(requestData: AuthRequest) {
    console.log(LOGIN_URL)
  return axios.post<AuthResponse>(LOGIN_URL, requestData)
};

// The Bearer header is attached by the axios interceptor (setUpAxios) from
// whatever's currently stored, so the token param isn't needed on the URL —
// kept only so existing callers (AuthInit, RequireAuth) don't need to change.
export function getUserByAccessToken(_token?: string) {
  return axios.get<AppUserModel>(ME_URL);
}

// Dev-only role picker backing /Auth/Mock/* — see AuthController.cs.
// Both 404 in any environment where MockAuth:Enabled isn't set (never in prod).
export function getMockRoles() {
  return axios.get<string[]>(MOCK_ROLES_URL);
}

export function mockLoginAsRole(role: string) {
  return axios.post<TokenResponse>(MOCK_LOGIN_URL, { role });
}