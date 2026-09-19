import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { isApiClientError } from './api';

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

export function formatScore(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'n/a';
  }

  return value.toFixed(2);
}

export function Button({
  tone = 'primary',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'secondary' | 'ghost';
}) {
  return (
    <button
      {...props}
      className={joinClassNames('button', `button--${tone}`, className)}
    >
      {children}
    </button>
  );
}

export function Section({
  title,
  eyebrow,
  actions,
  children,
  className,
}: HTMLAttributes<HTMLElement> & {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={joinClassNames('panel', className)}>
      <div className="panel__header">
        <div>
          {eyebrow ? <p className="panel__eyebrow">{eyebrow}</p> : null}
          <h2 className="panel__title">{title}</h2>
        </div>
        {actions ? <div className="panel__actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

type ErrorCopy = {
  title: string;
  message: string;
};

function getErrorCopy(error: unknown): ErrorCopy {
  if (isApiClientError(error)) {
    return {
      title: error.code ?? `Request failed (${error.status})`,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      title: 'Request failed',
      message: error.message,
    };
  }

  return {
    title: 'Request failed',
    message: 'Something unexpected happened.',
  };
}

export function ErrorBanner({
  error,
  className,
  title,
  message,
  detail,
}: {
  error: unknown;
  className?: string;
  title?: string;
  message?: string;
  detail?: string;
}) {
  const copy = getErrorCopy(error);
  const resolvedTitle = title ?? copy.title;
  const resolvedMessage = message ?? copy.message;

  return (
    <div className={joinClassNames('message message--error', className)} role="alert">
      <strong>{resolvedTitle}</strong>
      <p>{resolvedMessage}</p>
      {detail ? <small className="message__detail">{detail}</small> : null}
    </div>
  );
}

export function InfoBanner({
  title,
  message,
  className,
  tone = 'info',
  detail,
}: {
  title: string;
  message: string;
  className?: string;
  tone?: 'info' | 'success' | 'warning';
  detail?: string;
}) {
  return (
    <div className={joinClassNames('message', `message--${tone}`, className)}>
      <strong>{title}</strong>
      <p>{message}</p>
      {detail ? <small className="message__detail">{detail}</small> : null}
    </div>
  );
}

export function LoadingBlock({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <div className={joinClassNames('loading-block', compact && 'loading-block--compact')}>
      <span className="loading-block__dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
