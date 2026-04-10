/**
 * GameScene - main gameplay scene for Candy Run
 */
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.TILE = 64;          // tile size in pixels
    this.MAZE_COLS = 21;     // must be odd
    this.MAZE_ROWS = 21;     // must be odd
    this.score = 0;
    this.candyPitchIndex = 0;
    this.candyPitches = [261, 294, 329, 349, 392, 440, 494, 523]; // C major scale Hz
  }

  // ─────────────────────────────────────────────
  //  PRELOAD
  // ─────────────────────────────────────────────
  preload() {
    // Try to load user-provided assets; on error fall back to generated textures
    this.load.on('loaderror', (file) => {
      console.warn(`Asset not found: ${file.key}, using placeholder`);
    });

    this.load.image('player',       'assets/player.png');
    this.load.image('worm_head',    'assets/worm_head.png');
    this.load.image('worm_body',    'assets/worm_body.png');
    this.load.image('worm_tail',    'assets/worm_tail.png');
    for (let i = 1; i <= 5; i++) {
      this.load.image(`item${i}`, `assets/item${i}.png`);
    }
  }

  // ─────────────────────────────────────────────
  //  CREATE
  // ─────────────────────────────────────────────
  create() {
    const W = this.MAZE_COLS * this.TILE;
    const H = this.MAZE_ROWS * this.TILE;

    // Generate placeholder textures for any missing assets
    this._generatePlaceholders();

    // Build maze
    const gen = new MazeGenerator(this.MAZE_COLS, this.MAZE_ROWS);
    this.mazeGrid = gen.generate();

    // Draw background gradient
    this._drawBackground(W, H);

    // Draw maze walls
    this._buildMaze(W, H);

    // Place candies on passage tiles
    this.candies = this.physics.add.staticGroup();
    this._placeCandies(gen.getPassageTiles(this.TILE));

    // Player
    const start = gen.getStartPosition(this.TILE);
    this.player = new Player(this, start.x, start.y, this.TILE);

    // Worm enemy — start far from player
    const wormStart = this._getFarTile(start, gen.getPassageTiles(this.TILE));
    this.worm = new Worm(this, wormStart.x, wormStart.y, this.TILE, 4);

    // Collider: player vs walls
    this.physics.add.collider(this.player.sprite, this.wallGroup);

    // Overlap: player vs candies
    this.physics.add.overlap(
      this.player.sprite,
      this.candies,
      this._collectCandy,
      null,
      this
    );

    // Camera — smooth follow
    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

    // UI (fixed to camera)
    this._createUI();

    // Bloom-like post fx (Phaser 3.60 pipeline)
    try {
      this.cameras.main.setPostPipeline('BloomPipeline');
    } catch (e) {
      // BloomPipeline not available — skip silently
    }

    // AudioContext for procedural sfx
    this.audioCtx = null;
    this.input.once('pointerdown', () => { this._initAudio(); });
    this.input.keyboard.once('keydown', () => { this._initAudio(); });
  }

  // ─────────────────────────────────────────────
  //  UPDATE
  // ─────────────────────────────────────────────
  update() {
    this.player.update();
    this.worm.update(this.player.x, this.player.y);

    // Check catch
    if (this.worm.isCatching(this.player.x, this.player.y)) {
      this.worm.onCatch();
      this._bouncePlayerToSafety();
    }
  }

  // ─────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────

  _generatePlaceholders() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const T = this.TILE;

    const make = (key, drawFn) => {
      if (!this.textures.exists(key)) {
        g.clear();
        drawFn(g);
        g.generateTexture(key, T, T);
      }
    };

    // Player: pink circle with face
    make('player', (g) => {
      g.fillStyle(0xff88cc);
      g.fillCircle(T/2, T/2, T*0.38);
      g.fillStyle(0x000000);
      g.fillCircle(T*0.38, T*0.42, T*0.05);
      g.fillCircle(T*0.62, T*0.42, T*0.05);
      g.fillStyle(0xff4488);
      g.fillEllipse(T/2, T*0.6, T*0.25, T*0.1);
    });

    // Worm head: green circle with eyes
    make('worm_head', (g) => {
      g.fillStyle(0x66cc44);
      g.fillCircle(T/2, T/2, T*0.38);
      g.fillStyle(0xffffff);
      g.fillCircle(T*0.38, T*0.44, T*0.1);
      g.fillCircle(T*0.62, T*0.44, T*0.1);
      g.fillStyle(0x000000);
      g.fillCircle(T*0.38, T*0.44, T*0.05);
      g.fillCircle(T*0.62, T*0.44, T*0.05);
    });

    // Worm body: rounded lime segment
    make('worm_body', (g) => {
      g.fillStyle(0x88dd44);
      g.fillRoundedRect(T*0.12, T*0.12, T*0.76, T*0.76, T*0.2);
    });

    // Worm tail: small pointed segment
    make('worm_tail', (g) => {
      g.fillStyle(0xaaee66);
      g.fillTriangle(T/2, T*0.15, T*0.2, T*0.85, T*0.8, T*0.85);
    });

    // Candy items 1-5: different colored stars/circles
    const candyColors = [0xff4466, 0xff9922, 0xffdd00, 0x44cc88, 0x8866ff];
    const candyShapes = ['circle', 'star', 'circle', 'star', 'circle'];
    for (let i = 1; i <= 5; i++) {
      make(`item${i}`, (g) => {
        g.fillStyle(candyColors[i - 1]);
        if (candyShapes[i - 1] === 'circle') {
          g.fillCircle(T/2, T/2, T*0.32);
          g.fillStyle(0xffffff, 0.4);
          g.fillCircle(T*0.38, T*0.36, T*0.1);
        } else {
          // Simple 5-point star
          this._drawStar(g, T/2, T/2, 5, T*0.32, T*0.14);
          g.fillStyle(0xffffff, 0.3);
          g.fillCircle(T*0.38, T*0.36, T*0.08);
        }
      });
    }

    // Particle textures
    make('particle_star', (g) => {
      g.fillStyle(0xffffff);
      this._drawStar(g, T/2, T/2, 4, T*0.4, T*0.2);
    });

    make('particle_heart', (g) => {
      g.fillStyle(0xff69b4);
      // Simple heart using two circles + triangle
      g.fillCircle(T*0.35, T*0.38, T*0.17);
      g.fillCircle(T*0.65, T*0.38, T*0.17);
      g.fillTriangle(T*0.18, T*0.44, T*0.82, T*0.44, T/2, T*0.78);
    });

    g.destroy();
  }

  _drawStar(g, cx, cy, points, outerR, innerR) {
    const step = Math.PI / points;
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = i * step - Math.PI / 2;
      pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }
    g.fillPoints(pts, true);
  }

  _drawBackground(W, H) {
    // Pastel gradient via RenderTexture
    const rt = this.add.renderTexture(0, 0, W, H);
    const rows = Math.ceil(H / 8);
    const g = this.make.graphics({ add: false });
    for (let i = 0; i < rows; i++) {
      const t = i / rows;
      const r = Math.floor(Phaser.Math.Interpolation.Linear([0xf8, 0xe0, 0xd0], t));
      const gv = Math.floor(Phaser.Math.Interpolation.Linear([0xe0, 0xd0, 0xf0], t));
      const b = Math.floor(Phaser.Math.Interpolation.Linear([0xff, 0xff, 0xff], t));
      g.fillStyle(Phaser.Display.Color.GetColor(r, gv, b));
      g.fillRect(0, i * 8, W, 8);
    }
    rt.draw(g);
    g.destroy();
    rt.setDepth(-2);
  }

  _buildMaze(W, H) {
    this.wallGroup = this.physics.add.staticGroup();

    const g = this.add.graphics();
    g.setDepth(-1);

    // Wall colors: candy pastels
    const wallColors = [0xff88aa, 0xffaa66, 0xffdd88, 0x88ddff, 0xcc88ff];

    for (let row = 0; row < this.MAZE_ROWS; row++) {
      for (let col = 0; col < this.MAZE_COLS; col++) {
        if (this.mazeGrid[row][col] === 0) {
          const x = col * this.TILE;
          const y = row * this.TILE;
          const color = wallColors[(row * this.MAZE_COLS + col) % wallColors.length];

          // Draw decorative wall tile
          g.fillStyle(color);
          g.fillRoundedRect(x + 2, y + 2, this.TILE - 4, this.TILE - 4, 8);
          g.lineStyle(2, 0xffffff, 0.3);
          g.strokeRoundedRect(x + 2, y + 2, this.TILE - 4, this.TILE - 4, 8);

          // Add invisible physics body
          const body = this.add.zone(x + this.TILE / 2, y + this.TILE / 2, this.TILE, this.TILE);
          this.physics.world.enable(body, Phaser.Physics.Arcade.STATIC_BODY);
          this.wallGroup.add(body);
        }
      }
    }
  }

  _placeCandies(passageTiles) {
    // Place candies on roughly every 4th passage tile, shuffled
    const shuffled = Phaser.Utils.Array.Shuffle([...passageTiles]);
    const count = Math.floor(shuffled.length / 4);
    const itemKeys = ['item1', 'item2', 'item3', 'item4', 'item5'];

    for (let i = 0; i < count; i++) {
      const tile = shuffled[i];
      const key = itemKeys[i % itemKeys.length];
      const candy = this.candies.create(tile.x, tile.y, key);
      candy.setDepth(5);
      const scale = (this.TILE * 0.45) / Math.max(candy.width, candy.height);
      candy.setScale(scale);
      candy.refreshBody();

      // Idle float animation
      this.tweens.add({
        targets: candy,
        y: tile.y - 6,
        duration: 900 + Math.random() * 400,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 500
      });
    }
  }

  _collectCandy(playerSprite, candy) {
    this.score++;
    this.candyPitchIndex = Math.min(this.candyPitchIndex + 1, this.candyPitches.length - 1);

    // Bounce-then-vanish tween
    const cx = candy.x;
    const cy = candy.y;
    this.tweens.add({
      targets: candy,
      scaleX: candy.scaleX * 1.5,
      scaleY: candy.scaleY * 1.5,
      y: cy - 20,
      alpha: 0,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => candy.destroy()
    });

    // Sparkle burst
    this._spawnSparkle(cx, cy);

    // Score popup
    this._showScorePopup(cx, cy);

    // Update score UI
    this._updateScoreText();

    // Play ascending pitch sfx
    this._playPickupSound(this.candyPitches[this.candyPitchIndex - 1]);

    // Reset pitch index after pause
    if (this._pitchResetTimer) this._pitchResetTimer.remove();
    this._pitchResetTimer = this.time.delayedCall(2000, () => {
      this.candyPitchIndex = 0;
    });
  }

  _spawnSparkle(x, y) {
    const colors = [0xffff00, 0xff88cc, 0x88ffee, 0xffd700];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dot = this.add.circle(x, y, 5, colors[i % colors.length]);
      dot.setDepth(15);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * 40,
        y: y + Math.sin(angle) * 40,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: 400,
        ease: 'Power2',
        onComplete: () => dot.destroy()
      });
    }
  }

  _showScorePopup(x, y) {
    const txt = this.add.text(x, y - 10, `+1`, {
      fontSize: '22px',
      fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
      color: '#ffffff',
      stroke: '#ff66aa',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(20);

    this.tweens.add({
      targets: txt,
      y: y - 50,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => txt.destroy()
    });
  }

  _bouncePlayerToSafety() {
    // Find a passage tile at least 5 tiles away from the worm head
    const passages = [];
    for (let row = 1; row < this.MAZE_ROWS - 1; row++) {
      for (let col = 1; col < this.MAZE_COLS - 1; col++) {
        if (this.mazeGrid[row][col] === 1) {
          const wx = col * this.TILE + this.TILE / 2;
          const wy = row * this.TILE + this.TILE / 2;
          const dx = wx - this.worm.head.x;
          const dy = wy - this.worm.head.y;
          if (Math.sqrt(dx * dx + dy * dy) > this.TILE * 5) {
            passages.push({ x: wx, y: wy });
          }
        }
      }
    }
    if (passages.length === 0) return;
    const safe = Phaser.Utils.Array.GetRandom(passages);
    this.player.teleportToSafety(safe.x, safe.y);

    // Screen flash
    const flash = this.add.rectangle(
      this.cameras.main.scrollX + this.cameras.main.width / 2,
      this.cameras.main.scrollY + this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0xffffff, 0.6
    ).setDepth(50);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy()
    });
  }

  _getFarTile(nearPos, tiles) {
    let best = tiles[0];
    let bestDist = 0;
    for (const t of tiles) {
      const d = Phaser.Math.Distance.Between(nearPos.x, nearPos.y, t.x, t.y);
      if (d > bestDist) { bestDist = d; best = t; }
    }
    return best;
  }

  _createUI() {
    const cam = this.cameras.main;
    const padding = 16;

    // Semi-transparent rounded panel
    this.uiPanel = this.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(100);

    this.uiPanel.fillStyle(0xffffff, 0.45);
    this.uiPanel.fillRoundedRect(padding, padding, 260, 64, 20);

    // Score label
    this.scoreLabelText = this.add.text(padding + 16, padding + 10,
      'あつめた おかし', {
        fontSize: '16px',
        fontFamily: 'Hiragino Maru Gothic Pro, Meiryo, Arial, sans-serif',
        color: '#cc44aa'
      }
    ).setScrollFactor(0).setDepth(101);

    // Score value
    this.scoreValueText = this.add.text(padding + 16, padding + 30,
      '🍬 0こ', {
        fontSize: '22px',
        fontFamily: 'Hiragino Maru Gothic Pro, Meiryo, Arial, sans-serif',
        color: '#ff2288',
        stroke: '#ffffff',
        strokeThickness: 3
      }
    ).setScrollFactor(0).setDepth(101);
  }

  _updateScoreText() {
    this.scoreValueText.setText(`🍬 ${this.score}こ`);

    // Bounce effect on score
    this.tweens.add({
      targets: this.scoreValueText,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 100,
      ease: 'Back.easeOut',
      yoyo: true
    });
  }

  // ─────────────────────────────────────────────
  //  AUDIO (Web Audio API procedural sfx)
  // ─────────────────────────────────────────────
  _initAudio() {
    if (this.audioCtx) return;
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { /* no audio */ }
  }

  _playPickupSound(freq) {
    if (!this.audioCtx) return;
    try {
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) { /* ignore */ }
  }
}
