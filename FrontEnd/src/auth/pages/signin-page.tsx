import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/context/auth-context';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Check, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { getSigninSchema, SigninSchemaType } from '../forms/signin-schema';
import { LoaderCircleIcon } from 'lucide-react';
import { getUserByAccessToken, login, getMockRoles, mockLoginAsRole } from '../lib/requests';
import { AuthModel, AuthRequest } from '../lib/models';

// Static fallback so the picker still renders if /Auth/Mock/Roles can't be
// reached yet (backend not running, MockAuth disabled) — mirrors the roles
// seeded by database/hospital-schema.sql.
const FALLBACK_MOCK_ROLES = ['Admin', 'SuperUser', 'ClinicManager', 'Doctor', 'Reception', 'Patient'];

export function SignInPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { saveAuth, setCurrentUser, saveUserPages } = useAuth();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mockRoles, setMockRoles] = useState<string[]>(FALLBACK_MOCK_ROLES);
  const [mockingRole, setMockingRole] = useState<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    getMockRoles()
      .then(({ data }) => { if (data?.length) setMockRoles(data); })
      .catch(() => { /* backend unreachable or MockAuth disabled — keep the static fallback */ });
  }, []);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    if (errorParam) {
      switch (errorParam) {
        case 'auth_token_error':
          setError(errorDescription || 'Πρόβλημα στην αυθεντικοποίηση. Παρακαλώ δοκιμάστε ξανά.');
          break;
        default:
          setError(errorDescription || 'Πρόβλημα στην αυθεντικοποίηση. Παρακαλώ δοκιμάστε ξανά.');
          break;
      }
    }
  }, [searchParams]);

  const form = useForm<SigninSchemaType>({
    resolver: zodResolver(getSigninSchema()),
    defaultValues: { username: '', password: '' },
  });

  // ── Shared post-login handler (used by both real and mock login) ──────────
  async function handleAuthResponse(token: string, rootPages: any) {
    const auth: AuthModel = { token };
    saveAuth(auth);
    const { data: user } = await getUserByAccessToken(token);
    setCurrentUser(user);
    saveUserPages(rootPages);
    navigate(searchParams.get('next') || '/');
  }

  async function onSubmit(values: SigninSchemaType) {
    try {
      setIsProcessing(true);
      setError(null);

      if (!values.username.trim() || !values.password) {
        setError('Το όνομα χρήστη και ο κωδικός απαιτούνται. Παρακαλώ συμπληρώστε και τα δύο πεδία.');
        return;
      }

      try {
        const authRequest: AuthRequest = {
          username: values.username,
          password: values.password,
          rememberMe: false,
          serverIp: window.location.host,
        };
        const { data: authResponse } = await login(authRequest);
        if (!authResponse.hasError) {
          await handleAuthResponse(authResponse.token, authResponse.rootPages);
        } else {
          console.error('Σφάλμα κατά τη σύνδεση:', authResponse.errorMessage);
          console.error('Σφάλμα κονσόλας:', authResponse.errorMessage);
          saveAuth(undefined);
          setError(authResponse.errorMessage || 'Σφάλμα κατά τη σύνδεση. Παρακαλώ δοκιμάστε ξανά.');
        }
      } catch (err) {
        console.error('Απροσδιόριστο πρόβλημα κατά τη σύνδεση:', err);
        saveAuth(undefined);
        setError(err instanceof Error ? err.message : 'Απροσδιόριστο πρόβλημα κατά τη σύνδεση. Παρακαλώ δοκιμάστε ξανά.');
      }
    } catch (err) {
      console.error('Απροσδιόριστο πρόβλημα κατά τη διαδικασία της εισόδου:', err);
      setError(err instanceof Error ? err.message : 'Απροσδιόριστο πρόβλημα κατά τη διαδικασία της εισόδου. Παρακαλώ δοκιμάστε ξανά.');
    } finally {
      setIsProcessing(false);
    }
  }

  // ── Mock login handler (dev only) ─────────────────────────────────────────
  // Separate from handleAuthResponse on purpose: /Auth/Mock/Login already
  // returns the full user (no follow-up /Auth/Me round-trip needed), and
  // there's no rootPages/menu tree for this domain to save.
  async function onMockLogin(role: string) {
    setMockingRole(role);
    setError(null);
    try {
      const { data } = await mockLoginAsRole(role);
      const auth: AuthModel = { token: data.accessToken, jwtExpire: data.accessTokenExpiresAt };
      saveAuth(auth);
      setCurrentUser({
        userId: data.userId,
        email: data.email,
        fullName: data.fullName,
        roles: data.roles,
      });
      saveUserPages(data.rootPages);
      navigate(searchParams.get('next') || '/');
    } catch (err: any) {
      setError(
        err?.response?.status === 404
          ? 'Το mock login είναι απενεργοποιημένο σε αυτό το περιβάλλον.'
          : err instanceof Error ? err.message : 'Mock login error',
      );
    } finally {
      setMockingRole(null);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="block w-full space-y-5">

        <div className="text-center space-y-1 pb-3">
          <h1 className="text-2xl font-semibold tracking-tight">Είσοδος Χρήστη</h1>
          <p className="text-sm text-muted-foreground">
            Παρακαλώ εισάγετε τα στοιχεία σας για να συνδεθείτε στον λογαριασμό σας.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" appearance="light" onClose={() => setError(null)}>
            <AlertIcon><AlertCircle /></AlertIcon>
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}

        {successMessage && (
          <Alert appearance="light" onClose={() => setSuccessMessage(null)}>
            <AlertIcon><Check /></AlertIcon>
            <AlertTitle>{successMessage}</AlertTitle>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Όνομα Χρήστη</FormLabel>
              <FormControl>
                <Input placeholder="Εισάγετε όνομα χρήστη" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center gap-2.5">
                <FormLabel>Κωδικός Πρόσβασης</FormLabel>
              </div>
              <div className="relative">
                <Input
                  placeholder="Εισάγετε τον κωδικό πρόσβασης σας"
                  type={passwordVisible ? 'text' : 'password'}
                  {...field}
                />
                <Button
                  type="button"
                  variant="ghost"
                  mode="icon"
                  onClick={() => setPasswordVisible(!passwordVisible)}
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                >
                  {passwordVisible
                    ? <EyeOff className="text-muted-foreground" />
                    : <Eye className="text-muted-foreground" />}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isProcessing}>
          {isProcessing
            ? <span className="flex items-center gap-2"><LoaderCircleIcon className="h-4 w-4 animate-spin" /> Φόρτωση...</span>
            : 'Είσοδος'}
        </Button>

        {import.meta.env.DEV && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Mock login (dev only) — παρακάμπτει το gov.gr μέχρι να υπάρχουν πραγματικά credentials
            </p>
            <div className="grid grid-cols-2 gap-2">
              {mockRoles.map((role) => (
                <Button
                  key={role}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isProcessing || mockingRole !== null}
                  onClick={() => onMockLogin(role)}
                >
                  {mockingRole === role
                    ? <LoaderCircleIcon className="h-4 w-4 animate-spin" />
                    : role}
                </Button>
              ))}
            </div>
          </div>
        )}

      </form>
    </Form>
  );
}
