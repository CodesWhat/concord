import { useEffect } from "react";
import DmList from "../../components/DmList.js";
import DmView from "../../components/DmView.js";
import MobileNav from "../../components/MobileNav.js";
import { gateway } from "../../api/gateway.js";

export default function DmPage() {
  useEffect(() => {
    gateway.connect();
    return () => gateway.disconnect();
  }, []);

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex flex-1 overflow-hidden">
        <DmList />
        <DmView />
      </div>
      <MobileNav />
    </div>
  );
}
