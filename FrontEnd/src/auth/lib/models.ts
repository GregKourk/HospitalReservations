// Define UUID type for consistent usage
export type UUID = string;

// Language code type for user preferences
export type LanguageCode = 'en' | 'de' | 'es' | 'fr' | 'ja' | 'zh';

// Auth model representing the authentication session (matches backend AuthResponse)
export interface AuthModel {
  token: string;
  refreshToken?: string;
  jwtExpire?: string;
}

// User model representing the user profile
export interface UserModel {
  username: string;
  password?: string; 
  email: string;
  first_name: string;
  last_name: string;
  fullname?: string; 
  email_verified?: boolean;
  occupation?: string;
  company_name?: string; 
  phone?: string;
  roles?: number[]; 
  pic?: string;
  language?: LanguageCode; 
  is_admin?: boolean; 
}

export interface PageItem{
  app_Forms_Id: number;
  app_Id: number;
  parentId: number;
  name: string;
  routeElement: string;
  routeCombPath: string;
  navUrl: string;
  navTitle: string;
  navIcon: string;
  navFontIcon: string;
  navHasBullet: boolean;
  navHasChildren: boolean;
  canEdit: boolean;
  visible: boolean;
  devVisible: boolean;
  orderValue: number;
  onlyRoute: boolean;
  isExternalLink: boolean;
  userHasEditRights: boolean;
  pages: PageItem[];
}

export interface AuthResponse{
  token: string;
  refreshToken: string;
  jwtExpire:string;
  rootPages: PageItem[];
  errorMessage : string | null;
  consoleErrorMsg: string | null; 
  hasError: boolean;
}

export interface AuthRequest{
  username: string;
  password: string;
  rememberMe?: boolean;
  serverIp: string;

  // Mock-only (dev)
  isMock?: boolean;
  mockAma?: string;
  mockTenantCode?: string;
  mockRole?: string;
  mockAccess?: string;
}

// Matches HospitalReservationsAPI's /Auth/Me response and the user fields
// returned by /Auth/Mock/Login and /Auth/Token/Exchange.
export interface AppUserModel {
  userId: string;
  email: string;
  fullName: string;
  amka?: string | null;
  roles: string[];
  hasError?: boolean;
  error?: string;
}

// Matches HospitalReservationsAPI.Model.DTOs.TokenResponse.
export interface TokenResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  userId: string;
  email: string;
  fullName: string;
  roles: string[];
  rootPages: PageItem[];
}