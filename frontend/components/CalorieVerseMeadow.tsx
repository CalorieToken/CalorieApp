"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DisplayLanguagePicker, useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { localeDirection } from "@/lib/locales";
import translations from "@/config/calorieverse-meadow-copy.json";
import {
  appleCount, initialMeadow, interact, meadow, meadowComplete, MEADOW_KEY,
  moveToward, nearby, position, restoreMeadow, STARTER_KEY,
  type MeadowObject, type MeadowState, type Point,
} from "@/lib/calorieVerseMeadow";
import styles from "./CalorieVerseMeadow.module.css";

type Copy = typeof translations.en;
const directionKeys: Record<string, Point> = {
  ArrowUp: {x: 0, y: -1}, w: {x: 0, y: -1},
  ArrowDown: {x: 0, y: 1}, s: {x: 0, y: 1},
  ArrowLeft: {x: -1, y: 0}, a: {x: -1, y: 0},
  ArrowRight: {x: 1, y: 0}, d: {x: 1, y: 0},
};

// A local scene renderer. Motion, public scenery and input never need server writes.
function MeadowTerrain() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 0, 650);
    gradient.addColorStop(0, "#b9d5a7"); gradient.addColorStop(1, "#74ac68");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1000, 650);
    // Soft natural hills beyond the meadow; no mountain reveal or brand colours.
    for (const [x,y,r,color] of [[100,-30,230,"#759481"],[380,-90,280,"#8fa99b"],[770,-60,300,"#90a89a"]] as const) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x,y,r,r*.65,0,0,Math.PI*2); ctx.fill();
    }
    ctx.lineCap = "round";
    const path = () => { ctx.beginPath(); ctx.moveTo(95,650); ctx.bezierCurveTo(50,445,380,440,480,370); ctx.bezierCurveTo(610,285,490,195,565,117); };
    path(); ctx.strokeStyle = "#6b925a"; ctx.lineWidth = 67; ctx.stroke();
    path(); ctx.strokeStyle = "#d7c394"; ctx.lineWidth = 58; ctx.stroke();
    path(); ctx.strokeStyle = "#e2d0a5"; ctx.lineWidth = 44; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1000,545); ctx.bezierCurveTo(825,555,890,677,630,665);
    ctx.strokeStyle = "#486f67"; ctx.lineWidth = 100; ctx.stroke();
    ctx.strokeStyle = "#7bbec7"; ctx.lineWidth = 83; ctx.stroke();
    ctx.strokeStyle = "#bbe0d7"; ctx.lineWidth = 3; ctx.stroke();
    for (let i=0; i<90; i++) {
      const x=(i*137+29)%970, y=130+(i*83)%455;
      ctx.fillStyle = i%5===0 ? "#eae0a1" : "#639656";
      ctx.beginPath(); ctx.ellipse(x,y,i%5===0?2.8:2,1.6,0,0,Math.PI*2); ctx.fill();
    }
    const trees = [[45,200,1.1],[106,118,.95],[250,128,.95],[850,161,1.2],[944,275,1.2],[933,420,.85],[325,218,1.1]];
    for (const [x,y,s] of trees) {
      ctx.fillStyle="#456a4940";ctx.beginPath();ctx.ellipse(x+12,y+48*s,38*s,15*s,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#76583b";ctx.fillRect(x-6*s,y,12*s,45*s);
      for (const [dx,dy,r,c] of [[0,-22,40,"#40764c"],[-22,-9,28,"#467e4b"],[21,-16,29,"#528d53"],[0,-43,28,"#639b5f"]] as const) {
        ctx.fillStyle=c;ctx.beginPath();ctx.arc(x+dx*s,y+dy*s,r*s,0,Math.PI*2);ctx.fill();
      }
    }
  }, []);
  return <canvas ref={ref} width={1000} height={650} className={styles.terrain} aria-hidden="true" />;
}

export function CalorieVerseMeadow() {
  const display = useDisplayLanguage();
  const locale = display.enabled ? display.locale : "en";
  const copy = (translations as Record<string, Copy>)[locale] ?? translations.en;
  const [state, setState] = useState(initialMeadow);
  const current = useRef(state);
  const [loaded, setLoaded] = useState(false);
  const [writable, setWritable] = useState(true);
  const [selectedId, setSelectedId] = useState("meadow.guide");
  const [paused, setPaused] = useState(false);
  const [help, setHelp] = useState(false);
  const [announcement, setAnnouncement] = useState<keyof Copy | null>(null);
  const target = useRef<Point | null>(null);
  const held = useRef<Point | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const selected = meadow.objects.find(item => item.id === selectedId)!;
  const complete = meadowComplete(state);
  current.current = state;

  useEffect(() => {
    try {
      const restored = restoreMeadow(localStorage.getItem(MEADOW_KEY));
      current.current = restored.state;
      setState(restored.state);
      setWritable(restored.writable);
      // Keep the original character identity, including any existing user choice.
      if (!localStorage.getItem(STARTER_KEY)) localStorage.setItem(STARTER_KEY, JSON.stringify({version: 1, starter_character_id: meadow.starter_character_id, render_asset_key: "starter-original-v1"}));
    } catch { setWritable(false); }
    setLoaded(true);
  }, []);

  // Save at rest and on leaving, never on every animation frame.
  useEffect(() => {
    if (!loaded || !writable) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(MEADOW_KEY, JSON.stringify(current.current)); }
      catch { setWritable(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [state, loaded, writable]);

  useEffect(() => {
    if (!loaded || !writable) return;
    const save = () => {
      try { localStorage.setItem(MEADOW_KEY, JSON.stringify(current.current)); }
      catch { setWritable(false); }
    };
    window.addEventListener("pagehide", save);
    return () => { window.removeEventListener("pagehide", save); save(); };
  }, [loaded, writable]);

  useEffect(() => {
    if (!loaded || paused) { target.current = null; held.current = null; return; }
    let frame = 0, last = 0;
    const tick = (time: number) => {
      const seconds = last ? Math.min((time-last)/1000, .06) : 0;
      last = time;
      const from = current.current.position;
      const destination = held.current ? {x: from.x+held.current.x*10, y: from.y+held.current.y*10} : target.current;
      if (destination) {
        const next = moveToward(from, destination, seconds);
        if (Math.hypot(next.x-from.x,next.y-from.y) > .001) {
          const updated = {...current.current, position: next};
          current.current = updated;
          setState(updated);
        } else if (!held.current) target.current = null;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [loaded, paused]);

  useEffect(() => {
    const stop = () => { held.current=null; target.current=null; };
    const release = () => { held.current=null; };
    const hide = () => { if (document.hidden) { stop(); setPaused(true); } };
    window.addEventListener("blur", stop);
    window.addEventListener("pointerup", release);
    document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("blur", stop); window.removeEventListener("pointerup", release); document.removeEventListener("visibilitychange", hide); };
  }, []);

  function perform(object: MeadowObject) {
    if (paused || !loaded) return;
    setSelectedId(object.id);
    if (!nearby(current.current.position, object)) { target.current = object; return; }
    const updated = interact(current.current, object.id);
    if (updated !== current.current) {
      current.current = updated; setState(updated);
      setAnnouncement(object.kind === "apple" ? "picked" : updated.garden === "planted" ? "planted" : updated.garden === "watered" ? "watered" : "harvested");
    }
  }
  function label(object: MeadowObject): string {
    if (object.kind === "guide") return copy.guide;
    if (object.kind === "apple") return state.collected.includes(object.id) ? copy.picked : copy.apples;
    return state.garden === "empty" ? copy.plant : state.garden === "planted" ? copy.water : state.garden === "watered" ? copy.harvest : copy.done;
  }
  const directionButtons = (Object.entries({up:[0,-1],left:[-1,0],down:[0,1],right:[1,0]}) as Array<["up"|"left"|"down"|"right",number[]]>);

  return <main className={styles.page} data-calorieapp-content lang={locale} dir={localeDirection(locale)}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}><Image src="/logo.svg" width={35} height={35} alt="" /><span>CalorieVerse<small>{copy.tagline}</small></span></Link>
      <div className={styles.headerActions}><DisplayLanguagePicker /><button type="button" onClick={() => {setHelp(value=>!value);setPaused(true);}} aria-expanded={help}>{copy.settings}</button></div>
    </header>
    <div className={styles.layout}>
      <section className={styles.worldPanel} aria-labelledby="meadow-title">
        <div className={styles.worldHeading}><div><span className={styles.eyebrow}>{copy.begin}</span><h1 id="meadow-title">{copy.place}</h1></div><button type="button" onClick={()=>{setPaused(value=>!value);stage.current?.focus();}}>{paused?copy.resume:copy.pause}</button></div>
        <div ref={stage} className={styles.stage} tabIndex={0} role="group" aria-label={copy.place+". "+copy.controls}
          onKeyDown={event => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Escape") {event.preventDefault();setPaused(value=>!value);return;}
            if (paused) return;
            const direction = directionKeys[event.key] ?? directionKeys[event.key.toLowerCase()];
            if (direction) {event.preventDefault();held.current=direction;target.current=null;}
            if (event.key.toLowerCase() === "e") {event.preventDefault(); if (!event.repeat) {
              const close = meadow.objects.filter(object=>nearby(current.current.position,object) && !(object.kind==="apple" && current.current.collected.includes(object.id))).sort((a,b)=>Math.hypot(a.x-current.current.position.x,a.y-current.current.position.y)-Math.hypot(b.x-current.current.position.x,b.y-current.current.position.y))[0];
              if(close) perform(close);
            }}
          }}
          onKeyUp={()=>{held.current=null;}}
          onPointerDown={event=>{
            if (paused || event.target !== event.currentTarget) return;
            const rect=event.currentTarget.getBoundingClientRect();
            target.current=position({x:(event.clientX-rect.left)/rect.width*100,y:(event.clientY-rect.top)/rect.height*100});
            event.currentTarget.focus();
          }}>
          <MeadowTerrain />
          <span className={styles.worldSign} aria-hidden="true">CalorieVerse</span>
          {meadow.objects.map(object => {
            const collected=object.kind==="apple" && state.collected.includes(object.id);
            return <button type="button" key={object.id} className={[styles.object, styles[object.kind],collected?styles.collected:"",selectedId===object.id?styles.selected:""].join(" ")}
              style={{left:object.x+"%",top:object.y+"%"}} disabled={paused || !loaded || collected}
              onClick={()=>perform(object)} aria-label={label(object)+(object.kind==="apple"?" "+(meadow.objects.filter(o=>o.kind==="apple").indexOf(object)+1):"")}
              data-world-object={object.id}>
              {object.kind==="apple" ? <Image src="/images/food-illustrations/apple.svg" width={42} height={42} alt="" /> : object.kind==="garden" ? <span className={styles.bed}>{state.garden==="empty"?"· · ·":state.garden==="planted"?"🌱":state.garden==="watered"?<Image src="/images/food-illustrations/carrot.svg" width={55} height={55} alt="" />:"✓"}</span> : <span className={styles.guideIcon}>C<span>••</span></span>}
              <span className={styles.objectLabel}>{object.kind==="garden"?copy.garden:object.kind==="guide"?copy.guide:collected?"✓":""}</span>
            </button>;
          })}
          <div className={styles.player} style={{left:state.position.x+"%",top:state.position.y+"%"}} aria-label={copy.traveler} data-player-position={`${state.position.x.toFixed(1)},${state.position.y.toFixed(1)}`}><span>C</span><small>{copy.traveler}</small></div>
          <div className={styles.pad} dir="ltr">
            {directionButtons.map(([direction,vector])=><button type="button" key={direction} className={styles[direction]} aria-label={copy[direction]} disabled={paused || !loaded}
              onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);target.current=null;held.current={x:vector[0],y:vector[1]};}}
              onPointerUp={()=>{held.current=null;}} onPointerCancel={()=>{held.current=null;}}
              onClick={event=>{if(event.detail===0) target.current=position({x:current.current.position.x+vector[0]*6,y:current.current.position.y+vector[1]*6});}}>
              {{up:"↑",down:"↓",left:"←",right:"→"}[direction]}</button>)}
          </div>
          {paused ? <div className={styles.pauseOverlay}><strong>{copy.paused}</strong><button type="button" onClick={()=>{setPaused(false);setHelp(false);stage.current?.focus();}}>{copy.resume}</button></div>:null}
        </div>
        <div className={styles.instructions}><span>{copy.hint}</span><small>{copy.controls}</small></div>
      </section>
      <aside className={styles.side}>
        <section className={styles.quest}><span className={styles.eyebrow}>{copy.objective}</span><h2>{copy.garden}</h2><p>{complete?copy.allDone:copy.guideText}</p>
          <div className={styles.questRow}><Image src="/images/food-illustrations/apple.svg" width={30} height={30} alt="" /><span>{copy.apples}</span><strong>{appleCount(state)} / 3</strong></div>
          <div className={styles.questRow}><Image src="/images/food-illustrations/carrot.svg" width={30} height={30} alt="" /><span>{copy.garden}</span><strong>{["empty","planted","watered","harvested"].indexOf(state.garden)} / 3</strong></div>
          <div className={styles.progress} role="progressbar" aria-label={copy.objective} aria-valuenow={appleCount(state)+["empty","planted","watered","harvested"].indexOf(state.garden)} aria-valuemin={0} aria-valuemax={6}><span style={{width:(appleCount(state)+["empty","planted","watered","harvested"].indexOf(state.garden))/6*100+"%"}} /></div>
        </section>
        <section className={styles.actionCard}><span className={styles.eyebrow}>{selected.kind==="guide"?copy.guide:copy.place}</span><h2>{label(selected)}</h2>
          <p>{selected.kind==="guide"?copy.guideText:copy.hint}</p>
          {selected.kind!=="guide" && !(selected.kind==="apple" && state.collected.includes(selected.id)) && !(selected.kind==="garden" && state.garden==="harvested") ? <button type="button" disabled={paused || !loaded} onClick={()=>perform(selected)}>{nearby(state.position,selected)?label(selected):copy.walk}</button>:null}
          <p className={styles.announcement} role="status" aria-live="polite">{announcement?"✓ "+copy[announcement]:""}</p>
        </section>
        {help?<section className={styles.actionCard}><h2>{copy.settings}</h2><p>{copy.controls}</p><p>{copy.saved}</p><button type="button" onClick={()=>{setHelp(false);setPaused(false);}}>{copy.close}</button></section>:null}
        <p className={styles.saveNote} role="status">{writable?copy.saved:copy.temporary}</p>
        <Link href="/" className={styles.appLink}>{copy.home} ↗</Link>
      </aside>
    </div>
  </main>;
}
