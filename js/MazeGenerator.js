/**
 * MazeGenerator - Recursive backtracking maze generation
 * Produces open mazes with few dead ends suitable for young children
 */
class MazeGenerator {
  constructor(cols, rows) {
    // cols/rows must be odd for proper maze structure
    this.cols = cols % 2 === 0 ? cols + 1 : cols;
    this.rows = rows % 2 === 0 ? rows + 1 : rows;
    // 0 = wall, 1 = passage
    this.grid = [];
  }

  generate() {
    const { cols, rows } = this;
    // Initialize all cells as walls
    this.grid = Array.from({ length: rows }, () => new Array(cols).fill(0));

    // Start carving from cell (1,1)
    this._carve(1, 1);

    // Widen passages: remove extra walls to make it more open (child-friendly)
    this._widenPassages();

    return this.grid;
  }

  _carve(cx, cy) {
    this.grid[cy][cx] = 1;
    const dirs = this._shuffle([[0, -2], [0, 2], [-2, 0], [2, 0]]);
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx > 0 && nx < this.cols - 1 && ny > 0 && ny < this.rows - 1 && this.grid[ny][nx] === 0) {
        // Carve through the wall between current and next cell
        this.grid[cy + dy / 2][cx + dx / 2] = 1;
        this._carve(nx, ny);
      }
    }
  }

  _widenPassages() {
    const { cols, rows } = this;
    // Randomly remove ~30% of remaining walls that are adjacent to 2+ passages
    // This creates a more open, looping maze rather than a strict tree
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (this.grid[y][x] === 0 && Math.random() < 0.30) {
          const adj = this._countAdjacentPassages(x, y);
          if (adj >= 2) {
            this.grid[y][x] = 1;
          }
        }
      }
    }
  }

  _countAdjacentPassages(x, y) {
    let count = 0;
    if (this.grid[y - 1] && this.grid[y - 1][x] === 1) count++;
    if (this.grid[y + 1] && this.grid[y + 1][x] === 1) count++;
    if (this.grid[y][x - 1] === 1) count++;
    if (this.grid[y][x + 1] === 1) count++;
    return count;
  }

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Returns array of {x, y} passage tile positions (world coords)
  getPassageTiles(tileSize) {
    const tiles = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this.grid[row][col] === 1) {
          tiles.push({ x: col * tileSize + tileSize / 2, y: row * tileSize + tileSize / 2 });
        }
      }
    }
    return tiles;
  }

  // Returns a passage tile position as starting point
  getStartPosition(tileSize) {
    return { x: 1 * tileSize + tileSize / 2, y: 1 * tileSize + tileSize / 2 };
  }
}
