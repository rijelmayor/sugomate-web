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

    // A bright, dimensional SUGOMATE delivery cart replaces the tiny route dot.
    const vehicle = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: "#ff8a00", metalness: 0.28, roughness: 0.32 });
    const navyMaterial = new THREE.MeshStandardMaterial({ color: "#09234a", metalness: 0.38, roughness: 0.28 });
    const glassMaterial = new THREE.MeshStandardMaterial({ color: "#79dcff", metalness: 0.55, roughness: 0.16 });
    const tireMaterial = new THREE.MeshStandardMaterial({ color: "#101827", roughness: 0.82 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.34, 0.34), bodyMaterial);
    body.position.y = 0.02;
    vehicle.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.31, 0.31), navyMaterial);
    cabin.position.set(-0.08, 0.29, 0);
    vehicle.add(cabin);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.22, 0.25), glassMaterial);
    windshield.position.set(0.145, 0.3, 0);
    vehicle.add(windshield);
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.25, 0.29), new THREE.MeshStandardMaterial({ color: "#ffd166", roughness: 0.55 }));
    cargo.position.set(0.27, 0.31, 0);
    vehicle.add(cargo);
    [-0.25, 0.29].forEach((x) => {
      [-0.19, 0.19].forEach((z) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.075, 20), tireMaterial);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, -0.17, z);
        vehicle.add(wheel);
      });
    });
    const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), new THREE.MeshBasicMaterial({ color: "#fff2a6" }));
    headlight.position.set(0.425, 0.08, 0.08);
    vehicle.add(headlight);
    const vehicleGlow = new THREE.Mesh(
      new THREE.CircleGeometry(0.52, 32),
      new THREE.MeshBasicMaterial({ color: "#20cfff", transparent: true, opacity: 0.3, depthWrite: false }),
    );
    vehicleGlow.rotation.x = 0;
    vehicleGlow.position.z = -0.12;
    vehicle.add(vehicleGlow);
    vehicle.position.copy(routeCurve.getPointAt(0));
    vehicle.position.z = 0.78;
    vehicle.scale.setScalar(1.12);
    scene.add(vehicle);

    const nodeMeshes = routePoints.map((point, index) => {
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(index === 0 ? 0.13 : 0.11, 20, 20),
        new THREE.MeshBasicMaterial({ color: "#48bff2", transparent: true, opacity: 0.75 }),
      );
      node.position.copy(point);
      node.position.z = 0.42;
      scene.add(node);

      const check = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.045, 10, 28),
        new THREE.MeshBasicMaterial({ color: "#20df91" }),
      );
      check.add(ring);
      const makeStroke = (start, end) => {
        const direction = new THREE.Vector3().subVectors(end, start);
        const stroke = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, direction.length(), 12),
          new THREE.MeshBasicMaterial({ color: "#ffffff" }),
        );
        stroke.position.copy(start).add(end).multiplyScalar(0.5);
        stroke.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
        return stroke;
      };
      check.add(
        makeStroke(new THREE.Vector3(-0.105, 0.005, 0.055), new THREE.Vector3(-0.025, -0.075, 0.055)),
        makeStroke(new THREE.Vector3(-0.025, -0.075, 0.055), new THREE.Vector3(0.12, 0.105, 0.055)),
      );
      check.position.copy(point);
      check.position.z = 0.9;
      check.scale.setScalar(0.72);
      check.visible = false;
      scene.add(check);
      return { node, check };
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
      const cartPosition = routeCurve.getPointAt(progress);
      const tangent = routeCurve.getTangentAt(progress);
      vehicle.position.set(cartPosition.x, cartPosition.y + 0.16, 0.78);
      vehicle.rotation.z = Math.atan2(tangent.y, tangent.x);
      vehicle.position.z = 0.78 + Math.sin(now * 0.009) * 0.035;
      vehicleGlow.material.opacity = 0.22 + Math.sin(now * 0.01) * 0.08;
      const currentStep = Math.min(steps.length - 1, Math.floor(Math.min(0.9999, progress) * steps.length));
      nodeMeshes.forEach(({ node, check }, index) => {
        const completed = progress >= (index + 1) / steps.length;
        const material = node.material as THREE.MeshBasicMaterial;
        material.color.set(completed ? "#20df91" : index === currentStep ? "#ffbd18" : "#48bff2");
        material.opacity = completed || index === currentStep ? 1 : 0.45;
        node.scale.setScalar(index === currentStep ? 1.75 + Math.sin(now * 0.009) * 0.12 : 1);
        check.visible = completed;
        if (completed) check.scale.setScalar(0.72 + Math.sin(now * 0.006 + index) * 0.035);
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
      [imagePlane.material, frame.material, route.material, bodyMaterial, navyMaterial, glassMaterial, tireMaterial, cargo.material, vehicleGlow.material, ...vehicle.children.map((child) => child instanceof THREE.Mesh ? child.material : null).filter(Boolean), ...nodeMeshes.flatMap(({ node, check }) => [node.material, ...check.children.map((child) => (child as THREE.Mesh).material)])]
        .forEach((material) => {
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material.dispose();
        });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  const start = () => {
    if (elapsedRef.current >= DURATION) {
      elapsedRef.current = 0;
      setElapsed(0);
      setActiveStep(0);
    }
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
