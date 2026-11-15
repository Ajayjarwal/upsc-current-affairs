import type { Metadata } from 'next';
import { getCurrentUser, authenticationReady } from '../auth';
import { safeLoginReturnPath, signInPath, signOutPath } from '../auth-paths';
import LoginScreen from './login-screen';
import './login.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign in | Current Affairs', robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ return_to?: string | string[]; error?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeLoginReturnPath(params.return_to);
  const user = await getCurrentUser();
  const errors: Record<string, string> = {
    denied: 'This GitHub account cannot access this desk. Please use your own account.',
    cancelled: 'Sign-in was cancelled. You can try again when you’re ready.',
    expired: 'This sign-in request expired. Please try again.',
    unavailable: 'GitHub sign-in is temporarily unavailable. Please try again.',
  };
  return <LoginScreen
    signInHref={signInPath(returnTo)}
    deskHref={returnTo}
    signOutHref={signOutPath('/login')}
    signedInIdentity={user ? user.email || `@${user.username}` : null}
    localPreview={import.meta.env.DEV}
    authReady={authenticationReady()}
    errorMessage={typeof params.error === 'string' ? errors[params.error] ?? '' : ''}
  />;
}
