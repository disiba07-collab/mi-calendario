import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Airtable from "airtable";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

if (!process.env.AIRTABLE_TOKEN || !process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_TABLE_NAME) {
  console.error("Faltan variables AIRTABLE_* en .env");
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
const TABLE = process.env.AIRTABLE_TABLE_NAME;

// Healthcheck
app.get("/health", (_, res) => res.json({ ok: true }));

// Listar citas en rango (para pintar calendario)
app.get("/api/citas", async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from y to son obligatorios (ISO)" });

    const records = await base(TABLE).select({
      // Airtable formula: {inicio} >= from AND {inicio} <= to
      filterByFormula: `AND(
        IS_AFTER({inicio}, "${from}"),
        IS_BEFORE({inicio}, "${to}")
      )`,
      sort: [{ field: "inicio", direction: "asc" }]
    }).all();

    res.json(records.map(r => ({
      id: r.id,
      inicio: r.get("inicio"),
      fin: r.get("fin"),
      nombre: r.get("nombre") || "Bloqueado",
      color: r.get("color") || "#6366f1",
      tipo: r.get("tipo") || "cita"
    })));
  } catch (e) {
    res.status(500).json({ error: "Error listando citas", detail: String(e) });
  }
});

// Crear cita (con anti-solape simple)
app.post("/api/citas", async (req, res) => {
  try {
    const { inicio, fin, nombre, tipo = "cita" } = req.body;
    if (!inicio || !fin) return res.status(400).json({ error: "inicio y fin son obligatorios" });
    if (tipo === "cita" && !nombre) return res.status(400).json({ error: "nombre es obligatorio para citas" });

    // Solape: (inicio < fin_existente) AND (fin > inicio_existente)
    const overlap = await base(TABLE).select({
      maxRecords: 1,
      filterByFormula: `AND(
        IS_BEFORE({inicio}, "${fin}"),
        IS_AFTER({fin}, "${inicio}")
      )`
    }).firstPage();

    if (overlap.length) return res.status(409).json({ error: "Hueco ocupado" });

    const { color = tipo === "bloqueo" ? "#64748b" : "#6366f1" } = req.body;
    const fields = { inicio, fin, tipo, color };
    if (nombre) fields.nombre = nombre;

    const created = await base(TABLE).create([{ fields }]);
    res.status(201).json({ id: created[0].id });
  } catch (e) {
    res.status(500).json({ error: "Error creando cita", detail: String(e) });
  }
});

// Actualizar cita
app.put("/api/citas/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { inicio, fin, nombre } = req.body;
    if (!inicio || !fin || !nombre) return res.status(400).json({ error: "inicio, fin, nombre son obligatorios" });

    // Verificar solape excluyendo la cita actual
    const overlap = await base(TABLE).select({
      maxRecords: 1,
      filterByFormula: `AND(
        RECORD_ID() != "${id}",
        IS_BEFORE({inicio}, "${fin}"),
        IS_AFTER({fin}, "${inicio}")
      )`
    }).firstPage();

    if (overlap.length) return res.status(409).json({ error: "Hueco ocupado" });

    const { color = "#6366f1" } = req.body;
    await base(TABLE).update([{ id, fields: { inicio, fin, nombre, color } }]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Error actualizando cita", detail: String(e) });
  }
});

// Eliminar cita
app.delete("/api/citas/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await base(TABLE).destroy([id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Error eliminando cita", detail: String(e) });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("API escuchando en puerto", process.env.PORT || 3000);
});
