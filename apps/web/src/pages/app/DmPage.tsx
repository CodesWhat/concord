import { useEffect } from "react";
import DmList from "../../components/DmList.js";
import DmView from "../../components/DmView.js";
import { gateway } from "../../api/gateway.js";

export default function DmPage() {
  useEffect(() => {
    // Ensure gateway is connected when on DM page
    gateway.connect();
    return () => {};
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden">
      <DmList />
      <DmView />
    </div>
  );
}
