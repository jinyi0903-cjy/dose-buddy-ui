import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, AlertTriangle, Pill, ChevronDown, Plus, X } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

type AppState = "normal" | "upcoming" | "buzzing" | "missed";
const SUMMARY_CLEARED_STORAGE_KEY = "dose-buddy-summary-cleared-for-date";

type SummaryClearState = {
  date: string;
  takenKeys: string[];
};

type Dose = {
  id: number;
  medication: string;
  dosage: string;
  time: string;
  scheduled_date: string;
  slot: number;
  pills_count: number;
  taken: boolean;
  interval?: number;
  max_doses_per_day?: number;
};

const getLocalTodayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function Index() {
  const currentDayKey = getLocalTodayKey();
  const [state, setState] = useState<AppState>("normal");
  const [expanded, setExpanded] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [demoSpeed, setDemoSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [timeOffsetSeconds, setTimeOffsetSeconds] = useState(0);
  const [lastSeenDayKey, setLastSeenDayKey] = useState(currentDayKey);
  const [summaryClearState, setSummaryClearState] = useState<SummaryClearState | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const rawValue = window.localStorage.getItem(SUMMARY_CLEARED_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as SummaryClearState;
    } catch {
      return null;
    }
  });
  const [newDose, setNewDose] = useState({
    medication: "",
    dosage: "1",
    time: "",
    scheduled_date: "",
    slot: 1,
    pills_count: 5,
    interval: 0,
    max_doses_per_day: 1
  });

  type DoseGroup = Dose & { duplicates: Dose[] };

  const resetNewDose = () => {
    setNewDose({ medication: "", dosage: "1", time: "", scheduled_date: "", slot: 1, pills_count: 5, interval: 0, max_doses_per_day: 1 });
  };

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

  useEffect(() => {
    if (lastSeenDayKey === currentDayKey) {
      return;
    }

    setLastSeenDayKey(currentDayKey);
    setExpanded(false);
    setSecondsLeft(null);
    setState("normal");
    setShowAddModal(false);
    setDemoSpeed(1);
    setTimeOffsetSeconds(0);
    setSummaryClearState(null);
    resetNewDose();
    fetchDoses();
  }, [currentDayKey, lastSeenDayKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (summaryClearState) {
      window.localStorage.setItem(SUMMARY_CLEARED_STORAGE_KEY, JSON.stringify(summaryClearState));
    } else {
      window.localStorage.removeItem(SUMMARY_CLEARED_STORAGE_KEY);
    }
  }, [summaryClearState]);

  const doseKey = (dose: Dose) =>
    `${dose.medication.trim().toLowerCase()}|${dose.scheduled_date}|${dose.time}|${dose.slot}`;

  const supplyKey = (dose: Dose) =>
    `${dose.medication.trim().toLowerCase()}|${dose.slot}`;

  const mergeDoseGroup = (group: Dose[]): DoseGroup => {
    const [primary, ...rest] = group;
    return {
      ...primary,
      pills_count: group.reduce((sum, dose) => sum + dose.pills_count, 0),
      taken: group.some((dose) => dose.taken),
      duplicates: rest,
    };
  };

  const getUniqueDoses = (list: Dose[]): DoseGroup[] => {
    const grouped = new Map<string, Dose[]>();

    list.forEach((dose) => {
      const key = doseKey(dose);
      const current = grouped.get(key) ?? [];
      current.push(dose);
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).map(mergeDoseGroup);
  };

  const getSupplyGroups = (now = getSimulatedNow()) => {
    const grouped = new Map<string, Dose[]>();

    doses.forEach((dose) => {
      const key = supplyKey(dose);
      const current = grouped.get(key) ?? [];
      current.push(dose);
      grouped.set(key, current);
    });

    return Array.from(grouped.values())
      .map((group) => {
        const sortedGroup = [...group].sort(
          (a, b) => getDoseDateTime(a, now).getTime() - getDoseDateTime(b, now).getTime() || a.id - b.id,
        );
        const [primary, ...rest] = sortedGroup.slice().reverse();

        return {
          ...primary,
          pills_count: primary.pills_count,
          taken: primary.taken,
          duplicates: rest,
        };
      })
      .filter((dose) => dose.pills_count > 0);
  };

  const getSimulatedNow = (offsetSeconds = timeOffsetSeconds) => {
    return new Date(Date.now() + offsetSeconds * 1000);
  };

  const getTabletAmount = (dose: Dose) => {
    const amount = Number.parseFloat(dose.dosage);
    return Number.isFinite(amount) ? amount : 1;
  };

  const getTodayTakenSummary = (): { tabletTotal: number; latestDose: Dose | null } => {
    const seen = new Set<string>();
    let tabletTotal = 0;
    let latestDose: Dose | null = null;

    doses
      .filter((dose) => dose.taken && dose.scheduled_date === todayKey)
      .sort((a, b) => b.id - a.id)
      .forEach((dose) => {
        const key = doseKey(dose);

        if (seen.has(key)) {
          return;
        }

        seen.add(key);
        tabletTotal += getTabletAmount(dose);

        if (!latestDose) {
          latestDose = dose;
        }
      });

    return { tabletTotal, latestDose };
  };

  const getDoseDateTime = (dose: Dose, now = getSimulatedNow()) => {
    const scheduledDate = dose.scheduled_date || now.toISOString().slice(0, 10);
    const [hours, minutes] = dose.time.split(":").map(Number);
    const target = new Date(`${scheduledDate}T00:00:00`);
    target.setHours(hours, minutes, 0, 0);
    return target;
  };

  const getDoseDiff = (dose: Dose, now = getSimulatedNow()) => {
    const target = getDoseDateTime(dose, now);
    return Math.floor((target.getTime() - now.getTime()) / 1000);
  };

  const getNextDoseForTimer = (now = getSimulatedNow()) => {
    const sortedUntaken = getUniqueDoses(doses)
      .filter((d) => !d.taken)
      .sort((a, b) => getDoseDateTime(a, now).getTime() - getDoseDateTime(b, now).getTime());

    return sortedUntaken.find((dose) => getDoseDiff(dose, now) > -600) || null;
  };

  const getMissedDoses = (now = getSimulatedNow()) => {
    return getUniqueDoses(doses)
      .filter((dose) => !dose.taken && getDoseDiff(dose, now) <= -600)
      .sort((a, b) => getDoseDateTime(a, now).getTime() - getDoseDateTime(b, now).getTime());
  };

  const getActiveSupplies = (now = getSimulatedNow()) => {
    return getSupplyGroups(now).sort((a, b) => {
      const aNext = getNextOccurrenceForSupply(a, now);
      const bNext = getNextOccurrenceForSupply(b, now);

      if (aNext && bNext) {
        return getDoseDateTime(aNext, now).getTime() - getDoseDateTime(bNext, now).getTime();
      }

      if (aNext) return -1;
      if (bNext) return 1;

      return a.medication.localeCompare(b.medication);
    });
  };

  const getNextOccurrenceForSupply = (supply: DoseGroup, now = getSimulatedNow()) => {
    const nextOccurrence = doses
      .filter(
        (dose) =>
          dose.medication.toLowerCase() === supply.medication.toLowerCase() &&
          dose.slot === supply.slot &&
          !dose.taken &&
          getDoseDiff(dose, now) >= 0,
      )
      .sort((a, b) => getDoseDateTime(a, now).getTime() - getDoseDateTime(b, now).getTime())[0];

    return nextOccurrence ?? null;
  };

  const simulatedNow = getSimulatedNow();
  const nextDose = getNextDoseForTimer(simulatedNow);
  const missedDoses = getMissedDoses(simulatedNow);
  const todayKey = currentDayKey;
  const todaysTakenSummary = getTodayTakenSummary();
  const summaryClearedToday = summaryClearState?.date === todayKey;
  const summaryBaselineKeys = new Set(summaryClearedToday ? summaryClearState?.takenKeys ?? [] : []);
  const summaryVisibleTakenDoses = doses
    .filter((dose) => dose.taken && dose.scheduled_date === todayKey && !summaryBaselineKeys.has(doseKey(dose)))
    .sort((a, b) => b.id - a.id);
  const summaryTakenCount = summaryVisibleTakenDoses.reduce((total, dose) => total + getTabletAmount(dose), 0);
  const summaryLatestDose = summaryVisibleTakenDoses[0] ?? null;
  const summaryLastTakenTime = summaryLatestDose?.time || "--:--";

  const handleClearSummary = () => {
    setSummaryClearState({
      date: todayKey,
      takenKeys: doses
        .filter((dose) => dose.taken && dose.scheduled_date === todayKey)
        .map((dose) => doseKey(dose)),
    });
  };

  const syncTimerState = () => {
    const now = getSimulatedNow();
    const currentMissedDose = getMissedDoses(now)[0];
    const currentNextDose = getNextDoseForTimer(now);

    if (!currentNextDose && !currentMissedDose) {
      setSecondsLeft(null);
      setState("normal");
      return;
    }

    const activeDose = currentNextDose ?? currentMissedDose;
    const nextSecondsLeft = activeDose ? getDoseDiff(activeDose, now) : null;
    setSecondsLeft(nextSecondsLeft);

    if (currentMissedDose) {
      setState("missed");
      return;
    }

    if (nextSecondsLeft === null) {
      setState("normal");
    } else if (nextSecondsLeft <= 0) {
      if (state !== "buzzing") {
        fetch("http://127.0.0.1:5000/api/dispense", { method: "POST" }).catch(console.error);
      }
      setState("buzzing");
    } else if (nextSecondsLeft <= 300) {
      setState("upcoming");
    } else {
      setState("normal");
    }
  };

  useEffect(() => {
    syncTimerState();
  }, [tick, timeOffsetSeconds, doses, demoSpeed]);

  useEffect(() => {
    const timerId = setInterval(() => {
      setTick((prev) => prev + 1);
      setTimeOffsetSeconds((prevOffset) =>
        demoSpeed > 1 ? prevOffset + (demoSpeed - 1) : prevOffset,
      );
    }, 1000);

    return () => clearInterval(timerId);
  }, [demoSpeed]);

  const handleAddDose = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const dosageNum = parseFloat(newDose.dosage);
      if (isNaN(dosageNum) || (dosageNum * 2) % 1 !== 0) {
        alert("Dosage must be a whole number or end in .5 (e.g., 0.5, 1.5, 2)");
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const normalizedDose = {
        ...newDose,
        medication: newDose.medication.trim(),
        scheduled_date: newDose.scheduled_date || today,
        slot: Number.isFinite(newDose.slot) ? newDose.slot : 1,
        pills_count: Number.isFinite(newDose.pills_count) ? newDose.pills_count : 1,
        interval: Number.isFinite(newDose.interval) ? newDose.interval : 0,
        max_doses_per_day: Number.isFinite(newDose.max_doses_per_day) ? newDose.max_doses_per_day : 1,
      };
    
      const activeDoses = doses.filter(d => !d.taken);
      const existingInSlot = activeDoses.find(d => d.slot === normalizedDose.slot);

      if (existingInSlot && existingInSlot.medication.toLowerCase() !== normalizedDose.medication.toLowerCase()) {
        alert(`Conflict: Slot ${normalizedDose.slot} is already being used for "${existingInSlot.medication}". Please use a different slot.`);
        return;
      }

      const existingSameMedInSlot = activeDoses.find(d => 
        d.time === normalizedDose.time &&
        d.scheduled_date === normalizedDose.scheduled_date &&
        d.medication.toLowerCase() === normalizedDose.medication.toLowerCase()
      );

      if (existingSameMedInSlot) {
        const response = await fetch(`http://127.0.0.1:5000/api/doses/${existingSameMedInSlot.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pills_count: existingSameMedInSlot.pills_count + normalizedDose.pills_count
          }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        setShowAddModal(false);
        resetNewDose();
        await fetchDoses();
        return;
      }

      const response = await fetch("http://127.0.0.1:5000/api/doses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...normalizedDose,
          dosage: normalizedDose.dosage + " tablet(s)"
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setShowAddModal(false);
      resetNewDose();
      await fetchDoses();
    } catch (error) {
      console.error("Failed to add dose:", error);
      alert("Could not save to dispenser. Check the form values and backend connection.");
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-fill time whenever medication name matches an existing untaken one
  useEffect(() => {
    if (newDose.medication) {
      const match = [...doses]
        .reverse()
        .find((d) => !d.taken && d.medication.toLowerCase() === newDose.medication.toLowerCase());

      if (match) {
        setNewDose((prev) => ({
          ...prev,
          medication: match.medication,
          dosage: match.dosage || prev.dosage,
          time: match.time,
          scheduled_date: match.scheduled_date || prev.scheduled_date,
          slot: match.slot ?? prev.slot,
          pills_count: match.pills_count ?? prev.pills_count,
          interval: match.interval ?? prev.interval,
          max_doses_per_day: match.max_doses_per_day ?? prev.max_doses_per_day,
        }));
      }
    }
  }, [newDose.medication, doses]);

  const handleTakeDose = async () => {
    if (!nextDose) return;

    try {
      const sameGroup = doses.filter(
        (dose) =>
          dose.medication.toLowerCase() === nextDose.medication.toLowerCase() &&
          dose.scheduled_date === nextDose.scheduled_date &&
          dose.time === nextDose.time &&
          dose.slot === nextDose.slot &&
          !dose.taken,
      );

      await Promise.all(
        sameGroup.map((dose, index) =>
          fetch(`http://127.0.0.1:5000/api/doses/${dose.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taken: true,
              decrement_stock: index === 0,
              schedule_next: index === 0 && (dose.interval ?? 0) > 0,
            }),
          }),
        ),
      );

      if (sameGroup.length > 0) {
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

  const handleTakeMissedDose = async (dose: Dose) => {
    try {
      const sameGroup = doses.filter(
        (item) =>
          item.medication.toLowerCase() === dose.medication.toLowerCase() &&
          item.scheduled_date === dose.scheduled_date &&
          item.time === dose.time &&
          item.slot === dose.slot &&
          !item.taken,
      );

      const responses = await Promise.all(
        sameGroup.map((item, index) =>
          fetch(`http://127.0.0.1:5000/api/doses/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taken: true,
              decrement_stock: index === 0,
              schedule_next: index === 0 && (item.interval ?? 0) > 0,
            }),
          }),
        ),
      );

      if (responses.every((response) => response.ok)) {
        await fetchDoses();
      }
    } catch (error) {
      console.error("Failed to update missed dose:", error);
    }
  };

  const handleDeleteSupply = async (dose: DoseGroup) => {
    const confirmed = window.confirm(`Delete ${dose.medication} at ${dose.time}?`);
    if (!confirmed) return;

    const groupIds = [dose.id, ...dose.duplicates.map((item) => item.id)];

    try {
      const responses = await Promise.all(
        groupIds.map((id) =>
          fetch(`http://127.0.0.1:5000/api/doses/${id}`, {
            method: "DELETE",
          }),
        ),
      );

      if (responses.every((response) => response.ok)) {
        await fetchDoses();
      }
    } catch (error) {
      console.error("Failed to delete supply:", error);
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
          {expanded && missedDoses.length > 0 && (
            <div className="px-4 pb-4 text-sm bg-red-700 space-y-3">
              {missedDoses.map((dose) => (
                <div key={dose.id} className="rounded-lg bg-red-800/60 p-3">
                  <p className="font-semibold">
                    {dose.medication} — {dose.dosage}
                  </p>
                  <p>Scheduled at {dose.time}.</p>
                  <button
                    onClick={() => handleTakeMissedDose(dose)}
                    className="mt-3 w-full py-2 bg-white text-red-700 rounded-lg font-bold hover:bg-slate-100 transition-colors"
                  >
                    MARK AS TAKEN
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <header className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2 text-slate-700">
          <Clock size={22} />
          <h1 className="text-lg font-semibold">EZPill</h1>
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
                  {state === "missed" ? (nextDose ? `${prefix}${mm}:${ss}` : "OVERDUE") : `${prefix}${mm}:${ss}`}
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
                  onClick={() => {
                    setTimeOffsetSeconds((prev) => prev + 600);
                  }}
                  className="text-[10px] bg-slate-100 py-1 rounded hover:bg-slate-200"
                >
                  Fast Forward 10m
                </button>
                <button
                  onClick={() => {
                    const newSpeed = demoSpeed === 1 ? 60 : 1;
                    setDemoSpeed(newSpeed);
                  }}
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm uppercase tracking-widest text-slate-500 font-semibold">
              Today's Summary
            </h2>
            <button
              onClick={handleClearSummary}
              className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              {summaryClearedToday ? "Cleared Today" : "Clear Summary"}
            </button>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-4xl font-extrabold text-black">
                {summaryTakenCount}
              </p>
              <p className="text-sm text-slate-600">tablets taken today</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Last taken</p>
              <p className="text-lg font-bold text-black">
                {summaryLastTakenTime}
              </p>
              <p className="mt-2 text-sm text-slate-500">Most recent pill</p>
              <p className="text-base font-bold text-black">
                {summaryLatestDose
                  ? `${summaryLatestDose.medication} • ${summaryLatestDose.dosage}`
                  : "--"}
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
                getActiveSupplies(simulatedNow).map((s) => {
                  const nextOccurrence = getNextOccurrenceForSupply(s);

                  return (
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
                      {s.pills_count} items left
                    </span>
                    <span className="text-[10px] text-slate-500 ml-7">
                      Slot {s.slot}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-teal-800 font-bold">
                      {nextOccurrence?.time || "--"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSupply(s)}
                      className="p-1 rounded-full text-red-600 hover:bg-red-100 transition-colors"
                      aria-label={`Delete ${s.medication} at ${nextOccurrence?.time || "--"}`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </li>
                  );
                })
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
                <label className="text-xs font-bold text-slate-500 uppercase">Max Doses Per Day</label>
                <input
                  type="number"
                  min="1"
                  value={newDose.max_doses_per_day}
                  onChange={e => setNewDose({...newDose, max_doses_per_day: parseInt(e.target.value)})}
                  className="w-full p-2 border rounded-lg text-black"
                  placeholder="1"
                />
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
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={resetNewDose}
                  className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  CLEAR
                </button>
                <button 
                  type="submit"
                  className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold shadow-lg hover:bg-teal-700 transition-colors"
                  disabled={isSaving}
                >
                  {isSaving ? "SAVING..." : "SAVE TO DISPENSER"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
