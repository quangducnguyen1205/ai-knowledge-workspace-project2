import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiClientError, getCurrentUser, loginUser, logoutUser, registerUser, type AuthCredentialsInput } from '../../lib/api';
import { Button, ErrorBanner } from '../../lib/ui';

export const authKeys = {
  currentUser: ['auth', 'me'] as const,
};

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: authKeys.currentUser,
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 0,
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: registerUser,
  });
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: loginUser,
  });
}

export function useLogoutMutation() {
  return useMutation({
    mutationFn: logoutUser,
  });
}

type FriendlyAuthErrorCopy = {
  title: string;
  message: string;
  detail?: string;
};

function getFriendlyAuthErrorCopy(error: unknown, mode: 'register' | 'login' | 'logout'): FriendlyAuthErrorCopy | null {
  if (!(error instanceof ApiClientError)) {
    return null;
  }

  if (error.status === 0) {
    return {
      title: mode === 'logout' ? 'Sign out is unavailable' : 'Authentication is temporarily unavailable',
      message:
        mode === 'logout'
          ? 'We could not reach the service to sign you out, so your current session is still active.'
          : 'We could not reach the service, so your session has not changed yet.',
    };
  }

  if (mode === 'register' && error.status === 409 && error.code === 'EMAIL_ALREADY_REGISTERED') {
    return {
      title: 'Email already registered',
      message: 'Use a different email address or switch to Sign in if this account already exists.',
      detail: `Backend detail: ${error.code}`,
    };
  }

  if (mode === 'login' && error.status === 401 && error.code === 'INVALID_CREDENTIALS') {
    return {
      title: 'Incorrect email or password',
      message: 'Double-check your credentials and try again.',
      detail: `Backend detail: ${error.code}`,
    };
  }

  if (error.status === 400 && error.code === 'INVALID_EMAIL') {
    return {
      title: 'Enter a valid email address',
      message: 'Use a complete email address and try again.',
      detail: `Backend detail: ${error.code} - ${error.message}`,
    };
  }

  if (error.status === 400 && error.code === 'INVALID_PASSWORD') {
    return {
      title: 'Password was rejected',
      message: 'Use a password that meets the current requirements, then try again.',
      detail: `Backend detail: ${error.code} - ${error.message}`,
    };
  }

  if (error.status === 400 && error.code === 'INVALID_AUTH_REQUEST') {
    return {
      title: 'Check the form and try again',
      message: 'The request was not accepted. Review both fields and submit again.',
      detail: `Backend detail: ${error.code} - ${error.message}`,
    };
  }

  if (mode === 'logout') {
    return {
      title: 'Sign out failed',
      message: 'We could not confirm sign out, so this session is still active.',
      detail: error.code ? `Backend detail: ${error.code} - ${error.message}` : `Backend detail: ${error.message}`,
    };
  }

  return {
    title: mode === 'register' ? 'Account creation failed' : 'Sign-in failed',
    message:
      mode === 'register'
        ? 'We could not create your account yet. Try again in a moment.'
        : 'We could not sign you in yet. Try again in a moment.',
    detail: error.code ? `Backend detail: ${error.code} - ${error.message}` : `Backend detail: ${error.message}`,
  };
}

export function AuthEntrySurface({
  registerError,
  loginError,
  isRegistering,
  isLoggingIn,
  onRegister,
  onLogin,
  onResetErrors,
}: {
  registerError: unknown;
  loginError: unknown;
  isRegistering: boolean;
  isLoggingIn: boolean;
  onRegister: (input: AuthCredentialsInput) => void;
  onLogin: (input: AuthCredentialsInput) => void;
  onResetErrors: () => void;
}) {
  const [mode, setMode] = useState<'register' | 'login'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const activeError = mode === 'register' ? registerError : loginError;
  const errorCopy = getFriendlyAuthErrorCopy(activeError, mode);
  const isSubmitting = mode === 'register' ? isRegistering : isLoggingIn;
  const productHighlights = [
    {
      title: 'Upload source material',
      description: 'Bring lecture videos into one workspace.',
    },
    {
      title: 'Review the transcript',
      description: 'Read the extracted transcript before publishing it to search.',
    },
    {
      title: 'Search exact context',
      description: 'Open the surrounding transcript rows around every hit.',
    },
  ];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      email: email.trim(),
      password,
    };

    if (!payload.email || !payload.password.trim()) {
      return;
    }

    if (mode === 'register') {
      onRegister(payload);
      return;
    }

    onLogin(payload);
  }

  return (
    <div className="auth-shell">
      <div className="auth-layout">
        <section className="auth-hero">
          <div className="auth-hero__copy">
            <p className="hero__eyebrow">AI Knowledge Workspace</p>
            <h1>Search-first workspaces for long-form knowledge.</h1>
            <p>
              Upload a lecture video, review the transcript, explicitly index it, and search the exact passage you
              need inside the right workspace.
            </p>
          </div>

          <div className="auth-highlights">
            {productHighlights.map((highlight, index) => (
              <div key={highlight.title} className="auth-highlight">
                <span className="auth-highlight__index">0{index + 1}</span>
                <div>
                  <strong>{highlight.title}</strong>
                  <p>{highlight.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="auth-preview">
            <div className="auth-preview__card">
              <span className="auth-preview__label">Workspace</span>
              <strong>Distributed Systems Lab</strong>
              <p>12 assets ready for transcript review and search preparation.</p>
            </div>
            <div className="auth-preview__card auth-preview__card--accent">
              <span className="auth-preview__label">Transcript state</span>
              <strong>Ready to index</strong>
              <p>Transcript reviewed. Publish to workspace search when you are ready.</p>
            </div>
            <div className="auth-preview__snippet">
              <span className="auth-preview__label">Search context</span>
              <p>
                "Vector clocks capture causal ordering without forcing a single global time."
              </p>
            </div>
          </div>
        </section>

        <div className="auth-card">
          <div className="auth-card__top">
            <div className="auth-card__intro">
              <p className="hero__eyebrow">Welcome back</p>
              <h2>{mode === 'register' ? 'Create your account' : 'Sign in to your workspace'}</h2>
              <p>
                {mode === 'register'
                  ? 'Start with a clean workspace shell for transcript review, indexing, and search.'
                  : 'Pick up where you left off inside your authenticated knowledge workspace.'}
              </p>
            </div>

            <div className="auth-card__tabs" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                className={`auth-tab ${mode === 'login' ? 'auth-tab--active' : ''}`}
                onClick={() => {
                  onResetErrors();
                  setMode('login');
                }}
                aria-pressed={mode === 'login'}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`auth-tab ${mode === 'register' ? 'auth-tab--active' : ''}`}
                onClick={() => {
                  onResetErrors();
                  setMode('register');
                }}
                aria-pressed={mode === 'register'}
              >
                Create account
              </button>
            </div>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span className="field__label">Email</span>
              <input
                className="field__input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                autoComplete={mode === 'login' ? 'username' : 'email'}
                maxLength={255}
              />
            </label>

            <label className="field">
              <span className="field__label">Password</span>
              <input
                className="field__input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === 'register' ? 'Create a secure password' : 'Enter your password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                maxLength={255}
              />
            </label>

            <div className="auth-form__actions">
              <Button type="submit" disabled={isSubmitting || !email.trim() || !password.trim()}>
                {isSubmitting
                  ? mode === 'register'
                    ? 'Creating account...'
                    : 'Signing in...'
                  : mode === 'register'
                    ? 'Create account'
                    : 'Sign in'}
              </Button>
              <span className="auth-form__hint">
                {mode === 'register'
                  ? 'New accounts are signed in immediately after they are created.'
                  : 'Signing in opens your workspace shell directly.'}
              </span>
            </div>
          </form>

          {activeError ? (
            <ErrorBanner
              error={activeError}
              title={errorCopy?.title}
              message={errorCopy?.message}
              detail={errorCopy?.detail}
            />
          ) : null}

          <div className="auth-card__footer">
            <strong>What happens next</strong>
            <p>Choose or create a workspace, upload a source asset, review the transcript, then explicitly index it for search.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function getFriendlyLogoutErrorCopy(error: unknown): FriendlyAuthErrorCopy | null {
  return getFriendlyAuthErrorCopy(error, 'logout');
}
