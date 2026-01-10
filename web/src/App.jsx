import { useEffect, useMemo, useRef, useState } from "react";
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
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedColor, setSelectedColor] = useState("#6366f1");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [goToDate, setGoToDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isBlockMode, setIsBlockMode] = useState(false);
  const calendarRef = useRef(null);

  // Filtrar eventos por nombre
  const filteredEvents = searchQuery.trim()
    ? events.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : events;

  // Navegar a una fecha específica
  function handleGoToDate(dateStr) {
    setGoToDate(dateStr);
    if (dateStr && calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(dateStr);
    }
  }

  // Paleta de colores para citas
  const colorOptions = [
    { value: "#6366f1", name: "Índigo" },
    { value: "#10b981", name: "Verde" },
    { value: "#f59e0b", name: "Naranja" },
    { value: "#ef4444", name: "Rojo" },
    { value: "#8b5cf6", name: "Violeta" },
    { value: "#06b6d4", name: "Cyan" },
    { value: "#ec4899", name: "Rosa" },
    { value: "#64748b", name: "Gris" }
  ];

  // Detectar si es móvil
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Modo oscuro
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  async function loadRange(info) {
    setLoading(true);
    try {
      const from = info.startStr;
      const to = info.endStr;
      const r = await fetch(`${API}/api/citas?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const data = await r.json();
      setEvents((data || []).map(c => {
        const isBlock = c.tipo === "bloqueo";
        return {
          id: c.id,
          title: isBlock ? "🔒 No disponible" : c.nombre,
          start: c.inicio,
          end: c.fin,
          backgroundColor: isBlock ? "#64748b" : (c.color || "#6366f1"),
          borderColor: isBlock ? "#475569" : (c.color || "#6366f1"),
          extendedProps: { tipo: c.tipo || "cita" }
        };
      }));
    } catch {
      setToast({ type: "error", text: "No se pudieron cargar las citas." });
    } finally {
      setLoading(false);
    }
  }

  function onSelect(sel) {
    setModalData(sel);
    setNombreInput("");
    setIsBlockMode(false);

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
    // Para citas, el nombre es obligatorio. Para bloqueos, no.
    if (!isBlockMode && !nombreInput.trim()) return;

    // Construir fecha/hora de inicio usando la fecha del calendario + hora personalizada
    const selectedDate = new Date(modalData.start);
    const [hours, minutes] = startTime.split(':').map(Number);
    selectedDate.setHours(hours, minutes, 0, 0);

    // Calcular fecha/hora de fin sumando la duración
    const endDate = new Date(selectedDate);
    endDate.setMinutes(endDate.getMinutes() + duration);

    const payload = {
      inicio: toISO(selectedDate),
      fin: toISO(endDate),
      tipo: isBlockMode ? "bloqueo" : "cita",
      color: isBlockMode ? "#64748b" : selectedColor
    };
    if (!isBlockMode) payload.nombre = nombreInput.trim();

    // Si es edición, usar PUT en lugar de POST
    const isEdit = modalData.isEdit;
    const url = isEdit ? `${API}/api/citas/${modalData.editId}` : `${API}/api/citas`;
    const method = isEdit ? "PUT" : "POST";

    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (r.status === 409) {
      setShowModal(false);
      return setToast({ type: "warn", text: "Ese hueco ya está ocupado." });
    }
    if (!r.ok) {
      setShowModal(false);
      return setToast({ type: "error", text: isEdit ? "Error editando." : (isBlockMode ? "Error bloqueando horario." : "Error creando la cita.") });
    }

    if (isEdit) {
      // Actualizar el evento existente
      setEvents(prev => prev.map(e =>
        e.id === modalData.editId
          ? { ...e, title: nombreInput.trim(), start: payload.inicio, end: payload.fin, backgroundColor: selectedColor, borderColor: selectedColor }
          : e
      ));
      setToast({ type: "ok", text: "Cita actualizada." });
    } else {
      // Crear nuevo evento
      const data = await r.json();
      const bgColor = isBlockMode ? "#64748b" : selectedColor;
      setEvents(prev => prev.concat([{
        id: data.id || crypto.randomUUID(),
        title: isBlockMode ? "🔒 No disponible" : nombreInput.trim(),
        start: payload.inicio,
        end: payload.fin,
        backgroundColor: bgColor,
        borderColor: isBlockMode ? "#475569" : bgColor,
        extendedProps: { tipo: isBlockMode ? "bloqueo" : "cita" }
      }]));
      setToast({ type: "ok", text: isBlockMode ? "Horario bloqueado." : "Cita creada." });
    }

    setShowModal(false);
    setIsBlockMode(false);
    setTimeout(() => setToast(null), 2500);
  }

  function handleModalCancel() {
    setShowModal(false);
    setModalData(null);
    setNombreInput("");
    setStartTime("");
    setDuration(30);
    setSelectedColor("#6366f1");
    setIsBlockMode(false);
  }

  function onEventClick(info) {
    const event = info.event;
    setSelectedEvent({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      color: event.backgroundColor || "#6366f1"
    });
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function formatTime(date) {
    return new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  function getDuration(start, end) {
    const diffMs = new Date(end) - new Date(start);
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }

  // Mostrar modal de confirmación para eliminar
  function handleDeleteEvent() {
    if (!selectedEvent) return;
    setShowConfirmModal(true);
  }

  // Confirmar eliminación
  async function handleConfirmDelete() {
    if (!selectedEvent) return;

    try {
      const r = await fetch(`${API}/api/citas/${selectedEvent.id}`, {
        method: "DELETE",
      });

      if (!r.ok) {
        setToast({ type: "error", text: "Error eliminando la cita." });
        setSelectedEvent(null);
        setShowConfirmModal(false);
        return;
      }

      setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
      setSelectedEvent(null);
      setShowConfirmModal(false);
      setToast({ type: "ok", text: "Cita eliminada." });
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast({ type: "error", text: "Error de conexión." });
      setSelectedEvent(null);
      setShowConfirmModal(false);
    }
  }

  // Manejar arrastrar y soltar eventos
  async function handleEventDrop(info) {
    const event = info.event;
    const payload = {
      nombre: event.title,
      inicio: toISO(event.start),
      fin: toISO(event.end),
      color: event.backgroundColor || "#6366f1"
    };

    try {
      const r = await fetch(`${API}/api/citas/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (r.status === 409) {
        info.revert();
        return setToast({ type: "warn", text: "Ese hueco ya está ocupado." });
      }
      if (!r.ok) {
        info.revert();
        return setToast({ type: "error", text: "Error moviendo la cita." });
      }

      setEvents(prev => prev.map(e =>
        e.id === event.id
          ? { ...e, start: payload.inicio, end: payload.fin }
          : e
      ));
      setToast({ type: "ok", text: "Cita movida." });
      setTimeout(() => setToast(null), 2500);
    } catch {
      info.revert();
      setToast({ type: "error", text: "Error de conexión." });
    }
  }

  function handleEditEvent() {
    if (!selectedEvent) return;

    const start = new Date(selectedEvent.start);
    const end = new Date(selectedEvent.end);
    const hours = String(start.getHours()).padStart(2, '0');
    const minutes = String(start.getMinutes()).padStart(2, '0');
    const durationMinutes = (end - start) / (1000 * 60);

    setModalData({ start: selectedEvent.start, end: selectedEvent.end, isEdit: true, editId: selectedEvent.id });
    setNombreInput(selectedEvent.title);
    setStartTime(`${hours}:${minutes}`);
    setDuration(durationMinutes);
    setSelectedColor(selectedEvent.color || "#6366f1");
    setSelectedEvent(null);
    setShowModal(true);
  }

  // Duplicar cita existente
  function handleDuplicateEvent() {
    if (!selectedEvent) return;

    const start = new Date(selectedEvent.start);
    const end = new Date(selectedEvent.end);
    const hours = String(start.getHours()).padStart(2, '0');
    const minutes = String(start.getMinutes()).padStart(2, '0');
    const durationMinutes = (end - start) / (1000 * 60);

    // Crear nueva cita (sin isEdit) con los mismos datos
    setModalData({ start: selectedEvent.start, end: selectedEvent.end, isEdit: false });
    setNombreInput(selectedEvent.title);
    setStartTime(`${hours}:${minutes}`);
    setDuration(durationMinutes);
    setSelectedColor(selectedEvent.color || "#6366f1");
    setSelectedEvent(null);
    setShowModal(true);
  }

  const calendarProps = useMemo(() => ({
    plugins: [timeGridPlugin, dayGridPlugin, interactionPlugin],
    initialView: isMobile ? "timeGridThreeDay" : "timeGridWeek",
    views: {
      timeGridThreeDay: {
        type: 'timeGrid',
        duration: { days: 3 },
        buttonText: '3 días'
      }
    },
    selectable: true,
    selectMirror: true,
    editable: true,
    eventDrop: handleEventDrop,
    eventResize: handleEventDrop,
    select: onSelect,
    eventClick: onEventClick,
    events: filteredEvents,
    datesSet: loadRange,
    height: "auto",
    nowIndicator: true,
    slotMinTime: "08:00:00",
    slotMaxTime: "20:00:00",
    slotDuration: isMobile ? "00:30:00" : "00:15:00",
    expandRows: true,
    slotEventOverlap: false,
    eventMaxStack: 3,
    // Vista de mes: limitar eventos visibles y mostrar "+N más"
    dayMaxEvents: isMobile ? 2 : 3,
    moreLinkText: (n) => `+${n} más`,
    moreLinkClick: "popover",
    locale: esLocale,
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: isMobile ? '3d' : 'Semana',
      day: 'Día',
      list: 'Lista'
    },
    headerToolbar: isMobile
      ? { left: "prev,next", center: "title", right: "timeGridThreeDay,timeGridDay,dayGridMonth" }
      : { left: "prev,next today", center: "title", right: "timeGridWeek,timeGridDay,dayGridMonth" }
  }), [filteredEvents, isMobile]);

  const toastClass =
    toast?.type === "ok" ? "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300" :
      toast?.type === "warn" ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300" :
        "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300";

  return (
    <div className={`min-h-screen transition-colors ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className={`text-2xl font-semibold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>Calendario de citas</h1>
            <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Selecciona una franja (día/hora) para reservar.</p>
          </div>

          <div className="flex items-center gap-3">
            {loading && <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Cargando…</span>}

            {/* Toggle modo oscuro */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`rounded-full p-2 transition-colors ${darkMode
                ? 'bg-slate-700 text-yellow-400 hover:bg-slate-600'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              title={darkMode ? 'Modo claro' : 'Modo oscuro'}
            >
              {darkMode ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${darkMode
              ? 'border-slate-600 bg-slate-800 text-slate-300'
              : 'border-slate-200 bg-white text-slate-700'
              }`}>
              Online
            </span>
          </div>
        </div>

        {toast && (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${toastClass}`}>
            {toast.text}
          </div>
        )}

        {/* Selector de fecha para navegar */}
        <div className={`mt-4 flex items-center gap-3 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
          <label htmlFor="goto-date" className="text-sm font-medium">
            Ir a fecha:
          </label>
          <input
            id="goto-date"
            type="date"
            value={goToDate}
            onChange={(e) => handleGoToDate(e.target.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${darkMode
              ? 'border-slate-600 bg-slate-700 text-white'
              : 'border-slate-300 bg-white text-slate-900'
              }`}
          />
          <button
            onClick={() => handleGoToDate(new Date().toISOString().split('T')[0])}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${darkMode
              ? 'bg-indigo-600 text-white hover:bg-indigo-500'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
          >
            Hoy
          </button>
        </div>

        {/* Búsqueda de citas */}
        <div className={`mt-3 flex items-center gap-3 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
          <div className="relative flex-1 max-w-sm">
            <svg
              className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar citas por nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full rounded-lg border pl-10 pr-8 py-1.5 text-sm transition-colors ${darkMode
                ? 'border-slate-600 bg-slate-700 text-white placeholder:text-slate-400'
                : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
                }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 ${darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchQuery && (
            <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {filteredEvents.length} resultado{filteredEvents.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className={`mt-4 rounded-2xl border p-4 shadow-sm transition-colors ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
          <FullCalendar ref={calendarRef} {...calendarProps} />
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Si Render “duerme” el servicio, la primera carga puede tardar unos segundos.
        </p>
      </div>

      {/* Modal personalizado para crear cita */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {modalData?.isEdit ? 'Editar cita' : (isBlockMode ? 'Bloquear horario' : 'Nueva cita')}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {modalData?.isEdit ? 'Modifica los datos de la cita.' : (isBlockMode ? 'Selecciona el horario a bloquear.' : 'Introduce el nombre para la cita.')}
            </p>

            {/* Toggle Cita / Bloqueo (solo para crear nuevo) */}
            {!modalData?.isEdit && (
              <div className="mt-4 flex rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setIsBlockMode(false)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${!isBlockMode
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  📅 Cita
                </button>
                <button
                  type="button"
                  onClick={() => setIsBlockMode(true)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isBlockMode
                    ? 'bg-white text-slate-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  🔒 Bloquear
                </button>
              </div>
            )}

            {/* Campo nombre - solo para citas */}
            {!isBlockMode && (
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
            )}

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

            {/* Selector de color - solo para citas */}
            {!isBlockMode && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setSelectedColor(color.value)}
                      className={`w-8 h-8 rounded-full transition-all ${selectedColor === color.value
                        ? 'ring-2 ring-offset-2 ring-slate-400 scale-110'
                        : 'hover:scale-105'
                        }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleModalCancel}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
              >
                Cancelar
              </button>
              <button
                onClick={handleModalConfirm}
                disabled={!isBlockMode && !nombreInput.trim()}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${isBlockMode
                    ? 'bg-slate-600 hover:bg-slate-700 focus:ring-slate-500/50'
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500/50'
                  }`}
              >
                {modalData?.isEdit ? 'Guardar cambios' : (isBlockMode ? 'Bloquear' : 'Crear cita')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalle de cita */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="mx-4 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{selectedEvent.title}</h3>
                  <p className="text-sm text-slate-500 capitalize">{formatDate(selectedEvent.start)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Horario</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatTime(selectedEvent.start)} - {formatTime(selectedEvent.end)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Duración</p>
                  <p className="text-sm font-semibold text-slate-900">{getDuration(selectedEvent.start, selectedEvent.end)}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleEditEvent}
                className="flex-1 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                Editar
              </button>
              <button
                onClick={handleDuplicateEvent}
                className="flex-1 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-medium text-cyan-700 transition-colors hover:bg-cyan-100"
              >
                Duplicar
              </button>
              <button
                onClick={handleDeleteEvent}
                className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
              >
                Eliminar
              </button>
            </div>

            <div className="mt-3">
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">¿Eliminar cita?</h3>
                <p className="mt-1 text-sm text-slate-500">Esta acción no se puede deshacer.</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
