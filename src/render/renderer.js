import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { buildCourt, themeFor } from './court.js';
import { CharacterView } from './character.js';
import { FXSystem } from './fx.js';
import { GameCamera } from './camera.js';
import { toon, withOutline, makeCanvas, canvasTexture } from './materials.js';
import { COURT, FENCE } from '../data/constants.js';

/**
 * Three.js presentation layer. Reads from MatchSim every frame; never mutates it.
 */
export class MatchRenderer {
  constructor(canvas, sim, settings) {
    this.canvas = canvas;
    this.sim = sim;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.quality === 'high' ? 2 : 1.25));
    this.renderer.shadowMap.enabled = settings.quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    const theme = themeFor(sim.teams[0]);
    this.theme = theme;
    this.scene.background = skyTexture(theme.sky);
    this.scene.fog = new THREE.FogExp2(new THREE.Color(theme.fog), 0.012);

    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 200);
    this.gameCam = new GameCamera(this.camera);

    this.setupLights(theme);
    this.court = buildCourt(this.scene, theme);
    this.crowd = this.court.getObjectByName('crowd');
    this.net = this.court.getObjectByName('net');
    this.fenceNear = this.court.getObjectByName('fenceNear');
    this.fenceNearFade = 0;
    if (this.fenceNear) this.fenceNear.visible = false;

    this.views = new Map();
    for (const p of sim.players) {
      const v = new CharacterView(p.data, sim.teams[p.team]);
      this.scene.add(v.root);
      this.views.set(p.id, v);
    }
    this.ball = this.buildBall();
    this.scene.add(this.ball);
    this.fx = new FXSystem(this.scene);
    this.tmp = new THREE.Vector3();
    this.crowdEnergy = 0.2;
    this.netWobble = 0;
    this.gbFlash = 0;

    this.setupPost();
    this.bindEvents();
    this.resize();
  }

  setupLights(theme) {
    const hemi = new THREE.HemisphereLight(new THREE.Color(theme.sky[1]).lerp(new THREE.Color(0xffffff), 0.5), 0x2a2a30, 0.9);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff2dc, 2.4);
    key.position.set(8, 16, 10);
    key.castShadow = this.settings.quality !== 'low';
    key.shadow.mapSize.set(this.settings.quality === 'high' ? 2048 : 1024, this.settings.quality === 'high' ? 2048 : 1024);
    key.shadow.camera.left = -14;
    key.shadow.camera.right = 14;
    key.shadow.camera.top = 14;
    key.shadow.camera.bottom = -14;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 50;
    key.shadow.bias = -0.0008;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);
    this.keyLight = key;
    const rim = new THREE.DirectionalLight(new THREE.Color(theme.accent), 0.8);
    rim.position.set(-10, 6, -12);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0x9ec5ff, 0.45);
    fill.position.set(-6, 8, 14);
    this.scene.add(fill);
  }

  setupPost() {
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (this.settings.quality !== 'low') {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.6, 0.85);
      composer.addPass(this.bloom);
    }
    this.fxaa = new ShaderPass(FXAAShader);
    composer.addPass(this.fxaa);
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  buildBall() {
    const g = new THREE.Group();
    const c = makeCanvas(256, 128);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8641c';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#1a0d05';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 64);
    ctx.lineTo(256, 64);
    ctx.stroke();
    for (const x of [64, 192]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 128);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(128, 64, 70, 40, 0, 0, Math.PI * 2);
    ctx.stroke();
    const tex = canvasTexture(c);
    const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: toon('#ffffff').gradientMap });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 14), mat);
    mesh.castShadow = true;
    withOutline(mesh, 0.025);
    g.add(mesh);
    this.ballMesh = mesh;
    // Fire aura (heating up / gamebreaker)
    const aura = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff7a1f, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(aura);
    this.ballAura = aura;
    const shadowTex = (() => {
      const cc = makeCanvas(64, 64);
      const cx = cc.getContext('2d');
      const gr = cx.createRadialGradient(32, 32, 4, 32, 32, 30);
      gr.addColorStop(0, 'rgba(0,0,0,0.8)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = gr;
      cx.fillRect(0, 0, 64, 64);
      return canvasTexture(cc);
    })();
    this.ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.renderOrder = 1;
    this.scene.add(this.ballShadow);
    return g;
  }

  bindEvents() {
    const ev = this.sim.events;
    const team = (t) => this.sim.teams[t];
    ev.on('bounce', ({ pos, speed }) => {
      if (speed > 1.5) this.fx.dust(pos, Math.min(10, 2 + speed), Math.min(1.2, speed * 0.25));
    });
    ev.on('dunk', ({ player }) => {
      this.gameCam.punch(0.9);
      this.fx.shockwave({ x: COURT.rimX, z: COURT.rimZ + 0.3 }, team(player.team).accent, 5, 0.6);
      this.fx.sparks({ x: COURT.rimX, y: COURT.rimHeight, z: COURT.rimZ }, '#ffd23f', 20);
      this.netWobble = 1;
      this.crowdEnergy = 1;
    });
    ev.on('swish', () => {
      this.netWobble = 0.6;
      this.crowdEnergy = Math.max(this.crowdEnergy, 0.75);
    });
    ev.on('score', ({ player, gb }) => {
      this.gameCam.setMode('score', gb ? 1.8 : 1.1);
      if (gb) {
        this.fx.confetti({ x: COURT.rimX, y: 3.5, z: COURT.rimZ + 1 }, [team(player.team).primary, team(player.team).accent, '#ffffff'], 160);
        this.gameCam.punch(1.2);
      }
    });
    ev.on('knockdown', ({ victim }) => {
      this.fx.dust(victim.pos, 12, 1.4);
      this.gameCam.punch(0.35);
    });
    ev.on('ankle', ({ breaker, victim }) => {
      this.fx.burst({ x: victim.pos.x, y: 0.6, z: victim.pos.z }, team(breaker.team).accent, 26, 3.5, 0.18);
      this.fx.shockwave(victim.pos, team(breaker.team).accent, 3, 0.45);
      this.crowdEnergy = 1;
    });
    ev.on('block', ({ blocker }) => {
      this.gameCam.punch(0.6);
      this.fx.burst({ x: this.sim.ball.pos.x, y: this.sim.ball.pos.y, z: this.sim.ball.pos.z }, '#ffffff', 20, 4, 0.2);
      this.crowdEnergy = 1;
    });
    ev.on('steal', ({ stealer }) => {
      this.fx.burst({ x: stealer.pos.x, y: 1.0, z: stealer.pos.z }, team(stealer.team).accent, 14, 2.5, 0.15);
      this.crowdEnergy = Math.max(this.crowdEnergy, 0.7);
    });
    ev.on('shove', ({ victim }) => {
      this.gameCam.punch(0.3);
      this.fx.burst({ x: victim.pos.x, y: 1.0, z: victim.pos.z }, '#ffffff', 10, 2, 0.14);
    });
    ev.on('rim', ({ hard }) => {
      if (hard) this.fx.sparks({ x: COURT.rimX, y: COURT.rimHeight, z: COURT.rimZ }, '#ffb347', 8);
      this.netWobble = Math.max(this.netWobble, 0.3);
    });
    ev.on('shotstart', ({ player, type }) => {
      if (type === 'dunk') this.gameCam.setMode('dunk', 1.4, player);
    });
    ev.on('oopcatch', ({ player }) => this.gameCam.setMode('dunk', 1.3, player));
    ev.on('gamebreaker', ({ player }) => {
      this.gameCam.setMode('gamebreaker', 3.0, player);
      this.gbFlash = 1;
      this.fx.shockwave(player.pos, team(player.team).accent, 7, 0.8);
      this.crowdEnergy = 1;
    });
    ev.on('gbslam', ({ player }) => this.gameCam.setMode('dunk', 1.6, player));
    ev.on('trick', ({ player, turbo, broke }) => {
      if (turbo) this.fx.dust(player.pos, 6, 0.8);
    });
    ev.on('jump', ({ player }) => this.fx.dust(player.pos, 5, 0.7));
    ev.on('reset', () => this.gameCam.setMode('play', 0));
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    this.fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
  }

  update(dt) {
    const sim = this.sim;
    // Characters
    for (const p of sim.players) {
      const v = this.views.get(p.id);
      v.update(p, sim, dt, sim.ball.holder === p);
    }
    // Ball
    const b = sim.ball;
    const holder = b.holder;
    if (holder && (holder.state === 'shoot' || holder.state === 'dunk' || holder.state === 'oop' || holder.state === 'layup' || holder.state === 'jump' || holder.state === 'gbwind' || (holder.state === 'trick' && holder.trick && holder.trick.type === 5) || holder.state === 'pass')) {
      // Snap to the shooting hand.
      const v = this.views.get(holder.id);
      v.handWorld(this.tmp);
      if (holder.state === 'gbwind' || holder.state === 'pass' || (holder.state === 'trick')) {
        const l = new THREE.Vector3();
        v.leftHandWorld(l);
        this.tmp.lerp(l, 0.5);
      }
      this.ball.position.lerp(this.tmp, 0.7);
    } else {
      this.ball.position.set(b.pos.x, b.pos.y, b.pos.z);
    }
    const spin = b.vel.length() * dt * 6 + (holder ? dt * 4 : 0);
    this.ballMesh.rotation.x += spin;
    this.ballMesh.rotation.z += spin * 0.3;
    this.ballShadow.position.set(this.ball.position.x, 0.015, this.ball.position.z);
    const bh = this.ball.position.y;
    const bs = Math.max(0.4, 1 - bh * 0.15);
    this.ballShadow.scale.setScalar(bs);
    this.ballShadow.material.opacity = 0.6 * bs;

    // Ball aura: heating up team or gamebreaker
    const hotTeam = holder ? holder.team : b.lastTeam;
    const hot = sim.momentum[hotTeam] >= 3 || sim.state === 'gamebreaker';
    const aura = this.ballAura.material;
    aura.opacity += ((hot ? 0.55 : 0) - aura.opacity) * Math.min(1, dt * 6);
    aura.color.set(sim.state === 'gamebreaker' ? this.sim.teams[hotTeam].accent : '#ff7a1f');
    this.ballAura.scale.setScalar(1 + Math.sin(performance.now() * 0.02) * 0.15);
    const flightShot = b.flight && b.flight.kind === 'shot';
    this.fx.updateTrail(this.ball.position, flightShot || hot || sim.state === 'gamebreaker', flightShot ? (b.flight.gb ? this.sim.teams[b.flight.shooter.team].accent : hot ? '#ff7a1f' : '#ffd23f') : '#ff7a1f');

    // Net wobble
    if (this.net) {
      this.netWobble = Math.max(0, this.netWobble - dt * 1.6);
      const w = this.netWobble;
      this.net.rotation.x = Math.sin(performance.now() * 0.02) * 0.25 * w;
      this.net.rotation.z = Math.cos(performance.now() * 0.017) * 0.2 * w;
      this.net.position.y = -w * 0.05;
    }

    // Crowd bounce
    this.crowdEnergy += (0.2 - this.crowdEnergy) * Math.min(1, dt * 0.6);
    if (this.crowd) {
      const t = performance.now() * 0.001;
      const e = this.crowdEnergy;
      const kids = this.crowd.children;
      for (let i = 0; i < kids.length; i++) {
        const k = kids[i];
        const ph = k.userData.phase;
        k.position.y = k.userData.baseY + Math.max(0, Math.sin(t * (4 + e * 6) + ph)) * (0.05 + e * 0.3);
        k.rotation.z = Math.sin(t * 3 + ph) * 0.08 * (0.3 + e);
      }
    }

    // FX + camera
    this.fx.update(dt);
    this.gameCam.update(sim, dt);
    // Hide the near fence panel whenever the camera is looking in from outside the cage.
    if (this.fenceNear) {
      const cz = this.camera.position.z;
      const outside = cz > FENCE.maxZ - 0.5;
      const want = outside ? 0 : 1;
      this.fenceNearFade += (want - this.fenceNearFade) * Math.min(1, dt * 8);
      const vis = this.fenceNearFade > 0.05;
      this.fenceNear.visible = vis;
      if (vis) {
        for (const c of this.fenceNear.children) {
          if (c.material && c.material.transparent) c.material.opacity = 0.85 * this.fenceNearFade;
        }
      }
    }
    if (this.bloom) {
      this.gbFlash = Math.max(0, this.gbFlash - dt * 0.8);
      this.bloom.strength = 0.35 + this.gbFlash * 0.9 + (sim.state === 'gamebreaker' ? 0.3 : 0);
    }
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.renderer.dispose();
  }
}

function skyTexture(colors) {
  const c = makeCanvas(16, 512);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, colors[0]);
  g.addColorStop(0.55, colors[1]);
  g.addColorStop(1, colors[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 512);
  const t = canvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}
