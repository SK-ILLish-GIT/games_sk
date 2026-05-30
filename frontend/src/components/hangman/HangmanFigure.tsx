import React, { useEffect, useRef } from 'react';

interface Props {
  wrongGuesses: number;
  maxWrong?: number;
  isLost?: boolean;
  showCaption?: boolean;
  /** preview = before game starts; playing = active board */
  variant?: 'preview' | 'playing';
}

/** Classic gallows + stick figure; one body part per wrong guess (6 total). */
export default function HangmanFigure({
  wrongGuesses,
  maxWrong = 6,
  isLost = false,
  showCaption = true,
  variant = 'playing',
}: Props) {
  const parts = Math.min(wrongGuesses, maxWrong);
  const sceneRef = useRef<HTMLDivElement>(null);
  const prevParts = useRef(parts);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || parts <= prevParts.current) {
      prevParts.current = parts;
      return;
    }

    scene.classList.remove('is-wrong-hit');
    void scene.offsetWidth;
    scene.classList.add('is-wrong-hit');

    const timer = window.setTimeout(() => {
      scene.classList.remove('is-wrong-hit');
    }, 520);

    prevParts.current = parts;
    return () => window.clearTimeout(timer);
  }, [parts]);

  const sceneClass = [
    'hangman-figure-scene',
    variant === 'preview' ? 'is-preview' : 'is-playing',
    parts === 0 ? 'has-no-body' : 'has-body',
    isLost ? 'is-lost' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const caption =
    variant === 'preview'
      ? 'The gallows await…'
      : parts === 0
        ? 'No wrong guesses yet'
        : `${parts} / ${maxWrong} wrong`;

  return (
    <div ref={sceneRef} className={sceneClass} aria-hidden="true">
      <div className="hangman-figure-grid" />
      <div className="hangman-figure-glow" />

      <svg className="hangman-figure-svg" viewBox="0 0 200 210" role="img" aria-label="Hangman drawing">
        <g className="hangman-gallows" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none">
          <line x1="24" y1="196" x2="116" y2="196" className="hangman-gallows-line hangman-gallows-base" />
          <line x1="44" y1="196" x2="44" y2="28" className="hangman-gallows-line hangman-gallows-post" />
          <line x1="44" y1="28" x2="124" y2="28" className="hangman-gallows-line hangman-gallows-beam" />
          <line x1="124" y1="28" x2="124" y2="48" className="hangman-gallows-line hangman-gallows-rope" />
        </g>

        <g className="hangman-body" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none">
          <circle
            cx="124"
            cy="68"
            r="16"
            className={`hangman-part hangman-part-head${parts >= 1 ? ' is-visible' : ''}`}
          />
          <line
            x1="124"
            y1="84"
            x2="124"
            y2="132"
            className={`hangman-part hangman-part-body${parts >= 2 ? ' is-visible' : ''}`}
          />
          <line
            x1="124"
            y1="98"
            x2="98"
            y2="118"
            className={`hangman-part hangman-part-arm-l${parts >= 3 ? ' is-visible' : ''}`}
          />
          <line
            x1="124"
            y1="98"
            x2="150"
            y2="118"
            className={`hangman-part hangman-part-arm-r${parts >= 4 ? ' is-visible' : ''}`}
          />
          <line
            x1="124"
            y1="132"
            x2="104"
            y2="172"
            className={`hangman-part hangman-part-leg-l${parts >= 5 ? ' is-visible' : ''}`}
          />
          <line
            x1="124"
            y1="132"
            x2="144"
            y2="172"
            className={`hangman-part hangman-part-leg-r${parts >= 6 ? ' is-visible' : ''}`}
          />
        </g>
      </svg>

      {showCaption && <div className="hangman-figure-caption">{caption}</div>}
    </div>
  );
}
