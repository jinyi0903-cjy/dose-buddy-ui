import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, AlertTriangle, Pill, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

type AppState = "normal" | "upcoming" | "buzzing" | "missed";

const supplies = [
  { name: "Heart Med", count: 24 },
  { name: "Vitamin C", count: 58 },
  { name: "Joint Supp.", count: 12 },
];

const dosesTakenToday = 3;
const lastTakenTime = "08:00";

function Index() {
  const [state, setState] = useState<AppState>("normal");
  const [expanded, setExpanded] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60 * 47);

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const cardClasses = (() => {
    switch (state) {
      case "upcoming":
        return "border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)]";
      case "buzzing":
        return "border-red-500 animate-pulse shadow-[0_0_40px_rgba(239,68,68,0.7)]";
      case "missed":
        return "border-red-300";
      default:
        return "border-teal-200";
    }
  })();

  return (
    <div className="min-h-screen bg-slate-50 mx-auto max-w-md relative">
      {state === "missed" && (
        <div className="sticky top-0 z-50 bg-red-600 text-white shadow-lg">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full flex items-center justify-between px-4 py-3 font-bold tracking-wide"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle size={20} />
              MISSED DOSE ALERT
            </span>
            <ChevronDown
              size={20}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
          {expanded && (
            <div className="px-4 pb-4 text-sm bg-red-700">
              <p className="font-semibold">Heart Med — 1/2 pill</p>
              <p>Scheduled at 14:15. Missed by 12 minutes.</p>
              <p className="mt-1 opacity-90">Please take as soon as possible or skip.</p>
            </div>
          )}
        </div>
      )}

      <header className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2 text-slate-700">
          <Clock size={22} />
          <h1 className="text-lg font-semibold">PillPal Dispenser</h1>
        </div>
      </header>

      <main className="px-5 pb-8 space-y-6">
        {/* Next Dose Card */}
        <section
          className={`rounded-2xl bg-white border-2 overflow-hidden transition-all duration-300 ${cardClasses}`}
        >
          <div className="bg-teal-200 px-5 py-3">
            <h2 className="text-teal-900 font-semibold tracking-wide">
              Your Next Dose:
            </h2>
          </div>
          <div className="px-5 py-6 text-center">
            {state === "buzzing" ? (
              <p className="text-3xl font-extrabold text-red-600 tracking-wider">
                DISPENSING NOW
              </p>
            ) : (
              <p className="text-3xl font-extrabold text-black">Heart Med</p>
            )}
            <p className="text-xl font-bold text-black mt-2">1/2 pill</p>
            <p className="text-lg text-slate-700 mt-1">at 14:15</p>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Countdown
              </p>
              <p className="text-4xl font-mono font-extrabold text-black mt-1">
                {mm}:{ss}
              </p>
            </div>
          </div>
        </section>

        {/* Doses Taken Summary */}
        <section className="rounded-2xl bg-white border border-slate-200 p-5">
          <h2 className="text-sm uppercase tracking-widest text-slate-500 font-semibold">
            Today's Summary
          </h2>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-4xl font-extrabold text-black">
                {dosesTakenToday}
              </p>
              <p className="text-sm text-slate-600">pills taken today</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Last taken</p>
              <p className="text-lg font-bold text-black">{lastTakenTime}</p>
            </div>
          </div>
        </section>

        {/* Supplies */}
        <section>
          <h2 className="text-sm uppercase tracking-widest text-slate-500 font-semibold mb-3">
            Your Supplies
          </h2>
          <ul className="space-y-2">
            {supplies.map((s) => (
              <li
                key={s.name}
                className="flex items-center justify-between bg-teal-50 border border-teal-100 rounded-xl px-4 py-3"
              >
                <span className="flex items-center gap-2 text-slate-800 font-medium">
                  <Pill size={18} className="text-teal-700" />
                  {s.name}
                </span>
                <span className="text-teal-800 font-bold">({s.count})</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Simulator */}
        <section className="pt-2">
          <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">
            Simulate States
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {(["normal", "upcoming", "buzzing", "missed"] as AppState[]).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => {
                    setState(s);
                    if (s !== "missed") setExpanded(false);
                  }}
                  className={`text-xs font-semibold py-2 rounded-lg border transition-colors capitalize ${
                    state === s
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {s}
                </button>
              )
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
