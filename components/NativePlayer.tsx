"use client";

import {useEffect,useRef} from 'react';
import {nativeInvoke} from '@/lib/native';

/** Remote media lives in a separate, unprivileged native browser surface. */
export function NativePlayer({url,reload,title,onLoaded,onFailure}:{url:string;reload:number;title:string;onLoaded:()=>void;onFailure:()=>void}) {
  const element=useRef<HTMLDivElement>(null);
  const callbacks=useRef({onLoaded,onFailure});
  callbacks.current={onLoaded,onFailure};
  useEffect(()=>{
    const session=crypto.randomUUID().replaceAll('-','');
    let disposed=false,opened=false,frame=0,lastBounds='';
    let unlisten:(()=>void)|undefined;
    function rectangle(){
      const rect=element.current?.getBoundingClientRect();
      if(!rect)return;
      return {x:rect.left+1,y:rect.top+1,width:Math.max(1,rect.width-2),height:Math.max(1,rect.height-2),visible:rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth};
    }
    function resize(){
      if(disposed||!opened||frame)return;
      frame=requestAnimationFrame(()=>{
        frame=0;const bounds=rectangle();if(!bounds)return;
        const key=JSON.stringify(bounds);if(key===lastBounds)return;lastBounds=key;
        void nativeInvoke('media_resize',{session,...bounds}).catch(()=>{});
      });
    }
    const observer=new ResizeObserver(resize);
    if(element.current)observer.observe(element.current);
    window.addEventListener('scroll',resize,true);window.addEventListener('resize',resize);
    void (async()=>{
      const {listen}=await import('@tauri-apps/api/event');
      unlisten=await listen<string>('media-loaded',event=>{if(!disposed&&event.payload===session)callbacks.current.onLoaded();});
      if(disposed){unlisten();return;}
      const bounds=rectangle();if(!bounds)return;
      await nativeInvoke('media_open',{session,url,...bounds});
      if(disposed){await nativeInvoke('media_close',{session});return;}
      opened=true;resize();
    })().catch(()=>{if(!disposed)callbacks.current.onFailure();});
    return ()=>{
      disposed=true;observer.disconnect();cancelAnimationFrame(frame);unlisten?.();
      window.removeEventListener('scroll',resize,true);window.removeEventListener('resize',resize);
      void nativeInvoke('media_close',{session}).catch(()=>{});
    };
  },[url,reload]);
  return <div ref={element} className="absolute inset-0 rounded-2xl bg-black" role="group" aria-label={title} data-native-player="true"/>;
}
