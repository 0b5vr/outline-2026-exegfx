// Generated with Shader Minifier 1.5.1 (https://github.com/laurentlb/Shader_Minifier/)
#ifndef FRAG_PRESENT_H_
# define FRAG_PRESENT_H_
# define VAR_accumulatorTex "l"
# define VAR_fragColor "v"
# define VAR_iResolution "m"

const char *present_frag =
 "#version 430\n"
 "layout(location=0)out vec4 v;"
 "layout(location=0)uniform vec4 m;"
 "layout(binding=0)uniform sampler2D l;"
 "void main()"
 "{"
   "vec4 m=texelFetch(l,ivec2(gl_FragCoord.xy),0);"
   "vec3 s=clamp(smoothstep(1.,0.,exp(-m.xyz/m.w*mat3(.6,.35,.05,.08,.9,.02,.03,.13,.84)))*mat3(1.6,-.53,-.07,-.1,1.11,-.01,-.01,-.07,1.08),0.,1.);"
   "s=mix(vec3(.1),vec3(.8,.9,1),mix(s*12.92,pow(s,vec3(.4167))*1.055-.055,step(.0031308,s)));"
   "v=vec4(s,1);"
 "}";

#endif // FRAG_PRESENT_H_
