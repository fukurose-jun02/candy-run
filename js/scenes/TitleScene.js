/**
 * TitleScene - candy-colored title screen. Loads all optional PNG assets
 * (placeholders are used for any that are missing) and starts the game on tap.
 */
class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  preload() {
    this.load.on('loaderror', (file) => {
      console.warn(`Asset not found: ${file.key}, using placeholder`);
    });
    this.load.image('player',    'assets/player.png');
    this.load.image('worm_head', 'assets/worm_head.png');
    this.load.image('worm_body', 'assets/worm_body.png');
    this.load.image('worm_tail', 'assets/worm_tail.png');
    this.load.image('wall',      'assets/wall.png');
    this.load.image('heart',     'assets/heart.png');
    this.load.image('logo',      'assets/logo.png');
    for (let i = 1; i <= 5; i++) {
      this.load.image(`item${i}`, `assets/item${i}.png`);
    }
  }

  create() {
    if (this.registry.get('muted') === undefined) this.registry.set('muted', false);
    TextureFactory.createAll(this);

    this._build();
    this.scale.on('resize', this._onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._onResize, this));

    this.starting = false;
    this.input.on('pointerdown', () => this._start());
    if (this.input.keyboard) this.input.keyboard.on('keydown', () => this._start());
  }

  _onResize() {
    this.tweens.killAll();
    if (this.root) this.root.destroy(true);
    this._build();
  }

  _build() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.root = this.add.container(0, 0);

    // Pastel gradient background
    const g = this.add.graphics();
    g.fillGradientStyle(0xffd9f2, 0xffd9f2, 0xcfe4ff, 0xe6d4ff, 1);
    g.fillRect(0, 0, W, H);
    this.root.add(g);

    // Floating candies in the background
    for (let i = 0; i < 8; i++) {
      const c = this.add.image(
        Phaser.Math.Between(20, W - 20),
        Phaser.Math.Between(20, H - 20),
        `item${(i % 5) + 1}`
      ).setAlpha(0.8);
      c.setScale(36 / Math.max(c.width, c.height)); // keep aspect ratio
      this.root.add(c);
      this.tweens.add({
        targets: c,
        y: c.y - Phaser.Math.Between(15, 40),
        duration: 1500 + Math.random() * 1200,
        yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 800
      });
    }

    // Logo image if provided, otherwise styled text
    if (this.textures.exists('logo')) {
      const logo = this.add.image(W / 2, H * 0.28, 'logo');
      logo.setScale(Math.min(W * 0.85, 560) / logo.width);
      this.root.add(logo);
    } else {
      const t1 = this.add.text(W / 2, H * 0.24, 'キャンディラン', {
        fontSize: '44px', fontFamily: CANDY_FONT,
        color: '#ff4d9e', stroke: '#ffffff', strokeThickness: 10
      }).setOrigin(0.5);
      const t2 = this.add.text(W / 2, H * 0.24 + 46, '🍬 にげて あつめて！ 🍭', {
        fontSize: '18px', fontFamily: CANDY_FONT, color: '#9944cc'
      }).setOrigin(0.5);
      this.root.add([t1, t2]);
    }

    // Player being chased by the worm
    const cy = H * 0.52;
    const fit = (img, size) => {
      img.setScale(size / Math.max(img.width, img.height)); // keep aspect ratio
      return img;
    };
    const player = fit(this.add.image(W / 2 - 60, cy, 'player'), 84);
    const segs = [
      fit(this.add.image(W / 2 + 50,  cy + 6, 'worm_head'), 54).setRotation(-Math.PI / 2),
      fit(this.add.image(W / 2 + 88,  cy + 10, 'worm_body'), 46),
      fit(this.add.image(W / 2 + 120, cy + 12, 'worm_body'), 42),
      fit(this.add.image(W / 2 + 150, cy + 14, 'worm_tail'), 38).setRotation(Math.PI / 2)
    ];
    this.root.add([player, ...segs]);
    this.tweens.add({
      targets: player, y: cy - 12, duration: 500,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    segs.forEach((s, i) => {
      this.tweens.add({
        targets: s, y: s.y - 8, duration: 450,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 120
      });
    });

    // Blinking start prompt
    const tap = this.add.text(W / 2, H * 0.75, 'タップして スタート！', {
      fontSize: '24px', fontFamily: CANDY_FONT,
      color: '#ffffff', stroke: '#ff66aa', strokeThickness: 6
    }).setOrigin(0.5);
    this.root.add(tap);
    this.tweens.add({ targets: tap, alpha: 0.25, duration: 600, yoyo: true, repeat: -1 });
  }

  _start() {
    if (this.starting) return;
    this.starting = true;
    this.cameras.main.fadeOut(300, 26, 10, 46);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', { level: 1, hearts: 3 });
    });
  }
}
