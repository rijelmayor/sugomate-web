"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import styles from "./explainer.module.css";

const DURATION = 90;
const IMAGE = "/images/sugomate-explainer.png";
const steps = [
  {
    title: "Customer places an order",
    caption: "Browse a local store, choose items, set the delivery location, and place the order.",
    voice: "First, the customer browses nearby stores, chooses the items they need, selects a delivery location, and places an order through SUGOMATE.",
  },
  {
    title: "Merchant confirms and prepares",
    caption: "The merchant receives the order, verifies GCash payment when applicable, accepts it, and prepares the items.",
    voice: "Next, the merchant receives the order. The store verifies the payment when GCash is selected, accepts the order, and prepares the items for pickup.",
  },
  {
    title: "Admin monitors the network",
    caption: "The control room oversees orders, partners, delivery zones, and service performance.",
    voice: "Behind the scenes, the SUGOMATE Admin control room monitors platform activity, partner operations, delivery zones, and overall service performance.",
  },
  {
    title: "Driver receives and accepts",
    caption: "An approved delivery partner receives an offer and accepts the delivery job.",
    voice: "When the order is ready for dispatch, an eligible delivery partner receives a delivery offer, reviews the details, and accepts the job.",
  },
  {
    title: "Driver picks up from merchant",
    caption: "The driver travels to the store, confirms pickup, and secures the items.",
    voice: "The delivery partner then travels to the merchant, confirms the pickup, and carefully secures the customer's items for the trip.",
  },
  {
    title: "Driver delivers to customer",
    caption: "The driver follows the delivery route and hands the order to the customer.",
    voice: "The driver follows the route to the selected delivery location and hands the order directly to the customer.",
  },
  {
    title: "Order completed",
    caption: "The customer receives the order and the transaction and partner earnings are recorded.",
    voice: "Finally, the customer receives the order. The transaction is completed, and the corresponding merchant and delivery partner earnings are recorded. Imong sugo, kami bahala.",
  },
];

const routePoints = [
  new THREE.Vector3(-5.35, 1.65, 0.28),
  new THREE.Vector3(-0.15, 1.65, 0.28),
  new THREE.Vector3(5.15, 1.65, 0.28),
  new THREE.Vector3(-5.25, -2.25, 0.28),
  new THREE.Vector3(-1.15, -2.25, 0.28),
  new THREE.Vector3(2.65, -2.25, 0.28),
  new THREE.Vector3(5.65, -2.15, 0.28),
];
const routeCurve = new THREE.CatmullRomCurve3(routePoints);

export default function ExplainerScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const elapsedRef = useRef(0);
  const playingRef = useRef(false);

  useEffect(() => { playingRef.current = playing; }, [playing]);

  useEffect(() => {
    if (!playing || !voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(steps[activeStep].voice);
    utterance.lang = "en-PH";
    utterance.rate = 0.94;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((voice) => voice.lang.toLowerCase() === "en-ph")
      || voices.find((voice) => voice.lang.toLowerCase().startsWith("en-"));
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [activeStep, playing, voiceEnabled]);

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
    renderer.toneMappingExposure = 1.08;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight("#ffffff", 1.2));
    const keyLight = new THREE.DirectionalLight("#ffffff", 1.25);
    keyLight.position.set(-4, 7, 12);
    scene.add(keyLight);

    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(16.2, 9.2),
      new THREE.MeshStandardMaterial({ color: "#17395c", metalness: 0.5, roughness: 0.3 }),
    );
    frame.position.z = -0.16;
    scene.add(frame);

    const imagePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 9),
      new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    );
    imagePlane.position.z = 0;
    scene.add(imagePlane);

    let texture: THREE.Texture | null = null;
    let disposed = false;
    new THREE.TextureLoader().load(IMAGE, (loaded) => {
      if (disposed) { loaded.dispose(); return; }
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.anisotropy = renderer.capabilities.getMaxAnisotropy();
      imagePlane.material = new THREE.MeshBasicMaterial({ map: loaded });
      texture = loaded;
    });

    const routeGeometry = new THREE.TubeGeometry(routeCurve, 160, 0.035, 8, false);
    const route = new THREE.Mesh(
      routeGeometry,
      new THREE.MeshBasicMaterial({ color: "#25c9ff", transparent: true, opacity: 0.9 }),
    );
    route.position.z = 0.22;
    scene.add(route);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 24, 24),
      new THREE.MeshBasicMaterial({ color: "#ffbd18" }),
    );
    marker.position.copy(routeCurve.getPointAt(0));
    marker.position.z = 0.48;
    scene.add(marker);

    const nodeMeshes = routePoints.map((point, index) => {
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(index === 0 ? 0.13 : 0.11, 20, 20),
        new THREE.MeshBasicMaterial({ color: "#ffbd18", transparent: true, opacity: 0.82 }),
      );
      node.position.copy(point);
      node.position.z = 0.42;
      scene.add(node);
      return node;
    });

    let animationId = 0;
    let lastTime = 0;
    let lastUiUpdate = 0;
    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      const aspect = width / height;
      const viewHeight = Math.max(9, 16 / aspect);
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

      if (playingRef.current) {
        elapsedRef.current = Math.min(DURATION, elapsedRef.current + delta);
        if (elapsedRef.current >= DURATION) {
          playingRef.current = false;
          window.setTimeout(() => setPlaying(false), 0);
        }
      }

      const progress = Math.min(1, elapsedRef.current / DURATION);
      marker.position.copy(routeCurve.getPointAt(progress));
      marker.position.z = 0.5;
      marker.scale.setScalar(1 + Math.sin(now * 0.008) * 0.16);
      const currentStep = Math.min(steps.length - 1, Math.floor(progress * steps.length));
      nodeMeshes.forEach((node, index) => {
        const reached = index <= currentStep;
        const material = node.material as THREE.MeshBasicMaterial;
        material.color.set(reached ? "#ffbd18" : "#48bff2");
        material.opacity = reached ? 1 : 0.45;
        node.scale.setScalar(index === currentStep ? 1.65 : 1);
      });
      imagePlane.rotation.y = Math.sin(now * 0.00045) * 0.008;
      frame.rotation.copy(imagePlane.rotation);
      renderer.render(scene, camera);

      if (now - lastUiUpdate > 160) {
        setElapsed(elapsedRef.current);
        setActiveStep(Math.min(steps.length - 1, Math.floor(Math.min(0.999, progress) * steps.length)));
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
      routeGeometry.dispose();
      [imagePlane.material, frame.material, route.material, marker.material, ...nodeMeshes.map((node) => node.material)]
        .forEach((material) => {
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material.dispose();
        });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  const start = () => {
    if (elapsedRef.current >= DURATION) elapsedRef.current = 0;
    setVoiceEnabled(true);
    setPlaying(true);
  };

  const pause = () => {
    setPlaying(false);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  const restart = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    elapsedRef.current = 0;
    setElapsed(0);
    setActiveStep(0);
    setVoiceEnabled(true);
    setPlaying(true);
  };

  const progress = (elapsed / DURATION) * 100;

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
        <div className={styles.intro}>
          <span className={styles.eyebrow}>FROM ORDER TO FULFILLMENT</span>
          <h1>One connected journey. Seven clear steps.</h1>
          <p>Follow the moving route as each partner completes their part of the order.</p>
        </div>
        <div className={styles.scene} ref={mountRef} aria-label="3D SUGOMATE infographic with an animated route connecting seven order stages" />
        <div className={styles.stepPanel} aria-live="polite">
          <span className={styles.stepNumber}>STEP {String(activeStep + 1).padStart(2, "0")} / 07</span>
          <h2>{steps[activeStep].title}</h2>
          <p>{steps[activeStep].caption}</p>
        </div>
        <div className={styles.controls}>
          <button type="button" onClick={playing ? pause : start}>{playing ? "Pause" : elapsed >= DURATION ? "Play again" : "Play with voice-over"}</button>
          <button type="button" onClick={restart}>Restart</button>
          <div className={styles.timeline} aria-label={`${Math.floor(elapsed)} seconds of 90 seconds`}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <span className={styles.time}>{Math.floor(elapsed)} / 90 sec</span>
        </div>
        <p className={styles.tagline}>Imong sugo, kami bahala.</p>
      </section>
    </main>
  );
}
