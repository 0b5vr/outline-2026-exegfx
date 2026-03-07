/* framework header */
#version 430
layout(location = 0) out vec4 fragColor;
layout(location = 0) uniform vec4 iResolution;
layout(location = 1) uniform int iFrame;




/* vvv your shader goes here vvv */

const float MTL_WALL = 1.0;
const float MTL_SIGN = 2.0;
const float MTL_AD = 3.0;
const float MTL_EXIT_SIGN = 4.0;
const float MTL_CHROME_SPHERE = 5.0;
const float MTL_TRANSMISSION = 6.0;

const float PI = acos(-1.0);
const float TAU = PI + PI;
const float FAR = 30.0;

const int SAMPLES_PER_FRAME = 10;
const int PATH_ITER = 8;
const int MARCH_ITER = 30;

#define saturate(x) clamp(x, 0.0, 1.0)
#define linearstep(a, b, x) min(max(((x) - (a)) / ((b) - (a)), 0.0), 1.0)

// #define DEBUG_NORMAL

// == common =======================================================================================
uvec3 seed;

// https://www.shadertoy.com/view/XlXcW4
vec3 hash3f(vec3 s) {
  uvec3 r = floatBitsToUint(s);
  r = ((r >> 16u) ^ r.yzx) * 1111111111u;
  r = ((r >> 16u) ^ r.yzx) * 1111111111u;
  r = ((r >> 16u) ^ r.yzx) * 1111111111u;
  return vec3(r) / float(-1u);
}

vec2 cis(float t) {
  return vec2(cos(t), sin(t));
}

mat2 rotate2D(float t) {
  return mat2(cos(t), -sin(t), sin(t), cos(t));
}

float i_safeDot(vec3 a, vec3 b) {
  return clamp(dot(a, b), 0.0, 1.0);
}

mat3 orthBas(vec3 z) {
  z = normalize(z);
  vec3 up = abs(z.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
  vec3 x = normalize(cross(up, z));
  return mat3(x, cross(z, x), z);
}

// == noise ========================================================================================

vec3 perlin23(vec2 p) {
  vec2 cell = floor(p);
  vec2 t = fract(p);
  vec2 ts = (t * t * t * (t * (t * 6.0 - 15.0) + 10.0));

  vec2 v;
  vec3 dice;
  vec3 sum = vec3(0);
  int i = 0;

  v = vec2(ivec2(i++) >> ivec2(0, 1) & 1);
  dice = TAU * hash3f(mod((cell + v).xxy, 256.0));
  sum += mix(1.0 - ts, ts, v).x * mix(1.0 - ts, ts, v).y * (t - v).xxy * mat3(vec3(0, cis(dice.x)), vec3(0, cis(dice.y)), vec3(0, cis(dice.z)));
  v = vec2(ivec2(i++) >> ivec2(0, 1) & 1);
  dice = TAU * hash3f(mod((cell + v).xxy, 256.0));
  sum += mix(1.0 - ts, ts, v).x * mix(1.0 - ts, ts, v).y * (t - v).xxy * mat3(vec3(0, cis(dice.x)), vec3(0, cis(dice.y)), vec3(0, cis(dice.z)));
  v = vec2(ivec2(i++) >> ivec2(0, 1) & 1);
  dice = TAU * hash3f(mod((cell + v).xxy, 256.0));
  sum += mix(1.0 - ts, ts, v).x * mix(1.0 - ts, ts, v).y * (t - v).xxy * mat3(vec3(0, cis(dice.x)), vec3(0, cis(dice.y)), vec3(0, cis(dice.z)));
  v = vec2(ivec2(i++) >> ivec2(0, 1) & 1);
  dice = TAU * hash3f(mod((cell + v).xxy, 256.0));
  sum += mix(1.0 - ts, ts, v).x * mix(1.0 - ts, ts, v).y * (t - v).xxy * mat3(vec3(0, cis(dice.x)), vec3(0, cis(dice.y)), vec3(0, cis(dice.z)));

  return sum;
}

// Ref: https://suricrasia.online/blog/shader-functions/
vec3 i_uniformSphereBlackle(vec3 xi) {
  return normalize(tan(xi * 2.0 - 1.0));
}

vec3 perlin33(vec3 p) {
  vec3 cell = floor(p);
  vec3 t = fract(p);
  vec3 ts = (t * t * t * (t * (t * 6.0 - 15.0) + 10.0));

  vec3 v;
  vec3 dice;
  vec3 sum = vec3(0);
  int i = 0;

  v = vec3(ivec3(i++) >> ivec3(0, 1, 2) & 1);
  dice = mod(cell + v, 256.0);
  sum += mix(1.0 - ts, ts, v).x * mix(1.0 - ts, ts, v).y * mix(1.0 - ts, ts, v).z * (t - v) * mat3(i_uniformSphereBlackle(dice = hash3f(dice)), i_uniformSphereBlackle(dice = hash3f(dice)), i_uniformSphereBlackle(dice = hash3f(dice)));
  v = vec3(ivec3(i++) >> ivec3(0, 1, 2) & 1);
  dice = mod(cell + v, 256.0);
  sum += mix(1.0 - ts, ts, v).x * mix(1.0 - ts, ts, v).y * mix(1.0 - ts, ts, v).z * (t - v) * mat3(i_uniformSphereBlackle(dice = hash3f(dice)), i_uniformSphereBlackle(dice = hash3f(dice)), i_uniformSphereBlackle(dice = hash3f(dice)));
  v = vec3(ivec3(i++) >> ivec3(0, 1, 2) & 1);
  dice = mod(cell + v, 256.0);
  sum += mix(1.0 - ts, ts, v).x * mix(1.0 - ts, ts, v).y * mix(1.0 - ts, ts, v).z * (t - v) * mat3(i_uniformSphereBlackle(dice = hash3f(dice)), i_uniformSphereBlackle(dice = hash3f(dice)), i_uniformSphereBlackle(dice = hash3f(dice)));
  v = vec3(ivec3(i++) >> ivec3(0, 1, 2) & 1);
  dice = mod(cell + v, 256.0);
  sum += mix(1.0 - ts, ts, v).x * mix(1.0 - ts, ts, v).y * mix(1.0 - ts, ts, v).z * (t - v) * mat3(i_uniformSphereBlackle(dice = hash3f(dice)), i_uniformSphereBlackle(dice = hash3f(dice)), i_uniformSphereBlackle(dice = hash3f(dice)));
  v = vec3(ivec3(i++) >> ivec3(0, 1, 2) & 1);
  dice = mod(cell + v, 256.0);
  sum += mix(1.0 - ts, ts, v).x * mix(1.0 - ts, ts, v).y * mix(1.0 - ts, ts, v).z * (t - v) * mat3(i_uniformSphereBlackle(dice = hash3f(dice)), i_uniformSphereBlackle(dice = hash3f(dice)), i_uniformSphereBlackle(dice = hash3f(dice)));
  v = vec3(ivec3(i++) >> ivec3(0, 1, 2) & 1);
  dice = mod(cell + v, 256.0);
  sum += mix(1.0 - ts, ts, v).x * mix(1.0 - ts, ts, v).y * mix(1.0 - ts, ts, v).z * (t - v) * mat3(i_uniformSphereBlackle(dice = hash3f(dice)), i_uniformSphereBlackle(dice = hash3f(dice)), i_uniformSphereBlackle(dice = hash3f(dice)));
  v = vec3(ivec3(i++) >> ivec3(0, 1, 2) & 1);
  dice = mod(cell + v, 256.0);
  sum += mix(1.0 - ts, ts, v).x * mix(1.0 - ts, ts, v).y * mix(1.0 - ts, ts, v).z * (t - v) * mat3(i_uniformSphereBlackle(dice = hash3f(dice)), i_uniformSphereBlackle(dice = hash3f(dice)), i_uniformSphereBlackle(dice = hash3f(dice)));
  v = vec3(ivec3(i++) >> ivec3(0, 1, 2) & 1);
  dice = mod(cell + v, 256.0);
  sum += mix(1.0 - ts, ts, v).x * mix(1.0 - ts, ts, v).y * mix(1.0 - ts, ts, v).z * (t - v) * mat3(i_uniformSphereBlackle(dice = hash3f(dice)), i_uniformSphereBlackle(dice = hash3f(dice)), i_uniformSphereBlackle(dice = hash3f(dice)));

  return sum;
}

vec3 cyclicNoise(vec3 p, float pers) {
  vec4 sum = vec4(0.0);

  for (int i = 0; i ++ < 4;) {
    p *= orthBas(vec3(-1.0, 2.0, -3.0));
    p += sin(p.yzx);
    sum = (sum + vec4(cross(sin(p.zxy), cos(p)), 1.0)) / pers;
    p *= 2.0;
  }

  return sum.xyz / sum.w;
}

// == sdfs =========================================================================================

// Ref: https://iquilezles.org/articles/distgradfunctions3d/
vec3 sdgbox2(vec2 p, vec2 s, float r) {
  vec2 d = abs(p) - s;
  float g = max(d.x, d.y);

  if (g > 0.0) {
    // outside
    vec2 q = max(d, 0.0);
    float l = length(q);
    return vec3(sign(p) * q / l, l - r);
  } else {
    // inside
    return vec3(sign(p) * step(vec2(g), d), g - r);
  }
}

// == isects =======================================================================================
vec4 isectPlane(vec3 ro, vec3 rd, vec3 n) {
  float t = -dot(ro, n) / dot(rd, n);
  return t < 0.0 ? vec4(FAR) : vec4(n, t);
}

vec4 isectBox(vec3 ro, vec3 rd, vec3 s) {
  vec3 xo = -ro / rd;
  vec3 xs = abs(s / rd);

  vec3 dfv = xo - xs;
  vec3 dbv = xo + xs;

  float df = max(max(dfv.x, dfv.y), dfv.z);
  float db = min(min(dbv.x, dbv.y), dbv.z);
  if (db < df) { return vec4(FAR); }

  if (df > 0.0) {
    return vec4(-sign(rd) * step(vec3(df), dfv), df);
  }

  if (db > 0.0) {
    return vec4(-sign(rd) * step(dbv, vec3(db)), db);
  }

  return vec4(FAR);
}

vec4 isectSphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;

  if (h < 0.0) { return vec4(FAR); }

  h = sqrt(h);
  float t = -b - h;
  if (t > 0.0) {
    return vec4(normalize(ro + rd * t), t);
  }

  t = -b + h;
  if (t > 0.0) {
    return vec4(-normalize(ro + rd * t), t);
  }

  return vec4(FAR);
}

vec4 isectCapsule(vec3 ro, vec3 rd, vec3 tail, float r) {
  float tt = dot(tail, tail);
  float td = dot(tail, rd);
  float ot = dot(ro, tail);
  float od = dot(ro, rd);
  float oo = dot(ro, ro);

  float a = tt - td * td;
  float b = tt * od - ot * td;
  float c = tt * oo - ot * ot - r * r * tt;
  float h = b * b - a * c;

  if (h < 0.0) { return vec4(FAR); }

  float t = (-b - sqrt(h)) / a;
  if (t < 0.0) { return vec4(FAR); }

  float y = clamp(ot + t * td, 0.0, tt);
  if (y > 0.0 && y < tt) {
    // you might delete this if the precision doesn't matter
    return vec4((ro + rd * t - y / tt * tail) / r, t);
  }
  return isectSphere(ro - clamp(y, 0.0, tt) / tt * tail, rd, r);
}

// == marcher ======================================================================================
float mapChrome(vec3 p) {
  p += 0.2 * cyclicNoise(2.0 * p, 0.5);
  return length(p) - 0.75;
}

// == main =========================================================================================
void main() {
  fragColor *= 0.0;

  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  vec2 p = (uv - 0.5);
  p.x *= iResolution.x / iResolution.y;

  vec3 seed = hash3f(vec3(p, iFrame));

  for (int i = 0; i ++ < SAMPLES_PER_FRAME;) {
    vec2 pt = (p + (seed = hash3f(seed)).xy / iResolution.y);
    vec3 ro = vec3(0.0, 1.6, 14.0);
    vec3 rd = normalize(vec3(pt, -4.0));
    vec3 rt = ro + rd * 13.0;
    ro += 0.01 * vec3(cis(TAU * (seed = hash3f(seed)).x) * sqrt(seed.y), 0.0);
    rd = normalize(rt - ro);

    vec3 beta = vec3(2.0 - length(p));

    for (int i = 0; i ++ < PATH_ITER;) {
      mat3 material;

      vec4 isect = vec4(FAR), isect2, isect3;

      // wall
      isect2 = isectPlane(ro - vec3(1, 0, 0), rd, vec3(-1, 0, 0));
      isect3 = isectPlane(ro - vec3(0, 0, -3), rd, vec3(0, 0, 1));
      isect2 = isect2.w < isect3.w ? isect2 : isect3;
      isect3 = isectBox(ro - vec3(-2.5, 0, 4), rd, vec3(1, 10, 1));
      isect2 = isect2.w < isect3.w ? isect2 : isect3;
      if (isect2.w < isect.w) {
        isect = isect2;
        material = mat3(MTL_WALL);
      }

      // floor
      isect2 = isectPlane(ro, rd, vec3(0, 1, 0));
      if (isect2.w < isect.w) {
        isect = isect2;
        material = mat3(MTL_WALL);
      }

      // ceil
      isect2 = isectPlane(ro - vec3(0, 3, 0), rd, vec3(0, -1, 0));
      if (isect2.w < isect.w) {
        isect = isect2;

        vec3 rp = ro + rd * isect.w;
        if (abs(rp.x + 0.5) < 1.0 && (abs(rp.z) < 0.2 || abs(rp.z - 12.0) < 0.2)) {
          // light
          material = mat3(
            vec3(0.3),
            vec3(4.0),
            vec3(0.04, 1.0, 0.0)
          );
        } else if (abs(rp.x + 0.5) < 1.03 && abs(rp.z) < 0.23) {
          // frame of light
          material = mat3(
            vec3(0.8),
            vec3(0.0),
            vec3(0.1, 1.0, 0.0)
          );
        } else {
          material = mat3(MTL_WALL);
        }
      }

      // camera i guess
      isect2 = isectSphere(ro - vec3(0.8, 3, -2), rd, 0.1);
      if (isect2.w < isect.w) {
        isect = isect2;
        material = mat3(
          vec3(0.2), // cringe
          vec3(0),
          vec3(0.04, 1, 0.0)
        );
      }

      // sign
      ro -= vec3(-1.4, 1.5, -3.0);
      isect2 = isectBox(ro, rd, vec3(0.6, 1.2, 0.1));
      if (isect2.w < isect.w) {
        isect = isect2;

        vec3 rp = ro + rd * isect.w;
        if (abs(rp.x) < 0.55 && abs(rp.y) < 1.15) {
          material = mat3(
            vec3(rp),
            vec3(0),
            vec3(MTL_SIGN)
          );
        } else {
          material = mat3(
            vec3(0.8),
            vec3(0.0),
            vec3(0.1, 1.0, 0.0)
          );
        }
      }
      ro += vec3(-1.4, 1.5, -3.0);

      // ad
      ro -= vec3(1, 1.8, 2.5);
      isect2 = isectBox(ro - vec3(0, 0, -1.8), rd, vec3(0.05, 0.6, 0.05));
      isect3 = isectBox(ro - vec3(0, 0, 1.8), rd, vec3(0.05, 0.6, 0.05));
      isect2 = isect2.w < isect3.w ? isect2 : isect3;
      isect3 = isectBox(ro - vec3(0, 0.6, 0), rd, vec3(0.05, 0.05, 1.85));
      isect2 = isect2.w < isect3.w ? isect2 : isect3;
      isect3 = isectBox(ro - vec3(0, -0.6, 0), rd, vec3(0.05, 0.05, 1.85));
      isect2 = isect2.w < isect3.w ? isect2 : isect3;
      if (isect2.w < isect.w) {
        isect = isect2;

        vec3 rp = ro + rd * isect.w;
        if (abs(rp.y) < 0.6 && abs(rp.z) < 1.8 && isect.x == 0.0) {
          material = mat3(
            vec3(0),
            vec3(1),
            vec3(0, 1, 0)
          );
        } else {
          material = mat3(
            vec3(0.8),
            vec3(0.0),
            vec3(0.1, 1.0, 0.0)
          );
        }
      }

      isect2 = isectBox(ro - vec3(-0.049, 0, 0), rd, vec3(0, 0.6, 1.8));
      if (isect2.w < isect.w) {
        isect = isect2;

        material = mat3(
          vec3(1.0),
          vec3(0.0),
          vec3(0.04, 0.0, MTL_TRANSMISSION)
        );
      }

      isect2 = isectBox(ro, rd, vec3(0.03, 0.6, 1.8));
      if (isect2.w < isect.w) {
        isect = isect2;

        vec3 rp = ro + rd * isect.w;
        material = mat3(
          vec3(rp),
          vec3(0),
          vec3(MTL_AD)
        );
      }
      ro += vec3(1, 1.8, 2.5);

      // exit
      ro -= vec3(-0.1, 2.7, 2.0);
      isect2 = isectBox(ro, rd, vec3(0.5, 0.2, 0.15));
      isect3 = isectCapsule(ro - vec3(-0.3, 0.0, 0.0), rd, vec3(0, 1, 0), 0.05);
      isect2 = isect2.w < isect3.w ? isect2 : isect3;
      isect3 = isectCapsule(ro - vec3(0.3, 0.0, 0.0), rd, vec3(0, 1, 0), 0.05);
      isect2 = isect2.w < isect3.w ? isect2 : isect3;
      if (isect2.w < isect.w) {
        isect = isect2;
        vec3 rp = ro + rd * isect.w;
        if (abs(rp.x) < 0.45 && abs(rp.y) < 0.15 && rp.z > 0.0) {
          material = mat3(
            vec3(rp * 4.0),
            vec3(0),
            vec3(MTL_EXIT_SIGN)
          );
        } else {
          material = mat3(
            vec3(0.1),
            vec3(0.0),
            vec3(0.1, 1.0, 0.0)
          );
        }
      }
      ro += vec3(-0.1, 2.7, 2.0);

      // pipe
      ro -= vec3(0.9, 0, 4);
      isect2 = isectCapsule(ro - vec3(0.0, 0.85, 0.0), rd, vec3(0, 0, 20), 0.02);
      isect3 = isectCapsule(ro - vec3(0.0, 0.85, 0.0), rd, vec3(1, 0, 0), 0.02);
      isect2 = isect2.w < isect3.w ? isect2 : isect3;
      isect3 = isectCapsule(ro - vec3(0.0, 0.8, 0.3), rd, vec3(2, -1, 0), 0.012);
      isect2 = isect2.w < isect3.w ? isect2 : isect3;
      isect3 = isectCapsule(ro - vec3(0.0, 0.8, 0.3), rd, vec3(0, 0.05, 0), 0.012);
      isect2 = isect2.w < isect3.w ? isect2 : isect3;
      isect3 = isectCapsule(ro - vec3(0.0, 0.65, 0.0), rd, vec3(0, 0, 20), 0.02);
      isect2 = isect2.w < isect3.w ? isect2 : isect3;
      isect3 = isectCapsule(ro - vec3(0.0, 0.65, 0.0), rd, vec3(1, 0, 0), 0.02);
      isect2 = isect2.w < isect3.w ? isect2 : isect3;
      isect3 = isectCapsule(ro - vec3(0.0, 0.6, 0.3), rd, vec3(2, -1, 0), 0.012);
      isect2 = isect2.w < isect3.w ? isect2 : isect3;
      isect3 = isectCapsule(ro - vec3(0.0, 0.6, 0.3), rd, vec3(0, 0.05, 0), 0.012);
      isect2 = isect2.w < isect3.w ? isect2 : isect3;
      if (isect2.w < isect.w) {
        isect = isect2;
        material = mat3(
          vec3(0.8),
          vec3(0.0),
          vec3(0.1, 1.0, 0.0)
        );
      }
      ro += vec3(0.9, 0, 4);

      // chrome sphere
      ro -= vec3(0.0, 1.6, -1.0);
      isect2 = isectSphere(ro, rd, 0.9);
      if (isect2.w < isect.w) {
        vec3 rp = ro;
        float dist;

        for (int i = 0; i ++ < MARCH_ITER;) {
          dist = 0.8 * mapChrome(rp);
          rp += dist * rd;
        }

        if (abs(dist) < 0.01) {
          vec2 d = vec2(0.0, 0.001);
          vec3 i_n = normalize(vec3(
            mapChrome(rp + d.yxx) - mapChrome(rp - d.yxx),
            mapChrome(rp + d.xyx) - mapChrome(rp - d.xyx),
            mapChrome(rp + d.xxy) - mapChrome(rp - d.xxy)
          ));
          float i_rl = length(ro - rp);
          isect = vec4(i_n, i_rl);
          material = mat3(
            vec3(0.6, 0.68, 0.7),
            vec3(0.0),
            vec3(0.02, 1.0, MTL_CHROME_SPHERE)
          );
        }
      }
      ro += vec3(0.0, 1.6, -1.0);

      // if the ray misses then
      if (isect.w > FAR - 1.0) {
        break;
      }

      vec3 rp = ro + rd * isect.w;

      if (material[2].z == MTL_WALL) {
        mat3 basis = orthBas(isect.xyz);
        vec3 rpt = basis * rp;

        if (isect.y == -1.0) {
          // ceil
          float cell = floor(rp.z);
          float phase = rp.z - cell - 0.5;

          if (abs(phase) < 0.48) {
            // panels
            material = mat3(
              vec3(0.8),
              vec3(0.0),
              vec3(0.2, 0.0, 0.0)
            );
            vec3 i_wave = vec3(0, -1, 0.1 * phase);
            vec3 i_noise = perlin23(rpt.xy + 4.0 * cell);
            isect.xyz = normalize(i_wave + 0.1 * i_noise);
          } else {
            // gap
            material = mat3(
              vec3(0.02),
              vec3(0.0),
              vec3(0.8, 0.0, 0.0)
            );
          }
        } else if (isect.y == 1.0) {
          // floor

          rpt.x += 0.6;
          vec2 tilep = mod(rpt.xy, 0.4) - 0.2;
          vec3 sdgTile = sdgbox2(tilep, vec2(0.18), 0.01);
          vec3 cell = floor(rpt / 0.4) + vec3(0.0, 6.0, 0.0);
          vec3 dice = hash3f(cell);
          rpt.x -= 0.6;

          vec3 sdgTactile = vec3(FAR);

          if (floor(cell.x / 2.0) == 0.0 && floor(cell.y / 2.0) == 0.0) {
            // tactile tiles - warning
            sdgTactile = sdgbox2(
              mod(tilep - 0.035, 0.07) - 0.035,
              vec2(0.01),
              0.01
            );
          } else if (cell.x == 0.0 && cell.y > 0.0 || cell.y == 0.0 && cell.x > 0.0) {
            // tactile tiles - directional
            vec2 pp = cell.x == 0.0 ? tilep : tilep.yx;
            pp.x = mod(pp.x, 0.09) - 0.045;
            sdgTactile = sdgbox2(
              pp,
              vec2(0.0, 0.14),
              0.03
            );
          }

          if (sdgTactile.z < FAR) {
            material = mat3(
              vec3(0.8, 0.4, 0.1),
              vec3(0),
              vec3(0.2, 0, 0)
            );
          } else {
            tilep = mod(rpt.xy, 0.5) - 0.25;
            sdgTile = sdgbox2(tilep, vec2(0.235), 0.01);
            dice = hash3f(floor(rpt / 0.5));

            material = mat3(
              mix(
                vec3(0.1),
                vec3(0.7),
                pow(hash3f(floor(64.0 * mod(rpt.xyy, 1.0))).x, 0.2)
              ),
              vec3(0.0),
              vec3(0.4, 0.0, 0.0)
            );
          }

          if (sdgTile.z > 0.0) {
            // gap
            material = mat3(
              vec3(0.02),
              vec3(0.0),
              vec3(0.8, 0.0, 0.0)
            );
          }

          vec2 i_tactile2 = step(abs(sdgTactile.z + 0.005), 0.005) * sdgTactile.xy;
          vec2 i_gap2 = step(abs(sdgTile.z + 0.002), 0.002) * sdgTile.xy;
          vec2 i_noise2 = perlin23(40.0 * rpt.xy).xy;
          isect.xyz = normalize(vec3(
            i_tactile2 + i_gap2 + 0.01 * i_noise2 + 0.02 * (dice.xy - 0.5),
            1
          ) * basis);
        } else if (rp.y > 2.8) {
          // ceil plate
          material = mat3(
            vec3(0.04, 0.04, 0.4),
            vec3(0.0),
            vec3(0.2, 0.0, 0.0)
          );
        } else if (rp.y < 0.2) {
          // floor plate
          material = mat3(
            vec3(0.1, 0.1, 0.1),
            vec3(0.0),
            vec3(0.4, 0.0, 0.0)
          );
        } else {
          // wall
          vec2 i_pTile = mod(rpt.xy, 0.1) - 0.05;
          vec3 sdgTile = sdgbox2(i_pTile, vec2(0.043), 0.003);
          vec3 dice = hash3f(floor(rpt.xyy / 0.1));

          material = mat3(
            vec3(0.02),
            vec3(0.0),
            vec3(0.5, 0.0, 0.0)
          );

          if (sdgTile.z < 0.0) {
            material = mat3(
              vec3(0.7, 0.74, 0.8),
              vec3(0.0),
              vec3(0.14, 0.0, 0.0)
            );

          	vec2 i_gap2 = step(abs(sdgTile.z + 0.002), 0.002) * sdgTile.xy;
            vec2 i_noise2 = perlin23(40.0 * rpt.xy).xy;
            isect.xyz = normalize(basis * vec3(
              i_gap2 + 0.01 * i_noise2 + 0.03 * (dice.xy - 0.5),
              1
            ));
          }
        }
      } else if (material[2].z == MTL_SIGN) {
        vec2 p = material[0].xy * 2.5;
        p.x -= clamp(floor(p.x), -1.0, 0.0) + 0.53;
        vec2 pt = p;
        pt.y = abs(pt.y) - 0.4;
        pt -= sign(pt) * min(abs(pt), 0.1);
        pt.x = min(pt.x, 0.0);

        bool b = (
          (abs(length(pt) - 0.3) < 0.1) && p.x < 0.35
          || (abs(p.x - 0.25) < 0.1) && p.y > -0.7 && p.y < 0.4
        );

        vec3 col = b ? vec3(1, 0.2, 0) : vec3(1);

        pt = material[0].xy;
        col *= exp2(2.0 * sin(6.0 * pt.x) * sin(6.0 * pt.x) * cos(pt.y) * cos(pt.y) - 2.0);
        material = mat3(
          vec3(0.3),
          col,
          vec3(0.01, 1, 0)
        );
      } else if (material[2].z == MTL_AD) {
        // Ref: https://demozoo.org/productions/352724/
        vec2 cellp = material[0].yz * 2.0;
        vec2 cell = floor(cellp + 0.5);
        cellp -= cell;

        vec3 dice = hash3f(vec3(cell.xyy));
        cellp = dice.x < 0.5 ? cellp : -cellp;
        cellp = dice.y < 0.5 ? cellp : cellp.yx;

        bool i_shape = (
          (abs(cellp.x) < 0.25 && abs(cellp.y + 0.18) < 0.18)
          || (abs(cellp.x) < -cellp.y + 0.42 && cellp.y > 0.0)
        );
        vec3 i_col = cell == vec2(0) ? vec3(1, 0.1, 0.4) : vec3(0.01, 0.01, 0.2);

        material = mat3(
          i_shape ? i_col : vec3(1),
          vec3(0),
          vec3(0.5, 0, 0)
        );
      } else if (material[2].z == MTL_EXIT_SIGN) {
        bool b = false;
        vec2 p = material[0].xy;

        // Arrow
        {
          vec2 pt = p;
          pt.y = abs(pt.y);
          b = b
            || (abs(pt.x - pt.y + 1.5) < 0.1) && (pt.y < 0.4)
            || (abs(pt.x + 1.1) < 0.4) && (pt.y < 0.1);
        }

        // 出
        {
          vec2 pt = p;
          pt.x = abs(pt.x + 0.25);
          b = b
            || (pt.x < 0.05) && (abs(pt.y - 0.02) < 0.48)
            || (pt.x < 0.22) && (abs(pt.y - 0.12) < 0.07)
            || (pt.x < 0.24) && (abs(pt.y + 0.39) < 0.07)
            || (abs(pt.x - 0.17) < 0.05) && (abs(pt.y - 0.23) < 0.21)
            || (abs(pt.x - 0.19) < 0.05) && (abs(pt.y + 0.26) < 0.24);
        }

        // 口
        {
          vec2 pt = p;
          pt.x = abs(pt.x - 0.25);
          b = b
            || (pt.x < 0.22) && (abs(pt.y - 0.28 - 0.14) < 0.07)
            || (pt.x < 0.22) && (abs(pt.y + 0.21 - 0.14) < 0.07)
            || (abs(pt.x - 0.17) < 0.05) && (abs(pt.y - 0.14) < 0.35);
        }

        // E
        {
          vec2 pt = p;
          pt.y = abs(pt.y + 0.36);
          b = b
            || (abs(pt.x - 0.04) < 0.02) && (abs(pt.y) < 0.13)
            || (abs(pt.x - 0.08) < 0.05) && (pt.y < 0.02)
            || (abs(pt.x - 0.08) < 0.06) && (abs(pt.y - 0.11) < 0.02);
        }

        // X
        {
          vec2 pt = abs(p - vec2(0.23, -0.36));
          b = b
            || (abs(pt.x - 0.4 * pt.y) < 0.02) && (abs(pt.y) < 0.13);
        }

        // I
        {
          b = b
            || (abs(p.x - 0.34) < 0.02) && (abs(p.y + 0.36) < 0.13);
        }

        // T
        {
          vec2 pt = p;
          pt.x = abs(pt.x - 0.44);
          b = b
            || (pt.x < 0.02) && (abs(pt.y + 0.36) < 0.13)
            || (pt.x < 0.06) && (abs(pt.y + 0.25) < 0.02);
        }

        material = mat3(
          vec3(0.3),
          b ? vec3(2, 2, 0) : vec3(0.0),
          vec3(0.1, 1.0, 0.0)
        );
      }

      if (material[2].z != MTL_CHROME_SPHERE) {
        // is not chrome sphere
        vec3 rp = ro + rd * isect.w;

        // dirt
        float n = 0.2 * smoothstep(0.0, 1.0, cyclicNoise(rp, 0.5).x);
        material[2].x = mix(material[2].x, 1.0, n);

        // black water
        n = smoothstep(-0.5, 0.5, cyclicNoise(2.0 * rp, 0.5).x - rp.y);
        material[0] = mix(material[0], vec3(0), n);
        material[1] = mix(material[1], vec3(0), n);
        material[2].x = mix(material[2].x, 0.04, n);
      }

      vec3 i_baseColor = material[0];
      vec3 i_emissive = material[1];
      float i_roughness = material[2].x;
      float i_metallic = material[2].y;

      // if hit then
      ro = rp + isect.xyz * 0.001;
      float sqRoughness = i_roughness * i_roughness;
      float sqSqRoughness = sqRoughness * sqRoughness;

      #ifdef DEBUG_NORMAL
        fragColor = vec4(0.5 + 0.5 * isect.xyz, 1);
        return;
      #endif

      // shading
      {
        float dotNV = i_safeDot(isect.xyz, -rd);
        float Fn = mix(0.04, 1.0, pow(1.0 - dotNV, 5.0));
        float spec = max(
          step((seed = hash3f(seed)).x, Fn), // non metallic, fresnel
          i_metallic // metallic
        );

        // emissive
        fragColor.xyz += clamp(beta, 0.0, 4.0) * (1.0 - Fn) * i_emissive;

        // sample ggx or lambert
        seed.y = sqrt((1.0 - seed.y) / (1.0 - spec * (1.0 - sqSqRoughness) * seed.y));
        vec3 woOrH = orthBas(isect.xyz) * vec3(
          sqrt(1.0 - seed.y * seed.y) * sin(TAU * seed.z + vec2(0.0, TAU / 4.0)),
          seed.y
        );

        if (spec > 0.0) {
          // specular
          // note: woOrH is H right now
          vec3 i_H = woOrH;
          vec3 i_wo = reflect(rd, i_H);

          // vector math
          float dotNL = i_safeDot(isect.xyz, i_wo);
          float dotNH = i_safeDot(isect.xyz, i_H);
          float dotVH = i_safeDot(-rd, i_H);

          // fresnel
          vec3 i_F0 = mix(vec3(0.04), i_baseColor, i_metallic);
          vec3 i_Fh = mix(i_F0, vec3(1.0), pow(1.0 - dotVH, 5.0));

          // brdf
          //   Fh / Fn * G * VdotH / (NdotH * NdotV)
          // = Fh / Fn * G1L * G1V * V.H / N.H / N.V
          // = Fh / Fn * N.L / (N.L * (1 - k) + k) * N.V / (N.V * (1.0 - k) + k) * V.H / N.H / N.V
          // = Fh / Fn * N.L / (N.L * (1 - k) + k) / (N.V * (1.0 - k) + k) * V.H / N.H
          float k = 0.5 * sqRoughness;
          beta *= dotNL > 0.0 && dotNH > 0.0
            ? i_Fh / mix(Fn, 1.0, i_metallic)
                * dotNL / (dotNL * (1.0 - k) + k)
                / (dotNV * (1.0 - k) + k)
                * dotVH / dotNH
            : vec3(0);

          // wo is finally wo
          woOrH = i_wo;
        } else {
          // diffuse
          // note: woOrH is wo right now
          if (dot(woOrH, isect.xyz) < 0.0) {
            break;
          }

          // calc H
          // vector math
          vec3 i_H = normalize(-rd + woOrH);
          float i_dotVH = i_safeDot(-rd, i_H);

          // fresnel
          float i_Fh = mix(0.04, 1.0, pow(1.0 - i_dotVH, 5.0));

          // brdf
          beta *= (1.0 - i_Fh) / (1.0 - Fn) * i_baseColor;

          // cringe transmission
          if (material[2].z == MTL_TRANSMISSION) {
            ro -= 0.002 * isect.xyz;
            continue;
          }
        }

        // prepare the rd for the next ray
        rd = woOrH;
      }

      if (dot(beta, beta) < 0.01) {
        break;
      }
    }
  }

  fragColor.w = float(SAMPLES_PER_FRAME);
}
