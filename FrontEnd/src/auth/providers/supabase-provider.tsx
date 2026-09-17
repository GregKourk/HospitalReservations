import { PropsWithChildren, useEffect, useState } from 'react';
import { SupabaseAdapter } from '@/auth/adapters/supabase-adapter';
import { AuthContext } from '@/auth/context/auth-context';
import * as authHelper from '@/auth/lib/helpers';
import { AppUserModel, AuthModel, UserModel } from '@/auth/lib/models';
import { getUserByAccessToken } from '@/auth/lib/requests';

// Define the Supabase Auth Provider
export function AuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [auth, setAuth ] = useState<AuthModel | undefined>(authHelper.getAuth());
  const [currentUser, setCurrentUser] = useState<AppUserModel | undefined>();
  
  const verify = async () => {
    if (auth) {
      try {
        // If we have appUser in auth, use it directly
        if (currentUser) {
          const appUser = currentUser;
          setCurrentUser(appUser);    
          saveAuth(auth);  
        } else {
          // Fallback to getting user from backend if not in auth
          const user = await getUser();
          setCurrentUser(user.data);
        }
      } catch {
        saveAuth(undefined);
        setCurrentUser(undefined);
      }
    }
  };

  const saveAuth = (auth: AuthModel | undefined) => {
    setAuth(auth);
    if (auth) {
      authHelper.setAuth(auth);
    } else {
      authHelper.removeAuth();
    }
  };

  const getUser = async () => {
    return await getUserByAccessToken(auth?.token??"");
  };