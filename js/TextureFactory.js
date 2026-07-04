/**
 * TextureFactory - generates placeholder textures for any art that has not
 * been provided as a PNG in assets/. Every key is only generated if a real
 * texture with the same key does not already exist, so dropping PNG files
 * into assets/ automatically replaces these.
 */
const CANDY_FONT = 'Hiragino Maru Gothic Pro, Meiryo, Arial, sans-serif';

class TextureFactory {
  static createAll(scene) {
    const T = 64;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    const make = (key, drawFn) => {
      if (!scene.textures.exists(key)) {
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
          TextureFactory.drawStar(g, T/2, T/2, 5, T*0.32, T*0.14);
          g.fillStyle(0xffffff, 0.3);
          g.fillCircle(T*0.38, T*0.36, T*0.08);
        }
      });
    }

    // Particle textures
    make('particle_star', (g) => {
      g.fillStyle(0xffffff);
      TextureFactory.drawStar(g, T/2, T/2, 4, T*0.4, T*0.2);
    });

    make('particle_heart', (g) => {
      g.fillStyle(0xff69b4);
      g.fillCircle(T*0.35, T*0.38, T*0.17);
      g.fillCircle(T*0.65, T*0.38, T*0.17);
      g.fillTriangle(T*0.18, T*0.44, T*0.82, T*0.44, T/2, T*0.78);
    });

    g.destroy();
  }

  static drawStar(g, cx, cy, points, outerR, innerR) {
    const step = Math.PI / points;
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = i * step - Math.PI / 2;
      pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }
    g.fillPoints(pts, true);
  }
}
