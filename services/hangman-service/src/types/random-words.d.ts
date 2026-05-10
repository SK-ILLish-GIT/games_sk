// Ambient declaration for the `random-words` package (v1.x ships without bundled types).
declare module 'random-words' {
  interface RandomWordsOptions {
    exactly?:        number;
    min?:            number;
    max?:            number;
    minLength?:      number;
    maxLength?:      number;
    join?:           string;
    wordsPerString?: number;
  }
  function randomWords(): string;
  function randomWords(count: number): string[];
  function randomWords(options: RandomWordsOptions): string | string[];
  export = randomWords;
}
