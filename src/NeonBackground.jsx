// Decorative animated neon grid behind the page (original design; three.js, loaded lazily).
// - Never blocks the app: if WebGL or three.js fails, the plain dark CSS background remains.
// - Pauses while the tab is hidden; renders one still frame if the user prefers reduced motion.
// - Capped at ~30 frames per second and pixel ratio 1.5 to leave the charts responsive.
import { useEffect, useRef } from "react";

const BG = 0x05070d;
const CYAN = 0x00e5ff;
const ORANGE = 0xff9b21;
const CELL = 4; // grid spacing (world units)
const FAR = 120;

function gridLines(THREE, { y, color, opacity, halfWidth = 64 }) {
  const pts = [];
  for (let x = -halfWidth; x <= halfWidth; x += CELL) pts.push(x, y, CELL * 2, x, y, -FAR);
  for (let z = CELL * 2; z >= -FAR; z -= CELL) pts.push(-halfWidth, y, z, halfWidth, y, z);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  return new THREE.LineSegments(geo, mat);
}

function glowTexture(THREE, rgb) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, `rgba(${rgb},0.9)`);
  grad.addColorStop(0.35, `rgba(${rgb},0.25)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export default function NeonBackground() {
  const hostRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      let THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass;
      try {
        THREE = await import("three");
        ({ EffectComposer } = await import("three/addons/postprocessing/EffectComposer.js"));
        ({ RenderPass } = await import("three/addons/postprocessing/RenderPass.js"));
        ({ UnrealBloomPass } = await import("three/addons/postprocessing/UnrealBloomPass.js"));
        ({ OutputPass } = await import("three/addons/postprocessing/OutputPass.js"));
      } catch {
        return; // keep the plain CSS background
      }
      if (disposed || !hostRef.current) return;

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
      } catch {
        return; // no WebGL
      }
      const host = hostRef.current;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(BG, 1);
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(BG, 18, FAR - 10);
      const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 300);
      camera.position.set(0, 3.2, 6);
      camera.lookAt(0, 2.2, -40);

      // Floor and a faint ceiling grid form a corridor that drifts toward the viewer.
      const moving = new THREE.Group();
      moving.add(gridLines(THREE, { y: 0, color: CYAN, opacity: 0.55 }));
      moving.add(gridLines(THREE, { y: 16, color: CYAN, opacity: 0.12 }));
      scene.add(moving);

      // Horizon glow (cyan core, orange rim).
      const glowCyan = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE, "0,229,255"), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
      glowCyan.scale.set(140, 40, 1);
      glowCyan.position.set(0, 4, -FAR + 5);
      const glowOrange = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE, "255,155,33"), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0.35 }));
      glowOrange.scale.set(220, 18, 1);
      glowOrange.position.set(0, 0.5, -FAR + 4);
      scene.add(glowCyan, glowOrange);

      // Light streaks gliding along grid lanes: a bright head and a long fading tail.
      const streaks = [];
      const lanes = [-20, -12, -8, 8, 12, 24];
      lanes.forEach((x, i) => {
        const color = i % 2 === 0 ? ORANGE : CYAN;
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.12, 2.2),
          new THREE.MeshBasicMaterial({ color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }),
        );
        const tail = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.06, 26),
          new THREE.MeshBasicMaterial({ color, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.35, depthWrite: false }),
        );
        tail.position.z = -14;
        const g = new THREE.Group();
        g.add(head, tail);
        g.position.set(x, 0.08, -FAR + ((i * 37) % FAR));
        scene.add(g);
        streaks.push({ g, speed: 14 + ((i * 7) % 11) });
      });

      // Bloom gives the neon glow.
      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 1.05, 0.55, 0.05);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());

      const resize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        composer.setSize(w, h);
        bloom.resolution.set(w / 2, h / 2);
      };
      resize();
      window.addEventListener("resize", resize);

      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
      let raf = 0;
      let last = performance.now();
      let lastDraw = 0;
      const tick = (now) => {
        raf = requestAnimationFrame(tick);
        if (now - lastDraw < 33) return; // ~30 fps
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        lastDraw = now;
        moving.position.z = (moving.position.z + dt * 3.2) % CELL;
        for (const s of streaks) {
          s.g.position.z += dt * s.speed;
          if (s.g.position.z > CELL * 3) s.g.position.z = -FAR;
        }
        composer.render();
      };
      const play = () => {
        cancelAnimationFrame(raf);
        if (reduced?.matches || document.hidden) {
          composer.render(); // one still frame
          return;
        }
        last = performance.now();
        raf = requestAnimationFrame(tick);
      };
      const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : play());
      document.addEventListener("visibilitychange", onVisibility);
      reduced?.addEventListener?.("change", play);
      play();

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", onVisibility);
        reduced?.removeEventListener?.("change", play);
        scene.traverse((o) => {
          o.geometry?.dispose();
          o.material?.map?.dispose();
          o.material?.dispose();
        });
        composer.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
      if (disposed) cleanup();
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={hostRef} className="neon-bg" aria-hidden="true" />;
}
