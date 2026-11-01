import * as React from 'react';
import { cn } from '../lib/cn';

const AVATAR_TONES = [
  'bg-[#E8D5C4] text-[#6B4A2F]',
  'bg-[#D7E3D0] text-[#3F5C3A]',
  'bg-[#D9DEEC] text-[#3B4763]',
  'bg-[#EBD3D3] text-[#6E3B3B]',
  'bg-[#E6DCE8] text-[#57395C]',
  'bg-[#E4E1D3] text-[#5E5733]',
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

function toneFor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 9973;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md';
}

export function Avatar({ name, src, size = 'sm', className, ...props }: AvatarProps) {
  const sizes = { xs: 'h-5 w-5 text-[10px]', sm: 'h-6 w-6 text-[11px]', md: 'h-9 w-9 text-sm' };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold',
        sizes[size],
        !src && toneFor(name),
        className,
      )}
      title={name}
      {...props}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials(name)}
      <span className="sr-only">{name}</span>
    </span>
  );
}

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}

export function ProgressBar({ value, max = 100, label, className }: ProgressBarProps) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken', className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label ?? 'Progress'}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] motion-reduce:transition-none"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
