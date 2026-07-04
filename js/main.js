// Seed with a sane non-zero size. Some in-app browsers / webviews report
// window.innerWidth/Height as 0 at script-execution time, which would create a
// 0x0 (blank) canvas — the `|| 800` / `|| 600` fallbacks prevent that.
const initialW = window.innerWidth || 800;
const initialH = window.innerHeight || 600;

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: initialW,
  height: initialH,
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
    // RESIZE fills the whole screen (phone / tablet / desktop). Phaser measures
    // the #game parent, so it self-corrects even if the initial size was off.
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: initialW,
    height: initialH
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
// Expose for debugging / tooling.
window.game = game;

// Keep the game matched to the viewport as it changes (rotation, address bar,
// late layout on mobile browsers).
function fitToWindow() {
  const w = window.innerWidth || 800;
  const h = window.innerHeight || 600;
  game.scale.resize(w, h);
}
window.addEventListener('resize', fitToWindow);
window.addEventListener('orientationchange', fitToWindow);
window.addEventListener('load', fitToWindow);
