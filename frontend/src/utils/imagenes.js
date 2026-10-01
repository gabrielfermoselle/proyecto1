const MAX_LADO = 1280;
const CALIDAD = 0.78;
const MAX_ORIGINAL = 12 * 1024 * 1024;

// Lee una imagen del usuario y la devuelve como data URL JPEG redimensionada,
// para que las fotos de solicitudes, inventario y chat viajen livianas.
export function imagenADataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Elegí un archivo de imagen válido."));
      return;
    }
    if (file.size > MAX_ORIGINAL) {
      reject(new Error("La imagen es demasiado pesada (máx. 12 MB)."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo procesar la imagen."));
      img.onload = () => {
        const escala = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", CALIDAD));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
