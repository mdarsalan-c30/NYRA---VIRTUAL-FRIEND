import React, { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Float, MeshDistortMaterial, MeshWobbleMaterial } from '@react-three/drei';
import * as THREE from 'three';

// --- Custom Digital AI Entity ---
const DigitalEntity = ({ isSpeaking, isListening, isThinking }) => {
    const headRef = useRef();
    const mouthRef = useRef();
    const leftEyeRef = useRef();
    const rightEyeRef = useRef();

    // Status-based colors
    const primaryColor = isListening ? '#10b981' : isSpeaking ? '#8b5cf6' : isThinking ? '#6366f1' : '#6366f1';
    const emissiveInt = isSpeaking ? 1.5 : isListening ? 2 : 0.8;

    useFrame((state) => {
        const time = state.clock.getElapsedTime();

        // 1. Subtle Head Sway
        if (headRef.current) {
            headRef.current.rotation.y = Math.sin(time * 0.5) * 0.1;
            headRef.current.rotation.x = Math.cos(time * 0.3) * 0.05;
        }

        // 2. Blinking Logic
        const blink = (Math.sin(time * 0.5) > 0.98 || (time % 4 < 0.1)) ? 0 : 1;
        if (leftEyeRef.current) leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, blink, 0.2);
        if (rightEyeRef.current) rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, blink, 0.2);

        // 3. Lip Sync (Mouth Morphs)
        if (mouthRef.current) {
            const mouthScale = isSpeaking ? (0.2 + Math.abs(Math.sin(time * 20)) * 1.5) : 0.1;
            mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, mouthScale, 0.3);
            mouthRef.current.scale.x = isSpeaking ? (1 + Math.sin(time * 10) * 0.2) : 1;
        }
    });

    return (
        <group position={[0, 0, 0]}>
            {/* The Head - Crystalline Digital Sphere */}
            <mesh ref={headRef} position={[0, 0, 0]}>
                <sphereGeometry args={[1, 64, 64]} />
                <MeshDistortMaterial
                    color={primaryColor}
                    envMapIntensity={1}
                    clearcoat={1}
                    clearcoatRoughness={0}
                    metalness={0.9}
                    roughness={0.1}
                    distort={0.2}
                    speed={2}
                />
            </mesh>

            {/* Eyes - Emissive Digital Orbs */}
            <mesh ref={leftEyeRef} position={[-0.35, 0.2, 0.85]}>
                <sphereGeometry args={[0.08, 32, 32]} />
                <meshStandardMaterial color="white" emissive={primaryColor} emissiveIntensity={emissiveInt} />
            </mesh>
            <mesh ref={rightEyeRef} position={[0.35, 0.2, 0.85]}>
                <sphereGeometry args={[0.08, 32, 32]} />
                <meshStandardMaterial color="white" emissive={primaryColor} emissiveIntensity={emissiveInt} />
            </mesh>

            {/* Mouth - Responsive Sound Wave Viseme */}
            <mesh ref={mouthRef} position={[0, -0.4, 0.9]}>
                <capsuleGeometry args={[0.03, 0.3, 4, 16]} />
                <meshStandardMaterial color="white" emissive={primaryColor} emissiveIntensity={emissiveInt * 2} />
            </mesh>

            {/* Neck / Torso Base */}
            <mesh position={[0, -1.8, -0.2]}>
                <cylinderGeometry args={[0.4, 0.8, 2, 32]} />
                <meshStandardMaterial
                    color="#0a0a0f"
                    transparent
                    opacity={0.8}
                    roughness={0}
                    metalness={1}
                />
            </mesh>

            {/* Floating Particles/Data Halo */}
            <Float speed={2} rotationIntensity={1} floatIntensity={1}>
                <mesh position={[0, 0, -1]} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[1.5, 0.01, 16, 100]} />
                    <meshStandardMaterial color={primaryColor} emissive={primaryColor} emissiveIntensity={0.5} transparent opacity={0.3} />
                </mesh>
            </Float>
        </group>
    );
};

// --- Portrait Camera Setup ---
const Rig = ({ isFullScreen }) => {
    const { camera, mouse } = useThree();
    useFrame(() => {
        // Subtle camera follow
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, mouse.x * 0.1, 0.05);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, mouse.y * 0.1, 0.05);
        camera.lookAt(0, 0.2, 0);
    });
    return null;
};

const NiraAvatar = ({ isSpeaking = false, isListening = false, isThinking = false, isFullScreen = false }) => {
    const statusColor = isListening ? '#10b981' : isSpeaking ? '#8b5cf6' : '#6366f1';

    return (
        <div style={{
            width: '100%', height: isFullScreen ? '100vh' : '400px',
            position: isFullScreen ? 'fixed' : 'relative',
            background: 'radial-gradient(circle at center, #0f0c29, #0a0a25, #000000)',
            transition: 'all 0.5s'
        }}>
            <Canvas
                shadows
                camera={{ position: [0, 0.2, 2.8], fov: 35 }} // Tight Face/Chest focus
                gl={{ antialias: true }}
            >
                <color attach="background" args={['#010103']} />
                <fog attach="fog" args={['#010103', 5, 10]} />

                <ambientLight intensity={0.2} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} castShadow />
                <pointLight position={[-2, 2, 2]} intensity={1} color={statusColor} />

                <Suspense fallback={null}>
                    <group position={[0, -0.2, 0]} scale={1.2}>
                        <DigitalEntity
                            isSpeaking={isSpeaking}
                            isListening={isListening}
                            isThinking={isThinking}
                        />
                    </group>
                    <Environment preset="night" />
                    <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={10} blur={2} far={1} />
                </Suspense>

                <Rig isFullScreen={isFullScreen} />
                {!isFullScreen && <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 1.5} minPolarAngle={Math.PI / 3} />}
            </Canvas>

            {/* Glowing Status Ring UI */}
            <div style={{
                position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
                textAlign: 'center', pointerEvents: 'none'
            }}>
                <div style={{
                    width: '100px', height: '100px', borderRadius: '50%',
                    border: `2px solid ${statusColor}`,
                    boxShadow: `0 0 30px ${statusColor}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: isSpeaking || isListening ? 'pulse 2s infinite' : 'none'
                }}>
                    <span style={{ color: 'white', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>
                        {isListening ? 'Alive' : isThinking ? 'Thinking' : 'NIRA'}
                    </span>
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 0.8; }
                    50% { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(1); opacity: 0.8; }
                }
            `}</style>
        </div>
    );
};

export default NiraAvatar;
