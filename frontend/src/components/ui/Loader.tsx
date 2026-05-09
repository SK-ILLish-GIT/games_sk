import React from 'react';
import './Loader.css';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

export default function Loader({ size = 'md', color = 'var(--c-accent)', className = '' }: LoaderProps) {
  return (
    <div className={`modern-loader loader-${size} ${className}`} style={{ '--loader-color': color } as React.CSSProperties}>
      <div className="loader-ring"></div>
      <div className="loader-dot"></div>
    </div>
  );
}
