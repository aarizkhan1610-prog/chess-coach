import { useState } from 'react';

/**
 * The one question worth asking before anything has been imported.
 *
 * It used to own a route, which made it look like a third feature. It is a
 * gate: the coach shows it when it has nothing else to go on, and the settings
 * page is where it is changed afterwards.
 */
export function RatingPrompt({
  current,
  onAnswer,
}: {
  current: number | null;
  onAnswer: (rating: number | null) => void;
}) {
  const [value, setValue] = useState(current === null ? '' : String(current));
  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed >= 100 && parsed <= 3200;

  return (
    <div className="greeting">
      <div className="greeting-mark" aria-hidden>{'♚'}</div>
      <h1>{current === null ? 'What is your rating?' : 'Change your rating'}</h1>
      <p className="greeting-lede">
        It is the one thing that lets the coach say something specific before it has seen you play.
        A rough number is fine, and you can change it later.
      </p>

      <form
        className="row wrap greeting-form"
        onSubmit={(e) => { e.preventDefault(); if (valid) onAnswer(Math.round(parsed)); }}
      >
        <input
          className="greeting-input"
          type="number"
          inputMode="numeric"
          min={100}
          max={3200}
          placeholder="1200"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Your rating"
          autoFocus
        />
        <button className="btn primary" type="submit" disabled={!valid}>
          {valid ? `Continue at ${Math.round(parsed)}` : 'Continue'}
        </button>
      </form>

      {value !== '' && !valid && (
        <p className="tiny" style={{ color: 'var(--bad)' }}>Ratings run from about 100 to 3200.</p>
      )}

      <button className="btn ghost sm greeting-skip" onClick={() => onAnswer(null)}>
        I do not have one, or I am new to chess →
      </button>
    </div>
  );
}
