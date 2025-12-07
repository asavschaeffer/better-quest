import React, { useRef, Suspense } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { Canvas, useFrame } from "@react-three/fiber";

// Simple cylinder body with googly eyes
function CylinderAvatar({ accessories = [], lookAtChart = false, pose = "idle" }) {
  const groupRef = useRef();

  // Gentle idle animation - slight bobbing and rotation
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.05;
    }
  });

  const hasWand = accessories.includes("wand");
  const hasPopeHat = accessories.includes("popeHat");
  const hasCrown = accessories.includes("crown");
  const hasWizardHat = accessories.includes("wizardHat");
  const lookRightOffset = lookAtChart ? 0.05 : 0;
  const serene = pose === "serene";
  const flex = pose === "flex";

  return (
    <group ref={groupRef}>
      {/* Body - cylinder */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.65, 1.9, 32]} />
        <meshStandardMaterial color="#6366f1" />
      </mesh>

      {/* Left eye - white */}
      <mesh position={[-0.2, 0.55, 0.45]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* Left pupil - black */}
      <mesh position={[-0.2 + lookRightOffset, 0.55, 0.58]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color="#000000" />
      </mesh>

      {/* Right eye - white */}
      <mesh position={[0.2, 0.55, 0.45]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* Right pupil - black */}
      <mesh position={[0.2 + lookRightOffset, 0.55, 0.58]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color="#000000" />
      </mesh>

      {/* 3D smile: a short torus arc that protrudes slightly */}
      <mesh position={[0, serene ? 0.15 : 0.12, 0.6]} rotation={[serene ? 0.18 : 0.25, 0, Math.PI]}>
        <torusGeometry args={[0.16, serene ? 0.035 : 0.04, 16, 28, Math.PI * 0.9]} />
        <meshStandardMaterial color={serene ? "#1e293b" : "#0f172a"} metalness={0.1} roughness={0.4} />
      </mesh>

      {/* Simple arms */}
      <group position={[-0.65, 0.05, 0]}>
        <mesh rotation={[0, 0, flex ? 0.3 : 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.7, 12]} />
          <meshStandardMaterial color="#4f46e5" />
        </mesh>
      </group>
      <group position={[0.65, 0.05, 0]}>
        <mesh rotation={[flex ? -1.0 : 0, 0, flex ? -0.4 : 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.7, 12]} />
          <meshStandardMaterial color="#4f46e5" />
        </mesh>
      </group>

      {/* ACCESSORIES */}

      {/* Wizard Hat */}
      {hasWizardHat && (
        <group position={[0, 1.3, 0]}>
          {/* Hat cone */}
          <mesh>
            <coneGeometry args={[0.4, 0.8, 32]} />
            <meshStandardMaterial color="#4f46e5" />
          </mesh>
          {/* Hat brim */}
          <mesh position={[0, -0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.5, 0.08, 8, 32]} />
            <meshStandardMaterial color="#4f46e5" />
          </mesh>
          {/* Star on hat */}
          <mesh position={[0, 0.2, 0.25]}>
            <octahedronGeometry args={[0.1]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.5} />
          </mesh>
        </group>
      )}

      {/* Pope Hat / Mitre */}
      {hasPopeHat && (
        <group position={[0, 1.45, 0]}>
          {/* Main mitre shape - two cones */}
          <mesh position={[-0.15, 0, 0]} rotation={[0, 0, -0.2]}>
            <coneGeometry args={[0.2, 0.6, 4]} />
            <meshStandardMaterial color="#f9fafb" />
          </mesh>
          <mesh position={[0.15, 0, 0]} rotation={[0, 0, 0.2]}>
            <coneGeometry args={[0.2, 0.6, 4]} />
            <meshStandardMaterial color="#f9fafb" />
          </mesh>
          {/* Gold band */}
          <mesh position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.1, 32]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      )}

      {/* Crown */}
      {hasCrown && (
        <group position={[0, 1.15, 0]}>
          {/* Crown base */}
          <mesh>
            <cylinderGeometry args={[0.45, 0.5, 0.2, 32]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Crown points */}
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh
              key={i}
              position={[
                Math.sin((i / 5) * Math.PI * 2) * 0.4,
                0.25,
                Math.cos((i / 5) * Math.PI * 2) * 0.4,
              ]}
            >
              <coneGeometry args={[0.08, 0.3, 8]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
            </mesh>
          ))}
          {/* Jewel */}
          <mesh position={[0, 0, 0.45]}>
            <octahedronGeometry args={[0.08]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} />
          </mesh>
        </group>
      )}

      {/* Magic Wand - moved to the other hand (left side) */}
      {hasWand && (
        <group position={[-0.7, 0.2, 0.3]} rotation={[0.3, 0, -0.5]}>
          {/* Wand stick */}
          <mesh>
            <cylinderGeometry args={[0.03, 0.05, 0.8, 8]} />
            <meshStandardMaterial color="#8b4513" />
          </mesh>
          {/* Wand star tip */}
          <mesh position={[0, 0.45, 0]}>
            <octahedronGeometry args={[0.1]} />
            <meshStandardMaterial
              color="#fbbf24"
              emissive="#fbbf24"
              emissiveIntensity={0.8}
            />
          </mesh>
          {/* Sparkle particles */}
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              position={[
                Math.sin(i * 2) * 0.15,
                0.5 + i * 0.1,
                Math.cos(i * 2) * 0.15,
              ]}
            >
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive="#fbbf24"
                emissiveIntensity={1}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

// Pedestal / platform
function Pedestal() {
  return (
    <mesh position={[0, -1, 0]} rotation={[0, 0, 0]}>
      <cylinderGeometry args={[0.8, 1, 0.2, 32]} />
      <meshStandardMaterial color="#1f2937" />
    </mesh>
  );
}

// Main 3D Avatar component
export function Avatar3D({ size = 200, accessories = [], lookAtChart = false, pose = "idle" }) {
  // For web, we use the canvas directly
  // For native, expo-gl handles the context

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Canvas
        camera={{ position: [0, 0.5, 3.5], fov: 50 }}
        style={styles.canvas}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <directionalLight position={[-3, 2, -2]} intensity={0.3} color="#a5b4fc" />

        <Suspense fallback={null}>
          <CylinderAvatar accessories={accessories} lookAtChart={lookAtChart} pose={pose} />
          <Pedestal />
        </Suspense>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 12,
  },
  canvas: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
