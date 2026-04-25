// Pure game logic — no I/O, fully testable

export type Board = (string | null)[];
export type Player = 'X' | 'O';
export type GameResult = Player | 'draw' | null;

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diags
];

export function checkWinner(board: Board): GameResult {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as Player;
    }
  }
  if (board.every((cell) => cell !== null)) return 'draw';
  return null;
}

export function applyMove(
  board: Board,
  position: number,
  player: Player
): { board: Board; result: GameResult } {
  if (position < 0 || position > 8) throw new Error('Invalid position (0-8)');
  if (board[position] !== null) throw new Error('Cell already taken');
  const newBoard = [...board];
  newBoard[position] = player;
  return { board: newBoard, result: checkWinner(newBoard) };
}

export function nextPlayer(current: Player): Player {
  return current === 'X' ? 'O' : 'X';
}

export function scoreForResult(result: GameResult, playerSymbol: Player): number {
  if (result === playerSymbol) return 10;
  if (result === 'draw') return 3;
  return 0;
}
