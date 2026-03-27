/* framework header */
#version 430
layout(location = 0) out vec4 fragColor;
layout(location = 0) uniform vec4 resolution;
layout(location = 1) uniform int frame;




/* vvv your shader goes here vvv */

const int MTL_WALL = 1;
const int MTL_FLOOR = 3;
const int MTL_CEIL = 4;
const int MTL_CHROME_SPHERE = 5;
const int MTL_EXIT_SIGN = 6;
const int MTL_PROHIBITED_PLATE = 7;
const int MTL_PROHIBITED_PIPE = 8;
const int MTL_PROHIBITED_FEET = 9;
const int MTL_WALL_BAR = 10;
const int MTL_WALL_NO_SMOKING = 11;

const int MTLMOD_SCRATCH = 20;

const float TAU = 2 * acos(-1);
const float FAR = 100.0;

const int SAMPLES_PER_FRAME = 10;
const float SAMPLES_PER_FRAME_F = 10.0;
const int PATH_ITER = 5;
const int MARCH_ITER = 80;

// #define DEBUG_NORMAL

// == common =======================================================================================
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
  return mat2(cos(t), sin(t), -sin(t), cos(t));
}

float i_safeDot(vec3 a, vec3 b) {
  return clamp(dot(a, b), 0.0, 1.0);
}

mat3 orthBas(vec3 z) {
  z = normalize(z);
  vec3 i_up = abs(z.y) < 0.99 ? vec3(0, 1, 0) : vec3(0, 0, 1);
  vec3 x = normalize(cross(i_up, z));
  return mat3(x, cross(z, x), z);
}

// == noise ========================================================================================
vec3 cyclicNoise(vec3 p) {
  vec3 sum = vec3(0);

  for (int i = 0; i ++ < 5;) {
    p *= 2.0 * orthBas(vec3(3, 4, -5));
    p += sin(p.yzx);
    sum = sum * 2.0 + cross(cos(p), sin(p.zxy));
  }

  return sum / 31.0;
}

// == sdfs =========================================================================================
// Ref: https://iquilezles.org/articles/distgradfunctions3d/
vec3 sdgbox2(vec2 p, vec2 sizeOrD, float r) {
  sizeOrD = abs(p) - sizeOrD;
  float g = max(sizeOrD.x, sizeOrD.y);

  if (g > 0.0) {
    // outside
    vec2 q = max(sizeOrD, 0.0);
    float l = length(q);
    return vec3(sign(p) * q / l, l - r);
  } else {
    // inside
    return vec3(sign(p) * step(vec2(g), sizeOrD), g - r);
  }
}

void minSdArcPath(vec2 p, inout float d, float x0OrL, float y0OrR, float x1, float y1, float t) {
  t = t == 0.0 ? 0.001 : t;
  p -= vec2(x0OrL, y0OrR);
  vec2 tail = vec2(x1 - x0OrL, y1 - y0OrR);

  vec2 cs = cis(abs(t) / 2.0);
  x0OrL = length(tail);
  y0OrR = x0OrL / 2.0 / cs.y;
  p *= mat2(tail.y, -tail.x, tail.x, tail.y) / x0OrL;
  p.x *= sign(t);
  p -= y0OrR * cs * vec2(-1.0, 1.0);
  p.y = abs(p.y);
  float i_dArc = (cs.y * p.x > cs.x * p.y)
    ? abs(length(p) - y0OrR)
    : length(p - cs * y0OrR);

  d = min(d, i_dArc);
}

// == isects =======================================================================================
void isectBox(inout vec4 isect, vec3 roOrXoOrDfv, vec3 rd, vec3 sOrXsOrDbv) {
  roOrXoOrDfv = -roOrXoOrDfv / rd;
  sOrXsOrDbv = abs(sOrXsOrDbv / rd);

  roOrXoOrDfv = roOrXoOrDfv - sOrXsOrDbv;
  sOrXsOrDbv = roOrXoOrDfv + sOrXsOrDbv + sOrXsOrDbv;

  float df = max(max(roOrXoOrDfv.x, roOrXoOrDfv.y), roOrXoOrDfv.z);
  float db = min(min(sOrXsOrDbv.x, sOrXsOrDbv.y), sOrXsOrDbv.z);
  if (db >= df) {
    if (df > 0.0 && df < isect.w) {
      isect = vec4(-sign(rd) * step(vec3(df), roOrXoOrDfv), df);
    }

    if (db > 0.0 && db < isect.w) {
      isect = vec4(-sign(rd) * step(sOrXsOrDbv, vec3(db)), db);
    }
  }
}

void isectSphere(inout vec4 isect, vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float i_c = dot(ro, ro) - r * r;
  float h = b * b - i_c;

  if (h > 0.0) {
    h = sqrt(h);
    float t = -b - h;
    if (t > 0.0 && t < isect.w) {
      isect = vec4(normalize(ro + rd * t), t);
    }

    t = -b + h;
    if (t > 0.0 && t < isect.w) {
      isect = vec4(-normalize(ro + rd * t), t);
    }
  }
}

void isectCapsule(inout vec4 isect, vec3 ro, vec3 rd, vec3 tail, float r) {
  float tt = dot(tail, tail);
  float td = dot(tail, rd);
  float ot = dot(ro, tail);
  float i_od = dot(ro, rd);
  float i_oo = dot(ro, ro);

  float a = tt - td * td;
  float b = tt * i_od - ot * td;
  float i_c = tt * i_oo - ot * ot - r * r * tt;
  float h = b * b - a * i_c;

  if (h > 0.0) {
    float t = (-b - sqrt(h)) / a;
    if (t > 0.0) {
      float y = clamp(ot + t * td, 0.0, tt);
      if (y > 0.0 && y < tt && t < isect.w) {
        // you might delete this if the precision doesn't matter
        isect = vec4((ro + rd * t - y / tt * tail) / r, t);
      }

      isectSphere(isect, ro - clamp(y, 0.0, tt) / tt * tail, rd, r);
    }
  }
}

// == marcher ======================================================================================
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * h * k / 6.0;
}

float mapChrome(vec3 p) {
  return 0.8 * smin(
    smin(
      length(p + 0.4 * cyclicNoise(p * 0.5 + 14.0) - vec3(0.0, 1.2, 0.0)) - 0.8,
      2.5 - p.y,
      2.0
    ),
    p.y,
    1.0
  );
}

// == main =========================================================================================
void main() {
  fragColor *= 0.0;

  vec2 p = gl_FragCoord.xy / resolution.xy - 0.5;
  p.x *= resolution.x / resolution.y;

  vec3 seed = hash3f(vec3(p, frame));

  for (int i = 0; i ++ < SAMPLES_PER_FRAME;) {
    // -- create ray -------------------------------------------------------------------------------
    vec2 pt = (p * rotate2D(0.01) + seed.xy / resolution.y);
    seed = hash3f(seed);

    vec3 ro = vec3(-0.1, 1.6, 11.0);
    vec3 rd = normalize(vec3(pt, -4.0));
    rd.zx *= rotate2D(0.01);
    rd.yz *= rotate2D(0.04);
    rd = ro + rd * 10.0; // rd is temporarily ray target
    ro += 0.01 * vec3(cis(TAU * seed.z) * sqrt(seed.y), 0.0);
    rd = normalize(rd - ro);

    vec3 beta = vec3(2.0 - length(p));

    for (int i = 0; i ++ < PATH_ITER;) {
      mat3 material;

      vec4 isect = vec4(FAR), isect2 = vec4(FAR);

      // -- intersect stuff ------------------------------------------------------------------------
      // exit sign
      const vec3 i_exitSignPos = vec3(0.0, 2.35, -2.0);
      // isect2 = vec4(FAR);
      isectBox(isect2, ro - i_exitSignPos, rd, vec3(0.15, 0.15, 0.05));
      if (isect2.w < isect.w) {
        isect = isect2;
        material = mat3(
          vec3(ro + rd * isect.w - i_exitSignPos),
          vec3(0),
          vec3(MTL_EXIT_SIGN)
        );
      }

      // prohibited sign
      const float i_prohibitedRot = 0.2;
      ro.zx *= rotate2D(i_prohibitedRot);
      rd.zx *= rotate2D(i_prohibitedRot);

      const vec3 i_signPos = vec3(0.0, 0.4, 0.0);
      ro -= i_signPos;

      isect2 = vec4(FAR);
      isectBox(isect2, ro, rd, vec3(0.45, 0.3, 0.0));
      if (isect2.w < isect.w) {
        vec3 rp = ro + rd * isect2.w;
        float i_dProhibitedPlate = max(
          sdgbox2(rp.xy, vec2(0.45, 0.3), 0.0).z,
          -sdgbox2(abs(abs(rp.xy - vec2(0.0, 0.28)) - vec2(0.3, 0.0)), vec2(0.015, 0.0), 0.01).z
        ) + 0.01 * cyclicNoise(10.0 * rp).x;
        if (i_dProhibitedPlate < 0.0) {
          isect = isect2;
          material = mat3(
            vec3(rp),
            vec3(0),
            vec3(MTL_PROHIBITED_PLATE)
          );
          isect.zx *= rotate2D(-i_prohibitedRot);
        }
      }

      ro += i_signPos;

      // prohibited sign pipe
      isect2 = vec4(FAR);
      isectCapsule(isect2, ro - vec3(-0.6, 0.75, 0.0), rd, vec3(0, -1, 0.3), 0.02);
      isectCapsule(isect2, ro - vec3(-0.6, 0.75, 0.0), rd, vec3(0, -1, -0.3), 0.02);
      isectCapsule(isect2, ro - vec3(-0.6, 0.75, 0.0), rd, vec3(1.2, 0, 0), 0.02);
      isectCapsule(isect2, ro - vec3(-0.6, 0.1, 0.19), rd, vec3(1.2, 0, 0), 0.01);
      isectCapsule(isect2, ro - vec3(-0.6, 0.1, -0.19), rd, vec3(1.2, 0, 0), 0.01);
      isectCapsule(isect2, ro - vec3(0.6, 0.75, 0.0), rd, vec3(0, -1, 0.3), 0.02);
      isectCapsule(isect2, ro - vec3(0.6, 0.75, 0.0), rd, vec3(0, -1, -0.3), 0.02);
      isectBox(isect2, ro - vec3(-0.3, 0.71, 0.0), rd, vec3(0.015, 0.03, 0.002));
      isectBox(isect2, ro - vec3(0.3, 0.71, 0.0), rd, vec3(0.015, 0.03, 0.002));
      isectBox(isect2, ro - vec3(-0.61, 0.1, 0.0), rd, vec3(0.001, 0.02, 0.2));
      isectBox(isect2, ro - vec3(0.61, 0.1, 0.0), rd, vec3(0.001, 0.02, 0.2));
      if (isect2.w < isect.w) {
        vec3 rp = ro + rd * isect2.w;
        isect = isect2;
        material = mat3(
          vec3(rp),
          vec3(0),
          vec3(MTL_PROHIBITED_PIPE)
        );
        isect.zx *= rotate2D(-i_prohibitedRot);
      }

      // prohibited sign feet
      isect2 = vec4(FAR);
      isectBox(isect2, ro - vec3(-0.6, 0.0, 0.0), rd, vec3(0.04, 0.01, 0.3));
      isectBox(isect2, ro - vec3(0.6, 0.0, 0.0), rd, vec3(0.04, 0.01, 0.3));
      if (isect2.w < isect.w) {
        vec3 rp = ro + rd * isect2.w;
        isect = isect2;
        material = mat3(
          vec3(rp),
          vec3(0),
          vec3(MTL_PROHIBITED_FEET)
        );
        isect.zx *= rotate2D(-i_prohibitedRot);
      }

      rd.zx *= rotate2D(-i_prohibitedRot);
      ro.zx *= rotate2D(-i_prohibitedRot);

      // floor
      isect2 = vec4(FAR);
      isectBox(isect2, ro - vec3(0.0, -1.0, 10.0), rd, vec3(1.5, 1.0, 100));
      if (isect2.w < isect.w) {
        isect = isect2;
        material = mat3(MTL_FLOOR);
      }

      // gutter
      isect2 = vec4(FAR);
      isectBox(isect2, ro - vec3(0.0, -1.0, 10.0), rd, vec3(1.6, 0.98, 100));
      if (isect2.w < isect.w) {
        isect = isect2;
        material = mat3(MTL_WALL);
      }

      // wall
      isect2 = vec4(FAR);
      isectBox(isect2, ro - vec3(-5.0, 0.0, 10.0), rd, vec3(3.4, 3.0, 100));
      isectBox(isect2, ro - vec3(5.0, 0.0, 10.0), rd, vec3(3.4, 3.0, 100));
      isectBox(isect2, ro - vec3(0.0, 0.0, 20.0), rd, vec3(10.0, 10.0, 0.0));
      if (isect2.w < isect.w) {
        isect = isect2;
        material = mat3(MTL_WALL);
      }

      // no smoking
      const vec3 i_noSmokingSignPos = vec3(1.6, 1.72, 0.0);
      ro -= i_noSmokingSignPos;
      isect2 = vec4(FAR);
      isectBox(isect2, ro, rd, vec3(0.01, 0.25, 0.5));
      if (isect2.w < isect.w) {
        vec3 rp = ro + rd * isect2.w;
        isect = isect2;
        material = mat3(
          vec3(rp),
          vec3(0),
          vec3(MTL_WALL_NO_SMOKING)
        );
      }
      ro += i_noSmokingSignPos;

      // wall bar
      isect2 = vec4(FAR);
      isectBox(isect2, ro - vec3(1.6, 0.0, 1.5), rd, vec3(0.01, 3.0, 0.1));
      isectBox(isect2, ro - vec3(-1.6, 0.0, 1.5), rd, vec3(0.01, 3.0, 0.1));
      if (isect2.w < isect.w) {
        isect = isect2;
        material = mat3(MTL_WALL_BAR);
      }

      // ceil
      isect2 = vec4(FAR);
      isectBox(isect2, ro - vec3(0.0, 2.5, 10.0), rd, vec3(100.0, 0.0, 100.0));
      if (isect2.w < isect.w) {
        isect = isect2;
        material = mat3(MTL_CEIL);
      }

      // chrome sphere
      float i_chromeSpherePosZ = -4.0;
      ro.z -= i_chromeSpherePosZ;
      isect2 = vec4(FAR);
      isectBox(isect2, ro, rd, vec3(2.5));
      if (isect2.w < FAR) {
        vec3 rp = ro;
        float rl = 0.0;
        float dist;

        for (int i = 0; i ++ < MARCH_ITER;) {
          dist = mapChrome(rp) + 0.001 * seed.x;
          rl += dist;
          rp += dist * rd;
          if (abs(dist) < 0.0001 || rl > isect.w) {
            break;
          }
        }

        if (abs(dist) < 0.001 && rl < isect.w) {
          vec2 d = vec2(0.0, 0.001);
          vec3 i_n = normalize(vec3(
            mapChrome(rp + d.yxx) - mapChrome(rp - d.yxx),
            mapChrome(rp + d.xyx) - mapChrome(rp - d.xyx),
            mapChrome(rp + d.xxy) - mapChrome(rp - d.xxy)
          ));
          isect = vec4(i_n, rl);
          material = mat3(
            mix(vec3(0), vec3(0.6, 0.68, 0.7), smoothstep(0.0, 0.5, rp.y)),
            vec3(0),
            vec3(0.04, 1.0, MTL_CHROME_SPHERE)
          );
        }
      }
      ro.z += i_chromeSpherePosZ;

      // -- if the ray misses then -----------------------------------------------------------------
      if (isect.w > FAR - 1.0) {
        break;
      }

      // -- normals and materials ------------------------------------------------------------------
      mat3 basis = orthBas(isect.xyz);
      vec3 rp = ro + rd * isect.w;
      vec3 rpt = rp * basis;

      if (material[2].z == MTL_WALL) {
        if (rp.y < 0.2) {
          // floor plate
          material = mat3(
            vec3(0.1),
            vec3(0),
            vec3(0.4, 0.0, 0.0)
          );
        } else {
          // brick wall
          float tileY = floor(rpt.y / 0.1);
          vec2 tileCenter = vec2(
            (floor(rpt.x / 0.2 + mod(tileY, 2.0) * 0.5) - mod(tileY, 2.0) * 0.5) * 0.2 + 0.1,
            tileY * 0.1 + 0.05
          );
          vec3 sdgTile = sdgbox2(rpt.xy - tileCenter, vec2(0.093, 0.043), 0.003);
          vec3 dice = hash3f(tileCenter.xyy);
          vec3 noise = 0.5 + 0.5 * sin(3.0 * cyclicNoise(rp));

          material = mat3(
            vec3(0.1 + 0.6 * noise.x),
            vec3(0),
            vec3(0.8, 0.0, 0.0)
          );

          if (sdgTile.z < 0.0) {
            material = mat3(
              mix(
                pow(vec3(0.9, 0.7, 0.5), vec3(exp2(0.5 * dice.z))),
                vec3(0.6 * noise.x),
                0.2 * noise.y
              ),
              vec3(0),
              vec3(0.2 + 0.3 * noise.y, 0.0, 0.0)
            );

            vec2 i_nEdge = step(abs(sdgTile.z), 0.002) * sdgTile.xy;
            isect.xyz = normalize(basis * vec3(
              i_nEdge + 0.03 * (dice.xy - 0.5),
              2.0
            ));
          }
        }
      } else if (material[2].z == MTL_WALL_BAR) {
        material = mat3(
          vec3(0.5),
          vec3(0),
          vec3(0.4, 1.0, 0.0)
        );
      } else if (material[2].z == MTL_WALL_NO_SMOKING) {
        vec2 pp = material[0].zy;
        if (pp.x < -0.08) {
          vec2 pt = pp.xy * 60.0 + vec2(16, 0);

          float d = 1.0;

          // outside smoke
          minSdArcPath(pt, d, 6, 0, 4, 2, 1.6);
          minSdArcPath(pt, d, 4, 2, 3, 2, 0);
          minSdArcPath(pt, d, 3, 2, 2, 6, 1.6);

          // inside smoke
          minSdArcPath(pt, d, 5, 0, 4, 1, 1.6);
          minSdArcPath(pt, d, 4, 1, 2, 1, 0);
          minSdArcPath(pt, d, 2, 1, 1, 2, -1.6);
          minSdArcPath(pt, d, 1, 2, 1, 3, 0);
          minSdArcPath(pt, d, 1, 3, -1, 6, -2.0);

          bool i_shapeRed = length(pt) < 10.0 && (length(pt) > 8.0 || abs(pt.x + pt.y) < 1.5);
          bool i_shapeBlack = d < 0.3 && pt.y > 0.0 || abs(pt.x) < 6.3 && abs(pt.y + 1.3) < 1.0 && abs(pt.x - 5.5) > 0.2 && abs(pt.x - 4.5) > 0.2;

          material[0] = i_shapeRed ? vec3(1, 0.2, 0.3) : i_shapeBlack ? vec3(0) : vec3(1);
        } else {
          vec2 pt = pp.xy * 80.0 - vec2(6, 0);

          float d = 1.0;

          // 禁
          minSdArcPath(pt, d, -7, 6, -1, 6, 0);
          minSdArcPath(pt, d, -4, 7, -4, 2, 0);
          minSdArcPath(pt, d, -4, 6, -7, 2.5, -0.2);
          minSdArcPath(pt, d, -4, 6, -1, 2.5, 0.2);
          minSdArcPath(pt, d, 1, 6, 7, 6, 0);
          minSdArcPath(pt, d, 4, 7, 4, 2, 0);
          minSdArcPath(pt, d, 4, 6, 1, 2.5, -0.2);
          minSdArcPath(pt, d, 4, 6, 7, 2.5, 0.2);
          minSdArcPath(pt, d, -6, 0, 6, 0, 0);
          minSdArcPath(pt, d, -7, -2.5, 7, -2.5, 0);
          minSdArcPath(pt, d, 0, -2.5, 0, -7, 0);
          minSdArcPath(pt, d, 0, -7, -2, -7, 0);
          minSdArcPath(pt, d, -3, -4.5, -6.5, -7, -0.5);
          minSdArcPath(pt, d, 3, -4.5, 6.5, -7, 0.3);

          // 煙
          pt.x -= 20.0;
          minSdArcPath(pt, d, -7, 4, -7, 0, 0);
          minSdArcPath(pt, d, -3, 3, -4, 1, 0);
          minSdArcPath(pt, d, -5, 7, -5, -1, 0);
          minSdArcPath(pt, d, -5, -1, -7, -7, -0.5);
          minSdArcPath(pt, d, -5, -1, -3, -4, 0);

          minSdArcPath(pt, d, -1, 7, 7, 7, 0);
          minSdArcPath(pt, d, -1, 3.5, -1, -1, 0);
          minSdArcPath(pt, d, -1, 3.5, 7, 3.5, 0);
          minSdArcPath(pt, d, 7, 3.5, 7, -1, 0);
          minSdArcPath(pt, d, 1.7, 7, 1.7, -1, 0);
          minSdArcPath(pt, d, 4.3, 7, 4.3, -1, 0);
          minSdArcPath(pt, d, -1, -1, 7, -1, 0);
          minSdArcPath(pt, d, 0, -4, 6, -4, 0);
          minSdArcPath(pt, d, 3, -1, 3, -7, 0);
          minSdArcPath(pt, d, -1, -7, 7, -7, 0);

          material[0] = d < 0.8 ? vec3(1.0, 0.2, 0.3) : vec3(1);
        }

        material = mat3(
          mix(vec3(0.1), vec3(0.9), material[0]),
          vec3(0),
          vec3(0.4, 0.0, MTLMOD_SCRATCH)
        );
      } else if (material[2].z == MTL_FLOOR) {
        vec2 p = rpt.xy;

        // gap
        material = mat3(
          vec3(0.1 + 0.1 * sin(3.0 * cyclicNoise(2.0 * p.xxy).x)),
          vec3(0),
          vec3(0.8, 0.0, 0.0)
        );

        vec2 tileCenter = floor(p / 0.3) * 0.3 + 0.15;
        if (tileCenter.x == 0.15) {
          // tactile
          vec3 sdgTile = sdgbox2(p - tileCenter, vec2(0.135), 0.01);

          if (sdgTile.z < 0.0) {
            material = mat3(
              vec3(0.8, 0.5, 0.1),
              vec3(0),
              vec3(0.4, 0.0, MTLMOD_SCRATCH)
            );

            p -= tileCenter;
            p.x -= (floor(p.x / 0.07) + 0.5) * 0.07;
            vec3 sdgTactile = sdgbox2(
              p,
              vec2(0.0, 0.11),
              0.015
            );
            vec2 i_nEdge = step(abs(sdgTile.z), 0.004) * sdgTile.xy;
            vec2 i_nEdgeTactile = step(abs(sdgTactile.z), 0.002) * sdgTactile.xy;
            isect.xyz = normalize(basis * vec3(
              i_nEdge + i_nEdgeTactile + 0.03 * hash3f(tileCenter.xyy).xy,
              2
            ));
          }
        } else {
          // tiles
          tileCenter = floor(p / 0.5) * 0.5 + 0.25;
          vec3 sdgTile = sdgbox2(p - tileCenter, vec2(0.235), 0.01);

          if (sdgTile.z < 0.0) {
            // tile
            material = mat3(
              vec3(tileCenter.x == -0.25 ? 0.2 : 0.4),
              vec3(0),
              vec3(0.4, 0.0, 0.0)
            );

            vec2 i_nEdge = step(abs(sdgTile.z + 0.002), 0.002) * sdgTile.xy;
            isect.xyz = normalize(basis * vec3(
              i_nEdge + 0.03 * hash3f(tileCenter.xyy).xy,
              2
            ));
          }

          // direction sign
          bool side = p.x < 0.0;
          p = vec2(abs(abs(p.x) - 0.68), (p.y - 0.78) * sign(p.x));
          vec3 sdgDir = sdgbox2(p, vec2(0.15), 0.05);
          if ((sdgDir + 0.04 * max(cyclicNoise(rp * 10.0), 0.0)).z < 0.0) {
            bool i_shape = (sdgDir.z > -0.01 || abs(p.x) < 0.16 && abs(p.x - p.y - 0.08) < 0.05) ^^ side;

            material = mat3(
              i_shape ? vec3(0.1, 0.1, 0.3) : vec3(0.9),
              vec3(0),
              vec3(0.5, 0.0, MTLMOD_SCRATCH)
            );
          }
        }
      } else if (material[2].z == MTL_CEIL) {
        vec2 p = rp.xz;
        p -= floor(p / 6.0 + 0.5) * 6.0;
        if (abs(p.x) < 0.7 && abs(p.y) < 0.2) {
          // light
          material = mat3(
            vec3(0.3),
            vec3(10.0 * smoothstep(rp.z, 0.0, 1.0)), // cringe
            vec3(0.04, 1.0, 0.0)
          );
        } else if (abs(p.x) < 0.72 && abs(p.y) < 0.22) {
          // frame of light
          material = mat3(
            vec3(0.8),
            vec3(0),
            vec3(0.1, 1.0, 0.0)
          );
        } else {
          p = rp.xz;
          float i_tileZ = (floor(rp.z / 0.2) + 0.5) * 0.2;

          if (abs(i_tileZ - rp.z) < 0.09) {
            // panels
            material = mat3(
              vec3(0.8),
              vec3(0),
              vec3(0.4, 0.0, 0.0)
            );
          } else {
            // gap
            material = mat3(
              vec3(0.02),
              vec3(0),
              vec3(0.8, 0.0, 0.0)
            );
          }
        }
      } else if (material[2].z == MTL_EXIT_SIGN) {
        vec2 p = 170.0 * material[0].xy;
        if (abs(p.x) < 23.0 && abs(p.y) < 23.0) {
          // sign
          float d = 8.0;

          // arms
          minSdArcPath(p, d, -14, 3, -9, 3, 0);
          minSdArcPath(p, d, -9, 3, -4, 9, 0);
          minSdArcPath(p, d, -4, 9, 6, 9, 0);
          minSdArcPath(p, d, 6, 9, 10, 4, 0);

          // left leg
          minSdArcPath(p, d, -1, 9, 4, 0, 0);
          minSdArcPath(p, d, 4, 0, 5, -9, 0);
          minSdArcPath(p, d, 5, -9, 14, -9, 0);

          // right leg
          minSdArcPath(p, d, -4, 8, 1, -1, 0);
          minSdArcPath(p, d, 1, -1, -6, -14, 0);
          minSdArcPath(p, d, -5, -18, 2, -24, 0);

          // stroke width / head
          d = min(d - 1.6, length(p - vec2(-4.3, 14.4)) - 3.4);

          // door
          d = min(d, min(
            max(
              12.0 - abs(p.x + min(0.0, p.y + 16.0)),
              sign(p.x) - d
            ),
            20.0 - p.y
          ));

          bool i_shape = d < 0.0;

          material = mat3(
            vec3(1),
            i_shape ? vec3(0, 2, 1) : vec3(2),
            vec3(0.2, 1, 0)
          );
        } else {
          // frame
          material = mat3(
            vec3(0.9),
            vec3(0),
            vec3(0.4, 0.0, 0.0)
          );
        }
      } else if (material[2].z == MTL_PROHIBITED_PLATE) {
        vec2 pt = material[0].xy / vec2(0.012, 0.016);

        if (abs(pt.y) > 16.0) {
          material = mat3(
            cos(0.6 * (pt.x - pt.y)) > 0.0
              ? vec3(1.0, 0.5, 0.0)
              : vec3(0),
            vec3(0),
            vec3(0.1, 0.0, 0.0)
          );
        } else {
          float d = 1.0;

          // 立
          pt.x += 27.0;
          minSdArcPath(pt, d, 0, 7, 0, 5, 0);
          minSdArcPath(pt, d, -6, 5, 6, 5, 0);
          minSdArcPath(pt, d, -4, 3, -2, -5, -0.1);
          minSdArcPath(pt, d, 4, 3, 1, -7, -0.3);
          minSdArcPath(pt, d, -7, -7, 7, -7, 0);

          // 入
          pt.x -= 18.0;
          minSdArcPath(pt, d, -3, 7, 0, 7, 0);
          minSdArcPath(pt, d, 0, 7, -7, -7, -1.0);
          minSdArcPath(pt, d, 0, 7, 7, -7, 1.0);

          // 禁
          pt.x -= 18.0;
          minSdArcPath(pt, d, -7, 6, -1, 6, 0);
          minSdArcPath(pt, d, -4, 7, -4, 2, 0);
          minSdArcPath(pt, d, -4, 6, -7, 2.5, -0.2);
          minSdArcPath(pt, d, -4, 6, -1, 2.5, 0.2);
          minSdArcPath(pt, d, 1, 6, 7, 6, 0);
          minSdArcPath(pt, d, 4, 7, 4, 2, 0);
          minSdArcPath(pt, d, 4, 6, 1, 2.5, -0.2);
          minSdArcPath(pt, d, 4, 6, 7, 2.5, 0.2);
          minSdArcPath(pt, d, -6, 0, 6, 0, 0);
          minSdArcPath(pt, d, -7, -2.5, 7, -2.5, 0);
          minSdArcPath(pt, d, 0, -2.5, 0, -7, 0);
          minSdArcPath(pt, d, 0, -7, -2, -7, 0);
          minSdArcPath(pt, d, -3, -4.5, -6.5, -7, -0.5);
          minSdArcPath(pt, d, 3, -4.5, 6.5, -7, 0.3);

          // 止
          pt.x -= 18.0;
          minSdArcPath(pt, d, 0, 7, 0, -7, 0);
          minSdArcPath(pt, d, 0, 2, 6, 2, 0);
          minSdArcPath(pt, d, -4, 3, -4, -7, 0);
          minSdArcPath(pt, d, -7, -7, 7, -7, 0);

          material[0] = d < 1.0
            ? vec3(0.7, 0, 0)
            : vec3(1);
        }

        material = mat3(
          mix(vec3(0.04), vec3(0.9), material[0]),
          vec3(0),
          vec3(0.1, 0.0, MTLMOD_SCRATCH)
        );

        isect.xyz = normalize(isect.xyz);
      } else if (material[2].z == MTL_PROHIBITED_PIPE) {
        float n = step(0.5, cyclicNoise(20.0 * rp).x);

        material = mat3(
          mix(
            vec3(0.5, 0.1, 0.02),
            vec3(0.1, 0.02, 0.03),
            n
          ),
          vec3(0),
          vec3(mix(0.4, 1.0, n), 0.0, MTLMOD_SCRATCH)
        );

        isect.xyz = normalize(isect.xyz + 0.04 * cyclicNoise(80.0 * rp));
      } else if (material[2].z == MTL_PROHIBITED_FEET) {
        material = mat3(
          vec3(0.3),
          vec3(0),
          vec3(0.7, 1.0, MTLMOD_SCRATCH)
        );
      }

      seed = hash3f(seed);

      if (material[2].z != MTL_CHROME_SPHERE) {
        // is not chrome sphere

        // dirt
        float i_noiseDirt = 0.2 * smoothstep(0.0, 1.0, cyclicNoise(rp).x);
        material[2].x = mix(material[2].x, 1.0, i_noiseDirt);

        // black water
        float i_noiseWater = smoothstep(0.0, 1.0, cyclicNoise(rp).y - rp.y + 0.3);
        if (i_noiseWater > seed.x) {
          material[0] = vec3(0);
          material[1] = vec3(0);
          material[2].x = 0.04;
        }
      }

      if (material[2].z == MTLMOD_SCRATCH) {
        vec3 i_nDisplace = 20.0 * cyclicNoise(1.0 * rp.xyz);
        float i_n = pow(0.5 + 0.5 * cyclicNoise(i_nDisplace).x, 8);
        if (i_n > seed.x) {
          material = mat3(
            vec3(0.1, 0.06, 0.04),
            material[1],
            vec3(1.0, 0.0, 0.0)
          );
        }
      }

      vec3 i_baseColor = material[0];
      vec3 i_emissive = material[1];
      float i_roughness = material[2].x;
      float i_metallic = material[2].y;

      // -- update ray and throughput --------------------------------------------------------------
      ro = rp + isect.xyz * 0.001;
      float sqRoughness = i_roughness * i_roughness;

      // #ifdef DEBUG_NORMAL
      //   return vec4(0.5 + 0.5 * isect.xyz, 1.0);
      // #endif

      seed = hash3f(seed);

      {
        float dotNV = i_safeDot(isect.xyz, -rd);
        float Fn = mix(0.04, 1.0, pow(1.0 - dotNV, 5));
        float spec = max(
          step(seed.x, Fn), // non metallic, fresnel
          i_metallic // metallic
        );

        // emissive
        fragColor.xyz += clamp(beta, 0.0, 4.0) * (1.0 - Fn) * i_emissive;

        // sample ggx or lambert
        seed.y = sqrt((1.0 - seed.y) / (1.0 - spec * (1.0 - sqRoughness * sqRoughness) * seed.y));
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
          vec3 i_Fh = mix(i_F0, vec3(1.0), pow(1.0 - dotVH, 5));

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
          float i_Fh = mix(0.04, 1.0, pow(1.0 - i_dotVH, 5));

          // brdf
          beta *= (1.0 - i_Fh) / (1.0 - Fn) * i_baseColor;
        }

        // prepare the rd for the next ray
        rd = woOrH;
      }

      if (dot(beta, beta) < 0.01) {
        break;
      }
    }
  }

  fragColor.w = SAMPLES_PER_FRAME_F;
}
