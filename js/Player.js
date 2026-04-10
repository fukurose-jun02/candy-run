/**
 * Player (MIMI) - handles movement, wall collision with corner rounding,
 * and star/heart particle emission.
 */
class Player {
  constructor(scene, x, y, tileSize) {
    this.scene = scene;
    this.tileSize = tileSize;
    this.speed = 180;
    this.facingRight = true;

    // Sprite (uses placeholder texture key 'player'; swapped to PNG when available)
    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setDepth(10);
    this.sprite.setCollideWorldBounds(true);

    // Scale to fit tile nicely
    const scale = (tileSize * 0.75) / Math.max(this.sprite.width, this.sprite.height);
    this.sprite.setScale(scale);

    // Physics body slightly smaller than visual
    this.sprite.body.setSize(
      this.sprite.width * 0.7,
      this.sprite.height * 0.7
    );

    // Particle emitter for stars and hearts
    this._setupParticles();

    // Cursors + WASD
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });

    this.isMoving = false;
  }

  _setupParticles() {
    const scene = this.scene;

    // Star particles
    this.starEmitter = scene.add.particles(0, 0, 'particle_star', {
      speed: { min: 40, max: 100 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 300, max: 600 },
      frequency: 80,
      quantity: 1,
      tint: [0xffff00, 0xffd700, 0xffffff],
      gravityY: 60,
      emitting: false
    });
    this.starEmitter.setDepth(9);

    // Heart particles
    this.heartEmitter = scene.add.particles(0, 0, 'particle_heart', {
      speed: { min: 30, max: 80 },
      angle: { min: 220, max: 320 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 400, max: 700 },
      frequency: 150,
      quantity: 1,
      tint: [0xff69b4, 0xff1493, 0xffb6c1],
      gravityY: 40,
      emitting: false
    });
    this.heartEmitter.setDepth(9);
  }

  update() {
    const { cursors, wasd, sprite } = this;
    let vx = 0;
    let vy = 0;

    if (cursors.left.isDown || wasd.left.isDown)  vx = -this.speed;
    if (cursors.right.isDown || wasd.right.isDown) vx =  this.speed;
    if (cursors.up.isDown || wasd.up.isDown)        vy = -this.speed;
    if (cursors.down.isDown || wasd.down.isDown)    vy =  this.speed;

    // Normalize diagonal speed
    if (vx !== 0 && vy !== 0) {
      vx *= 0.7071;
      vy *= 0.7071;
    }

    sprite.body.setVelocity(vx, vy);

    // Flip sprite based on horizontal direction
    if (vx > 0) { sprite.setFlipX(false); this.facingRight = true; }
    if (vx < 0) { sprite.setFlipX(true);  this.facingRight = false; }

    this.isMoving = (vx !== 0 || vy !== 0);

    // Update particle emitter positions to player feet
    const fx = sprite.x;
    const fy = sprite.y + sprite.displayHeight * 0.4;
    this.starEmitter.setPosition(fx, fy);
    this.heartEmitter.setPosition(fx, fy);

    if (this.isMoving) {
      this.starEmitter.start();
      this.heartEmitter.start();
    } else {
      this.starEmitter.stop();
      this.heartEmitter.stop();
    }
  }

  // Teleport player to a safe position (used when caught by worm)
  teleportToSafety(safeX, safeY) {
    this.sprite.setPosition(safeX, safeY);
    this.sprite.body.reset(safeX, safeY);

    // Magic smoke flash effect
    const smoke = this.scene.add.circle(safeX, safeY, 30, 0xcc88ff, 0.8);
    smoke.setDepth(20);
    this.scene.tweens.add({
      targets: smoke,
      scaleX: 3, scaleY: 3,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => smoke.destroy()
    });
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
}
