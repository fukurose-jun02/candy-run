/**
 * ResultScene - shown after clearing a level (won: true) or losing all
 * hearts (won: false). Offers "next level" / "retry" and "back to title".
 */
class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  init(data) {
    // NOTE: don't use this.data — Phaser scenes already own a DataManager there.
    this.params = data || {};
  }

  create() {
    this._build();
    this.scale.on('resize', this._onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._onResize, this));
  }

  _onResize() {
    this.tweens.killAll();
    this.children.removeAll(true);
    this._build();
  }

  _build() {
    const { won, level, hearts, collected } = this.params;
    const W = this.scale.width;
    const H = this.scale.height;

    const g = this.add.graphics();
    if (won) {
      g.fillGradientStyle(0xfff3c4, 0xffd9f2, 0xcfe4ff, 0xffe1f0, 1);
    } else {
      g.fillGradientStyle(0xd9d4ff, 0xd9d4ff, 0xcfe4ff, 0xffe1f0, 1);
    }
    g.fillRect(0, 0, W, H);

    if (won) this._confetti(W, H);

    const emoji = this.add.text(W / 2, H * 0.22, won ? '🎉' : '🐛', { fontSize: '64px' })
      .setOrigin(0.5).setScale(0);
    const title = this.add.text(W / 2, H * 0.35,
      won ? `レベル ${level} クリア！` : 'つかまっちゃった…', {
        fontSize: '32px', fontFamily: CANDY_FONT,
        color: won ? '#ff4d9e' : '#7755cc',
        stroke: '#ffffff', strokeThickness: 8
      }).setOrigin(0.5).setScale(0);
    this.add.text(W / 2, H * 0.44, `おかしを ${collected}こ あつめたよ！`, {
      fontSize: '20px', fontFamily: CANDY_FONT, color: '#9944cc'
    }).setOrigin(0.5);

    this.tweens.add({ targets: emoji, scale: 1, duration: 450, ease: 'Back.easeOut' });
    this.tweens.add({ targets: title, scale: 1, duration: 450, delay: 150, ease: 'Back.easeOut' });

    if (won) {
      this._button(W / 2, H * 0.58, 'つぎのレベルへ ▶', 0xff66aa, () => {
        this.scene.start('GameScene', { level: level + 1, hearts: hearts });
      });
    } else {
      this._button(W / 2, H * 0.58, 'もういちど チャレンジ', 0xff66aa, () => {
        this.scene.start('GameScene', { level: level, hearts: 3 });
      });
    }
    this._button(W / 2, H * 0.70, 'タイトルへ', 0x8877ee, () => {
      this.scene.start('TitleScene');
    });
  }

  _button(cx, cy, label, color, onClick) {
    const w = Math.min(this.scale.width * 0.8, 320);
    const h = 56;
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 28);
    g.lineStyle(3, 0xffffff, 0.8);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 28);

    const t = this.add.text(cx, cy, label, {
      fontSize: '22px', fontFamily: CANDY_FONT, color: '#ffffff'
    }).setOrigin(0.5);

    const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
    zone.once('pointerdown', () => {
      this.tweens.add({ targets: t, scale: 0.88, duration: 80, yoyo: true });
      this.time.delayedCall(140, onClick);
    });
  }

  _confetti(W, H) {
    const colors = [0xff6699, 0xffcc44, 0x66ddff, 0x99ee77, 0xcc99ff];
    for (let i = 0; i < 30; i++) {
      const c = this.add.rectangle(
        Math.random() * W, -20 - Math.random() * H * 0.5,
        10, 14, colors[i % colors.length]
      );
      this.tweens.add({
        targets: c,
        y: H + 30,
        angle: Phaser.Math.Between(180, 540),
        duration: 2500 + Math.random() * 2000,
        repeat: -1,
        delay: Math.random() * 1500
      });
    }
  }
}
