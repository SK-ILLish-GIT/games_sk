import React, { useMemo } from 'react';
import { Hint } from '../../enums/game.enum';
import type { GuessNumberGame } from '../../types';
import Squares from '../ui/Squares';

const MIN = 1;
const MAX = 100;

interface Props {
  game: GuessNumberGame | null;
  compact?: boolean;
}

export default function GuessRangeViz({ game, compact = false }: Props) {
  const range = useMemo(() => {
    let lo = MIN;
    let hi = MAX;
    for (const g of game?.guesses ?? []) {
      if (g.hint === Hint.TooLow)  lo = Math.max(lo, g.value + 1);
      if (g.hint === Hint.TooHigh) hi = Math.min(hi, g.value - 1);
    }
    return { lo, hi };
  }, [game?.guesses]);

  const pct = (n: number) => ((n - MIN) / (MAX - MIN)) * 100;
  const rangeLeft  = pct(range.lo);
  const rangeWidth = pct(range.hi) - pct(range.lo);
  const guesses = game?.guesses ?? [];
  const hasGuesses = guesses.length > 0;

  return (
    <div className={`guess-range-viz${compact ? ' guess-range-viz--compact' : ''}`} aria-hidden={!game}>
      <div className="guess-range-viz-bg">
        <Squares
          direction="diagonal"
          speed={0.35}
          squareSize={36}
          borderColor="rgba(124, 110, 245, 0.12)"
          hoverFillColor="rgba(124, 110, 245, 0.08)"
        />
      </div>

      <div className="guess-range-viz-content">
        {!game ? (
          <div className="guess-range-idle">
            <span className="guess-range-idle-icon">🎯</span>
            <p>Your search range will appear here</p>
          </div>
        ) : (
          <>
            <div className="guess-range-header">
              <span>Possible range</span>
              <strong>{range.lo} – {range.hi}</strong>
            </div>

            <div className="guess-range-track">
              <div className="guess-range-track-labels">
                <span>{MIN}</span>
                <span>{MAX}</span>
              </div>
              <div className="guess-range-bar">
                <div
                  className="guess-range-window"
                  style={{ left: `${rangeLeft}%`, width: `${rangeWidth}%` }}
                />
                {guesses.map((g, i) => (
                  <span
                    key={i}
                    className={`guess-range-marker hint-${g.hint}`}
                    style={{ left: `${pct(g.value)}%` }}
                    title={`${g.value}: ${g.hint}`}
                  />
                ))}
              </div>
            </div>

            <p className="guess-range-caption">
              {!hasGuesses
                ? 'Each hint narrows the highlighted band.'
                : range.lo === range.hi
                  ? `Only ${range.lo} remains!`
                  : `${range.hi - range.lo + 1} numbers still possible`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
