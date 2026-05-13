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
   "vec4 g=texelFetch(l,ivec2(gl_FragCoord.xy),0);"
   "vec3 m=clamp(smoothstep(1.,0.,exp(-g.xyz/g.w*mat3(.6,.35,.05,.08,.9,.02,.03,.13,.84)))*mat3(1.6,-.53,-.07,-.1,1.11,-.01,-.01,-.07,1.08),0.,1.);"
   "m=sign(g.w)*mix(vec3(.1),vec3(.8,.9,1),mix(m*12.92,pow(m,vec3(.4167))*1.055-.055,step(.0031308,m)));"
   "v=vec4(m,1);"
 "}";

#endif // FRAG_PRESENT_H_
