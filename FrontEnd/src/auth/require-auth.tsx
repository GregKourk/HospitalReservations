import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ScreenLoader } from '@/components/common/screen-loader';
import { useAuth } from './context/auth-context';
import { getUserByAccessToken } from '@/auth/lib/requests';

/**
 * Component to protect routes that require authentication.
 * If user is not authenticated, redirects to the login page.
 */
export const RequireAuth = () => {
  const { auth, logout, currentUser, setCurrentUser } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!auth?.token) {
        setLoading(false)
        return
      }

      // ✅ User already loaded
      if (currentUser) {
        setLoading(false)
        return
      }
      try {
        // ✅ ONLY verify if token exists
        const response = await getUserByAccessToken(auth?.token ?? "")
        if (response.data?.hasError) {
          throw new Error(response.data.error)
        }
        setCurrentUser(response.data)
        // Optional: refresh auth state if backend returns new data
      } catch (error: any) {
        console.error('Token verification failed', error)
        // Logout μόνο σε 401 — network errors δεν πρέπει να αποσυνδέουν
        if (error?.response?.status === 401) {
          logout()
        }
      } finally {
        setLoading(false)
      }
    };
    checkAuth();
  }, [auth]);

  // Show screen loader while checking authentication
  if (loading) {
    return <ScreenLoader />;
  }

  // If not authenticated, redirect to login
  if (!auth?.token) {
    return (
      <Navigate
        to={`/auth/signin?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  // If authenticated, render child routes
  return <Outlet />;
};
