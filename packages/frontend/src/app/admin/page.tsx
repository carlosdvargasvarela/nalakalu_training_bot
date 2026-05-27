"use client";

import { useState, useRef } from "react";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3001";

interface DocMeta {
  id: string;
  originalName: string;
  category: string | null;
  tags: string[];
  createdAt: string;
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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

  if (!authed) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center p-4">
        <div className="bg-surface p-6 rounded-2xl w-full max-w-sm">
          <h1 className="text-white text-xl font-bold mb-4 text-center">Panel Admin</h1>
          <input
            type="password"
            placeholder="Clave de acceso"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full bg-elevated text-white rounded-xl px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-500"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app p-4 max-w-2xl mx-auto">
      <h1 className="text-white text-2xl font-bold mb-6">Gestión de Procedimientos</h1>

      <div className="bg-surface rounded-2xl p-4 mb-6">
        <h2 className="text-white font-semibold mb-3">Subir nuevo procedimiento</h2>
        <input
          type="text"
          placeholder="Categoría (ej: Ensamble, Seguridad)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-elevated text-white rounded-xl px-4 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          type="text"
          placeholder="Etiquetas: ensamble, seguridad, cajón (separadas por coma)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full bg-elevated text-white rounded-xl px-4 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-accent"
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

      <div className="space-y-3">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="bg-surface rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-white font-medium">{doc.originalName}</p>
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
            <button
              onClick={() => handleDelete(doc.id)}
              className="text-red-400 hover:text-red-300 text-sm px-3 py-1 border border-red-800 rounded-lg"
            >
              Desactivar
            </button>
          </div>
        ))}
        {docs.length === 0 && (
          <p className="text-muted text-center py-8">
            No hay procedimientos cargados aún.
          </p>
        )}
      </div>
    </div>
  );
}
