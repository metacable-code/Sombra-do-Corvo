// SOMBRA DO CORVO - protótipo v0.1 (Phaser 3)
const W = 800, H = 450, TOP = 300, BOT = 420;
const input = { left: false, right: false, up: false, down: false, punch: false, jump: false };

// ---------- Controlos (teclado + botões táteis) ----------
const keyMap = {
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
  ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
  j: 'punch', ' ': 'punch', k: 'jump'
};
window.addEventListener('keydown', e => { const k = keyMap[e.key]; if (k) { input[k] = true; e.preventDefault(); } });
window.addEventListener('keyup', e => { const k = keyMap[e.key]; if (k) input[k] = false; });
document.querySelectorAll('[data-k]').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); input[k] = true; b.classList.add('on'); };
  const off = e => { e.preventDefault(); input[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointerleave', off);
  b.addEventListener('pointercancel', off);
});

// ---------- Telegram Mini App ----------
const tg = window.Telegram && window.Telegram.WebApp;
if (tg) { tg.ready(); tg.expand(); }
function guardarProgresso(dados) {
  try { localStorage.setItem('sombra_corvo', JSON.stringify(dados)); } catch (e) {}
  // FASE 2: enviar para o servidor (Railway) com tg.initData para ligar à conta do Telegram
}
function lerProgresso() {
  try { return JSON.parse(localStorage.getItem('sombra_corvo')) || {}; } catch (e) { return {}; }
}

// ---------- Jogo ----------
class Main extends Phaser.Scene {
  create() {
    this.makeTextures();
    this.add.rectangle(W / 2, 0, W, TOP, 0x14101c).setOrigin(0.5, 0);
    this.add.rectangle(W / 2, TOP - 70, W, 70, 0x1d1729).setOrigin(0.5, 0);
    for (let i = 0; i < 9; i++) { // silhuetas de prédios góticos
      const h = 80 + Math.random() * 90;
      this.add.rectangle(i * 100 + 40, TOP - 70, 60, h, 0x0e0a15).setOrigin(0.5, 1);
      this.add.triangle(i * 100 + 40, TOP - 70 - h, 0, 30, 30, -20, 60, 30, 0x0e0a15).setOrigin(0.5, 1);
    }
    this.add.rectangle(W / 2, TOP - 70, W, 6, 0x2a2140).setOrigin(0.5, 0);
    this.add.rectangle(W / 2, TOP, W, H - TOP, 0x2b2437).setOrigin(0.5, 0);
    this.add.rectangle(W / 2, TOP, W, 3, 0x3b3150).setOrigin(0.5, 0);

    this.best = lerProgresso();
    this.hud = this.add.graphics().setDepth(10000);
    this.hudText = this.add.text(12, 8, '', { fontSize: '14px', color: '#e8e0f5', fontFamily: 'monospace' }).setDepth(10001);
    this.startGame();
  }

  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const mk = (key, w, h, draw) => { g.clear(); draw(g); g.generateTexture(key, w, h); };
    mk('hero', 36, 60, g => {
      g.fillStyle(0x2a1f3d).fillRect(6, 18, 24, 42);        // capa
      g.fillStyle(0x1a1228).fillTriangle(18, 0, 4, 24, 32, 24); // capuz
      g.fillStyle(0xd22b3a).fillRect(14, 12, 4, 3).fillRect(21, 12, 4, 3); // olhos
      g.fillStyle(0x4a3a6b).fillRect(4, 28, 6, 16).fillRect(26, 28, 6, 16); // braços
    });
    const enemy = (key, w, h, body, eye) => mk(key, w, h, g => {
      g.fillStyle(body).fillRect(4, 14, w - 8, h - 14);
      g.fillStyle(body).fillCircle(w / 2, 10, 10);
      g.fillStyle(eye).fillRect(w / 2 - 6, 8, 4, 3).fillRect(w / 2 + 2, 8, 4, 3);
    });
    enemy('e1', 32, 54, 0x5a5a66, 0xffd23f);
    enemy('boss', 56, 90, 0x6b1f2a, 0xffffff);
    mk('px', 4, 4, g => g.fillStyle(0xffffff).fillRect(0, 0, 4, 4));
  }

  startGame() {
    const now = this.time.now;
    this.over = false; this.paused = false;
    this.hero = this.mk('hero', 120, 370, 1);
    Object.assign(this.hero, { hp: 100, maxHp: 100, speed: 170, dmg: 10, punchCd: 380, level: 1, xp: 0, xpNext: 20,
      gold: 0, score: 0, facing: 1, z: 0, vz: 0, punchReady: 0, invul: 0 });
    this.enemies = [];
    this.wave = 0;
    this.nextWaveAt = now + 800;
    this.msg && this.msg.destroy();
  }

  mk(tex, x, y, scale) {
    const s = this.add.sprite(x, y, tex).setOrigin(0.5, 1).setScale(scale);
    s.sh = this.add.ellipse(x, y, 34 * scale, 10 * scale, 0x000000, 0.45);
    s.gx = x; s.gy = y; s.z = 0;
    return s;
  }
  place(s) {
    s.x = s.gx; s.y = s.gy - s.z;
    s.sh.x = s.gx; s.sh.y = s.gy;
    s.setDepth(s.gy); s.sh.setDepth(s.gy - 1);
  }

  spawnWave() {
    this.wave++;
    const boss = this.wave % 5 === 0;
    const n = boss ? 2 + Math.floor(this.wave / 5) : 2 + this.wave;
    const k = 1 + (this.wave - 1) * 0.18; // escala de dificuldade
    for (let i = 0; i < Math.min(n, 12); i++) {
      const side = Math.random() < 0.5 ? -30 : W + 30;
      const e = this.mk('e1', side, TOP + 10 + Math.random() * (BOT - TOP - 10), 1);
      Object.assign(e, { hp: 24 * k, maxHp: 24 * k, speed: 60 + Math.random() * 25 + this.wave * 2, dmg: 6 * k,
        atkReady: this.time.now + 1000, wind: 0, stun: 0, xp: 8, gold: 3, boss: false });
      this.enemies.push(e);
    }
    if (boss) {
      const e = this.mk('boss', W + 40, 360, 1);
      Object.assign(e, { hp: 220 * k, maxHp: 220 * k, speed: 55, dmg: 16 * k, atkReady: this.time.now + 1500,
        wind: 0, stun: 0, xp: 60, gold: 40, boss: true });
      this.enemies.push(e);
    }
    this.banner(boss ? `ONDA ${this.wave} - BOSS!` : `Onda ${this.wave}`);
  }

  banner(txt) {
    const t = this.add.text(W / 2, 120, txt, { fontSize: '36px', color: '#f5e6ff', fontFamily: 'monospace', stroke: '#000', strokeThickness: 5 })
      .setOrigin(0.5).setDepth(10002);
    this.tweens.add({ targets: t, alpha: 0, y: 90, duration: 1400, onComplete: () => t.destroy() });
  }

  floatText(x, y, txt, color) {
    const t = this.add.text(x, y - 50, txt, { fontSize: '16px', color, fontFamily: 'monospace', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(10002);
    this.tweens.add({ targets: t, y: y - 90, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  update(time, delta) {
    if (this.over || this.paused) return;
    const dt = delta / 1000, h = this.hero;

    // movimento do herói
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (dx) { h.facing = dx; h.setFlipX(dx < 0); }
    h.gx = Phaser.Math.Clamp(h.gx + dx * h.speed * dt, 20, W - 20);
    h.gy = Phaser.Math.Clamp(h.gy + dy * h.speed * 0.7 * dt, TOP + 10, BOT);
    if (input.jump && h.z === 0) h.vz = 430;
    h.z += h.vz * dt; h.vz -= 1200 * dt;
    if (h.z <= 0) { h.z = 0; h.vz = 0; }
    h.setAlpha(time < h.invul ? (Math.floor(time / 80) % 2 ? 0.4 : 1) : 1);

    // soco
    if (input.punch && time > h.punchReady) { h.punchReady = time + h.punchCd; this.doPunch(time); }

    // ondas
    if (!this.enemies.length && time > this.nextWaveAt) this.spawnWave();

    // inimigos
    for (const e of this.enemies) {
      if (time < e.stun) { this.place(e); continue; }
      const ex = h.gx - e.gx, ey = h.gy - e.gy;
      const near = Math.abs(ex) < 44 && Math.abs(ey) < 14;
      if (e.wind) {
        if (time > e.wind) {
          e.wind = 0; e.clearTint(); e.atkReady = time + (e.boss ? 1400 : 1200);
          if (Math.abs(h.gx - e.gx) < 62 && Math.abs(h.gy - e.gy) < 24 && h.z < 25 && time > h.invul) this.hurtHero(e.dmg, time);
        }
      } else if (!near) {
        const d = Math.hypot(ex, ey) || 1;
        e.gx += (ex / d) * e.speed * dt;
        e.gy = Phaser.Math.Clamp(e.gy + (ey / d) * e.speed * 0.7 * dt, TOP + 10, BOT);
        e.setFlipX(ex < 0);
      } else if (time > e.atkReady) { e.wind = time + 420; e.setTint(0xffe066); }
      this.place(e);
    }
    this.place(h);
    this.drawHud();
  }

  doPunch(time) {
    const h = this.hero;
    const fx = h.gx + h.facing * 34;
    const f = this.add.rectangle(fx, h.gy - h.z - 34, 30, 16, 0xffffff, 0.85).setDepth(h.gy + 1);
    this.tweens.add({ targets: f, alpha: 0, scaleX: 1.6, duration: 140, onComplete: () => f.destroy() });
    for (const e of this.enemies) {
      const rel = (e.gx - h.gx) * h.facing;
      if (rel > -12 && rel < 66 && Math.abs(e.gy - h.gy) < 24) {
        const dmg = Math.round(h.dmg * (0.9 + Math.random() * 0.3));
        e.hp -= dmg; e.gx += h.facing * (e.boss ? 6 : 20);
        e.stun = time + (e.boss ? 120 : 280); e.wind = 0;
        e.setTint(0xff6666); this.time.delayedCall(120, () => e.active && !e.wind && e.clearTint());
        this.floatText(e.gx, e.gy - e.z, String(dmg), '#ffe066');
        if (e.hp <= 0) this.killEnemy(e);
      }
    }
  }

  killEnemy(e) {
    const h = this.hero;
    this.enemies.splice(this.enemies.indexOf(e), 1);
    h.gold += e.gold; h.score += e.xp * 10; h.xp += e.xp;
    const p = this.add.particles(e.x, e.y - 20, 'px', { speed: { min: 60, max: 180 }, lifespan: 500, quantity: 12, scale: { start: 1, end: 0 }, tint: 0xd22b3a, emitting: false });
    p.explode(12); this.time.delayedCall(600, () => p.destroy());
    e.sh.destroy(); e.destroy();
    if (!this.enemies.length) { this.nextWaveAt = this.time.now + 1800; }
    if (h.xp >= h.xpNext) this.levelUp();
  }

  hurtHero(dmg, time) {
    const h = this.hero;
    h.hp -= Math.round(dmg); h.invul = time + 700;
    this.floatText(h.gx, h.gy - h.z, '-' + Math.round(dmg), '#ff5566');
    this.cameras.main.shake(120, 0.005);
    if (h.hp <= 0) this.gameOver();
  }

  levelUp() {
    const h = this.hero;
    h.xp -= h.xpNext; h.level++; h.xpNext = Math.round(h.xpNext * 1.35);
    this.paused = true;
    const pool = [
      ['Mais dano (+20%)', () => h.dmg *= 1.2],
      ['Mais vida (+25 e cura)', () => { h.maxHp += 25; h.hp = Math.min(h.maxHp, h.hp + 40); }],
      ['Mais velocidade (+10%)', () => h.speed *= 1.1],
      ['Socos mais rápidos (-12%)', () => h.punchCd *= 0.88],
      ['Cura total', () => h.hp = h.maxHp]
    ];
    Phaser.Utils.Array.Shuffle(pool);
    const ui = [this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setDepth(20000)];
    ui.push(this.add.text(W / 2, 90, `NÍVEL ${h.level}! Escolhe um upgrade`, { fontSize: '26px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(20001));
    pool.slice(0, 3).forEach((opt, i) => {
      const b = this.add.rectangle(W / 2, 170 + i * 80, 460, 62, 0x3b2a5c).setStrokeStyle(2, 0x9b7fd1).setDepth(20001).setInteractive();
      const t = this.add.text(W / 2, 170 + i * 80, opt[0], { fontSize: '22px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(20002);
      b.on('pointerdown', () => { opt[1](); ui.forEach(o => o.destroy()); this.paused = false; if (h.xp >= h.xpNext) this.levelUp(); });
      ui.push(b, t);
    });
  }

  gameOver() {
    this.over = true;
    const h = this.hero, b = this.best;
    const novo = { melhorOnda: Math.max(b.melhorOnda || 0, this.wave), melhorPontos: Math.max(b.melhorPontos || 0, h.score) };
    guardarProgresso(novo); this.best = novo;
    this.msg = this.add.text(W / 2, H / 2,
      `FIM DE JOGO\nOnda ${this.wave}  |  Pontos ${h.score}\nRecorde: onda ${novo.melhorOnda}, ${novo.melhorPontos} pts\n\nToca para recomeçar`,
      { fontSize: '24px', color: '#fff', fontFamily: 'monospace', align: 'center', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(30000);
    this.time.delayedCall(500, () => this.input.once('pointerdown', () => this.scene.restart()));
  }

  drawHud() {
    const h = this.hero, g = this.hud;
    g.clear();
    g.fillStyle(0x000000, 0.6).fillRect(10, 30, 204, 14).fillRect(10, 48, 204, 8);
    g.fillStyle(0xd22b3a).fillRect(12, 32, 200 * Math.max(0, h.hp / h.maxHp), 10);
    g.fillStyle(0x6fd0ff).fillRect(12, 49, 200 * (h.xp / h.xpNext), 6);
    this.hudText.setText(`Nv ${h.level}   Onda ${this.wave}   Ouro ${h.gold}   Pts ${h.score}`);
  }
}

new Phaser.Game({
  type: Phaser.AUTO, width: W, height: H, parent: 'game', backgroundColor: '#0b0812',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: Main
});
