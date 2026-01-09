import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from '@fullcalendar/core/locales/es';

const API = import.meta.env.VITE_API_URL;

function toISO(d) {
  return new Date(d).toISOString();
}

export default function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [nombreInput, setNombreInput] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(30);

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

  function onSelect(sel) {
    setModalData(sel);
    setNombreInput("");

    // Extraer hora de inicio y calcular duración
    const start = new Date(sel.start);
    const end = new Date(sel.end);
    const hours = String(start.getHours()).padStart(2, '0');
    const minutes = String(start.getMinutes()).padStart(2, '0');
    setStartTime(`${hours}:${minutes}`);

    const durationMinutes = (end - start) / (1000 * 60);
    setDuration(durationMinutes);

    setShowModal(true);
  }

  async function handleModalConfirm() {
    if (!nombreInput.trim()) return;

    // Construir fecha/hora de inicio usando la fecha del calendario + hora personalizada
    const selectedDate = new Date(modalData.start);
    const [hours, minutes] = startTime.split(':').map(Number);
    selectedDate.setHours(hours, minutes, 0, 0);

    // Calcular fecha/hora de fin sumando la duración
    const endDate = new Date(selectedDate);
    endDate.setMinutes(endDate.getMinutes() + duration);

    const payload = { nombre: nombreInput.trim(), inicio: toISO(selectedDate), fin: toISO(endDate) };

    const r = await fetch(`${API}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (r.status === 409) {
      setShowModal(false);
      return setToast({ type: "warn", text: "Ese hueco ya está ocupado." });
    }
    if (!r.ok) {
      setShowModal(false);
      return setToast({ type: "error", text: "Error creando la cita." });
    }

    setEvents(prev => prev.concat([{
      id: crypto.randomUUID(),
      title: nombreInput.trim(),
      start: payload.inicio,
      end: payload.fin
    }]));
    setShowModal(false);
    setToast({ type: "ok", text: "Cita creada." });
    setTimeout(() => setToast(null), 2500);
  }

  function handleModalCancel() {
    setShowModal(false);
    setModalData(null);
    setNombreInput("");
    setStartTime("");
    setDuration(30);
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
    locale: esLocale,
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana',
      day: 'Día',
      list: 'Lista'
    },
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

      {/* Modal personalizado para crear cita */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Nueva cita</h3>
            <p className="mt-1 text-sm text-slate-600">Introduce el nombre para la cita.</p>

            <div className="mt-4">
              <label htmlFor="nombre-cita" className="block text-sm font-medium text-slate-700">
                Nombre
              </label>
              <input
                id="nombre-cita"
                type="text"
                autoFocus
                value={nombreInput}
                onChange={(e) => setNombreInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nombreInput.trim()) handleModalConfirm();
                  if (e.key === 'Escape') handleModalCancel();
                }}
                placeholder="Ej: Reunión con Juan"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="start-time" className="block text-sm font-medium text-slate-700">
                  Hora de inicio
                </label>
                <input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-slate-700">
                  Duración
                </label>
                <select
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hora</option>
                  <option value={90}>1.5 horas</option>
                  <option value={120}>2 horas</option>
                  <option value={150}>2.5 horas</option>
                  <option value={180}>3 horas</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleModalCancel}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
              >
                Cancelar
              </button>
              <button
                onClick={handleModalConfirm}
                disabled={!nombreInput.trim()}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Crear cita
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
