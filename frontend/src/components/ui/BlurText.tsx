import React, { useRef, useEffect, useState } from 'react';
import './BlurText.css';

interface BlurTextProps {
  text: string;
  delay?: number;
  className?: string;
}

const BlurText: React.FC<BlurTextProps> = ({ text, delay = 0, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simple visibility trigger with optional delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  // Split text by words for individual animation
  const words = text.split(' ');

  return (
    <div ref={textRef} className={`blur-text-container ${className}`}>
      {words.map((word, index) => (
        <span
          key={index}
          className={`blur-text-word ${isVisible ? 'visible' : ''}`}
          style={{ transitionDelay: `${index * 80}ms` }}
        >
          {word}&nbsp;
        </span>
      ))}
    </div>
  );
};

export default BlurText;
