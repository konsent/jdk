const SIZE = 4;

export function createEmptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

export function addRandomTile(grid) {
  const empties = [];
  grid.forEach((row, r) => row.forEach((v, c) => { if (v === 0) empties.push([r, c]); }));
  if (empties.length === 0) return grid;

  const next = grid.map(row => [...row]);
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slideAndMergeRow(row) {
  const compact = row.filter(v => v !== 0);
  let scoreGained = 0;
  const merged = [];

  for (let i = 0; i < compact.length; i++) {
    if (compact[i] === compact[i + 1]) {
      const value = compact[i] * 2;
      merged.push(value);
      scoreGained += value;
      i++;
    } else {
      merged.push(compact[i]);
    }
  }

  while (merged.length < SIZE) merged.push(0);
  return { row: merged, scoreGained };
}

export function moveLeft(grid) {
  let scoreGained = 0;
  const newGrid = grid.map(row => {
    const { row: newRow, scoreGained: gained } = slideAndMergeRow(row);
    scoreGained += gained;
    return newRow;
  });
  const moved = JSON.stringify(newGrid) !== JSON.stringify(grid);
  return { grid: newGrid, moved, scoreGained };
}

function rotateClockwise(grid) {
  return grid[0].map((_, c) => grid.map(row => row[c]).reverse());
}

function rotateCounterClockwise(grid) {
  return grid[0].map((_, c) => grid.map(row => row[row.length - 1 - c]));
}

export function move(grid, direction) {
  if (direction === "left") return moveLeft(grid);

  if (direction === "right") {
    const rotated = grid.map(row => [...row].reverse());
    const result = moveLeft(rotated);
    return { ...result, grid: result.grid.map(row => [...row].reverse()) };
  }

  if (direction === "up") {
    const rotated = rotateCounterClockwise(grid);
    const result = moveLeft(rotated);
    return { ...result, grid: rotateClockwise(result.grid) };
  }

  if (direction === "down") {
    const rotated = rotateClockwise(grid);
    const result = moveLeft(rotated);
    return { ...result, grid: rotateCounterClockwise(result.grid) };
  }

  throw new Error(`Unknown direction: ${direction}`);
}

export function isGameOver(grid) {
  const hasEmpty = grid.some(row => row.some(v => v === 0));
  if (hasEmpty) return false;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (c < SIZE - 1 && grid[r][c + 1] === v) return false;
      if (r < SIZE - 1 && grid[r + 1][c] === v) return false;
    }
  }
  return true;
}
