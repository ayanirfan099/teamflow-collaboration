import * as React from 'react';
import { cn } from '../lib/cn';

const fieldBase =
  'w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink ' +
  'placeholder:text-ink-faint transition-colors focus-visible:outline-2 ' +
  'focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed ' +
  'disabled:bg-surface-sunken disabled:text-ink-faint motion-reduce:transition-none';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(fieldBase, invalid && 'border-danger focus-visible:outline-danger', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        fieldBase,
        'min-h-24 resize-y leading-relaxed',
        invalid && 'border-danger focus-visible:outline-danger',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        fieldBase,
        'appearance-none bg-surface-raised pr-8',
        invalid && 'border-danger focus-visible:outline-danger',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
});
