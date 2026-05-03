'use client';

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MathUtils, Color } from 'three';
import * as THREE from 'three';

const vertexShader = /* glsl */ `
uniform float u_intensity;
uniform float u_time;

varying vec2 vUv;
varying float vDisplacement;

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
vec3 fade(vec3 t){return t*t*t*(t*(t*6.0-15.0)+10.0);}

float cnoise(vec3 P){
    vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0);
    Pi0 = mod(Pi0, 289.0); Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0);
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz;
    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);
    vec4 gx0 = ixy0 / 7.0;
    vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);
    vec4 gx1 = ixy1 / 7.0;
    vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);
    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);
    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
}

void main() {
    vUv = uv;
    vDisplacement = cnoise(position + vec3(2.0 * u_time));
    vec3 newPosition = position + normal * (u_intensity * vDisplacement);
    vec4 modelPosition = modelMatrix * vec4(newPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;
}
`;

const fragmentShader = /* glsl */ `
uniform float u_intensity;
uniform float u_time;
uniform vec3 u_color;
uniform vec3 u_hot;
uniform float u_alpha;

varying vec2 vUv;
varying float vDisplacement;

void main() {
    float distort = 2.0 * vDisplacement * u_intensity * sin(vUv.y * 10.0 + u_time);
    vec3 base = mix(u_color, u_hot, smoothstep(-0.4, 0.6, distort));
    vec3 color = mix(base, vec3(1.0), clamp(distort * 0.6, 0.0, 1.0));
    gl_FragColor = vec4(color, u_alpha);
}
`;

interface BlobProps {
  /** 0..1 — how "complete" the taar is. Drives distortion, color, and wireframe→solid morph. */
  progress: number;
}

const Blob: React.FC<BlobProps> = ({ progress }) => {
  const solidMesh = useRef<THREE.Mesh>(null);
  const wireMesh = useRef<THREE.Mesh>(null);

  // Cool "ghostly" color when unformed → warm accent (#ea580c) as it completes.
  const coldColor = useMemo(() => new Color('#1f2937'), []);
  const accentColor = useMemo(() => new Color('#ea580c'), []);
  const hotColor = useMemo(() => new Color('#f97316'), []);

  const solidUniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_intensity: { value: 0.9 },
      u_color: { value: new Color('#1f2937') },
      u_hot: { value: new Color('#f97316') },
      u_alpha: { value: 1 },
    }),
    []
  );
  const wireUniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_intensity: { value: 0.95 },
      u_color: { value: new Color('#ea580c') },
      u_hot: { value: new Color('#fde68a') },
      u_alpha: { value: 1 },
    }),
    []
  );

  useFrame((state) => {
    const { clock } = state;
    const t = clock.getElapsedTime();

    // High distortion when unformed, settling as progress → 1.
    const targetIntensity = MathUtils.lerp(0.9, 0.18, progress);
    // Wireframe overlay fades from fully visible → invisible as solid takes over.
    const targetWireIntensity = MathUtils.lerp(0.95, 0.0, progress);

    if (solidMesh.current) {
      const m = solidMesh.current.material as THREE.ShaderMaterial;
      m.uniforms.u_time.value = 0.4 * t;
      m.uniforms.u_intensity.value = MathUtils.lerp(
        m.uniforms.u_intensity.value,
        targetIntensity,
        0.04
      );
      // Lerp base color from cold → accent.
      (m.uniforms.u_color.value as Color).lerpColors(coldColor, accentColor, progress);
      (m.uniforms.u_hot.value as Color).lerpColors(hotColor, hotColor, 1);
      // Solid scale grows in a touch as it forms.
      const s = MathUtils.lerp(0.95, 1.2, progress);
      solidMesh.current.scale.setScalar(s);
      solidMesh.current.rotation.x = t * 0.15;
      solidMesh.current.rotation.y = t * 0.2;
    }

    if (wireMesh.current) {
      const m = wireMesh.current.material as THREE.ShaderMaterial;
      m.uniforms.u_time.value = 0.5 * t;
      m.uniforms.u_intensity.value = MathUtils.lerp(
        m.uniforms.u_intensity.value,
        targetWireIntensity,
        0.04
      );
      // Slightly larger wire shell, also rotating opposite for depth.
      const s = MathUtils.lerp(1.3, 1.25, progress);
      wireMesh.current.scale.setScalar(s);
      wireMesh.current.rotation.x = -t * 0.1;
      wireMesh.current.rotation.y = -t * 0.15;
      // Fade overlay alpha by progress (via shader uniform — material.opacity doesn't apply to ShaderMaterial).
      m.uniforms.u_alpha.value = MathUtils.lerp(m.uniforms.u_alpha.value, 1 - progress, 0.06);
    }
  });

  return (
    <group>
      <mesh ref={solidMesh}>
        <icosahedronGeometry args={[1.6, 12]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={solidUniforms}
        />
      </mesh>
      <mesh ref={wireMesh}>
        <icosahedronGeometry args={[1.6, 6]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={wireUniforms}
          wireframe
          transparent
        />
      </mesh>
    </group>
  );
};

export interface ForgeBlobProps {
  /** 0..1 — overall completion. Drives morph from unformed mesh to solid taar. */
  progress: number;
  className?: string;
}

export function ForgeBlob({ progress, className }: ForgeBlobProps) {
  return (
    <div className={className ?? 'h-full w-full'}>
      <Canvas
        camera={{ position: [0, 0, 7.5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false,
        }}
        onCreated={({ gl }) => {
          // Recover gracefully if the browser drops our GL context (HMR, tab switch,
          // or another canvas exhausting the per-tab WebGL context budget).
          const canvas = gl.domElement;
          canvas.addEventListener(
            'webglcontextlost',
            (e) => {
              e.preventDefault();
            },
            false
          );
          canvas.addEventListener(
            'webglcontextrestored',
            () => {
              gl.forceContextRestore?.();
            },
            false
          );
        }}
      >
        <Blob progress={progress} />
      </Canvas>
    </div>
  );
}

export default ForgeBlob;
