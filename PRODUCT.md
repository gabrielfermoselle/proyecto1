# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + React Router + React-Leaflet + Socket.io-client (frontend); Node.js + Express + Socket.io, JWT + bcrypt auth (backend). Persistence currently in a JSON datastore (demo-era choice); the project is moving toward real production, so this is expected to migrate to a real database — treat it as a known constraint to revisit, not a durable architectural fact.

## Users

Two roles on one platform:
- **Clientes (vecinos):** people who need to hire a tradesperson (plumber, electrician, carpenter, painter, etc.) for home services and currently lack transparent, trustworthy ways to find and vet one.
- **Trabajadores (oficios):** tradespeople offering validated services who need visibility, a way to be found by proximity, and a way to build verifiable reputation.

## Product Purpose

A directory and hiring platform for traditional trades ("Directorio y Contratación de Oficios Tradicionales Validados") that solves the lack of transparency in hiring home-service workers. Success means clients can find a nearby, trustworthy worker and complete a hire safely; workers can be discovered and build real, unfakeable reputation.

## Positioning

Three technical pillars a copycat directory could not casually replicate:
1. **Geolocation-based matching:** Haversine-distance filtering by coverage zone, interactive OpenStreetMap/Leaflet map.
2. **Transaction-anchored reviews:** a client can only review a worker if a **completed** hire exists between them, and only once — eliminating fake/spam reviews.
3. **In-app real-time chat (Socket.io)** per hire, so budget/logistics can be discussed **without ever exposing contact info** (email/phone are never shared).

## Operating Context

Core flow: client browses/searches the worker directory (map + distance filter) → views a worker profile → requests a hire ("Solicitar contratación") → real-time chat opens → worker accepts, sets a budget, chats → job marked completed → client leaves a review (only unlockable at that point). Roles: cliente, trabajador. Demo/seed data currently models trades: Plomería, Electricidad, Carpintería, Pintura.

## Capabilities and Constraints

- Auth via JWT + bcrypt.
- Distance/geolocation filtering via Haversine formula.
- Reviews are gated strictly behind a completed transaction between the two specific parties.
- Chat is scoped per job/hire, real-time via Socket.io; contact info (email/phone) is never exposed through the platform.
- Current persistence is a JSON file datastore — acceptable for demo, expected to change as the project moves toward production (undecided: target database/hosting).
- Deployed frontend on Vercel as a SPA (recent commits reference Vercel deploy config, rewrites excluding `/api`, and handling non-JSON responses gracefully); backend production hosting is undecided.

## Evidence on Hand

- README.md documents the three technical pillars, stack, and full demo flow with seeded demo accounts (ana@demo.com, luis@demo.com as clientes; carlos@demo.com, marta@demo.com, jose@demo.com, sole@demo.com as trabajadores, one trade each).
- Existing pages: Directory, WorkerProfile, Dashboard, JobDetail, EditProfile, Login, Register — plus MapView, Navbar, and Stars (rating) components.
- No case studies, press, testimonials, or real customer evidence exist yet — this is thesis/demo data and must not be treated as real proof.

## Product Principles

1. Trust is earned through structural guarantees (transaction-anchored reviews), not just UI polish — never let a design change weaken that guarantee.
2. Privacy by design: contact info never leaves the platform; all coordination happens in-app.
3. Proximity is a first-class decision input — geolocation/distance should stay visible and usable, not buried.
4. This is graduating from thesis MVP toward a real product — favor durable, production-minded choices over demo shortcuts going forward.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established yet.
