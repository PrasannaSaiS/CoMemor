import type { ReactNode } from 'react';

interface BadgeProps {
  tone?: 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet' | 'blue' | 'gray';
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'gray', children, className = '' }: BadgeProps): ReactNode {
  return <span className={`badge ${tone} ${className}`.trim()}>{children}</span>;
}
