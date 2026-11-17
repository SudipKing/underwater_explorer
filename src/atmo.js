// ATMO — shaders & atmosphere. No preprocessor directives are used (Q-dependent counts are const ints),
// so the GLSL can be whitespace-stripped onto a single line safely.
const ATMO = /*glsl*/`
// in-water (refracted, n=1.33) sun direction, and its xz shear per metre of height (aU.xz/aU.y)
const vec3 aU=vec3(.3363,.8899,.3082);
const vec2 aV=vec2(.3779,.3463);
// swell: 4 analytic sines, |h| <= .48 — mirrored EXACTLY by waveH() in JS
float wave(vec2 p){return .22*sin(p.x*.19+p.y*.11+uT*.9)+.13*sin(p.y*.37-p.x*.23+uT*1.3)+.08*sin(p.x*.61+p.y*.52-uT*1.9)+.05*sin(p.x*.9-p.y*1.3+uT*2.6);}
// depth palette (in-scatter radiance): turquoise -> teal/blue -> indigo -> midnight purple
vec3 aP(float y){float z=-y;return mix(mix(mix(vec3(.05,.48,.52),vec3(.012,.17,.3),smoothstep(4.,40.,z)),vec3(.022,.03,.12),smoothstep(35.,80.,z)),vec3(.03,.012,.055),smoothstep(75.,120.,z));}
// extinction per metre at height y (green dies faster in the deep -> violet murk)
vec3 aX(float y){return mix(vec3(.045,.018,.013),vec3(.05,.04,.022),smoothstep(20.,90.,-y));}
// ambient at height y: palette + faint violet floor so the abyss never goes pitch black
vec3 aA(float y){return aP(y)*.6+vec3(.012,.008,.03);}
// sunlight colour left after d metres of water column
vec3 aD(float d){return vec3(1.9,1.75,1.5)*exp(-d*vec3(.07,.022,.015));}
// raw caustic field on the surface plane (tiles every 14 m); result in ~[.04,.7]
float aJ(vec2 q){
vec2 i;
q=mod(q*.45,6.2832)-250.;i=q;
float c=.6,t=0.;
for(int n=Z0;n<3;n++){
t=(uT*.5+23.)*(1.-3.5/float(n+1));
i=q+vec2(cos(t-i.x)+sin(t+i.y),sin(t-i.y)+cos(t+i.x));
c+=1./length(vec2(q.x*.005/sin(i.x+t),q.y*.005/cos(i.y+t)));
}
return pow(c/3.,1.4);
}
// crisp caustic filaments at p, projected along the in-water sun; per-channel threshold = slight chromatic split
vec3 aC(vec3 p){return pow(abs(vec3(1.2,1.17,1.14)-aJ(p.xz-aV*p.y)),vec3(8.));}
// light arriving at an underwater point (2 map probes toward the sun)
vec3 lit(vec3 p){float d=max(-p.y,0.);return aD(d)*(clamp(gQ(p+aU*2.)*.7,0.,1.)*clamp(gQ(p+aU*8.)*.25,0.,1.)*(.3+aC(p)*2.4*exp(-d*.035))+.06)+aA(p.y)+glow(p);}
// in-scattered water colour seen along direction d at height y
vec3 aS(vec3 d,float y){return aP(y)*(.7+.3*d.y+.7*pow(max(dot(d,aU),0.),5.));}
// water fog between a and b
vec3 aF(vec3 c,vec3 a,vec3 b){vec3 d=b-a;float l=length(d)+1e-4,y=a.y+d.y/l*min(l,30.)*.5;vec3 T=exp(-l*aX(y));return c*T+aS(d/l,y)*(1.-T);}
vec3 fog(vec3 c,vec3 p){return aF(c,uP,p);}
vec3 tone(vec3 c){c=max(c,0.)*.9;return pow(clamp(c*(2.51*c+.03)/(c*(2.43*c+.59)+.14),0.,1.),vec3(.4545));}
`;

const SCENE = /*glsl*/`
// march / god-ray / shadow step counts for Q = 0,1,2 : 48/80/121, 12/20/30, 7/9/11
const int aNS=48+Q*32+Q/2*9,aNG=8+Q*2+Q/2*4,aNO=7+Q*2;
// sphere trace from a along r up to m; returns distance, or ZF when nothing within m
// the 4 tetrahedron normal taps run in the same loop, so the big map() is instantiated once (fast compile)
float aM(vec3 a,vec3 r,float m,out vec3 n){
float t=0.;int k=0;n=vec3(0.);
for(int i=Z0;i<aNS+4;i++){
int j=k-1;
vec3 K=k>0?2.*vec3(((j+3)>>1)&1,(j>>1)&1,j&1)-1.:vec3(0.);
gL=k>0?0.:1.;
float d=map(a+r*t+K*(.003+.001*t));
if(k>0){n+=K*d;if(++k>4)break;}
else if(d<.001+.0012*t||i>=aNS-1)k=1;
else{t+=d*.8;if(t>m)return ZF;}
}
n=normalize(n);
return t;
}
// tetrahedron normal
// soft shadow toward light direction L, geometric steps
// also returns 2-tap ambient occlusion along n (same loop => one gQ instance)
float aO(vec3 p,vec3 n,vec3 L,out float ao){
float s=1.,t=.4;ao=0.;
for(int i=Z0;i<aNO+2;i++){
bool A=i<2;
float h=A?(i<1?.4:1.6):t,d=gQ(p+(A?n*h:n*.03+L*h));
if(A)ao+=.5*clamp(d/h,0.,1.);
else{s=min(s,8.*d/t);t+=max(d,t*.7);if(s<.02||t>70.)break;}
}
return clamp(s,0.,1.);
}
// player foam rings on the surface: x = height, y = foam.
// A: burst rings spawned at the last crossing, expanding at 2.4 m/s; B: continuous bobbing rings while at the surface
vec2 aR(vec2 p){
float r=length(p-uP.xz),s=uC.y,e=r-1.2-s*2.4,w=sin(e*7.),z=sin(r*6.-uT*3.5),
A=abs(uC.w)*exp(-s*.7)*smoothstep(-3.5,-.5,e)*(1.-smoothstep(-.3,.4,e)),
B=exp(-abs(uP.y-wave(uP.xz))*1.2)*(1.-.6*uC.x)*(.5+.25*min(uC.z,2.))*exp(-r*.35)*smoothstep(0.,.8,r);
return vec2(.06*A*w+.025*B*z,A*pow(max(w,0.),3.)*1.3+B*pow(max(z,0.),6.)*.5);
}
// swell + player rings + fine ripples (k fades them with distance); normals only
float aW(vec2 p,float k){return wave(p)+aR(p).x+k*(.025*sin(p.x*3.1+uT*2.3+2.*sin(p.y*1.3-uT))+.018*sin(p.y*4.3-uT*2.9+2.*sin(p.x*1.9+uT*.7))+.008*sin((p.x+p.y)*9.+uT*4.));}
// upward surface normal at xz, d = view distance
vec3 aN(vec2 p,float d){float k=exp(-d*.02),e=.02+d*.003,h=aW(p,k);return normalize(vec3(h-aW(p+vec2(e,0),k),e,h-aW(p+vec2(0,e),k)));}
// god-ray density: broad slow bands x a soft version of the SAME caustic field (shafts line up with floor caustics)
float aH(vec3 p){vec2 x=p.xz-aV*p.y;float b=.5+.5*sin(x.x*.35+1.7*sin(x.y*.21+uT*.3))*sin(x.y*.3+1.7*sin(x.x*.17-uT*.25));return(.1+b*b*1.4)*(.2+pow(abs(1.17-aJ(x)),4.)*1.8);}
// sky: zenith gradient + horizon haze, high wispy layer + lit low cumulus layer, sun halo + disc
vec3 aK(vec3 d){
float y=max(d.y,0.),s=max(dot(d,SUN),0.),m=smoothstep(0.,.25,y);
vec2 w=d.xz/(y+.12);
vec3 c=mix(mix(vec3(.62,.78,.92),vec3(.08,.27,.7),pow(y,.45)),vec3(.95,.9,.86),.6*exp(-y*14.)),k=vec3(w*.9-uT*.03,uT*.02);
float a=smoothstep(.55,.85,fbm(vec3(w*.3+uT*.01,9.)))*m,b=smoothstep(.45,.75,fbm(k))*m,l=clamp(1.25-1.5*fbm(k+vec3(SUN.xz*.3,0.)),.3,1.);
c=mix(c,vec3(1.,.97,.94),a*.55);
c=mix(c,mix(vec3(.36,.42,.54),vec3(1.05,1.,.94),l)+vec3(1.,.75,.45)*pow(s,8.)*.5,b*.9);
return c+vec3(1.,.85,.6)*(pow(s,6.)*.2+pow(s,90.)*.8)*(1.-b*.6)+vec3(1.,.95,.85)*smoothstep(.9996,.9999,s)*25.*(1.-b);
}
// shade terrain at p (works above and below the water)
vec3 aT(vec3 p,vec3 n,vec3 r){
vec3 al,em;
surf(p,n,al,em);
bool w=p.y<wave(p.xz);
vec3 L=w?aU:SUN;
float d=max(-p.y,0.),ao,l=aO(p,n,L,ao)*(.3+.7*max(dot(n,L),0.)),f=1.-max(dot(n,-r),0.);
// underwater: sun x caustics on every lit face (brightest in the shallows) + depth-graded ambient
vec3 c=w?aD(d)*(l*(.25+aC(p)*2.6*exp(-d*.035))+ao*.07*(1.+n.y))+ao*aA(p.y)*(.7+.5*n.y):vec3(1.9,1.75,1.5)*l+ao*vec3(.2,.3,.45)*(.6+.4*n.y);
// emissive gets a thin-film hue shift with view angle + rim
// + soft diver headlamp so dark tunnels stay readable
return al*(c+glow(p)*ao*.55+vec3(.8,.95,1.)*1.3*max(dot(n,-r),0.)/(1.+.06*dot(p-uP,p-uP)))+.6*em*(.65+.45*cos(6.283*(f*1.2+vec3(0.,.33,.67))+p.y*.5+uT*.4)+1.5*f*f*f);
}
// ray vs wave heightfield; u = +1 origin above water, -1 below
float aI(vec3 a,vec3 r,float u){
if(r.y*u>-.001)return ZF;
float t=max((u*.5-a.y)/r.y,0.);
for(int i=Z0;i<6;i++){vec3 p=a+r*t;t+=u*(p.y-wave(p.xz))/(abs(r.y)+.12);}
return t;
}
void main(){
// origin pushed .3 m along the ray so the waterline can cut across the screen
vec3 rd=ray(v),ro=uP+rd*.3,c=vec3(0),p,n,N,sd=rd;
// sky is evaluated once at the end (weight ws, direction sd) so aK() is instantiated a single time
float ws=0.;
float u=ro.y<wave(ro.xz)?-1.:1.,m=u<0.?140.:ZF,tw=aI(ro,rd,u),t=aM(ro,rd,min(tw,m),N),z=ZF,L=min(t,tw);
if(t<ZF){
p=ro+rd*t;
c=aT(p,N,rd);
z=t+.3;
}else if(tw<m){
// water surface: Snell's window / TIR from below, reflection + see-through from above
p=ro+rd*tw;
n=aN(p.xz,tw);
vec3 r=refract(rd,n*u,u<0.?1.33:.75),R=reflect(rd,n),b=vec3(0);
float f=1.-min(min(abs(dot(rd,n)),abs(dot(r,n))),1.);
f=.02+.98*f*f*f*f*f;
float s=ZF,T=0.,g0=0.;
for(int i=Z0;i<40;i++){float d=gQ(p+r*T);if(i==0){g0=d;if(dot(r,r)<.5)break;}if(d<.02+.004*T){s=T;break;}T+=d;if(T>60.)break;}
if(dot(r,r)>.5){
vec3 q=p+r*min(s,60.);
b=s<ZF?vec3(.28,.3,.26)*aD(max(-q.y,0.))*(.4+aC(q))+aA(q.y)*.3:vec3(0);
if(s>=ZF&&u<0.){ws=1.;sd=r;}
if(u>0.)b=aF(b,p,q);
}
c=mix(b,u<0.?aS(R,ro.y):vec3(0),f);
ws=u<0.?ws*(1.-f):f;
if(u>0.)sd=R;
// lacy foam where rock meets the surface + the player's foam rings (seen from above and below)
float e=clamp((1.-smoothstep(.1,1.4,g0))*smoothstep(.35,.95,n3(vec3(p.xz*3.,uT*.6))+.5*n3(vec3(p.xz*9.,uT)))+aR(p.xz).y*(.4+.8*n3(vec3(p.xz*6.,uT*.7))),0.,1.);
c=mix(c,u>0.?vec3(.85,.9,.95):vec3(.5,.75,.8),e);
ws*=1.-e;
}else if(u>0.)ws=1.;
if(ws>0.)c+=ws*aK(sd);
if(u<0.){
// volumetric sun shafts + bioluminescent haze. Occlusion: one map probe per sample toward the in-water sun,
// alternating 5 m / 15 m, combined with the previous sample's probe (min) so ceilings and shaft walls both cast.
float j=h2(v*uR+uT),ds=min(L,60.)/float(aNG),cs=max(dot(rd,aU),0.),ph=.025+.04*cs*cs+.08*pow(cs,8.),k=0.,y=1.;
vec3 w=vec3(0),E=aX(ro.y),q;
for(int i=Z0;i<aNG;i++){
float s=(float(i)+j)*ds,a=float(i%2)*10.+5.;
q=ro+rd*s;
k=clamp(gQ(q+aU*a)/(1.+.2*a),0.,1.);
w+=(glow(q)*.008+(aD(max(-q.y,0.))*.7+aP(q.y)*1.5)*min(k,y)*aH(q)*ph)*exp(-s*E);
y=k;
}
c=aF(c,ro,ro+rd*min(L,300.))+w*ds;
}else if(L<ZF)c=mix(c,vec3(.7,.8,.9),1.-exp(-L*.004));
o=vec4(c,z);
}
`;

const POST = /*glsl*/`
void main(){
vec2 R=vec2(textureSize(uS,0)),q=v,x=vec2(0);
vec3 d=ray(v),a=uP+d*.3,b=vec3(0);
// h<0: this pixel is submerged (same test as the scene pass)
float h=a.y-wave(a.xz),u=step(h,0.),r=uR.x/uR.y,s=0.,
W=step(.5,uC.w)*clamp(1.-uC.y/2.5,0.,1.),
B=step(uC.w,-.5)*clamp(1.-uC.y,0.,1.);
if(W>0.){
// just surfaced: water sheet draining down the lens with a wobbly meniscus edge
float e=1.25-uC.y*.6+.04*sin(v.x*17.+uT*2.)+.02*sin(v.x*41.),k=e-v.y,
// + rivulets: one per random column, a drop head sliding down with a lensing trail above it
c=floor(v.x*16.),n=h1(c),f=fract(v.x*16.)-.5-.2*sin(v.y*8.+n*40.),y=v.y-1.1+uC.y*(.35+.5*n),m=step(.4,n);
vec2 l=vec2(f,y*16./r);
float t=(1.-smoothstep(.24,.32,length(l)))*m;
x=step(0.,k)*.01*vec2(sin(v.y*37.+v.x*9.+uT*3.),cos(v.x*29.-v.y*13.-uT*2.))+vec2(0,1.5*k*exp(-k*k*2500.));
x.x+=m*f*(1.-smoothstep(.03,.12,abs(f)))*step(0.,y)*exp(-y*2.)*.06;
x=(x-l*t*.08)*W;
s=t*(1.-smoothstep(0.,.12,length(l-vec2(-.08,.1))))*W;
}
if(B>0.){
// just dived: burst of rising bubbles that refract the view
for(int i=Z0;i<2;i++){
float z=7.+float(i)*6.;
vec2 p=vec2(v.x*r,v.y-uC.y*(.5+float(i)*.3))*z,c=floor(p),f=fract(p)-.5-(vec2(h2(c),h2(c+5.))-.5)*.4;
float w=.12+.2*h2(c+9.),l=length(f),m=(1.-smoothstep(w-.05,w,l))*step(.3,h2(c+3.))*B;
x+=f*m*.25/z;
s+=m*(1.-smoothstep(0.,.04,abs(l-w+.03)))*.6;
}
}
// subtle underwater wobble
q+=x+u*.002*vec2(sin(v.y*31.+uT*1.7),cos(v.x*23.+uT*1.3));
vec2 e=(q-.5)*(.002+u*.006)+x*.3;
vec3 c=vec3(texture(uS,q+e).r,texture(uS,q).g,texture(uS,q-e).b);
for(int i=Z0;i<4;i++)b+=max(texture(uS,q+(vec2(i&1,i>>1)*2.-1.)*5./R).rgb-1.,0.);
// bloom, meniscus line, droplet/bubble highlights, vignette
c=tone((c+b*.06+vec3(.5,.8,.8)*(1.-smoothstep(0.,.008,abs(h)))+s*vec3(.7,.85,.9))*(1.-dot(q-.5,q-.5)*(.5+u*.7)));
// gentle split-tone: purple shadows, teal highlights (pure black untouched)
float l=dot(c,vec3(.3,.59,.11));
c+=(vec3(.03,-.01,.05)*(1.-l)+vec3(-.02,.02,.01)*l)*min(l*6.,1.);
o=vec4(c+(h2(v*uR+uT)-.5)/255.,1);
gl_FragDepth=dep(texelFetch(uS,ivec2(clamp(q,0.,.9999)*R),0).a*dot(ray(q),uM[2]));
}
`;

// JS mirror of GLSL wave() — same constants.
function waveH(x, z, t) {
  return .22 * Math.sin(x * .19 + z * .11 + t * .9) + .13 * Math.sin(z * .37 - x * .23 + t * 1.3) +
    .08 * Math.sin(x * .61 + z * .52 - t * 1.9) + .05 * Math.sin(x * .9 - z * 1.3 + t * 2.6);
}
