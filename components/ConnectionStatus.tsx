"use client";

import {useEffect,useState} from 'react';

export function ConnectionStatus() {
  const [slow,setSlow]=useState(false);
  useEffect(()=>{const timer=setTimeout(()=>setSlow(true),8000);return()=>clearTimeout(timer);},[]);
  return slow?<p role="status" className="glass-card p-4 text-sm text-secondary">Connecting to the catalog service. It may take about a minute to wake up. Your saved library stays available.</p>:null;
}
