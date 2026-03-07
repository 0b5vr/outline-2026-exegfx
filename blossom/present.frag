/* framework header */
#version 430
layout(location = 0) out vec4 fragColor;
layout(location = 0) uniform vec4 iResolution;
layout(binding = 0) uniform sampler2D accumulatorTex;




void main() {
  vec4 tex = texelFetch(accumulatorTex,ivec2(gl_FragCoord.xy),0);

  vec3 color = tex.rgb / tex.a;

  // ACES filmic tone mapping
  // Ref: https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl
  color *= mat3(
    0.59719, 0.35458, 0.04823,
    0.07600, 0.90834, 0.01566,
    0.02840, 0.13383, 0.83777
  );

  vec3 i_a = color * (color + 0.0245786f) - 0.000090537f;
  vec3 i_b = color * (0.983729f * color + 0.4329510f) + 0.238081f;
  color = i_a / i_b;

  color *= mat3(
    1.60475, -0.53108, -0.07367,
    -0.10208,  1.10813, -0.00605,
    -0.00327, -0.07276,  1.07602
  );

  color = clamp(color, 0.0, 1.0);

  // sRGB OETF
  color = mix(
    color * 12.92,
    pow(color, vec3(0.4167)) * 1.055 - 0.055,
    step(0.0031308, color)
  );

  // color grading
  color = mix(vec3(-0.1, 0.05, 0.05), vec3(1.1, 1.0, 0.9), color);

  fragColor = vec4(color,1);
}
