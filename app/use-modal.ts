'use client';
import { useEffect, useRef } from 'react';
export function useModal(onEscape:()=>void) {
 const ref=useRef<HTMLElement>(null),escape=useRef(onEscape);escape.current=onEscape;
 useEffect(()=>{
  const root=ref.current;if(!root)return;
  const previous=document.activeElement as HTMLElement|null;
  const focusable=()=>Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[contenteditable="true"],[tabindex="0"]')).filter(x=>x.getClientRects().length>0);
  const frame=requestAnimationFrame(()=>{if(!root.contains(document.activeElement))(root.querySelector<HTMLElement>('[autofocus]')||focusable()[0])?.focus();});
  function key(e:KeyboardEvent){
   const dialogs=document.querySelectorAll('[role="dialog"],[role="alertdialog"]');if(dialogs[dialogs.length-1]!==root)return;
   if(e.key==='Escape'){e.preventDefault();escape.current();}
   if(e.key==='Tab'){const els=focusable(),first=els[0],last=els[els.length-1];if(e.shiftKey&&(document.activeElement===first||!root!.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!root!.contains(document.activeElement))){e.preventDefault();first?.focus();}}
  }
  document.addEventListener('keydown',key);return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',key);previous?.focus();};
 },[]);return ref;
}
