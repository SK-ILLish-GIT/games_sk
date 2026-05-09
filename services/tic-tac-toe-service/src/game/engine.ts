// Pure game logic — no I/O, fully testable
import { GAME_CONSTANTS } from '../config/constants';

export type Board = (string | null)[];
export enum Player     { X = 'X', O = 'O' }
export enum GameResult { X = 'X', O = 'O', Draw = 'draw' }

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diags
];

export function checkWinner(board: Board): GameResult | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as GameResult;
    }
  }
  if (board.every((cell) => cell !== null)) return GameResult.Draw;
  return null;
}

export function applyMove(
  board: Board,
  position: number,
  player: Player
): { board: Board; result: GameResult | null } {
  if (position < 0 || position > 8) throw new Error('Invalid position (0-8)');
  if (board[position] !== null) throw new Error('Cell already taken');
  const newBoard = [...board];
  newBoard[position] = player;
  return { board: newBoard, result: checkWinner(newBoard) };
}

export function nextPlayer(current: Player): Player {
  return current === Player.X ? Player.O : Player.X;
}

export function scoreForResult(result: GameResult | null, playerSymbol: Player): number {
  if (result !== null && result === (playerSymbol as unknown as GameResult)) return GAME_CONSTANTS.WIN_SCORE;
  if (result === GameResult.Draw) return GAME_CONSTANTS.DRAW_SCORE;
  return GAME_CONSTANTS.LOSE_SCORE;
}
