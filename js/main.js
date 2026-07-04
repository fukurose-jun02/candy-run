const config = {
  type: Phaser.AUTO,
  parent: 'game',
  // Initial size — actual size follows the window because of Scale.RESIZE below
  width: window.innerWidth,
  height: window.innerHeight,
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
    // RESIZE makes the game fill the whole screen (phone / tablet / desktop)
    // instead of leaving big letterbox bars like FIT does.
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight
  },
  input: {
    activePointers: 3 // allow multi-touch (joystick + taps)
  },
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: false
  }
};

const game = new Phaser.Game(config);
