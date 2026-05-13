/* framework header */
#version 430
layout(location = 0) out vec4 fragColor;
layout(location = 0) uniform vec4 iResolution;
layout(binding = 0) uniform sampler2D accumulatorTex;




void main() {
  vec4 tex = texelFetch(accumulatorTex,ivec2(gl_FragCoord.xy),0);

  vec3 color = tex.rgb / tex.a;

  // ACES-like cringe tone mapping
  // Ref: https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl
  color *= mat3(
    0.60, 0.35, 0.05,
    0.08, 0.90, 0.02,
    0.03, 0.13, 0.84
  );

  color = smoothstep(1.0, 0.0, exp(-color));

  color *= mat3(
    1.60, -0.53, -0.07,
    -0.10, 1.11, -0.01,
    -0.01, -0.07, 1.08
  );

  color = clamp(color, 0.0, 1.0);

  // sRGB OETF
  color = mix(
    color * 12.92,
    pow(color, vec3(0.4167)) * 1.055 - 0.055,
    step(0.0031308, color)
  );

  // color grading
  color = sign(tex.a) * mix(vec3(0.1), vec3(0.8, 0.9, 1.0), color);

  fragColor = vec4(color, 1);
}
