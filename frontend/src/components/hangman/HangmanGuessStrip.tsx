import React from 'react';
import type { HangmanGuessRecord } from '../../types';

interface Props {
  guesses: HangmanGuessRecord[];
  hideEmptyMessage?: boolean;
}

export default function HangmanGuessStrip({ guesses, hideEmptyMessage = false }: Props) {
  const letters = guesses.filter((g): g is Extract<HangmanGuessRecord, { kind: 'letter' }> => g.kind === 'letter');

  if (letters.length === 0) {
    if (hideEmptyMessage) return <div className="hangman-guess-strip" aria-hidden="true" />;
    return (
      <p className="hangman-guess-strip-empty">Guessed letters appear here in order.</p>
    );
  }

  return (
    <div className="hangman-guess-strip" aria-label="Guessed letters">
      {letters.map((g, i) => {
        const hit = g.feedback.occurrences > 0;
        return (
          <span
            key={`${g.value}-${i}`}
            className={`hangman-guess-pill${hit ? ' is-hit' : ' is-miss'}`}
            title={hit ? `${g.value.toUpperCase()} is in the word` : `${g.value.toUpperCase()} not in word`}
          >
            {g.value.toUpperCase()}
          </span>
        );
      })}
    </div>
  );
}
