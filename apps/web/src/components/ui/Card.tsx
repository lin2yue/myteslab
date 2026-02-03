import * as React from 'react';
import { cn } from './cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'muted';
}

export default function Card({ className, variant = 'default', ...props }: CardProps) {
  return (
    <div
      className={cn(variant === 'muted' ? 'panel-muted' : 'panel', className)}
      {...props}
    />
  );
}
