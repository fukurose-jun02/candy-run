/**
 * GameScene - main gameplay scene for Candy Run
 *
 * Level system: collect `goal` candies to clear the level. Higher levels add
 * more worms and make them faster. The player has hearts (lives) carried
 * between levels; losing them all ends the run.
 */
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.TILE = 64;          // tile size in pixels
    this.MAZE_COLS = 21;     // must be odd
    this.MAZE_ROWS = 21;     // must be odd
    this.candyPitches = [261, 294, 329, 349, 392, 440, 494, 523]; // C major scale Hz
  }

  init(data) {
    data = data || {};
    this.level = data.level || 1;
    this.hearts = (data.hearts != null) ? data.hearts : 3;
    this.score = 0;
    this.goal = Math.min(15 + (this.level - 1) * 5, 30);
    this.candyPitchIndex = 0;
    this.frozen = false;              // true during clear / game-over sequence
    this.playerInvincibleUntil = 0;   // grace period after being caught
  }

  // ─────────────────────────────────────────────
  //  PRELOAD
  // ─────────────────────────────────────────────
  preload() {
    // TitleScene normally loads these already; kept here as a safety net.
    this.load.on('loaderror', (file) => {
      console.warn(`Asset not found: ${file.key}, using placeholder`);
    });
    this.load.image('player',    'assets/player.png');
    this.load.image('worm_head', 'assets/worm_head.png');
    this.load.image('worm_body', 'assets/worm_body.png');
    this.load.image('worm_tail', 'assets/worm_tail.png');
    this.load.image('wall',      'assets/wall.png');
    this.load.image('heart',     'assets/heart.png');
    for (let i = 1; i <= 5; i++) {
      this.load.image(`item${i}`, `assets/item${i}.png`);
    }
  }

  // ─────────────────────────────────────────────
  //  CREATE
  // ─────────────────────────────────────────────
  create() {
    try {
      this._create();
    } catch (err) {
      // Never leave the player staring at a blank screen: log, surface the
      // message on the page, and draw it in-canvas too.
      console.error('GameScene create failed:', err);
      if (window.__gameError) window.__gameError('ゲームの初期化に失敗しました: ' + err.message);
      this.add.text(20, 20, 'エラー: ' + err.message, {
        fontSize: '16px', color: '#ffffff', backgroundColor: '#aa0044',
        padding: { x: 10, y: 8 }, wordWrap: { width: this.scale.width - 40 }
      }).setScrollFactor(0).setDepth(9999);
    }
  }

  _create() {
    const W = this.MAZE_COLS * this.TILE;
    const H = this.MAZE_ROWS * this.TILE;

    // Generate placeholder textures for any missing assets
    TextureFactory.createAll(this);

    // Build maze
    const gen = new MazeGenerator(this.MAZE_COLS, this.MAZE_ROWS);
    this.mazeGrid = gen.generate();

    // Draw background gradient
    this._drawBackground(W, H);

    // Draw maze walls
    this._buildMaze(W, H);

    // Place candies on passage tiles
    const passages = gen.getPassageTiles(this.TILE);
    this.candies = this.physics.add.staticGroup();
    this._placeCandies(passages);

    // Touch joystick for mobile (stays hidden / no-op on desktop)
    this.touchControls = new TouchControls(this);

    // Player
    const start = gen.getStartPosition(this.TILE);
    this.player = new Player(this, start.x, start.y, this.TILE);

    // Worms — count and speed grow with the level
    this.worms = [];
    const wormCount = Math.min(1 + Math.floor((this.level - 1) / 2), 3);
    const wormSpeed = Math.min(80 + this.level * 8, 140);
    const spots = this._pickFarTiles(start, passages, wormCount);
    for (let i = 0; i < wormCount; i++) {
      this.worms.push(new Worm(this, spots[i].x, spots[i].y, this.TILE, 4, wormSpeed));
    }

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

    // Physics world bounds must match the maze, not the screen. With
    // Scale.RESIZE the default bounds equal the window size, and the player's
    // collideWorldBounds turned that into an invisible wall about one screen
    // down/right ("can't move further even though there's no block").
    this.physics.world.setBounds(0, 0, W, H);

    // Camera — smooth follow
    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.fadeIn(300, 26, 10, 46);

    // UI (fixed to camera)
    this._createUI();
    this._showLevelBanner();

    this.scale.on('resize', this._layoutUI, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this._layoutUI, this);
    });

    // AudioContext unlock (must happen on a user gesture) + BGM loop
    this.audioCtx = null;
    const unlock = () => { this._initAudio(); };
    this.input.once('pointerdown', unlock);
    if (this.input.keyboard) this.input.keyboard.once('keydown', unlock);

    this.bgmStep = 0;
    this.time.addEvent({ delay: 230, loop: true, callback: this._bgmTick, callbackScope: this });
  }

  // ─────────────────────────────────────────────
  //  UPDATE
  // ─────────────────────────────────────────────
  update() {
    // Skip while init is incomplete or during clear/game-over sequences.
    if (this.frozen || !this.player || !this.worms) return;

    this.player.update();

    const px = this.player.x;
    const py = this.player.y;
    const invincible = this.time.now < this.playerInvincibleUntil;

    for (const worm of this.worms) {
      worm.update(px, py);
      if (!invincible && worm.isCatching(px, py)) {
        this._onCaught(worm);
        break;
      }
    }
  }

  // ─────────────────────────────────────────────
  //  GAME FLOW
  // ─────────────────────────────────────────────

  _onCaught(worm) {
    worm.onCatch();
    this.hearts--;
    this._updateHearts();
    this._playCatchSound();
    this.cameras.main.shake(200, 0.008);

    if (this.hearts <= 0) {
      this.frozen = true;
      this.player.sprite.body.setVelocity(0, 0);
      this.time.delayedCall(900, () => {
        this.scene.start('ResultScene', {
          won: false, level: this.level, collected: this.score
        });
      });
      return;
    }

    // Brief invincibility + blink, then continue from a safe spot
    this.playerInvincibleUntil = this.time.now + 2000;
    this.tweens.add({
      targets: this.player.sprite,
      alpha: 0.3, duration: 120, yoyo: true, repeat: 7,
      onComplete: () => { this.player.sprite.alpha = 1; }
    });
    this._bouncePlayerToSafety();
  }

  _onLevelClear() {
    this.frozen = true;
    this.player.sprite.body.setVelocity(0, 0);
    this._playClearJingle();

    const txt = this.add.text(this.scale.width / 2, this.scale.height / 2, 'クリア！', {
      fontSize: '52px', fontFamily: CANDY_FONT,
      color: '#ffffff', stroke: '#ff66aa', strokeThickness: 10
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setScale(0);
    this.tweens.add({ targets: txt, scale: 1, duration: 400, ease: 'Back.easeOut' });

    // Star burst around the clear text
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const star = this.add.image(this.scale.width / 2, this.scale.height / 2, 'particle_star')
        .setScrollFactor(0).setDepth(299).setDisplaySize(22, 22)
        .setTint([0xffff66, 0xff88cc, 0x88ffee][i % 3]);
      this.tweens.add({
        targets: star,
        x: star.x + Math.cos(angle) * 130,
        y: star.y + Math.sin(angle) * 130,
        alpha: 0, angle: 180,
        duration: 900, ease: 'Power2',
        onComplete: () => star.destroy()
      });
    }

    this.time.delayedCall(1800, () => {
      this.scene.start('ResultScene', {
        won: true, level: this.level, hearts: this.hearts, collected: this.score
      });
    });
  }

  // ─────────────────────────────────────────────
  //  WORLD BUILDING
  // ─────────────────────────────────────────────

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

    // If a wall.png was provided, tile it; otherwise draw candy-colored blocks.
    const useWallTexture = this.textures.exists('wall');
    const g = useWallTexture ? null : this.add.graphics().setDepth(-1);
    const wallColors = [0xff88aa, 0xffaa66, 0xffdd88, 0x88ddff, 0xcc88ff];

    for (let row = 0; row < this.MAZE_ROWS; row++) {
      for (let col = 0; col < this.MAZE_COLS; col++) {
        if (this.mazeGrid[row][col] === 0) {
          const x = col * this.TILE;
          const y = row * this.TILE;

          if (useWallTexture) {
            this.add.image(x + this.TILE / 2, y + this.TILE / 2, 'wall')
              .setDisplaySize(this.TILE, this.TILE)
              .setDepth(-1);
          } else {
            const color = wallColors[(row * this.MAZE_COLS + col) % wallColors.length];
            g.fillStyle(color);
            g.fillRoundedRect(x + 2, y + 2, this.TILE - 4, this.TILE - 4, 8);
            g.lineStyle(2, 0xffffff, 0.3);
            g.strokeRoundedRect(x + 2, y + 2, this.TILE - 4, this.TILE - 4, 8);
          }

          // Invisible physics body
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

  _pickFarTiles(nearPos, tiles, count) {
    const far = tiles.filter(t =>
      Phaser.Math.Distance.Between(nearPos.x, nearPos.y, t.x, t.y) > this.TILE * 8
    );
    const pool = far.length >= count ? far : tiles;
    const shuffled = Phaser.Utils.Array.Shuffle([...pool]);
    const picked = [];
    for (let i = 0; i < count; i++) {
      picked.push(shuffled[i % shuffled.length]);
    }
    return picked;
  }

  // ─────────────────────────────────────────────
  //  CANDY COLLECTION
  // ─────────────────────────────────────────────

  _collectCandy(playerSprite, candy) {
    if (this.frozen) return;

    // overlap fires every frame while bodies touch. The candy only visually
    // disappears after a 300ms tween, so without this guard a single candy
    // would be counted ~18 times. Mark it collected and disable its body so it
    // counts exactly once.
    if (candy.collected) return;
    candy.collected = true;
    if (candy.body) candy.body.enable = false;

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

    this._spawnSparkle(cx, cy);
    this._showScorePopup(cx, cy);
    this._updateScoreText();
    this._playPickupSound(this.candyPitches[this.candyPitchIndex - 1]);

    // Reset pitch index after pause
    if (this._pitchResetTimer) this._pitchResetTimer.remove();
    this._pitchResetTimer = this.time.delayedCall(2000, () => {
      this.candyPitchIndex = 0;
    });

    if (this.score >= this.goal) {
      this._onLevelClear();
    }
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
    // Find a passage tile at least 5 tiles away from every worm head
    const passages = [];
    for (let row = 1; row < this.MAZE_ROWS - 1; row++) {
      for (let col = 1; col < this.MAZE_COLS - 1; col++) {
        if (this.mazeGrid[row][col] === 1) {
          const wx = col * this.TILE + this.TILE / 2;
          const wy = row * this.TILE + this.TILE / 2;
          const safeFromAll = this.worms.every(w =>
            Phaser.Math.Distance.Between(wx, wy, w.head.x, w.head.y) > this.TILE * 5
          );
          if (safeFromAll) passages.push({ x: wx, y: wy });
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

  // ─────────────────────────────────────────────
  //  UI
  // ─────────────────────────────────────────────

  _createUI() {
    const pad = 12;

    // Semi-transparent rounded panel (top-left): level, candy progress
    this.uiPanel = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.uiPanel.fillStyle(0xffffff, 0.5);
    this.uiPanel.fillRoundedRect(pad, pad, 216, 86, 18);

    this.levelText = this.add.text(pad + 16, pad + 10, `レベル ${this.level}`, {
      fontSize: '14px', fontFamily: CANDY_FONT, color: '#9944cc'
    }).setScrollFactor(0).setDepth(101);

    this.scoreValueText = this.add.text(pad + 16, pad + 28, `🍬 0 / ${this.goal}`, {
      fontSize: '22px', fontFamily: CANDY_FONT,
      color: '#ff2288', stroke: '#ffffff', strokeThickness: 3
    }).setScrollFactor(0).setDepth(101);

    this.progressG = this.add.graphics().setScrollFactor(0).setDepth(101);
    this._drawProgress();

    // Hearts (top-right)
    this.heartIcons = [];
    const heartKey = this.textures.exists('heart') ? 'heart' : 'particle_heart';
    for (let i = 0; i < 3; i++) {
      this.heartIcons.push(
        this.add.image(0, 0, heartKey)
          .setScrollFactor(0).setDepth(101).setDisplaySize(30, 30)
      );
    }

    // Mute toggle (top-right, under the hearts)
    this.muteBtn = this.add.text(0, 0, this.registry.get('muted') ? '🔇' : '🔊', {
      fontSize: '26px'
    }).setScrollFactor(0).setDepth(101).setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerdown', (pointer, lx, ly, event) => {
      if (event) event.stopPropagation(); // keep the joystick from appearing
      this._toggleMute();
    });

    this._layoutUI();
    this._updateHearts();
  }

  _layoutUI() {
    if (!this.heartIcons) return;
    const w = this.scale.width;
    this.heartIcons.forEach((h, i) => h.setPosition(w - 26 - i * 36, 30));
    this.muteBtn.setPosition(w - 44, 52);
  }

  _drawProgress() {
    const pad = 12;
    const x = pad + 16, y = pad + 62, w = 184, h = 12;
    const ratio = Phaser.Math.Clamp(this.score / this.goal, 0, 1);
    this.progressG.clear();
    this.progressG.fillStyle(0xffffff, 0.7);
    this.progressG.fillRoundedRect(x, y, w, h, 6);
    if (ratio > 0) {
      this.progressG.fillStyle(0xff66aa, 1);
      this.progressG.fillRoundedRect(x, y, Math.max(w * ratio, 12), h, 6);
    }
  }

  _updateScoreText() {
    this.scoreValueText.setText(`🍬 ${this.score} / ${this.goal}`);
    this._drawProgress();

    this.tweens.add({
      targets: this.scoreValueText,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 100,
      ease: 'Back.easeOut',
      yoyo: true
    });
  }

  _updateHearts() {
    this.heartIcons.forEach((h, i) => h.setAlpha(i < this.hearts ? 1 : 0.25));
  }

  _showLevelBanner() {
    const txt = this.add.text(this.scale.width / 2, this.scale.height / 2, `レベル ${this.level}`, {
      fontSize: '42px', fontFamily: CANDY_FONT,
      color: '#ffffff', stroke: '#ff66aa', strokeThickness: 8
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setScale(0);
    this.tweens.add({
      targets: txt, scale: 1, duration: 400, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: txt, alpha: 0, delay: 700, duration: 400,
          onComplete: () => txt.destroy()
        });
      }
    });
  }

  // ─────────────────────────────────────────────
  //  AUDIO (Web Audio API procedural sfx + BGM)
  // ─────────────────────────────────────────────

  _initAudio() {
    if (this.audioCtx) return;
    try {
      // Reuse one AudioContext across level restarts (browsers cap how many
      // can exist, especially iOS Safari).
      if (!window.__candyAudioCtx) {
        window.__candyAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      this.audioCtx = window.__candyAudioCtx;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    } catch (e) { /* no audio */ }
  }

  _playTone(freq, dur, type, vol, slideTo, when) {
    if (!this.audioCtx) return;
    try {
      const ctx = this.audioCtx;
      const t = ctx.currentTime + (when || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur);
    } catch (e) { /* ignore */ }
  }

  _playPickupSound(freq) {
    if (this.registry.get('muted')) return;
    this._playTone(freq, 0.25, 'sine', 0.25, freq * 1.5);
  }

  _playCatchSound() {
    if (this.registry.get('muted')) return;
    this._playTone(300, 0.4, 'sawtooth', 0.12, 110);
  }

  _playClearJingle() {
    if (this.registry.get('muted')) return;
    [523, 659, 784, 1046].forEach((f, i) => {
      this._playTone(f, 0.25, 'sine', 0.2, null, i * 0.13);
    });
  }

  _bgmTick() {
    const melody = [523, 0, 659, 0, 784, 0, 880, 784, 659, 0, 587, 659, 523, 0, 0, 0];
    const f = melody[this.bgmStep % melody.length];
    this.bgmStep++;
    if (!f || !this.audioCtx || this.registry.get('muted') || this.frozen) return;
    this._playTone(f, 0.18, 'triangle', 0.05);
  }

  _toggleMute() {
    const muted = !this.registry.get('muted');
    this.registry.set('muted', muted);
    this.muteBtn.setText(muted ? '🔇' : '🔊');
  }
}
