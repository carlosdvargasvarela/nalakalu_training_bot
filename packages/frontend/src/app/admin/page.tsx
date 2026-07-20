"use client";

import { useState, useRef, useEffect } from "react";
import { fetchTags, fetchCategories } from "@/lib/api";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3001";

interface DocMeta {
  id: string;
  originalName: string;
  category: string | null;
  tags: string[];
  createdAt: string;
}

function parseTagsInput(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [knownCategories, setKnownCategories] = useState<string[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [filter, setFilter] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editTags, setEditTags] = useState("");

  useEffect(() => {
    fetchCategories().then(setKnownCategories);
    fetchTags().then(setKnownTags);
  }, []);

  const authHeaders = () => ({ "x-admin-secret": secret });

  const loadDocs = async () => {
    const res = await fetch(`${GATEWAY}/api/admin/documents`, {
      headers: authHeaders(),
    });
    if (res.ok) setDocs(await res.json());
  };

  const handleLogin = async () => {
    const res = await fetch(`${GATEWAY}/api/admin/documents`, {
      headers: authHeaders(),
    });
    if (res.ok) {
      setAuthed(true);
      setDocs(await res.json());
    } else {
      alert("Clave incorrecta");
    }
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (tags) params.set("tags", tags);
    const url = `${GATEWAY}/api/admin/documents${params.toString() ? `?${params.toString()}` : ""}`;
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    setUploading(false);
    if (res.ok) {
      await loadDocs();
      if (fileRef.current) fileRef.current.value = "";
      setCategory("");
      setTags("");
    } else {
      alert("Error al subir archivo");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Desactivar este procedimiento?")) return;
    await fetch(`${GATEWAY}/api/admin/documents/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const startEdit = (doc: DocMeta) => {
    setEditingId(doc.id);
    setEditCategory(doc.category ?? "");
    setEditTags(doc.tags.join(", "));
  };

  const handleSaveEdit = async (id: string) => {
    const parsedTags = parseTagsInput(editTags);
    const res = await fetch(`${GATEWAY}/api/admin/documents/${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ category: editCategory || null, tags: parsedTags }),
    });
    if (res.ok) {
      setDocs((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, category: editCategory || null, tags: parsedTags } : d
        )
      );
      setEditingId(null);
    } else {
      alert("Error al guardar los cambios");
    }
  };

  const filteredDocs = docs.filter((d) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      d.originalName.toLowerCase().includes(q) ||
      (d.category ?? "").toLowerCase().includes(q) ||
      d.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  if (!authed) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center p-4">
        <div className="bg-surface p-6 rounded-2xl w-full max-w-sm">
          <h1 className="font-heading text-primary text-xl mb-4 text-center">Panel Admin</h1>
          <input
            type="password"
            placeholder="Clave de acceso"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full bg-elevated text-primary rounded-xl px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-accent text-white rounded-xl py-3 font-semibold hover:bg-accent-hover"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app p-4 max-w-2xl mx-auto">
      <h1 className="font-heading text-primary text-2xl mb-6">Gestión de Procedimientos</h1>

      <datalist id="known-categories">
        {knownCategories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="known-tags">
        {knownTags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <div className="bg-surface rounded-2xl p-4 mb-6">
        <h2 className="font-heading text-primary mb-3">Subir nuevo procedimiento</h2>
        <input
          type="text"
          list="known-categories"
          placeholder="Categoría (ej: Ensamble, Seguridad)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-elevated text-primary rounded-xl px-4 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          type="text"
          list="known-tags"
          placeholder="Etiquetas: ensamble, seguridad, cajón (separadas por coma)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full bg-elevated text-primary rounded-xl px-4 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="w-full text-primary mb-3"
        />
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-500 disabled:opacity-50"
        >
          {uploading ? "Subiendo y procesando..." : "Subir procedimiento"}
        </button>
      </div>

      <input
        type="text"
        placeholder="Buscar por nombre, categoría o etiqueta..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full bg-elevated text-primary rounded-xl px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-accent"
      />

      <div className="space-y-3">
        {filteredDocs.map((doc) => (
          <div key={doc.id} className="bg-surface rounded-xl p-4">
            {editingId === doc.id ? (
              <div className="space-y-2">
                <input
                  type="text"
                  list="known-categories"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  placeholder="Categoría"
                  className="w-full bg-elevated text-primary rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <input
                  type="text"
                  list="known-tags"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="Etiquetas separadas por coma"
                  className="w-full bg-elevated text-primary rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(doc.id)}
                    className="flex-1 text-xs bg-accent hover:bg-accent-hover text-white rounded-lg py-1.5"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs text-muted hover:text-primary border border-nk-border rounded-lg px-3"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-primary font-medium">{doc.originalName}</p>
                  <p className="text-muted text-sm">{doc.category ?? "Sin categoría"}</p>
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {doc.tags.map((t) => (
                        <span
                          key={t}
                          className="text-xs bg-elevated text-muted rounded-full px-2 py-0.5"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => startEdit(doc)}
                    className="text-accent hover:text-accent-hover text-sm px-3 py-1 border border-accent/40 rounded-lg"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-red-600 hover:text-red-700 text-sm px-3 py-1 border border-red-300 rounded-lg"
                  >
                    Desactivar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {filteredDocs.length === 0 && (
          <p className="text-muted text-center py-8">
            {docs.length === 0
              ? "No hay procedimientos cargados aún."
              : "Ningún procedimiento coincide con la búsqueda."}
          </p>
        )}
      </div>
    </div>
  );
}
