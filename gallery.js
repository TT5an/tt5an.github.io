"use strict";
(() => {
  const works = {
    rain: { title: "雨中磨砂玻璃", label: "磨砂强度", value: 62, time: 4.2, color: "#101c25", alt: "雨滴在半透明玻璃上滑落，折射背后冷蓝和琥珀色的街灯。" },
    fire: { title: "焰影回旋", label: "扭转强度", value: 54, time: 2.3, color: "#1c1513", alt: "金橙色火焰绕竖轴旋转，火星升起，地面的光影随火焰移动。" },
    jelly: { title: "深海水母", label: "发光强度", value: 65, time: 1.4, color: "#081d2b", alt: "一只蓝紫色半透明水母缓缓收缩伞部，发光的触须在海水中漂动。" }
  };
  const shared = `precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float control;
const float TAU = 6.28318530718;
float hash(vec2 p) {
  vec3 q = fract(p.xyx * vec3(.1031,.1030,.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
mat2 rotate(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }
float bell(float x) { return exp(-x*x); }
vec3 expose(vec3 c) { return pow(1.0-exp(-max(c,0.0)), vec3(.85)); }
`;
  const fragments = {
    rain: `
// City lights behind the pane: soft windows, shop signs, then larger circles of confusion.
vec3 city(vec2 p, float blur, float t) {
  vec3 c = mix(vec3(.025,.054,.084),vec3(.115,.22,.29),smoothstep(-.6,1.4,p.y));
  for (int i=0; i<3; i++) {
    float layer = float(i);
    vec2 g = p * vec2(10.0 + layer*5.0, 9.0 + layer*3.0) + vec2(19.0*layer,2.4);
    vec2 id = floor(g);
    float skyline = .06 + .88*hash(vec2(floor(id.x/3.0),layer));
    float inBuilding = 1.0-smoothstep(skyline-.08,skyline+.04,p.y);
    float window = length((fract(g)-.5)*vec2(1.0,1.42));
    float glow = bell(window / (.12+blur*.35)) * (.18/(.18+blur));
    vec3 lamp = mix(vec3(.21,.65,.96), vec3(1.15,.51,.28),hash(id+21.0));
    c += lamp * glow * smoothstep(.68,.98,hash(id+layer)) * inBuilding * .82;
  }
  // Neon reflections span the lower part of the street.
  c += vec3(.09,.72,1.14)*bell((p.x+.91)/.61)*bell((p.y+.20)/.67);
  c += vec3(1.09,.14,.12)*bell((p.x-.75)/.48)*bell((p.y+.11)/.50);
  for (int i=0; i<23; i++) {
    float n=float(i);
    float x=(hash(vec2(n,2.1))-.5)*5.8;
    float y=(hash(vec2(n,7.0))-.53)*1.32;
    vec2 origin=vec2(x+.022*sin(t*.36+n),y);
    float r=mix(.023,.125,hash(vec2(n,4.0)));
    float d=length(p-origin), spread=.009+blur*.132;
    float core=1.0-smoothstep(max(0.0,r-spread),r+spread,d);
    float halo=bell(d/(r*3.1+spread))*.29;
    vec3 tint=mix(vec3(.12,1.04,1.45),vec3(1.65,.47,.19),step(.52,hash(vec2(n,6.0))));
    if (i==2 || i==9 || i==14) tint=vec3(1.9,1.16,.42);
    c += tint*(core*(1.15-.60*blur)+halo)*(.67+.28*hash(vec2(n,8.2)));
    c += tint*.095*bell((p.x-x)/(.045+r))*bell((p.y+.78)/.30);
  }
  return c;
}
// xy: refracting normal; z: clear water coverage; w: reflection on the lip.
vec4 beads(vec2 p, float scale, float seed, float t) {
  vec2 g=p*scale;
  float col=floor(g.x);
  float speed=.15+.45*hash(vec2(col,seed));
  g.y=g.y*.60+t*speed+hash(vec2(col,seed+8.4))*8.0;
  vec2 id=floor(g), local=fract(g)-.5;
  float n=hash(id+seed);
  local.x-=(hash(id+seed+4.0)-.5)*.52;
  local.x-=.028*sin(g.y*4.8+col);
  local.y-=.17*(n-.5);
  float radius=mix(.074,.23,n*n);
  vec2 q=local/vec2(radius, radius*(.76+.38*n));
  float d=length(q), mask=1.0-smoothstep(.83,1.05,d);
  vec2 bead=vec2(local.x+.019*sin(g.y*19.0),fract((local.y-.11)*4.4)-.5);
  float trail=step(.08,local.y)*(1.0-smoothstep(.038,.081,length(bead*vec2(1, .42))))*smoothstep(.48,.76,n);
  float rim=bell((d-.83)/.13)*(.15+.85*max(dot(normalize(q+.0001),normalize(vec2(-.7,.9))),0.0));
  return vec4(q*mask,max(mask,trail*.66),rim+trail*.24);
}
void main() {
  vec2 p=(2.0*gl_FragCoord.xy-resolution)/resolution.y;
  float t=time*.60;
  vec4 a=beads(p,3.5,3.2,t), b=beads(p+vec2(.11,.3),8.0,41.0,t*.47);
  vec4 wet=a+b*(1.0-a.z);
  float mist=noise(p*5.0+3.0)*.55+noise(p*21.0)*.28+noise(p*69.0)*.17;
  float grit=hash(floor(gl_FragCoord.xy));
  vec2 rough=vec2(noise(p*91.0)-.5,grit-.5);
  float frost=control*(.35+.88*mist)*(1.0-.92*wet.z);
  vec3 light=city(p+rough*frost*.059-wet.xy*.16,.035+frost*.96,t);
  light=mix(light,vec3(.42,.56,.64),frost*.52);
  light*=1.0-.28*wet.z;
  light+=vec3(.72,.91,1.0)*wet.w*.55;
  light+=(grit-.5)*(.017+.085*frost);
  gl_FragColor=vec4(expose(light),1);
}
`,
    fire: `
// Project turning flame sheets at different azimuths onto their height axis.
void main() {
  vec2 p=(2.0*gl_FragCoord.xy-resolution)/resolution.y;
  float t=time, twist=mix(3.6,17.0,control);
  float air=noise(vec2(p.x*4.6-t*.44,p.y*5.3-t*.86));
  float eddy=noise(p*13.0+vec2(air*2.0,-t*1.43));
  float fine=noise(p*36.0+vec2(eddy*2.4,-t*2.6));
  float h=(p.y+.68)/1.38;
  float height=clamp(h,0.,1.);
  float drift=.08*sin(height*6.7+t*.74)*height+.14*height*height;
  float radius=.085+.42*pow(sin(3.14159*height),.85)+.08*height;
  float envelope=smoothstep(-.07,.085,h)*(1.0-smoothstep(.84,1.11,h+.13*(air-.5)));
  float warp=(air-.5)*.15+(eddy-.5)*.065;
  vec3 color=vec3(.016,.011,.018);
  color+=vec3(.18,.043,.009)*bell((p.x-drift)/.72)*bell((p.y+.06)/.83);
  // A moving pool of reflected light and interrupted bands of shadow on the floor.
  vec2 floorP=vec2(p.x,(p.y+.695)*4.5);
  float floorD=length(floorP), angle=atan(floorP.y,floorP.x+.00001);
  float spokes=.52+.48*sin(5.0*angle+2.0*floorD-t*1.19);
  float ground=(1.0-smoothstep(-.70,-.56,p.y))*exp(-floorD*2.9);
  color+=vec3(1.8,.39,.036)*ground*(.23+.77*spokes)*(.55+.45*noise(p*vec2(35,120)));
  color+=vec3(.63,.12,.01)*ground*bell((floorD-.43)/.045);
  for (int i=0;i<8;i++) {
    float fi=float(i), phi=fi*2.39996;
    float a=height*twist-t*1.55+phi+air*.99+eddy*.35;
    float r=radius*mix(.63,1.17,fract(fi*.618+.19));
    float ribbonX=drift+sin(a)*r+warp;
    float depth=.5+.5*cos(a);
    float w=(.018+.041*depth+.034*(1.0-height))*(.75+.6*eddy);
    float d=(p.x-ribbonX)/w;
    float broken=.29+.71*smoothstep(.16,.74,eddy*.56+fine*.22+.19*sin(17.0*height+phi-t)+.13*depth);
    float plume=envelope*broken*(.34+.89*depth);
    color+=vec3(1.85,.19,.009)*exp(-abs(d)*.47)*plume*.63;
    color+=vec3(2.25,.80,.11)*bell(d*1.25)*plume*(.36+.86*fine);
    color+=vec3(1.24,1.02,.43)*bell(d*3.8)*plume*depth*fine;
  }
  // Embers climb through the dark air on either side of the vortex.
  vec2 g=p*vec2(13,8);
  g.y-=t*(.5+.7*hash(vec2(floor(g.x),19.0)));
  vec2 id=floor(g), q=fract(g)-.5;
  float spark=bell(length(q*vec2(1.0,.49))/.041)*step(.78,hash(id));
  color+=vec3(2.5,.73,.11)*spark*(.54+.46*sin(t*2.0+hash(id)*TAU));
  gl_FragColor=vec4(expose(color),1);
}
`,
    jelly: `
vec3 medusa(vec2 q,float clock,float light) {
  q=rotate(.14+.045*sin(clock*.48))*q;
  q.y-=.055*sin(clock);
  float pulse=.5+.5*sin(clock*1.9);
  q.x/=1.0+.055*pulse;
  q.y*=1.0+.043*pulse;
  if(abs(q.x)> .73 || q.y> .81 || q.y< -1.17) return vec3(0.);
  vec3 c=vec3(0.0);
  // Fine silk filaments and the wider, folded oral arms beneath the bell.
  if(q.y<.22) {
    float v=max(.0,.13-q.y);
    for(int i=0;i<17;i++) {
      float fi=float(i), spread=(fi-8.0)/8.0;
      float end=.63+.55*hash(vec2(fi,5.0));
      float fade=(1.0-smoothstep(end-.20,end,v))*smoothstep(-.05,.11,v);
      float wave=.055*sin(v*7.5+clock*1.2+fi*.37)+.021*sin(v*19.0-clock+fi);
      float x=spread*(.445-.14*v)+wave*min(v*4.0,1.0)+.17*v*v;
      float dist=abs(q.x-x);
      float core=exp(-dist/(.0022+.001*(1.0-v*.5)));
      float haze=exp(-dist/.013)*.20;
      c+=mix(vec3(.12,.86,1.1),vec3(.81,.37,1.13),.5+.45*sin(fi))*(core+haze)*fade;
    }
    for(int i=0;i<3;i++) {
      float fi=float(i), w=.043+.016*sin(v*15.0+fi-clock);
      float x=(fi-1.)*.11+.065*sin(v*8.0+fi+clock*.85)+.10*v*v;
      float distance=abs(q.x-x);
      float ruffle=.49+.51*sin(v*63.0+sin(v*24.0+fi)*2.0+q.x*24.0-clock);
      float fade=(1.-smoothstep(.65,1.01,v))*smoothstep(-.06,.1,v);
      c+=vec3(.48,.32,.82)*(bell(distance/w)*(.22+.56*ruffle)+bell((distance-w)/.011)*.39)*fade;
    }
  }
  vec2 cap=vec2(q.x/.51,(q.y-.115)/(.43+.028*pulse));
  float d=length(cap);
  float skirt=.108-.055*sqrt(max(0.,1.-cap.x*cap.x))+.015*sin(35.0*q.x+clock);
  float isCap=smoothstep(skirt-.016,skirt+.018,q.y);
  float inside=1.0-smoothstep(.986,1.012,d);
  float edge=exp(-abs(d-1.0)*29.0);
  float az=atan(cap.x, max(cap.y,.002));
  float veins=pow(.5+.5*cos(az*23.0+.95*sin(d*9.0-clock*.5)),7.0);
  vec3 teal=vec3(.15,1.14,1.29), violet=vec3(1.02,.42,1.19);
  vec3 tint=mix(violet,teal,smoothstep(-.45,.35,q.x+.2*q.y));
  c+=isCap*(tint*(edge*1.57+inside*(.12+.42*veins)*(.35+.85*d))
       +inside*vec3(.70,.68,1.14)*bell((d-.88)/.026)*.46);
  float rim=exp(-abs(q.y-skirt)/.009)*(1.0-smoothstep(.47,.52,abs(q.x)));
  c+=tint*rim*(.9+.4*sin(q.x*71.0));
  c+=vec3(.31,.67,.85)*isCap*exp(-abs(d-1.0)*7.5)*.23;
  return c*light;
}
void main() {
  vec2 p=(2.0*gl_FragCoord.xy-resolution)/resolution.y;
  float t=time;
  vec3 water=mix(vec3(.006,.017,.052),vec3(.024,.16,.21),smoothstep(-1.1,1.35,p.y));
  float shaft=noise(vec2((p.x+p.y*.37)*3.1+t*.053,1.67));
  water+=vec3(.035,.14,.15)*shaft*shaft*smoothstep(-1.4,1.05,p.y);
  vec2 grid=p*vec2(21,17)+vec2(t*.15,-t*.22);
  vec2 id=floor(grid), point=fract(grid)-.5;
  float mote=bell(length(point)/.061)*step(.85,hash(id));
  water+=vec3(.36,.69,.73)*mote*(.6+.35*sin(t+8.0*hash(id)));
  float power=mix(.40,2.65,control);
  water+=medusa((p-vec2(-1.23,.26))/.43,t*.65+1.9,power*.36);
  water+=medusa((p-vec2(1.36,-.16))/.32,t*.77+4.2,power*.24);
  water+=medusa((p-vec2(-.04,.17))/1.12,t*.89,power);
  gl_FragColor=vec4(expose(water),1);
}
`
  };
  const canvas = document.getElementById("screen");
  const poster = document.getElementById("poster");
  const title = document.getElementById("scene-title");
  const range = document.getElementById("parameter");
  const output = document.getElementById("value");
  const play = document.getElementById("play");
  const transport = document.querySelector(".transport");
  const notice = document.querySelector(".notice");
  const tiles = document.querySelectorAll(".tile");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const programs = new Map();
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  let vertex, geometry, active, work;
  let paused = reducedMotion.matches;
  let inView = true;
  let frame = 0;
  let lastTime = null;
  let needsDraw = true;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(error);
    }
    return shader;
  }

  function programFor(key) {
    if (programs.has(key)) return programs.get(key);
    if (!vertex) {
      vertex = compile(gl.VERTEX_SHADER,
        "attribute vec2 point; void main() { gl_Position=vec4(point,0.,1.); }");
      geometry = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, geometry);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    }
    const fragment = compile(gl.FRAGMENT_SHADER, shared + fragments[key]);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, "point");
    gl.linkProgram(program);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(error);
    }
    const linked = { program, resolution: gl.getUniformLocation(program,"resolution"),
      time: gl.getUniformLocation(program,"time"), control: gl.getUniformLocation(program,"control") };
    programs.set(key, linked);
    return linked;
  }

  function fit() {
    const size = canvas.parentElement.getBoundingClientRect();
    const scale = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(680000 / Math.max(size.width * size.height, 1)));
    const width = Math.max(1, Math.round(size.width * scale));
    const height = Math.max(1, Math.round(size.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
  }

  function stopFrame() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = null;
  }

  function schedule() {
    if (!frame && active && inView && !document.hidden && (needsDraw || !paused)) {
      frame = requestAnimationFrame(render);
    }
  }

  function render(now) {
    frame = 0;
    if (!active || document.hidden || !inView) return;
    if (lastTime === null || needsDraw || now - lastTime >= 31) {
      if (!paused && lastTime !== null) work.time += Math.min((now-lastTime)/1000,.15);
      lastTime = now;
      gl.uniform2f(active.resolution, canvas.width, canvas.height);
      gl.uniform1f(active.time, work.time);
      gl.uniform1f(active.control, work.value / 100);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      canvas.hidden = false;
      needsDraw = false;
    }
    schedule();
  }

  function syncPlayback() {
    play.dataset.paused = String(paused);
    document.getElementById("play-label").textContent = paused ? "播放" : "暂停";
    lastTime = null;
    needsDraw = true;
    schedule();
  }

  function setValue() {
    output.value = work.value + "%";
    range.setAttribute("aria-valuetext", output.value);
  }

  function selectScene() {
    const hash = location.hash.slice(1);
    const key = Object.hasOwn(works, hash) ? hash : "rain";
    work = works[key];
    stopFrame();
    active = null;
    canvas.hidden = true;
    document.body.dataset.scene = key;
    title.textContent = work.title;
    document.title = work.title + " · TT5an";
    document.querySelector('meta[name="theme-color"]').content = work.color;
    poster.src = "renders/" + key + ".webp";
    poster.alt = work.alt;
    document.getElementById("parameter-label").textContent = work.label;
    range.value = work.value;
    setValue();
    for (const tile of tiles) {
      if (tile.hash === "#" + key) tile.setAttribute("aria-current", "true");
      else tile.removeAttribute("aria-current");
    }
    if (gl && !gl.isContextLost()) {
      try {
        active = programFor(key);
        gl.useProgram(active.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, geometry);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        fit();
      } catch (error) {
        active = null;
        console.error(work.title, error);
      }
    }
    transport.hidden = !active;
    notice.hidden = Boolean(active);
    syncPlayback();
  }

  play.addEventListener("click", () => { paused = !paused; syncPlayback(); });
  range.addEventListener("input", () => {
    work.value = range.valueAsNumber;
    setValue();
    needsDraw = true;
    schedule();
  });
  reducedMotion.addEventListener("change", () => { paused = reducedMotion.matches; syncPlayback(); });
  document.addEventListener("visibilitychange", () => { stopFrame(); needsDraw = true; schedule(); });
  new ResizeObserver(() => { if (active) { fit(); needsDraw = true; schedule(); } }).observe(canvas.parentElement);
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (!inView) stopFrame();
    else { needsDraw = true; schedule(); }
  }).observe(canvas.parentElement);
  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    stopFrame();
    active = null;
    canvas.hidden = true;
    transport.hidden = true;
    notice.hidden = false;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    programs.clear();
    vertex = geometry = null;
    selectScene();
  });
  window.addEventListener("hashchange", selectScene);
  selectScene();
})();
