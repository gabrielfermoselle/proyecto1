import { useRef, useState } from "react";
import { imagenADataUrl } from "../utils/imagenes.js";
import { CameraIcon, TrashIcon } from "./Icons.jsx";

/**
 * Selector de fotos con miniaturas. Las imágenes se comprimen en el navegador
 * y se guardan como data URLs en `value` (array de strings).
 */
export default function FotosInput({ value = [], onChange, max = 6, label = "Agregar fotos" }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFiles(e) {
    const files = Array.from(e.target.files || []).slice(0, max - value.length);
    e.target.value = "";
    if (!files.length) return;
    setError("");
    setBusy(true);
    try {
      const nuevas = await Promise.all(files.map(imagenADataUrl));
      onChange([...value, ...nuevas]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="fotos-grid">
        {value.map((src, i) => (
          <div className="foto-thumb" key={i}>
            <img src={src} alt={`Foto ${i + 1}`} />
            <button
              type="button"
              className="foto-thumb-remove"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              aria-label={`Quitar foto ${i + 1}`}
            >
              <TrashIcon />
            </button>
          </div>
        ))}
        {value.length < max && (
          <button type="button" className="foto-add" onClick={() => inputRef.current?.click()} disabled={busy}>
            <CameraIcon width={20} height={20} />
            <span>{busy ? "Procesando…" : label}</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple={max > 1} onChange={onFiles} hidden />
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
