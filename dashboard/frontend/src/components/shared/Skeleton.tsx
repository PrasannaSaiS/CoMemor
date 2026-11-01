import type { ReactNode } from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({ width = '100%', height = '18px', className = '' }: SkeletonProps): ReactNode {
  return <div className={`skeleton-box ${className}`.trim()} style={{ width, height }} />;
}
