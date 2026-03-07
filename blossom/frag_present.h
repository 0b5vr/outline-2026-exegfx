// Generated with Shader Minifier 1.3.6 (https://github.com/laurentlb/Shader_Minifier/)
#ifndef FRAG_PRESENT_H_
# define FRAG_PRESENT_H_
# define VAR_accumulatorTex "l"
# define VAR_fragColor "v"
# define VAR_iResolution "u"

const char *present_frag =
 "#version 430\n"
 "layout(location=0) out vec4 v;"
 "layout(location=0) uniform vec4 u;"
 "layout(binding=0) uniform sampler2D l;"
 "void main()"
 "{"
   "vec4 m=texelFetch(l,ivec2(gl_FragCoord.xy),0);"
   "vec3 f=m.xyz/m.w;"
   "f*=mat3(.59719,.35458,.04823,.076,.90834,.01566,.0284,.13383,.83777);"
   "f=(f*(f+.0245786f)-9.0537e-5f)/(f*(.983729f*f+.432951f)+.238081f);"
   "f*=mat3(1.60475,-.53108,-.07367,-.10208,1.10813,-.00605,-.00327,-.07276,1.07602);"
   "f=clamp(f,0.,1.);"
   "f=mix(f*12.92,pow(f,vec3(.4167))*1.055-.055,step(.0031308,f));"
   "f=mix(vec3(-.1,.05,.05),vec3(1.1,1,.9),f);"
   "v=vec4(f,1);"
 "}";

#endif // FRAG_PRESENT_H_
