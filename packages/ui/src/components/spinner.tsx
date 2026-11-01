import * as React from 'react';
import { cn } from '../lib/cn';

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
  label?: string;
}

export function Spinner({ className, label = 'Loading', ...props }: SpinnerProps) {
  return (
    <svg
      className={cn('animate-spin motion-reduce:animate-none', className)}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label={label}
      {...props}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}
