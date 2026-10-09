# Guion de la demo — Fletes Tucumán

Recorrido de unos 15 minutos que muestra cada punto del enunciado con los datos de demo.
Cada paso indica con qué cuenta entrar y qué mostrar.

## Preparación

```bash
cd web
npm run db:seed     # BORRA la base y carga los datos de demo (no corre con NODE_ENV=production)
npm run dev         # http://localhost:3000
```

- Contraseña de todas las cuentas: **`Demo1234`**.
- Usá **dos navegadores** (o uno normal y otro en incógnito): uno de cliente y otro de fletero,
  para mostrar el chat y el seguimiento en tiempo real.
- Las fechas del seed son relativas al día en que se corre: siempre hay solicitudes abiertas a
  futuro y fletes en curso hoy. Si la demo es otro día, volvé a correr el seed.

## Cuentas

| Cuenta | Rol | Qué tiene |
|---|---|---|
| `ana@demo.test` | Cliente (Barrio Sur) | Mudanza abierta con 3 presupuestos, flete **confirmado** con Soledad y una propuesta de horario pendiente |
| `luis@demo.test` | Cliente (Centro) | "Heladera y lavarropas" con 2 presupuestos; flete **cerrado sin calificar** ("Caja con repuestos") |
| `valeria@demo.test` | Cliente (Yerba Buena) | Flete **entregado** esperando que revise y cierre ("Escritorio y biblioteca") |
| `carolina@demo.test` / `jorge@demo.test` | Clientes | Fletes en **cargando** y **en traslado** |
| `paula@demo.test` | Cliente nueva | Sin dirección habitual (buscador sin punto de referencia) |
| `rocio@demo.test` | Cliente | Para mostrar cambiar y recuperar contraseña sin cerrar otras sesiones |
| `carlos@demo.test` | Fletero (camioneta, Barrio Norte) | Feed de solicitudes cercanas y chat con Ana |
| `soledad@demo.test` | Fletera (auto) | Flete confirmado con Ana, que avanza en vivo |
| `diego@demo.test` | Fletero nuevo | Onboarding sin terminar |
| `admin@demo.test` | Administración | Verificación de fleteros (documentos), cuentas, denuncias y pedidos |

## Recorrido

### 1. Registro, roles y onboarding (2 min)
1. En `/registro`, mostrar la elección de rol (cliente o fletero) y la validación de la contraseña.
2. Entrar como **diego** → lo manda al **onboarding**: datos, zona en el mapa (radio de
   cobertura), vehículo con capacidad y volumen, y tarifas. Hasta terminarlo no aparece en las
   búsquedas.
3. Intentar abrir `/admin` como cliente → vuelve a su área (**autorización por rol**).

### 2. Perfil del cliente y búsqueda de fleteros (3 min)
1. Como **ana** → *Perfil* (Mi cuenta): datos y **dirección habitual** con mapa.
2. *Fleteros*: por defecto mide la **distancia desde la dirección habitual** y muestra solo los
   que **llegan a ese punto** con su radio. Cada tarjeta muestra distancia, calificación, fletes
   hechos y precio mínimo.
3. Cambiar la referencia a **"Una de mis solicitudes"** → aparece el **precio estimado** con las
   tarifas de cada fletero, y se puede ordenar por ese precio. Solo quedan los fleteros con un
   vehículo donde entra la carga.
4. Filtrar por **vehículo**, **tope de precio** y **calificación mínima**.
5. (Opcional) Como **paula**: sin dirección cargada, el buscador lo explica y lista a los
   fleteros sin distancia.

### 3. Solicitud y presupuestos (3 min)
1. Como **ana** → *Nuevo pedido*, en 5 pasos: tipo, origen y destino con autocompletado y mapa
   (la **distancia** se calcula sola), **inventario** con cantidades y medidas, fecha y franja, y
   extras (ayudantes, **embalaje**). Al publicar, sumar fotos.
2. En el otro navegador, como **carlos** → *Pedidos disponibles* (con filtros de zona, fecha y
   tipo): el feed muestra solo lo que está
   **dentro de su radio** y entra en sus vehículos, con la dirección aproximada (sin altura).
3. Carlos abre el pedido, ve el **precio sugerido**, lo ajusta, pone la **hora de llegada** y
   envía el presupuesto.
4. Ana ve el presupuesto **al instante** (notificación) y en *Mudanza de monoambiente*
   **compara** los tres presupuestos lado a lado.

### 4. Chat interno en tiempo real (2 min)
1. Ana y Carlos conversan en el chat de la mudanza: mensajes en vivo, "escribiendo…", "en
   línea", doble check de leído y **envío de fotos**.
2. Escribir un teléfono en el chat → queda **oculto** hasta que haya flete confirmado.
3. Desde el chat se puede **proponer otra fecha**; Ana tiene una propuesta pendiente de
   Soledad en el flete "Compra del mayorista".

### 5. Ciclo del flete e inventario (3 min)
1. Ana **acepta** un presupuesto → se crea el flete, los demás quedan rechazados.
2. Como **soledad**, en el flete "Compra del mayorista": *Salgo a buscar la carga* → *Llegué al
   origen* → marcar cada ítem **cargado** (con observación o foto) → *Terminé de cargar*. No deja
   salir con ítems sin resolver.
3. En el navegador de Ana, el **seguimiento se actualiza solo**: etapas, mapa con la ubicación
   del fletero e inventario.
4. Soledad descarga (entregado, con daño o faltante) y **firma la conformidad** de entrega.

### 6. Entrega, reclamo y calificación (1 min)
1. Como **valeria** → "Escritorio y biblioteca": revisa cada ítem recibido (conforme o
   **reclamo** con foto), firma y **cierra** el flete.
2. **Califica** al fletero (solo se puede una vez y con el flete cerrado). Como **luis**
   también se puede calificar "Caja con repuestos".
3. Descargar el **comprobante en PDF**.

### 7. Administración (1 min)
1. Como **admin** → *Reportes*: resolver una denuncia (lo ven las dos partes).
2. *Fleteros*: revisar los **documentos** y **verificar** a un fletero (aparece la insignia);
   en *Todas las cuentas*, desactivar una.

### 8. Seguridad y cuenta (1 min)
1. Como **rocio** → *Perfil* → *Contraseña*: al cambiarla se **cierran todas sus sesiones**
   (mostrar que el otro navegador vuelve al login).
2. *¿Olvidaste tu contraseña?* en el login → llega el link (con `RESEND_API_KEY` por email; sin
   ella, en desarrollo el link aparece en la **consola del servidor**). Vale 30 minutos y se usa
   una sola vez.
3. Diez intentos de login fallidos con el mismo email → se bloquea por 15 minutos.

### 9. Calidad (opcional, 1 min)
- `npm test` (unitarios y con base de datos), `npm run test:e2e` (Playwright con chequeo de
  accesibilidad) y el CI de GitHub en verde.
- Cada respuesta trae un `x-request-id`; en los logs JSON del servidor se busca todo lo que pasó
  en ese request.
