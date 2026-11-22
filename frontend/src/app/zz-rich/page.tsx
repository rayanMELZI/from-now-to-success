"use client";
import { useState } from "react";
import { RichField, RichText } from "@/components/ui/RichText";
export default function P() {
  const [v, setV] = useState("plain **bold** {red:red}");
  const [m, setM] = useState("");
  return (
    <div className="p-8 max-w-xl space-y-3">
      <RichField value={v} onChange={setV} maxLength={120} ariaLabel="T" placeholder="Something…" onEnter={() => setV("")} />
      <pre id="out">{v}</pre>
      <RichField value={m} onChange={setM} maxLength={500} ariaLabel="M" placeholder="Notes…" multiline rows={2} onEnter={() => setM("SUBMIT")} />
      <pre id="mout">{JSON.stringify(m)}</pre>
      <div id="mview" className="whitespace-pre-wrap"><RichText source={m} /></div>
      <input id="other" />
    </div>
  );
}
