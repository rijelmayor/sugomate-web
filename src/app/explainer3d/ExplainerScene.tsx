"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import styles from "./explainer.module.css";

const stages = [
  { title: "Customer places an order", copy: "The customer browses approved local stores, chooses products, checks out and receives an order confirmation.", actor: "CUSTOMER", detail: "Browse • Cart • Checkout" },
  { title: "Merchant receives the order", copy: "The store reviews the incoming order and accepts it before preparing the items.", actor: "MERCHANT", detail: "Review • Accept • Prepare" },
  { title: "Order is ready for dispatch", copy: "When preparation is complete, the order enters the dispatch queue for an eligible delivery partner.", actor: "DISPATCH", detail: "Ready for pickup • Assignment" },
  { title: "Delivery partner picks up", copy: "An approved, online rider accepts the delivery offer, confirms pickup and starts the trip.", actor: "DELIVERY PARTNER", detail: "Claim • Pickup • In transit" },
  { title: "Customer receives the order", copy: "The rider completes delivery with photo proof. The customer can review the order status and delivery proof.", actor: "FULFILLMENT", detail: "Delivered • Proof recorded" },
  { title: "Admin oversees the network", copy: "Operations monitors partner readiness, dispatch activity, service zones, order outcomes and the audit trail.", actor: "ADMIN CONTROL ROOM", detail: "Monitor • Verify • Improve" },
];

const points = [
  new THREE.Vector3(-4.2, 0.15, 1.2),
  new THREE.Vector3(-2.5, 0.8, -1.2),
  new THREE.Vector3(-0.3, 0.25, 1.1),
  new THREE.Vector3(2.0, 0.85, -1.0),
  new THREE.Vector3(4.1, 0.2, 1.1),
];

export default function ExplainerScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#071b35");
    scene.fog = new THREE.Fog("#071b35", 12, 25);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 7.8, 12.8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight("#d8ecff", "#172b46", 2.1));
    const key = new THREE.DirectionalLight("#ffffff", 2.4);
    key.position.set(3, 8, 5);
    scene.add(key);
    const orangeLight = new THREE.PointLight("#ff8a00", 28, 12);
    orangeLight.position.set(-3, 2, 2);
    scene.add(orangeLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(8.5, 80),
      new THREE.MeshStandardMaterial({ color: "#0b2c50", roughness: 0.82, metalness: 0.12 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.24;
    scene.add(floor);

    const grid = new THREE.GridHelper(16, 32, "#27517a", "#173b60");
    grid.position.y = -0.22;
    scene.add(grid);

    const route = new THREE.CatmullRomCurve3(points);
    const road = new THREE.Mesh(
      new THREE.TubeGeometry(route, 120, 0.075, 8, false),
      new THREE.MeshStandardMaterial({ color: "#ff9a18", emissive: "#a74400", emissiveIntensity: 0.7, roughness: 0.35 }),
    );
    scene.add(road);

    const nodes: THREE.Group[] = [];
    const colors = ["#ffbd18", "#ff6a00", "#f6f8ff", "#ff7b22", "#ffbd18"];
    const labels = ["CUSTOMER", "MERCHANT", "DISPATCH", "RIDER", "DELIVERED"];
    points.forEach((point, index) => {
      const group = new THREE.Group();
      group.position.copy(point);
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 32, 24),
        new THREE.MeshStandardMaterial({ color: colors[index], emissive: colors[index], emissiveIntensity: 0.35, metalness: 0.35, roughness: 0.24 }),
      );
      group.add(sphere);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.53, 0.025, 8, 48),
        new THREE.MeshBasicMaterial({ color: colors[index], transparent: true, opacity: 0.8 }),
      );
      halo.rotation.x = Math.PI / 2;
      group.add(halo);
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.6, 8),
        new THREE.MeshBasicMaterial({ color: "#b7d4f2" }),
      );
      stem.position.y = -0.48;
      group.add(stem);
      scene.add(group);
      nodes.push(group);

      const spriteCanvas = document.createElement("canvas");
      spriteCanvas.width = 512;
      spriteCanvas.height = 128;
      const ctx = spriteCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#eaf4ff";
        ctx.font = "bold 34px Arial";
        ctx.textAlign = "center";
        ctx.fillText(labels[index], 256, 78);
      }
      const texture = new THREE.CanvasTexture(spriteCanvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
      sprite.scale.set(2.1, 0.52, 1);
      sprite.position.set(point.x, point.y + 0.95, point.z);
      scene.add(sprite);
    });

    const courier = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.3, 0.72),
      new THREE.MeshStandardMaterial({ color: "#ff8a00", metalness: 0.35, roughness: 0.28 }),
    );
    body.position.y = 0.22;
    courier.add(body);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.2, 0.32),
      new THREE.MeshStandardMaterial({ color: "#f4f7fb", roughness: 0.25 }),
    );
    top.position.set(0, 0.46, -0.02);
    courier.add(top);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: "#101c2d", roughness: 0.8 });
    [-0.23, 0.23].forEach((x) => {
      [-0.24, 0.24].forEach((z) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.07, 18), wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.12, z);
        courier.add(wheel);
      });
    });
    scene.add(courier);

    const stars = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 180 }, () => new THREE.Vector3((Math.random() - 0.5) * 22, Math.random() * 7 + 1, (Math.random() - 0.5) * 18))),
      new THREE.PointsMaterial({ color: "#a8c9ed", size: 0.025, transparent: true, opacity: 0.6 }),
    );
    scene.add(stars);

    let frame = 0;
    let animationId = 0;
    let width = 0;
    let height = 0;
    const resize = () => {
      const rect = mount.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      frame += 0.008;
      nodes.forEach((node, index) => {
        node.position.y = points[index].y + Math.sin(frame * 1.5 + index) * 0.08;
        node.rotation.y += 0.003;
      });
      const progress = (frame * 0.11) % 1;
      courier.position.copy(route.getPointAt(progress));
      const tangent = route.getTangentAt(progress);
      courier.rotation.y = Math.atan2(tangent.x, tangent.z);
      scene.rotation.y = Math.sin(frame * 0.16) * 0.045;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material.dispose();
        } else if (object instanceof THREE.Sprite) {
          object.material.map?.dispose();
          object.material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % stages.length), 6500);
    return () => window.clearInterval(timer);
  }, [playing]);

  const stage = stages[active];

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}><span className={styles.brandMark}>S</span><span>SUGOMATE <small>IMONG SUGO, AMONG IHATOD.</small></span></Link>
        <span className={styles.topLabel}>THE DELIVERY NETWORK, IN MOTION</span>
      </header>

      <section className={styles.hero}>
        <div className={styles.intro}>
          <span className={styles.eyebrow}>ONE CONNECTED LOCAL-COMMERCE SYSTEM</span>
          <h1>From your <em>order</em><br />to your doorstep.</h1>
          <p>See how customers, local merchants, delivery partners and the SUGOMATE control room work together to complete every order.</p>
          <div className={styles.introTags}><span>Customer</span><b>→</b><span>Merchant</span><b>→</b><span>Rider</span><b>→</b><span>Fulfillment</span></div>
        </div>
        <div className={styles.sceneWrap}>
          <div className={styles.sceneHud}><span><i /> LIVE SYSTEM OVERVIEW</span><span>3D NETWORK MODEL</span></div>
          <div className={styles.scene} ref={mountRef} aria-label="Animated three-dimensional SUGOMATE order and delivery network" />
          <div className={styles.sceneFoot}><span>LOCAL STORES</span><span>CONNECTED BY SUGOMATE</span><span>LAST-MILE DELIVERY</span></div>
        </div>
      </section>

      <section className={styles.workflow}>
        <div className={styles.workflowHeading}>
          <div><span className={styles.eyebrow}>THE ORDER JOURNEY</span><h2>One order. A coordinated team.</h2></div>
          <div className={styles.controls}>
            <button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play"} <span>{playing ? "Ⅱ" : "▶"}</span></button>
            <button type="button" onClick={() => { setActive(0); setPlaying(false); }}>Restart ↺</button>
          </div>
        </div>
        <div className={styles.progress}><span style={{ width: `${((active + 1) / stages.length) * 100}%` }} /></div>
        <div className={styles.stageLayout}>
          <div className={styles.stageList}>
            {stages.map((item, index) => (
              <button type="button" key={item.actor} onClick={() => { setActive(index); setPlaying(false); }} className={index === active ? styles.stageActive : styles.stageButton}>
                <span className={styles.stageIndex}>{String(index + 1).padStart(2, "0")}</span><span><strong>{item.title}</strong><small>{item.actor}</small></span><b>›</b>
              </button>
            ))}
          </div>
          <article className={styles.stageDetail}>
            <span className={styles.stageKicker}>STEP {String(active + 1).padStart(2, "0")} / 06 · {stage.actor}</span>
            <h3>{stage.title}</h3>
            <p>{stage.copy}</p>
            <div className={styles.detailPill}>{stage.detail}</div>
            <div className={styles.stageNav}><button type="button" onClick={() => setActive((active + stages.length - 1) % stages.length)}>← Previous</button><button type="button" onClick={() => setActive((active + 1) % stages.length)}>Next step →</button></div>
          </article>
        </div>
      </section>

      <section className={styles.guardrails}>
        <div><span className={styles.eyebrow}>BUILT FOR TRUST</span><h2>Every handoff has a clear owner.</h2><p>Role-based workspaces keep each participant focused on their responsibility, while operations has visibility across the network.</p></div>
        <div className={styles.guardrailGrid}>
          <div><strong>01</strong><b>Verified partners</b><span>Merchant and rider applications are reviewed before activation.</span></div>
          <div><strong>02</strong><b>Controlled dispatch</b><span>Ready orders are assigned to approved, online delivery partners.</span></div>
          <div><strong>03</strong><b>Proof of delivery</b><span>Completion includes a recorded photo proof for the order.</span></div>
          <div><strong>04</strong><b>Admin oversight</b><span>Order activity, service zones and administrative actions remain reviewable.</span></div>
        </div>
      </section>

      <footer className={styles.footer}><div className={styles.footerBrand}>SUGOMATE</div><p>Imong sugo, among ihatod.</p><span>A connected local delivery network for communities.</span></footer>
    </main>
  );
}
