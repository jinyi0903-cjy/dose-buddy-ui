import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, AlertTriangle, Pill, ChevronDown, Plus, X } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

type AppState = "normal" | "upcoming" | "buzzing" | "missed";

type Dose = {
  id: number;
  medication: string;
  dosage: string;
  time: string;
  slot: number;
  pills_count: number;
  taken: boolean;
};

function Index() {
  const [state, setState] = useState<AppState>("normal");
  const [expanded, setExpanded] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [demoSpeed, setDemoSpeed] = useState(1);
  const [newDose, setNewDose] = useState({
    medication: "",
    dosage: "1",
    time: "",
    slot: 1,
    pills_count: 5,
    interval: 0
  });

  const fetchDoses = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/api/doses");
      const data = await response.json();
      setDoses(data);
    } catch (error) {
      console.error("Failed to fetch doses:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoses();
  }, []);

  const getNextDoseForTimer = () => {
    const sortedUntaken = doses
      .filter((d) => !d.taken)
      .sort((a, b) => a.time.localeCompare(b.time));
    
    // If the earliest dose is missed (due for > 10m), we skip it for the timer
    // and show the next one instead.
    const now = new Date();
    return sortedUntaken.find(d => {
      const [hours, minutes] = d.time.split(":").map(Number);
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);
      const diff = Math.floor((target.getTime() - now.getTime()) / 1000);
      return diff > -600; // Not missed yet
    }) || sortedUntaken[0];
  };

  const nextDose = getNextDoseForTimer();

  // Helper to check for any missed doses
  const getMissedDose = () => {
    const now = new Date();
    return doses.find(d => {
      if (d.taken) return false;
      const [hours, minutes] = d.time.split(":").map(Number);
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);
      const diff = Math.floor((target.getTime() - now.getTime()) / 1000);
      return diff <= -600;
    });
  };

  const missedDose = getMissedDose();

  useEffect(() => {
    if (!nextDose) {
      setSecondsLeft(null);
      setState("normal");
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date();
      const [hours, minutes] = nextDose.time.split(":").map(Number);
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);

      const diff = Math.floor((target.getTime() - now.getTime()) / 1000);
      return diff;
    };

    const initialDiff = calculateTimeLeft();
    setSecondsLeft(initialDiff);

    const timerId = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) return null;
        const nextValue = prev - demoSpeed;
        
        // Find if ANY dose is currently missed to keep UI state
        // (but timer continues for the 'nextDose')
        const currentNow = new Date();
        const anyUntaken = doses.filter(d => !d.taken);
        const hasMissed = anyUntaken.some(d => {
          const [h, m] = d.time.split(":").map(Number);
          const t = new Date();
          t.setHours(h, m, 0, 0);
          return Math.floor((t.getTime() - currentNow.getTime()) / 1000) <= -600;
        });

        if (hasMissed) {
          setState("missed");
        } else if (nextValue <= 0) {
          setState("buzzing");
        } else if (nextValue <= 300) {
          setState("upcoming");
        } else {
          setState("normal");
        }
        
        return nextValue;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [nextDose, demoSpeed, doses]);

  const handleAddDose = async (e: React.FormEvent) => {
    e.preventDefault();

    // Dosage validation: only ends in .0 or .5
    const dosageNum = parseFloat(newDose.dosage);
    if (isNaN(dosageNum) || (dosageNum * 2) % 1 !== 0) {
      alert("Dosage must be a whole number or end in .5 (e.g., 0.5, 1.5, 2)");
      return;
    }
    
    // Check if target SLOT is occupied by a DIFFERENT name
    const activeDoses = doses.filter(d => !d.taken);
    const existingInSlot = activeDoses.find(d => d.slot === newDose.slot);

    if (existingInSlot && existingInSlot.medication.toLowerCase() !== newDose.medication.toLowerCase()) {
      alert(`Conflict: Slot ${newDose.slot} is already being used for "${existingInSlot.medication}". Please use a different slot.`);
      return;
    }

    // Filter by name AND slot specifically now
    const existingSameMedInSlot = activeDoses.find(d => 
      d.slot === newDose.slot && 
      d.medication.toLowerCase() === newDose.medication.toLowerCase()
    );

    if (existingSameMedInSlot) {
      // Update count in that specific slot
      try {
        const response = await fetch(`http://127.0.0.1:5000/api/doses/${existingSameMedInSlot.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pills_count: existingSameMedInSlot.pills_count + Number(newDose.pills_count)
          }),
        });

        if (response.ok) {
          setShowAddModal(false);
          setNewDose({ medication: "", dosage: "1", time: "", slot: 1, pills_count: 5, interval: 0 });
          await fetchDoses();
          return;
        }
      } catch (error) {
        console.error("Failed to update existing dose:", error);
      }
    }

    // Create new dose
    try {
      const response = await fetch("http://127.0.0.1:5000/api/doses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newDose,
          dosage: newDose.dosage + " tablet(s)"
        }),
      });
      
      if (response.ok) {
        setShowAddModal(false);
        setNewDose({ medication: "", dosage: "1", time: "", slot: 1, pills_count: 5, interval: 0 });
        await fetchDoses(); 
      }
    } catch (error) {
      console.error("Failed to add dose:", error);
    }
  };

  // Auto-fill time if medication name matches an existing untaken one
  useEffect(() => {
    if (newDose.medication) {
      const match = doses.find(d => !d.taken && d.medication.toLowerCase() === newDose.medication.toLowerCase());
      if (match && !newDose.time) {
        setNewDose(prev => ({ ...prev, time: match.time }));
      }
    }
  }, [newDose.medication, doses]);

  const handleTakeDose = async () => {
    if (!nextDose) return;

    try {
      const response = await fetch(`http://127.0.0.1:5000/api/doses/${nextDose.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taken: true }),
      });

      if (response.ok) {
        // Force a full refresh from backend to ensure state consistency
        await fetchDoses();
        setState("normal");
      }
    } catch (error) {
      console.error("Failed to update dose:", error);
    }
  };

  useEffect(() => {
    // Simulator logic is handled in the calculateTimeLeft hook now
  }, [secondsLeft, state, loading, nextDose]);

  const absSeconds = Math.abs(secondsLeft || 0);
  const mm = secondsLeft !== null ? String(Math.floor(absSeconds / 60)).padStart(2, "0") : "--";
  const ss = secondsLeft !== null ? String(absSeconds % 60).padStart(2, "0") : "--";
  const prefix = secondsLeft !== null && secondsLeft < 0 ? "-" : "";

  const handleTakeMissedDose = async (id: number) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/doses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taken: true }),
      });

      if (response.ok) {
        await fetchDoses();
      }
    } catch (error) {
      console.error("Failed to update missed dose:", error);
    }
  };

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
          {expanded && missedDose && (
            <div className="px-4 pb-4 text-sm bg-red-700">
              <p className="font-semibold">{missedDose.medication} — {missedDose.dosage}</p>
              <p>Scheduled at {missedDose.time}.</p>
              <button 
                onClick={() => handleTakeMissedDose(missedDose.id)}
                className="mt-3 w-full py-2 bg-white text-red-700 rounded-lg font-bold hover:bg-slate-100 transition-colors"
              >
                MARK AS TAKEN
              </button>
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
              <p className="text-3xl font-extrabold text-black">
                {loading ? "Loading..." : nextDose?.medication || "No Doses"}
              </p>
            )}
            <p className="text-xl font-bold text-black mt-2">
              {loading ? "" : nextDose?.dosage}
            </p>
            <p className="text-lg text-slate-700 mt-1">
              at {loading ? "" : nextDose?.time || "--:--"}
            </p>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Countdown
              </p>
              <p className="text-4xl font-mono font-extrabold text-black mt-1">
                  {state === "missed" ? "OVERDUE" : `${prefix}${mm}:${ss}`}
                </p>
              </div>
              {state === "buzzing" && (
              <button
                onClick={handleTakeDose}
                className="mt-6 w-full py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg hover:bg-red-700 transition-colors"
              >
                CONFIRM TAKEN
              </button>
            )}
            <div className="mt-6 flex flex-col gap-2">
              <p className="text-[10px] text-slate-400 uppercase font-bold text-center">Demo Controls</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSecondsLeft(prev => prev !== null ? prev - 600 : null)}
                  className="text-[10px] bg-slate-100 py-1 rounded hover:bg-slate-200"
                >
                  Fast Forward 10m
                </button>
                <button
                  onClick={() => setDemoSpeed(s => s === 1 ? 60 : 1)}
                  className={`text-[10px] py-1 rounded border ${demoSpeed > 1 ? 'bg-orange-100 border-orange-200' : 'bg-slate-100 border-slate-200'}`}
                >
                  {demoSpeed > 1 ? 'Normal Speed' : '60x Speed'}
                </button>
              </div>
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
                {doses.filter(d => d.taken).length}
              </p>
              <p className="text-sm text-slate-600">pills taken today</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Last taken</p>
              <p className="text-lg font-bold text-black">
                {doses.filter(d => d.taken).sort((a,b) => b.id - a.id)[0]?.time || "--:--"}
              </p>
            </div>
          </div>
        </section>

        {/* Supplies */}
        {/* Supplies */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm uppercase tracking-widest text-slate-500 font-semibold">
              Your Supplies
            </h2>
            <button 
              onClick={() => setShowAddModal(true)}
              className="p-1 rounded-full bg-teal-600 text-white hover:bg-teal-700 transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>
          <ul className="space-y-2">
            {loading ? (
              <p>Loading supplies...</p>
            ) : (
              doses.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between bg-teal-50 border border-teal-100 rounded-xl px-4 py-3"
                >
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2 text-slate-800 font-medium">
                      <Pill size={18} className="text-teal-700" />
                      {s.medication}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-7">
                      Slot {s.slot} • {s.pills_count} items left
                    </span>
                  </div>
                  <span className="text-teal-800 font-bold">
                    {s.taken ? "Taken" : s.time}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>

      {/* Add Dose Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Setup Dispenser</h3>
              <button onClick={() => setShowAddModal(false)}>
                <X size={24} className="text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddDose} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Medicine Name</label>
                <input 
                  required
                  type="text" 
                  value={newDose.medication}
                  onChange={e => setNewDose({...newDose, medication: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-black"
                  placeholder="e.g. Heart Med"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Slot #</label>
                  <input 
                    type="number" 
                    min="1" max="6"
                    value={newDose.slot}
                    onChange={e => setNewDose({...newDose, slot: parseInt(e.target.value)})}
                    className="w-full p-2 border rounded-lg text-black"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Pills Count</label>
                  <input 
                    type="number" 
                    min="1"
                    value={newDose.pills_count}
                    onChange={e => setNewDose({...newDose, pills_count: parseInt(e.target.value)})}
                    className="w-full p-2 border rounded-lg text-black"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Dose (e.g. 0.5, 1)</label>
                  <input 
                    required
                    type="number" 
                    step="0.5"
                    value={newDose.dosage}
                    onChange={e => setNewDose({...newDose, dosage: e.target.value})}
                    className="w-full p-2 border rounded-lg text-black"
                    placeholder="1"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Interval (Hrs)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={newDose.interval}
                    onChange={e => setNewDose({...newDose, interval: parseInt(e.target.value)})}
                    className="w-full p-2 border rounded-lg text-black"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Schedule Time</label>
                <input 
                  required
                  type="time" 
                  value={newDose.time}
                  onChange={e => setNewDose({...newDose, time: e.target.value})}
                  className="w-full p-2 border rounded-lg text-black"
                />
              </div>
              <button 
                type="submit"
                className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold shadow-lg hover:bg-teal-700 transition-colors"
                disabled={loading}
              >
                {loading ? "SAVING..." : "SAVE TO DISPENSER"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
