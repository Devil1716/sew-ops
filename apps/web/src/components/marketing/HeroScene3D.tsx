"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Procedural "thread through a needle" hero scene using native Three.js.
 * 100% compatible with React 19 (bypasses fiber reconciler / ReactCurrentOwner incompatibilities).
 *   - Needle: capillary cylinder with an elongated eye and tapered tip.
 *   - Thread: parametric curve that waves gently; scroll drives its draw ratio.
 *   - Stitch line: dashed line continuing down the page.
 *   - Interactive mouse parallax & scroll response.
 */
export function HeroScene3D({ scrollProgress = 0 }: { scrollProgress?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(scrollProgress);
  scrollRef.current = scrollProgress;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.5);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(3, 4, 2);
    scene.add(dirLight);

    // Group
    const group = new THREE.Group();
    scene.add(group);

    // Needle Materials
    const needleMat = new THREE.MeshStandardMaterial({
      color: "#D7D3CC",
      metalness: 0.9,
      roughness: 0.3,
    });
    const needleEyeMat = new THREE.MeshStandardMaterial({
      color: "#B5B1A8",
      metalness: 0.9,
      roughness: 0.3,
    });

    // Needle shaft
    const shaftGeo = new THREE.CylinderGeometry(0.03, 0.06, 1.4, 24);
    const shaft = new THREE.Mesh(shaftGeo, needleMat);
    shaft.position.set(-2.2, 0, 0);
    shaft.rotation.set(0, 0, Math.PI / 2);
    group.add(shaft);

    // Needle eye
    const eyeGeo = new THREE.TorusGeometry(0.08, 0.015, 16, 48);
    const eye = new THREE.Mesh(eyeGeo, needleEyeMat);
    eye.position.set(-2.85, 0, 0);
    group.add(eye);

    // Needle tip
    const tipGeo = new THREE.ConeGeometry(0.03, 0.25, 24);
    const tip = new THREE.Mesh(tipGeo, needleMat);
    tip.position.set(-1.5, 0, 0);
    tip.rotation.set(0, 0, -Math.PI / 2);
    group.add(tip);

    // Thread points & line
    const pointCount = 200;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= pointCount; i++) {
      const t = i / pointCount;
      pts.push(new THREE.Vector3(-2 + t * 4, Math.sin(t * Math.PI * 2) * 0.15, 0));
    }

    const threadGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const threadMat = new THREE.LineDashedMaterial({
      color: new THREE.Color("#FF5A1F"),
      dashSize: 0.1,
      gapSize: 0.05,
      linewidth: 2,
    });

    const threadLine = new THREE.Line(threadGeo, threadMat);
    threadLine.computeLineDistances();
    group.add(threadLine);

    // Orange stitch beads
    const sphereGeo = new THREE.SphereGeometry(0.02, 12, 12);
    const sphereMat = new THREE.MeshBasicMaterial({ color: "#FF5A1F" });
    const spheres: THREE.Mesh[] = [];
    pts.filter((_, i) => i % 20 === 0).forEach((p) => {
      const sp = new THREE.Mesh(sphereGeo, sphereMat);
      sp.position.copy(p);
      group.add(sp);
      spheres.push(sp);
    });

    // Mouse Parallax
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const handleMouseMove = (e: MouseEvent) => {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      mouse.targetX = (e.clientX - halfW) / halfW;
      mouse.targetY = (e.clientY - halfH) / halfH;
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Resize observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const t = clock.getElapsedTime();

      // Mouse lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, mouse.x * 0.3, 0.05);
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, -mouse.y * 0.2, 0.05);

      // Thread shimmer
      const positions = threadGeo.attributes.position.array as Float32Array;
      for (let i = 0; i <= pointCount; i++) {
        const u = i / pointCount;
        positions[i * 3 + 1] = Math.sin(u * Math.PI * 2 + t * 0.6) * 0.15;
      }
      threadGeo.attributes.position.needsUpdate = true;

      // Scroll progress stitch adjustment
      const visible = Math.max(0.05, scrollRef.current);
      threadMat.gapSize = Math.max(0.01, 0.3 * (1 - visible));
      threadLine.computeLineDistances();

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      resizeObserver.disconnect();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      renderer.dispose();
      shaftGeo.dispose();
      eyeGeo.dispose();
      tipGeo.dispose();
      threadGeo.dispose();
      sphereGeo.dispose();
      needleMat.dispose();
      needleEyeMat.dispose();
      threadMat.dispose();
      sphereMat.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full pointer-events-none" />
  );
}
