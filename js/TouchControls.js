/**
 * TouchControls - dynamic on-screen virtual joystick for touch devices.
 *
 * The player touches anywhere on the screen and drags: a joystick appears
 * under the finger, and dragging away from the origin produces a direction
 * vector (magnitude 0..1) that the Player reads each frame.
 *
 * On desktop it stays invisible and simply returns a zero vector, so the
 * keyboard keeps working unchanged.
 */
class TouchControls {
  constructor(scene) {
    this.scene = scene;
    this.vector = { x: 0, y: 0 };
    this.maxDist = 64;          // pixels from origin for full speed
    this.deadZone = 8;          // ignore tiny wobbles
    this.activePointerId = null;

    // Visual pieces (screen-space, so they ignore camera scroll)
    this.base = scene.add.circle(0, 0, 60, 0xffffff, 0.22)
      .setStrokeStyle(4, 0xffffff, 0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false);

    this.thumb = scene.add.circle(0, 0, 30, 0xff88cc, 0.65)
      .setStrokeStyle(3, 0xffffff, 0.8)
      .setScrollFactor(0)
      .setDepth(201)
      .setVisible(false);

    scene.input.on('pointerdown', this._onDown, this);
    scene.input.on('pointermove', this._onMove, this);
    scene.input.on('pointerup', this._onUp, this);
    scene.input.on('pointerupoutside', this._onUp, this);
    scene.input.on('gameout', this._onUp, this);
  }

  _onDown(pointer) {
    if (this.activePointerId !== null) return; // already tracking a finger
    this.activePointerId = pointer.id;
    this.originX = pointer.x;
    this.originY = pointer.y;
    this.base.setPosition(pointer.x, pointer.y).setVisible(true);
    this.thumb.setPosition(pointer.x, pointer.y).setVisible(true);
  }

  _onMove(pointer) {
    if (pointer.id !== this.activePointerId) return;
    let dx = pointer.x - this.originX;
    let dy = pointer.y - this.originY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > this.maxDist) {
      dx = (dx / dist) * this.maxDist;
      dy = (dy / dist) * this.maxDist;
    }
    this.thumb.setPosition(this.originX + dx, this.originY + dy);

    if (dist < this.deadZone) {
      this.vector.x = 0;
      this.vector.y = 0;
    } else {
      this.vector.x = dx / this.maxDist;
      this.vector.y = dy / this.maxDist;
    }
  }

  _onUp(pointer) {
    if (pointer && pointer.id !== this.activePointerId) return;
    this.activePointerId = null;
    this.vector.x = 0;
    this.vector.y = 0;
    this.base.setVisible(false);
    this.thumb.setVisible(false);
  }

  // Returns { x, y } each in range -1..1
  getVector() {
    return this.vector;
  }
}
