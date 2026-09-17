import { createContext, FC, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import {  AppUserModel, AuthModel, PageItem, UserModel } from '@/auth/lib/models';
import * as helpers from '@/auth/lib/helpers';
import { Save } from 'lucide-react';
import { da } from 'date-fns/locale';
import { ScreenLoader } from '@/components/common/screen-loader';
import { getUserByAccessToken } from '@/auth/lib/requests';

// Create AuthContext with types
export const AuthContext = createContext<{
  auth?: AuthModel;
  saveAuth: (auth: AuthModel | undefined) => void;
  saveUserPages: (data: PageItem[] | undefined) => void;
  currentUser?: AppUserModel | undefined;
  setCurrentUser: React.Dispatch<React.SetStateAction<AppUserModel | undefined>>;
  logout: () => void;
  pagesAllowed: PageItem[] | undefined;
  routesAllowed: PageItem[] | undefined;
  setPagesAllowed: React.Dispatch<React.SetStateAction<PageItem[] | undefined>>;
}>({
  auth: helpers.getAuth(),
  saveAuth: () => { },
  saveUserPages: () => { },
  currentUser: undefined,
  setCurrentUser: () => { },
  logout: () => { },
  pagesAllowed: [],
  routesAllowed: [],
  setPagesAllowed: () => { },
});

const useAuth = () => {
  return useContext(AuthContext);
}

const flattenrray = (arr: PageItem[]): PageItem[] => {
  return arr.reduce((acc: PageItem[], item) => {
    const flattenedPages = item.navHasChildren && item.pages ? flattenrray(item.pages) : [];
    return acc.concat(item, flattenedPages);
  }, []);
};

const getRoutesFromPages = (arr: PageItem[]): PageItem[] => {
  const flattenPagesList = flattenrray(arr);
  return flattenPagesList.filter(page => page.navUrl && page.navUrl !== '');
};

const AuthProvider = ({ children }: PropsWithChildren) => {
  const [auth, setAuth] = useState<AuthModel | undefined>(helpers.getAuth());
  const [currentUser, setCurrentUser] = useState<AppUserModel | undefined>();
  const [pagesAllowed, setPagesAllowed] = useState<Array<PageItem> | undefined>(helpers.getStoreObject<Array<PageItem>>('UserPages'));
  const [routesAllowed, setRoutesAllowed] = useState<Array<PageItem> | undefined>(getRoutesFromPages(helpers.getStoreObject<Array<PageItem>>('UserPages') ?? []));

  const saveAuth = (authData: AuthModel | undefined) => {
    setAuth(authData);
    if (authData) {
      helpers.setAuth(authData);
    } else {
      helpers.removeAuth();
    }
  }; 

  const saveUserPages = (data: Array<PageItem> | undefined) => {
    const storeKey = 'UserPages';
    setPagesAllowed(data);
    setRoutesAllowed(getRoutesFromPages(data ?? []));
    if(data && data !== null){
      helpers.setStoreObject<Array<PageItem>>({ storeKey, data });
    } else {
      helpers.removeStoreObject(storeKey);
    }
  }

  const logout = () => {
    helpers.removeAuth();
    helpers.removeStoreObject('UserPages');
    saveAuth(undefined);
    setCurrentUser(undefined);
    setPagesAllowed(undefined);
    setRoutesAllowed(undefined);
    window.location.replace('/auth/signin');
  }

  return (
    <AuthContext.Provider
      value={{
        auth,
        saveAuth,
        saveUserPages,
        currentUser,
        setCurrentUser,
        logout,
        pagesAllowed,
        routesAllowed,
        setPagesAllowed
      }}>
      {children}
    </AuthContext.Provider>
  );  
}

const AuthInit: FC<PropsWithChildren> = ({ children }) => {
  const {auth, logout, setCurrentUser} = useAuth();
  const didRequest = useRef(false);
  const [showSplashScreen, setShowSplashScreen] = useState(true);

  useEffect(() => {
    const requestUser = async (apiToken: string) => {
      try {
        if (!didRequest.current) {
          const { data } = await getUserByAccessToken(apiToken);
          if (data) {
            if (!data.hasError) {
              setCurrentUser(data);
            } else {
              console.error('Error fetching user:', data.error);
              logout();
            }
          }
        }
      } catch (error: any) {
        console.error('Error fetching current user:', error);
        // Logout μόνο σε 401 — network errors δεν πρέπει να αποσυνδέουν
        if (!didRequest.current && error?.response?.status === 401) {
          logout();
        }
      } finally {
        setShowSplashScreen(false);
      }
    };

    if (auth && auth.token) {
      requestUser(auth.token);
    } else {
      logout();
      setShowSplashScreen(false);
    }

    return () => { didRequest.current = true; };
  }, [auth]);

  return (showSplashScreen ? <ScreenLoader /> : children);
};

export {AuthProvider, AuthInit, useAuth}