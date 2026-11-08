"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import styles from "./explainer.module.css";

const DURATION = 90;
const IMAGE = "/images/sugomate-explainer.png";
const shots = [
  { time: 0, x: 0, y: 0, height: 9.7 },
  { time: 6, x: -5.65, y: 1.55, height: 4.45 },
  { time: 16, x: -0.45, y: 1.55, height: 4.45 },
  { time: 26, x: 5.15, y: 1.55, height: 4.45 },
  { time: 36, x: -5.65, y: -2.25, height: 4.45 },
  { time: 46, x: -1.55, y: -2.25, height: 4.45 },
  { time: 56, x: 2.85, y: -2.25, height: 4.45 },
  { time: 66, x: 6.35, y: -2.25, height: 4.45 },
  { time: 78, x: 0, y: 0, height: 9.7 },
  { time: 90, x: 0, y: 0, height: 9.7 },
];

function shotAt(seconds: number) {
  let index = 0;
  while (index < shots.length - 2 && seconds > shots[index + 1].time) index += 1;
  const from = shots[index];
  const to = shots[index + 1];
  const raw = THREE.MathUtils.clamp((seconds - from.time) / (to.time - from.time), 0, 1);
  const eased = raw * raw * (3 - 2 * raw);
  return {
    x: THREE.MathUtils.lerp(from.x, to.x, eased),
    y: THREE.MathUtils.lerp(from.y, to.y, eased),
    height: THREE.MathUtils.lerp(from.height, to.height, eased),
  };
}

export default function ExplainerScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const playingRef = useRef(true);

  useEffect(() => { playingRef.current = playing; }, [playing]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#06162b");
    const camera = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, 0.1, 100);
    camera.position.set(0, 0, 18);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight("#ffffff", 1.15));
    const keyLight = new THREE.DirectionalLight("#ffffff", 1.3);
    keyLight.position.set(-4, 7, 12);
    scene.add(keyLight);

    const imagePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 9),
      new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    );
    imagePlane.rotation.set(-0.035, -0.045, 0);
    scene.add(imagePlane);

    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(16.18, 9.18),
      new THREE.MeshStandardMaterial({ color: "#17395c", metalness: 0.48, roughness: 0.34 }),
    );
    frame.position.z = -0.12;
    frame.rotation.copy(imagePlane.rotation);
    scene.add(frame);

    const loader = new THREE.TextureLoader();
    let texture: THREE.Texture | null = null;
    let disposed = false;
    loader.load(IMAGE, (loaded) => {
      if (disposed) { loaded.dispose(); return; }
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.anisotropy = renderer.capabilities.getMaxAnisotropy();

      const source = loaded.image as HTMLImageElement;
      const canvas = document.createElement("canvas");
      canvas.width = source.naturalWidth || 1536;
      canvas.height = source.naturalHeight || 864;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        const scale = canvas.width / 1536;
        context.fillStyle = "#ffffff";
        context.fillRect(590 * scale, 91 * scale, 410 * scale, 48 * scale);
        context.fillStyle = "#071b35";
        context.font = `italic 700 ${Math.round(31 * scale)}px Arial, sans-serif`;
        context.textAlign = "left";
        context.fillText("Imong sugo, kami bahala.", 603 * scale, 124 * scale);
        const corrected = new THREE.CanvasTexture(canvas);
        corrected.colorSpace = THREE.SRGBColorSpace;
        corrected.anisotropy = renderer.capabilities.getMaxAnisotropy();
        imagePlane.material = new THREE.MeshBasicMaterial({ map: corrected });
        texture = corrected;
        loaded.dispose();
      } else {
        imagePlane.material = new THREE.MeshBasicMaterial({ map: loaded });
        texture = loaded;
      }
    }, undefined, () => {
      imagePlane.material = new THREE.MeshBasicMaterial({ color: "#102b49" });
    });

    let animationId = 0;
    let lastTime = 0;
    let lastUiUpdate = 0;
    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      const aspect = width / height;
      const viewHeight = Math.max(9.7, 16 / aspect);
      camera.left = (-viewHeight * aspect) / 2;
      camera.right = (viewHeight * aspect) / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const animate = (now: number) => {
      animationId = requestAnimationFrame(animate);
      if (!lastTime) lastTime = now;
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      if (playingRef.current) elapsedRef.current = (elapsedRef.current + delta) % DURATION;

      const shot = shotAt(elapsedRef.current);
      const aspect = Math.max(0.45, mount.clientWidth / Math.max(1, mount.clientHeight));
      const focusedHeight = Math.max(shot.height, 3.75 / aspect);
      const viewWidth = focusedHeight * aspect;
      camera.left = -viewWidth / 2;
      camera.right = viewWidth / 2;
      camera.top = focusedHeight / 2;
      camera.bottom = -focusedHeight / 2;
      camera.position.x += (shot.x - camera.position.x) * 0.045;
      camera.position.y += (shot.y - camera.position.y) * 0.045;
      camera.position.z += (18 - camera.position.z) * 0.045;
      camera.lookAt(camera.position.x, camera.position.y, 0);
      camera.updateProjectionMatrix();
      imagePlane.rotation.y = -0.045 + Math.sin(now * 0.00018) * 0.012;
      renderer.render(scene, camera);

      if (now - lastUiUpdate > 180) {
        setElapsed(elapsedRef.current);
        lastUiUpdate = now;
      }
    };
    animationId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      observer.disconnect();
      texture?.dispose();
      imagePlane.geometry.dispose();
      frame.geometry.dispose();
      const material = imagePlane.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material.dispose();
      frame.material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  const restart = () => {
    elapsedRef.current = 0;
    setElapsed(0);
    setPlaying(true);
  };

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>S</span>
          <span>SUGOMATE<small>IMONG SUGO, KAMI BAHALA.</small></span>
        </Link>
        <span className={styles.topLabel}>HOW SUGOMATE WORKS</span>
      </header>
      <section className={styles.explainer}>
        <div className={styles.scene} ref={mountRef} aria-label="Animated 3D presentation of the SUGOMATE infographic" />
        <div className={styles.controls}>
          <button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play"}</button>
          <button type="button" onClick={restart}>Restart</button>
          <div className={styles.timeline} aria-label={`${Math.floor(elapsed)} seconds of 90 seconds`}>
            <span style={{ width: `${(elapsed / DURATION) * 100}%` }} />
          </div>
          <span className={styles.time}>{Math.floor(elapsed)} / 90 sec</span>
        </div>
      </section>
    </main>
  );
}
