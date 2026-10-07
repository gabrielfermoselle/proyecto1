# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15 (App Router) + React 19 + TypeScript, Tailwind + shadcn/ui, React-Leaflet (in `web/`). Server Actions + Prisma on PostgreSQL/PostGIS (Supabase), NextAuth (credentials, JWT) + bcrypt. Supabase Realtime for chat and live tracking, Supabase Storage for photos. Architecture in `docs/ARQUITECTURA.md`.

## Users

Two roles on one platform:
- **Clientes:** people in Tucumán who need to move something (a house move, a piece of furniture, a purchase, a parcel) and today have to find a fletero on their own and ask each one for a quote.
- **Fleteros:** drivers with a moto, auto, camioneta or camión who offer freight services and need a steady flow of nearby requests to quote on.

## Product Purpose

"Fletes Tucumán": a freight marketplace for San Miguel de Tucumán and surroundings. Clients publish what they need to move (origin, destination, date, photos, item inventory); nearby fleteros send quotes; the client compares by price, rating, vehicle and proximity and picks one. The freight is then tracked by stage, and a digital inventory controls that everything loaded arrives. Success means a client moves their things safely at a price they chose, and fleteros get real work close to them.

## Positioning

What it adds over asking around or posting in groups:
1. **Organization:** all freight information (items, photos, route, quotes, status) in one place.
2. **Communication:** in-app chat per request and fletero, without exposing phone or email.
3. **Control:** a digital inventory where each item is registered as loaded and unloaded.
4. **Tracking:** the client sees each stage and confirms delivery; ratings are only possible after a confirmed delivery.

## Operating Context

Core flow: client publishes request → nearby fleteros send quotes → client compares and chooses → freight confirmed → fletero registers loading → transfer → fletero registers unloading → client confirms reception and rates the fletero. Stages: SOLICITADO, PRESUPUESTADO, CONFIRMADO, EN_CAMINO_A_ORIGEN, CARGANDO, EN_TRASLADO, DESCARGANDO, ENTREGADO, CERRADO (+ CANCELADO). Demo data is set in Gran San Miguel de Tucumán.

## Capabilities and Constraints

- Auth via JWT + bcrypt; roles cliente and fletero.
- Proximity via PostGIS (ST_DWithin/ST_Distance on GIST-indexed geography columns).
- Photos are compressed in the browser and uploaded directly to Supabase Storage with signed URLs.
- Specifications are intentionally generic for now: pricing rules, vehicle capacities, payments and notifications are still to be defined.

## Evidence on Hand

- Project brief (PDF "Plataforma de fletes"): problem, solution, main features for clientes, fleteros, chat and inventory/tracking, and the 7-step operating flow.
- No real users, testimonials or metrics yet; all data is demo data.

## Product Principles

1. The client decides: quotes are compared side by side, never auto-assigned.
2. Control over the load: nothing leaves without registered loading, nothing is "delivered" without registered unloading.
3. Privacy by design: contact info stays off the platform; coordination happens in the chat.
4. Proximity is a first-class input: distance to the origin is visible wherever fleteros or requests are listed.
5. Trust is earned: ratings only come from clients who confirmed a real delivery.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established yet.
