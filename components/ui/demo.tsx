"use client";
import { TabDemo } from "@/components/ui/tabs-like-bookmark"
import { SlideTabs } from "@/components/ui/slide-tabs";

export default function DemoOne() {
  return <div className="site-shell grid min-h-screen place-content-center bg-white p-4 dark:bg-black"><SlideTabs /></div>;
}

function TabsLikeBookmark() {
  return (
    <div className="block">
      <TabDemo />
    </div>
  );
} 

export { TabsLikeBookmark };

