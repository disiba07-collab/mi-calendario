import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

const API = import.meta.env.VITE_API_URL; // ej: https://tu-api.onrender.com

function toISO(d) {
  // FullCalendar te da Date; guardamos ISO
  return new Date(d).toISOString();
}

export default function App() {
  const [events, setEvents] = useState([]);
  const [msg, setMsg] = useState("");

  async function loadRange(info) {
    setMsg("");
    const from = info.startStr;
    const to = info.endStr;
    const r = await fetch(`${API}/api/citas?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    const data = await r.json();
    setEvents(data.map(c => ({
      id: c.id,
      title: c.nombre,
      start: c.inicio,
      end: c.fin
    })));
  }

  async function onSelect(selectionInfo) {
    setMsg("");
    const nombre = prompt("Nombre para la cita:");
    if (!nombre) return;

    const payload = {
      nombre,
      inicio: toISO(selectionInfo.start),
      fin: toISO(selectionInfo.end)
    };

    const r = await fetch(`${API}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (r.status === 409) {
      setMsg("Ese hueco ya está ocupado.");
      return;
    }
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      setMsg("Error creando cita: " + (e.error || r.status));
      return;
    }

    // recarga suave: añade al estado sin pedir al server (o llama loadRange)
    setEvents(prev => prev.concat([{
      id: crypto.randomUUID(),
      title: nombre,
      start: payload.inicio,
      end: payload.fin
    }]));
    setMsg("Cita creada.");
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
    slotMaxTime: "20:00:00"
  }), [events]);

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <h2>Calendario de citas</h2>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Selecciona una franja (día/hora) para reservar.
      </p>
      {msg && <div style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>{msg}</div>}
      <FullCalendar {...calendarProps} />
    </div>
  );
}
