const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#f8e0ff',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: false
  }
};

const game = new Phaser.Game(config);
