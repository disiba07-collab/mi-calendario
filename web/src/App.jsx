import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

const API = import.meta.env.VITE_API_URL;

function toISO(d) {
  return new Date(d).toISOString();
}

export default function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  async function loadRange(info) {
    setLoading(true);
    try {
      const from = info.startStr;
      const to = info.endStr;
      const r = await fetch(`${API}/api/citas?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const data = await r.json();
      setEvents((data || []).map(c => ({
        id: c.id,
        title: c.nombre,
        start: c.inicio,
        end: c.fin
      })));
    } catch {
      setToast({ type: "error", text: "No se pudieron cargar las citas." });
    } finally {
      setLoading(false);
    }
  }

  async function onSelect(sel) {
    const nombre = window.prompt("Nombre para la cita:");
    if (!nombre) return;

    const payload = { nombre, inicio: toISO(sel.start), fin: toISO(sel.end) };

    const r = await fetch(`${API}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (r.status === 409) return setToast({ type: "warn", text: "Ese hueco ya está ocupado." });
    if (!r.ok) return setToast({ type: "error", text: "Error creando la cita." });

    setEvents(prev => prev.concat([{
      id: crypto.randomUUID(),
      title: nombre,
      start: payload.inicio,
      end: payload.fin
    }]));
    setToast({ type: "ok", text: "Cita creada." });
    setTimeout(() => setToast(null), 2500);
  }

  const calendarProps = useMemo(() => ({
    plugins: [timeGridPlugin, dayGridPlugin, interactionPlugin],
    initialView: "timeGridWeek",
    selectable: true,
    selectMirror: true,
    select: onSelect,
    events,
    datesSet: loadRange,
    height: "auto",
    nowIndicator: true,
    slotMinTime: "08:00:00",
    slotMaxTime: "20:00:00",
    headerToolbar: { left: "prev,next today", center: "title", right: "timeGridWeek,dayGridMonth" }
  }), [events]);

  const toastClass =
    toast?.type === "ok" ? "border-green-200 bg-green-50 text-green-900" :
    toast?.type === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" :
    "border-red-200 bg-red-50 text-red-900";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Calendario de citas</h1>
            <p className="mt-1 text-sm text-slate-600">Selecciona una franja (día/hora) para reservar.</p>
          </div>

          <div className="flex items-center gap-3">
            {loading && <span className="text-sm text-slate-600">Cargando…</span>}
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
              Online
            </span>
          </div>
        </div>

        {toast && (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${toastClass}`}>
            {toast.text}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <FullCalendar {...calendarProps} />
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Si Render “duerme” el servicio, la primera carga puede tardar unos segundos.
        </p>
      </div>
    </div>
  );
}
