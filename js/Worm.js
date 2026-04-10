/**
 * Worm (Colorful Caterpillar) - segmented body with slither movement.
 * Head follows player gently; body/tail each trail the previous segment.
 */
class Worm {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x - start x
   * @param {number} y - start y
   * @param {number} tileSize
   * @param {number} bodyCount - number of body segments (3-5)
   */
  constructor(scene, x, y, tileSize, bodyCount = 4) {
    this.scene = scene;
    this.tileSize = tileSize;
    this.speed = 90; // gentle speed so children are not cornered
    this.catchRadius = tileSize * 0.55;

    // History buffer: stores past positions of the head for trailing segments
    this.historySize = (bodyCount + 1) * 12; // frames between segments
    this.history = [];
    this.segmentGap = 12; // frames apart each segment tracks

    // Build sprites: head + body[] + tail
    const segSize = tileSize * 0.75;
    this.segments = [];

    this.head = this._makeSegment(x, y, 'worm_head', segSize, 0);
    this.segments.push(this.head);

    this.bodyParts = [];
    for (let i = 0; i < bodyCount; i++) {
      const part = this._makeSegment(x, y, 'worm_body', segSize * 0.9, i + 1);
      this.bodyParts.push(part);
      this.segments.push(part);
    }

    this.tail = this._makeSegment(x, y, 'worm_tail', segSize * 0.85, bodyCount + 1);
    this.segments.push(this.tail);

    // Pre-fill history so segments start stacked
    for (let i = 0; i < this.historySize; i++) {
      this.history.push({ x, y });
    }

    // Breathing tween on all segments
    this._setupBreathingAnimation();

    // Invincibility flag to prevent repeated catches
    this.invincible = false;
  }

  _makeSegment(x, y, textureKey, size, zOffset) {
    const sprite = this.scene.add.image(x, y, textureKey);
    sprite.setDepth(8 - zOffset * 0.1);
    const scale = size / Math.max(sprite.width, sprite.height);
    sprite.setScale(scale);
    return sprite;
  }

  _setupBreathingAnimation() {
    // Gentle pulsing scale on each segment with slight offsets
    this.segments.forEach((seg, i) => {
      const baseScale = seg.scaleX;
      this.scene.tweens.add({
        targets: seg,
        scaleX: baseScale * 1.08,
        scaleY: baseScale * 1.08,
        duration: 800 + i * 60,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        delay: i * 80
      });
    });
  }

  update(playerX, playerY) {
    // Move head toward player
    const dx = playerX - this.head.x;
    const dy = playerY - this.head.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 4) {
      const nx = dx / dist;
      const ny = dy / dist;
      this.head.x += nx * this.speed * (1 / 60);
      this.head.y += ny * this.speed * (1 / 60);
    }

    // Record head position in history
    this.history.unshift({ x: this.head.x, y: this.head.y });
    if (this.history.length > this.historySize) {
      this.history.pop();
    }

    // Each body/tail segment follows a past position of head
    this.bodyParts.forEach((part, i) => {
      const idx = Math.min((i + 1) * this.segmentGap, this.history.length - 1);
      const past = this.history[idx];
      part.x = past.x;
      part.y = past.y;
    });

    // Tail
    const tailIdx = Math.min((this.bodyParts.length + 1) * this.segmentGap, this.history.length - 1);
    const tailPast = this.history[tailIdx];
    this.tail.x = tailPast.x;
    this.tail.y = tailPast.y;

    // Rotate head toward movement direction
    if (dist > 4) {
      this.head.setRotation(Math.atan2(playerY - this.head.y, playerX - this.head.x) + Math.PI / 2);
    }
  }

  // Returns true if head is within catch radius of player
  isCatching(playerX, playerY) {
    if (this.invincible) return false;
    const dx = playerX - this.head.x;
    const dy = playerY - this.head.y;
    return Math.sqrt(dx * dx + dy * dy) < this.catchRadius;
  }

  // Briefly flash red and become invincible for a moment
  onCatch() {
    this.invincible = true;
    this.segments.forEach(seg => {
      this.scene.tweens.add({
        targets: seg,
        alpha: 0.3,
        duration: 100,
        yoyo: true,
        repeat: 3,
        onComplete: () => { seg.alpha = 1; }
      });
    });
    this.scene.time.delayedCall(2000, () => { this.invincible = false; });
  }
}
