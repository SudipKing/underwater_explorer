// ATMO — shaders & atmosphere. No preprocessor directives are used (Q-dependent counts are const ints),
// so the GLSL can be whitespace-stripped onto a single line safely.
const ATMO = /*glsl*/`
// march / god-ray / shadow step counts for Q = 0,1,2 : 48/72/110, 10/16/24, 7/9/11
const int aNS=48+Q*24+Q/2*14,aNG=10+Q*6+Q/2*2,aNO=7+Q*2;
// water extinction per metre (red dies first)
const vec3 aE=vec3(.045,.018,.013);
// swell: 4 analytic sines, |h| <= .48 — mirrored EXACTLY by waveH() in JS
float wave(vec2 p){return .22*sin(p.x*.19+p.y*.11+uT*.9)+.13*sin(p.y*.37-p.x*.23+uT*1.3)+.08*sin(p.x*.61+p.y*.52-uT*1.9)+.05*sin(p.x*.9-p.y*1.3+uT*2.6);}
// swell + fine ripples (k fades them with distance); normals only
float aW(vec2 p,float k){return wave(p)+k*(.025*sin(p.x*3.1+uT*2.3+2.*sin(p.y*1.3-uT))+.018*sin(p.y*4.3-uT*2.9+2.*sin(p.x*1.9+uT*.7))+.008*sin((p.x+p.y)*9.+uT*4.));}
// upward surface normal at xz, d = view distance
vec3 aN(vec2 p,float d){float k=exp(-d*.02),e=.02+d*.003,h=aW(p,k);return normalize(vec3(h-aW(p+vec2(e,0),k),e,h-aW(p+vec2(0,e),k)));}
// sunlight colour left after d metres of water column
vec3 aD(float d){return vec3(1.9,1.75,1.5)*exp(-d*vec3(.07,.022,.015));}
// caustic filaments, projected along SUN onto the surface plane (tiles every 14 m)
float aC(vec3 p){
vec2 q=mod((p.xz-vec2(.5625,.5156)*p.y)*.45,6.2832)-250.,i=q;
float c=.6,t;
for(int n=0;n<3;n++){
t=(uT*.5+23.)*(1.-3.5/float(n+1));
i=q+vec2(cos(t-i.x)+sin(t+i.y),sin(t-i.y)+cos(t+i.x));
c+=1./length(vec2(q.x*.005/sin(i.x+t),q.y*.005/cos(i.y+t)));
}
return pow(abs(1.17-pow(c/3.,1.4)),8.);
}
// in-scattered water colour seen along direction d at height y (<=0)
vec3 aS(vec3 d,float y){return vec3(.04,.42,.5)*exp(min(y,0.)*vec3(.08,.035,.025))*(.65+.35*d.y+.3*pow(max(dot(d,SUN),0.),3.));}
// water fog between a and b
vec3 aF(vec3 c,vec3 a,vec3 b){vec3 d=b-a;float l=length(d)+1e-4;vec3 T=exp(-l*aE);return c*T+aS(d/l,a.y+d.y/l*min(l,30.)*.5)*(1.-T);}
vec3 fog(vec3 c,vec3 p){return aF(c,uP,p);}
// light arriving at an underwater point (2 map probes toward the sun)
vec3 lit(vec3 p){float d=max(-p.y,0.);return aD(d)*(clamp(map(p+SUN*2.)*.7,0.,1.)*clamp(map(p+SUN*8.)*.25,0.,1.)*(.3+aC(p)*2.*exp(-d*.03))+.15)+glow(p);}
vec3 tone(vec3 c){c=max(c,0.)*.9;return pow(clamp(c*(2.51*c+.03)/(c*(2.43*c+.59)+.14),0.,1.),vec3(.4545));}
`;

const SCENE = /*glsl*/`
// sphere trace from a along r up to m; returns distance, or ZF when nothing within m
float aM(vec3 a,vec3 r,float m){float t=0.;for(int i=0;i<aNS;i++){float d=map(a+r*t);if(d<.001+.0012*t)break;t+=d*.9;if(t>m)return ZF;}return t;}
// tetrahedron normal
vec3 aG(vec3 p,float e){vec2 k=vec2(e,-e);return normalize(k.xyy*map(p+k.xyy)+k.yyx*map(p+k.yyx)+k.yxy*map(p+k.yxy)+k.xxx*map(p+k.xxx));}
// soft shadow toward the sun, geometric steps
float aO(vec3 p){float s=1.,t=.4;for(int i=0;i<aNO;i++){float d=map(p+SUN*t);s=min(s,8.*d/t);t+=max(d,t*.7);if(s<.02||t>70.)break;}return clamp(s,0.,1.);}
// broad sun-shaft pattern for the volumetric march
float aB(vec3 p){vec2 q=p.xz-vec2(.5625,.5156)*p.y;float b=.5+.5*sin(q.x*.9+1.7*sin(q.y*.5+uT*.4))*sin(q.y*.8+1.7*sin(q.x*.45-uT*.3));return .12+b*b*b*1.6;}
// sky: gradient, clouds, sun disc + bloom
vec3 aK(vec3 d){
float y=max(d.y,0.),s=max(dot(d,SUN),0.);
vec3 c=mix(vec3(.55,.75,.95),vec3(.12,.32,.75),sqrt(y));
c=mix(c,vec3(1.,.96,.9),.75*smoothstep(.5,.8,fbm(vec3(d.xz/(y+.2)*1.2+uT*.01,uT*.02)))*smoothstep(0.,.15,y));
return c+vec3(1.,.8,.55)*(pow(s,8.)*.25+pow(s,400.)*4.+pow(s,4000.)*40.);
}
// shade terrain at p (works above and below the water)
vec3 aT(vec3 p,vec3 n,vec3 r){
vec3 al,em;
surf(p,n,al,em);
float d=max(-p.y,0.),ao=.5*clamp(map(p+n*.4)*2.5,0.,1.)+.5*clamp(map(p+n*1.6)*.625,0.,1.),
l=aO(p+n*.03)*(.3+.7*max(dot(n,SUN),0.)),f=1.-max(dot(n,-r),0.);
vec3 c=p.y<wave(p.xz)?aD(d)*(l*(.3+aC(p)*2.*exp(-d*.03))+ao*(.13+.07*n.y)):vec3(1.9,1.75,1.5)*l+ao*vec3(.2,.3,.45)*(.6+.4*n.y);
// emissive gets a thin-film hue shift with view angle + rim
// + soft diver headlamp so dark tunnels stay readable
return al*(c+glow(p)*ao*.55+vec3(.8,.95,1.)*1.3*max(dot(n,-r),0.)/(1.+.06*dot(p-uP,p-uP)))+.6*em*(.65+.45*cos(6.283*(f*1.2+vec3(0.,.33,.67))+p.y*.5+uT*.4)+1.5*f*f*f);
}
// ray vs wave heightfield; u = +1 origin above water, -1 below
float aI(vec3 a,vec3 r,float u){
if(r.y*u>-.001)return ZF;
float t=max((u*.5-a.y)/r.y,0.);
for(int i=0;i<6;i++){vec3 p=a+r*t;t+=u*(p.y-wave(p.xz))/(abs(r.y)+.12);}
return t;
}
void main(){
// origin pushed .3 m along the ray so the waterline can cut across the screen
vec3 rd=ray(v),ro=uP+rd*.3,c=vec3(0),p,n;
float u=ro.y<wave(ro.xz)?-1.:1.,m=u<0.?140.:ZF,tw=aI(ro,rd,u),t=aM(ro,rd,min(tw,m)),z=ZF,L=min(t,tw);
if(t<ZF){
p=ro+rd*t;
c=aT(p,aG(p,.003+.001*t),rd);
z=t+.3;
}else if(tw<m){
// water surface: Snell's window / TIR from below, reflection + see-through from above
p=ro+rd*tw;
n=aN(p.xz,tw);
vec3 r=refract(rd,n*u,u<0.?1.33:.75),R=reflect(rd,n),b=vec3(0);
float f=1.-min(min(abs(dot(rd,n)),abs(dot(r,n))),1.);
f=.02+.98*f*f*f*f*f;
if(dot(r,r)>.5){
float s=aM(p,r,60.);
vec3 q=p+r*min(s,60.);
b=s<ZF?vec3(.28,.3,.26)*aD(max(-q.y,0.))*(.4+aC(q)):u<0.?aK(r):vec3(0);
if(u>0.)b=aF(b,p,q);
}
c=mix(b,u<0.?aS(R,ro.y):aK(R),f);
// foam where rock meets the surface
c=mix(c,vec3(.85),(1.-smoothstep(.1,.8,map(p)))*(.4+.4*n3(vec3(p.xz*4.,uT))));
}else if(u>0.)c=aK(rd);
if(u<0.){
// volumetric sun shafts + bioluminescent haze
float j=h2(v*uR+uT),ds=min(L,55.)/float(aNG),ph=.012+.036*pow(max(dot(rd,SUN),0.),2.);
vec3 w=vec3(0);
for(int i=0;i<aNG;i++){
float s=(float(i)+j)*ds;
vec3 q=ro+rd*s;
float k=clamp(map(q+SUN*5.)*.4,0.,1.);
if(Q==2&&k>0.)k*=clamp(map(q+SUN*16.)*.12,0.,1.);
w+=(glow(q)*.008+aD(max(-q.y,0.))*k*aB(q)*ph)*exp(-s*aE);
}
c=aF(c,ro,ro+rd*min(L,300.))+w*ds;
}else if(L<ZF)c=mix(c,vec3(.55,.75,.95),1.-exp(-L*.004));
o=vec4(c,z);
}
`;

const POST = /*glsl*/`
void main(){
vec2 R=vec2(textureSize(uS,0)),q=v;
vec3 d=ray(v),a=uP+d*.3,b=vec3(0);
// h<0: this pixel is submerged (same test as the scene pass)
float h=a.y-wave(a.xz),u=step(h,0.);
q+=u*.002*vec2(sin(v.y*31.+uT*1.7),cos(v.x*23.+uT*1.3));
vec2 e=(q-.5)*(.002+u*.006);
vec3 c=vec3(texture(uS,q+e).r,texture(uS,q).g,texture(uS,q-e).b);
for(int i=0;i<4;i++)b+=max(texture(uS,q+(vec2(i&1,i>>1)*2.-1.)*5./R).rgb-1.,0.);
// bloom, meniscus line, vignette
c=(c+b*.06+vec3(.5,.8,.8)*(1.-smoothstep(0.,.008,abs(h))))*(1.-dot(q-.5,q-.5)*(.5+u*.7));
o=vec4(tone(c)+(h2(v*uR+uT)-.5)/255.,1);
gl_FragDepth=dep(texelFetch(uS,ivec2(clamp(q,0.,.9999)*R),0).a*dot(ray(q),uM[2]));
}
`;

// JS mirror of GLSL wave() — same constants.
function waveH(x, z, t) {
  return .22 * Math.sin(x * .19 + z * .11 + t * .9) + .13 * Math.sin(z * .37 - x * .23 + t * 1.3) +
    .08 * Math.sin(x * .61 + z * .52 - t * 1.9) + .05 * Math.sin(x * .9 - z * 1.3 + t * 2.6);
}
