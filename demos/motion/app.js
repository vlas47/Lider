(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { paused: reduced.matches, gain: .55, mode: 0, modeCurrent: 0, time: 0, pointer: [0, 0], scrollVelocity: 0 };
  const scenes = [];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mobile = () => innerWidth < 701;
  let lastTime = performance.now(), previousScroll = scrollY, frame = 0, needsDraw = true;

  function shader(gl, kind, source) {
    const s = gl.createShader(kind); gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const message = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(message); }
    return s;
  }
  function program(gl, vertex, fragment) {
    const p = gl.createProgram(); const v = shader(gl, gl.VERTEX_SHADER, vertex); const f = shader(gl, gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p); gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  const basicVertex = 'attribute vec2 aPosition; varying vec2 vUv; void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}';
  function quad(gl) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW); return b; }
  function drawQuad(gl, p, b) { gl.useProgram(p); gl.bindBuffer(gl.ARRAY_BUFFER,b); const a=gl.getAttribLocation(p,'aPosition'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0); gl.drawArrays(gl.TRIANGLES,0,6); }
  function sizeCanvas(canvas, maxDpr=1.3) { const r=canvas.getBoundingClientRect(); const dpr=Math.min(devicePixelRatio||1,mobile()?1:maxDpr); const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr)); if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;return true;}return false; }
  function context(canvas) { return canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:true}); }
  function ready(canvas) { canvas.parentElement.classList.add('webgl-ready'); canvas.dataset.status='ready'; canvas.addEventListener('webglcontextlost',()=>{canvas.dataset.status='fallback';canvas.parentElement.classList.remove('webgl-ready');}); }
  function watch(canvas, item) { item.visible=true; if('IntersectionObserver' in window){const o=new IntersectionObserver(es=>{item.visible=es[0].isIntersecting;if(item.visible)needsDraw=true;},{rootMargin:'100px'});o.observe(canvas);} scenes.push(item); }

  function makeSculpture() {
    const canvas=$('#sculpture'),gl=context(canvas); if(!gl) return;
    const fragment=`precision highp float;
      uniform vec2 uResolution; uniform vec2 uPointer; uniform float uTime,uGain,uMode;
      mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
      vec3 turn(vec3 p){p.xz=rot(uTime*.10+uPointer.x*.26)*p.xz;p.yz=rot(.86+uPointer.y*.22)*p.yz;p.xy=rot(-.46)*p.xy;return p;}
      float map(vec3 p){p=turn(p);float a=atan(p.z,p.x);float pulse=clamp(uMode-1.,0.,1.);float k=.14+uGain*.045;
        p.y+=sin(a*3.+uTime*.45)*k;float r=1.04+sin(a*2.-uTime*.21)*.045;
        float thick=.29+sin(a*3.-uTime*.4)*.055;thick-=pulse*.07;
        return length(vec2(length(p.xz)-r,p.y))-thick;}
      vec3 normal(vec3 p){vec2 e=vec2(.002,0.);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
      void main(){vec2 uv=(gl_FragCoord.xy*2.-uResolution)/uResolution.y;
        vec3 bg=vec3(.063,.071,.063);float halo=exp(-length(uv-vec2(.0,.04))*2.4);bg+=vec3(.095,.13,.025)*halo*.24;
        float grid=(1.-smoothstep(.0,.008,abs(fract((uv.x+.0)*5.)-.5)))*(1.-smoothstep(1.0,1.9,length(uv)))*.012;
        bg+=vec3(grid);float shadow=exp(-pow(uv.x*1.6,2.)-pow((uv.y+.88)*8.,2.));bg-=shadow*.018;
        vec3 ro=vec3(0.,0.,4.6),rd=normalize(vec3(uv*1.15,-2.7));float t=0.;bool hit=false;
        for(int i=0;i<76;i++){vec3 p=ro+rd*t;float d=map(p);if(d<.0018){hit=true;break;}t+=d*.82;if(t>8.)break;}
        vec3 col=bg;float cloud=1.-min(abs(uMode-1.),1.);
        if(hit){vec3 p=ro+rd*t,n=normal(p),r=reflect(rd,n);float diff=max(dot(n,normalize(vec3(-.6,.9,1.))),0.);
          float edge=pow(1.-max(dot(-rd,n),0.),2.4);float env=smoothstep(-.5,.9,r.y)*.48+pow(max(0.,sin(r.x*2.8+r.y*2.2)),12.)*.8;
          float spec=pow(max(dot(r,normalize(vec3(-.4,.9,1.2))),0.),65.);
          vec3 steel=vec3(.24,.28,.22)*(diff*.6+.22)+vec3(.78,.81,.70)*env+vec3(1.,1.,.86)*spec;
          float band=sin(turn(p).y*72.+turn(p).x*4.)*.5+.5;steel*=.89+.11*band;
          vec3 acid=vec3(.72,.97,.22);steel+=acid*edge*.48+acid*pow(max(r.x*.6+r.y*.3,0.),4.)*.5;
          steel=mix(steel,acid*.9,clamp(uMode-1.,0.,1.)*pow(edge,2.)*.6);
          col=mix(bg,steel,1.-cloud*.96);}
        float vign=1.-smoothstep(.6,2.4,length(uv));col*=.88+vign*.12;gl_FragColor=vec4(col,1.);}`;
    const p=program(gl,basicVertex,fragment),b=quad(gl),u={};for(const n of ['uResolution','uPointer','uTime','uGain','uMode'])u[n]=gl.getUniformLocation(p,n);
    const vp=`precision highp float;attribute vec4 aSeed;uniform vec2 uResolution,uPointer;uniform float uTime,uGain,uMode,uPixel;varying vec4 vColor;
      mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
      void main(){float tau=6.2831853;float a=aSeed.x*tau;float y=aSeed.y*2.-1.;float circle=sqrt(max(0.,1.-y*y));vec3 sphere=vec3(cos(a)*circle,y,sin(a)*circle)*1.19;
        float shell=1.35+aSeed.z*.75;vec3 dust=sphere*shell;vec3 ring=vec3(cos(a)*(1.06+(aSeed.y-.5)*.7),(aSeed.z-.5)*.7,sin(a)*(1.06+(aSeed.y-.5)*.7));
        ring.y+=sin(a*3.+uTime*.45)*(.14+uGain*.045);float cloud=1.-min(abs(uMode-1.),1.);vec3 pos=mix(ring,sphere,cloud);
        if(aSeed.w>.88)pos=dust;pos.xz=rot(-uTime*.10-uPointer.x*.26)*pos.xz;pos.yz=rot(-.86-uPointer.y*.22)*pos.yz;pos.xy=rot(.46)*pos.xy;
        pos+=normalize(pos)*sin(uTime*.8+a*5.)*uGain*.018;float depth=4.6-pos.z;gl_Position=vec4(pos.x*2.35/depth*uResolution.y/uResolution.x,pos.y*2.35/depth,0.,1.);
        gl_PointSize=(.75+aSeed.z*1.7+cloud*.35)*uPixel;float shine=.18+.82*pow(aSeed.z,3.);float alpha=mix(.08,shine*.63,cloud);if(aSeed.w>.88)alpha=.10+aSeed.z*.22;
        vColor=vec4(mix(vec3(.78,.88,.68),vec3(.83,.98,.34),aSeed.y),alpha);}`;
    const fp='precision mediump float;varying vec4 vColor;void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(.10,.5,d);gl_FragColor=vec4(vColor.rgb,vColor.a*a);}';
    const pp=program(gl,vp,fp),pb=gl.createBuffer(),count=mobile()?5500:12500,seeds=new Float32Array(count*4);let seed=9123;
    function rnd(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}for(let i=0;i<seeds.length;i++)seeds[i]=rnd();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,seeds,gl.STATIC_DRAW);
    const pu={};for(const n of ['uResolution','uPointer','uTime','uGain','uMode','uPixel'])pu[n]=gl.getUniformLocation(pp,n);
    ready(canvas);
    const item={draw(){sizeCanvas(canvas);gl.viewport(0,0,canvas.width,canvas.height);gl.disable(gl.BLEND);gl.useProgram(p);
      gl.uniform2f(u.uResolution,canvas.width,canvas.height);gl.uniform2f(u.uPointer,state.pointer[0],state.pointer[1]);gl.uniform1f(u.uTime,state.time);gl.uniform1f(u.uGain,state.gain);gl.uniform1f(u.uMode,state.modeCurrent);drawQuad(gl,p,b);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.useProgram(pp);gl.bindBuffer(gl.ARRAY_BUFFER,pb);const a=gl.getAttribLocation(pp,'aSeed');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,4,gl.FLOAT,false,0,0);
      gl.uniform2f(pu.uResolution,canvas.width,canvas.height);gl.uniform2f(pu.uPointer,state.pointer[0],state.pointer[1]);gl.uniform1f(pu.uTime,state.time);gl.uniform1f(pu.uGain,state.gain);gl.uniform1f(pu.uMode,state.modeCurrent);gl.uniform1f(pu.uPixel,Math.min(devicePixelRatio||1,1.3));gl.drawArrays(gl.POINTS,0,count);gl.disable(gl.BLEND);
    }};watch(canvas,item);
  }

  function makeLiquid(){const canvas=$('#liquid'),gl=context(canvas);if(!gl)return;const n=256;
    const update=program(gl,basicVertex,`precision highp float;varying vec2 vUv;uniform sampler2D uField;uniform vec2 uTexel,uPoint;uniform float uSplat;
      void main(){vec4 c=texture2D(uField,vUv);float l=texture2D(uField,vUv-vec2(uTexel.x,0.)).r-.5;float r=texture2D(uField,vUv+vec2(uTexel.x,0.)).r-.5;
      float b=texture2D(uField,vUv-vec2(0.,uTexel.y)).r-.5;float t=texture2D(uField,vUv+vec2(0.,uTexel.y)).r-.5;float h=((l+r+b+t)*.5-(c.g-.5))*.987;
      vec2 d=vUv-uPoint;h+=exp(-dot(d,d)*700.)*uSplat;h*=smoothstep(.0,.025,vUv.x)*smoothstep(.0,.025,1.-vUv.x)*smoothstep(.0,.025,vUv.y)*smoothstep(.0,.025,1.-vUv.y);
      gl_FragColor=vec4(clamp(h+.5,.04,.96),c.r,.5,1.);}`);
    const render=program(gl,basicVertex,`precision highp float;varying vec2 vUv;uniform sampler2D uField;uniform vec2 uTexel;uniform float uTime;
      void main(){float l=texture2D(uField,vUv-vec2(uTexel.x,0.)).r;float r=texture2D(uField,vUv+vec2(uTexel.x,0.)).r;float b=texture2D(uField,vUv-vec2(0.,uTexel.y)).r;float t=texture2D(uField,vUv+vec2(0.,uTexel.y)).r;
      vec3 n=normalize(vec3((l-r)*8.,(b-t)*8.,.18));vec3 light=normalize(vec3(.4,.7,1.));float d=max(dot(n,light),0.);float h=texture2D(uField,vUv).r-.5;
      float sweep=sin(vUv.x*4.+vUv.y*3.+h*23.);vec3 dark=vec3(.025,.14,.105);vec3 base=mix(dark,vec3(.20,.43,.25),vUv.x*.5+vUv.y*.3+.12);
      base+=vec3(.51,.64,.25)*pow(d,18.)*.75;base+=vec3(.23,.39,.15)*pow(max(sweep,0.),3.)*.35;base+=vec3(.14,.30,.11)*abs(h)*3.;gl_FragColor=vec4(base,1.);}`);
    const q=quad(gl),textures=[],fbos=[],initial=new Uint8Array(n*n*4);for(let i=0;i<initial.length;i+=4){initial[i]=128;initial[i+1]=128;initial[i+2]=128;initial[i+3]=255;}
    for(let i=0;i<2;i++){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,n,n,0,gl.RGBA,gl.UNSIGNED_BYTE,initial);textures.push(t);const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Liquid framebuffer unavailable');fbos.push(f);}
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.disable(gl.DITHER);const up={};for(const k of ['uField','uTexel','uPoint','uSplat'])up[k]=gl.getUniformLocation(update,k);const rp={};for(const k of ['uField','uTexel','uTime'])rp[k]=gl.getUniformLocation(render,k);
    let current=0,splat=.08,point=[.68,.62],auto=0;const parent=$('#liquid-panel');
    function interact(e){if(state.paused)return;const r=parent.getBoundingClientRect();point=[(e.clientX-r.left)/r.width,1-(e.clientY-r.top)/r.height];splat=.035+state.gain*.06;}
    parent.addEventListener('pointermove',interact,{passive:true});parent.addEventListener('pointerdown',interact,{passive:true});ready(canvas);
    watch(canvas,{draw(dt){if(!state.paused){auto+=dt;if(auto>3.6){auto=0;point=[.53+Math.sin(state.time*.7)*.23,.55+Math.cos(state.time*.5)*.23];splat=.025+state.gain*.03;}
      for(let k=0;k<2;k++){const next=1-current;gl.bindFramebuffer(gl.FRAMEBUFFER,fbos[next]);gl.viewport(0,0,n,n);gl.useProgram(update);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures[current]);gl.uniform1i(up.uField,0);gl.uniform2f(up.uTexel,1/n,1/n);gl.uniform2f(up.uPoint,point[0],point[1]);gl.uniform1f(up.uSplat,k===0?splat:0);drawQuad(gl,update,q);current=next;}splat=0;}
      sizeCanvas(canvas,1);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(render);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures[current]);gl.uniform1i(rp.uField,0);gl.uniform2f(rp.uTexel,1/n,1/n);gl.uniform1f(rp.uTime,state.time);drawQuad(gl,render,q);
    }});
  }

  function makeType(){const canvas=$('#type-canvas'),gl=context(canvas);if(!gl)return;
    const p=program(gl,basicVertex,`precision highp float;varying vec2 vUv;uniform sampler2D uText;uniform float uTime,uVelocity,uGain;uniform vec2 uPointer;
      void main(){vec2 uv=vUv;float stretch=1.+min(abs(uVelocity)*.16,.18);uv.x=(uv.x-.5)/stretch+.5;uv.y+=sin(uv.x*7.+uTime*.65)*(.025+uGain*.035)+uVelocity*.025*sin(uv.x*3.14);uv.x+=sin(uv.y*8.+uTime*.4+uPointer.x)*.009*uGain;
      float a=texture2D(uText,uv).a;vec3 bg=vec3(.784,.875,.612);vec3 ink=vec3(.11,.17,.075);gl_FragColor=vec4(mix(bg,ink,a),1.);}`);
    const q=quad(gl),texture=gl.createTexture(),textCanvas=document.createElement('canvas');textCanvas.width=1600;textCanvas.height=400;const ctx=textCanvas.getContext('2d');
    function upload(){ctx.clearRect(0,0,1600,400);ctx.fillStyle='#fff';ctx.font='750 212px Manrope, Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('ДВИЖЕНИЕ',800,205,1510);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,textCanvas);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
    upload();if(document.fonts)document.fonts.ready.then(()=>{upload();needsDraw=true;});const u={};for(const k of ['uText','uTime','uVelocity','uGain','uPointer'])u[k]=gl.getUniformLocation(p,k);ready(canvas);
    watch(canvas,{draw(){sizeCanvas(canvas);gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(p);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(u.uText,0);gl.uniform1f(u.uTime,state.time);gl.uniform1f(u.uVelocity,state.paused?0:state.scrollVelocity);gl.uniform1f(u.uGain,state.gain);gl.uniform2f(u.uPointer,state.pointer[0],state.pointer[1]);drawQuad(gl,p,q);}});
  }

  function initGraphics(){for(const fn of [makeSculpture,makeLiquid,makeType]){try{fn();}catch(e){console.warn('Visual fallback:',e.message);}}
    if($('#sculpture').dataset.status!=='ready'){$('.art-caption').textContent='Статичный просмотр · анимация недоступна в этом браузере';$('.scene-switch').style.display='none';}
    if($('#liquid').dataset.status!=='ready'){$('.panel-bottom span').textContent='Статичный просмотр поверхности';}
    if($('#type-canvas').dataset.status!=='ready'){$('.type-panel>p').textContent='Статичный просмотр типографики';}
    if([...document.querySelectorAll('canvas')].some(c=>c.dataset.status!=='ready')){$('.lab-footnote p').textContent='Часть эффектов показана в статичном режиме. Для полного просмотра попробуйте браузер с поддержкой интерактивной графики.';}
  }
  let audio=null,audioEnabled=false;
  function createAudio(){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;const ctx=new AC(),gain=ctx.createGain(),filter=ctx.createBiquadFilter(),panner=ctx.createStereoPanner?ctx.createStereoPanner():null;gain.gain.value=0;filter.type='lowpass';filter.frequency.value=280;filter.Q.value=.4;
    for(const f of [55,110,164.81]){const osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=f;osc.connect(filter);osc.start();}filter.connect(gain);if(panner){gain.connect(panner);panner.connect(ctx.destination);}else gain.connect(ctx.destination);return{ctx,gain,panner};}
  $('#sound-toggle').addEventListener('click',async()=>{try{if(!audio)audio=createAudio();if(!audio){$('#audio-note').textContent='Пространственный звук недоступен в этом браузере.';return;}await audio.ctx.resume();audioEnabled=!audioEnabled;audio.gain.gain.setTargetAtTime(audioEnabled?.018:0,audio.ctx.currentTime,.15);$('#sound-toggle').setAttribute('aria-pressed',String(audioEnabled));$('#sound-toggle span').textContent=audioEnabled?'Звук: вкл':'Звук: выкл';$('#audio-note').textContent=audioEnabled?'Двигайте курсором: направление звука меняется.':'Пространственный звук включается по желанию.';}catch(e){$('#audio-note').textContent='Воспроизведение звука недоступно.';}});
  function syncMotion(){needsDraw=true;document.body.classList.toggle('is-paused',state.paused);const button=$('#motion-toggle');button.setAttribute('aria-pressed',String(state.paused));button.querySelector('span:last-child').textContent=state.paused?'Продолжить эффекты':'Пауза эффектов';button.querySelector('.control-symbol').textContent=state.paused?'▷':'Ⅱ';}
  $('#motion-toggle').addEventListener('click',()=>{state.paused=!state.paused;syncMotion();});reduced.addEventListener('change',e=>{state.paused=e.matches;syncMotion();});syncMotion();
  $('#intensity').addEventListener('input',e=>{needsDraw=true;state.gain=Number(e.target.value)/100;e.target.style.background=`linear-gradient(90deg,var(--acid) ${e.target.value}%,#404936 ${e.target.value}%)`;});
  document.querySelectorAll('[data-scene]').forEach(button=>button.addEventListener('click',()=>{needsDraw=true;state.mode=Number(button.dataset.scene);document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(state.paused)state.modeCurrent=state.mode;}));
  window.addEventListener('resize',()=>{needsDraw=true;},{passive:true});
  window.addEventListener('pointermove',e=>{state.pointer=[e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2];if(audio?.panner)audio.panner.pan.setTargetAtTime(state.pointer[0]*.85,audio.ctx.currentTime,.08);},{passive:true});
  document.addEventListener('visibilitychange',()=>{lastTime=performance.now();if(audio)audio.gain.gain.setTargetAtTime(!document.hidden&&audioEnabled?.018:0,audio.ctx.currentTime,.15);});
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target);}},{threshold:.08});document.querySelectorAll('.reveal').forEach(e=>observer.observe(e));document.body.classList.add('js-motion');}
  initGraphics();
  const stretch=$('.stretch-title');
  function tick(now){requestAnimationFrame(tick);if(document.hidden)return;const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;if(!state.paused)state.time+=dt*(.35+state.gain*.9);state.modeCurrent+=(state.mode-state.modeCurrent)*.065;
    const delta=scrollY-previousScroll;previousScroll=scrollY;state.scrollVelocity+=(clamp(delta*.025,-1.2,1.2)-state.scrollVelocity)*.12;
    if(!state.paused&&stretch){const v=state.scrollVelocity;stretch.style.transform=`scaleX(${1-Math.abs(v)*.018}) skewX(${v*-1.8}deg)`;}else if(stretch)stretch.style.transform='none';
    if(!state.paused||needsDraw){for(const s of scenes)if(s.visible)s.draw(dt);needsDraw=false;}
    if(frame++%6===0){$('#coord-x').textContent=state.pointer[0].toFixed(2);$('#coord-y').textContent=state.pointer[1].toFixed(2);}
  }requestAnimationFrame(tick);
})();
