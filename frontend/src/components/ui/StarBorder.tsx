import React from 'react';
import './StarBorder.css';

interface StarBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  className?: string;
  color?: string;
  speed?: string;
}

const StarBorder: React.FC<StarBorderProps> = ({
  as: Component = 'div',
  className = '',
  color = 'var(--c-accent)',
  speed = '4s',
  children,
  ...props
}) => {
  return (
    <Component className={`star-border-container ${className}`} {...props}>
      <div 
        className="star-border-glow" 
        style={{ 
          background: `conic-gradient(from 0deg, transparent 60%, ${color} 80%, transparent 100%)`,
          animationDuration: speed
        }} 
      />
      <div className="star-border-content">
        {children}
      </div>
    </Component>
  );
};

export default StarBorder;
