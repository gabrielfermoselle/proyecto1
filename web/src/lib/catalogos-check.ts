// Verificación en tiempo de compilación: los catálogos del dominio (puros, sin Prisma)
// tienen que coincidir exactamente con los enums de la base. Si alguien agrega un valor
// en un lado y no en el otro, `npm run typecheck` falla acá.
import type { FranjaHoraria, Rol, TipoFlete, TipoVehiculo } from "@prisma/client";
import type * as Catalogos from "@/domain/catalogos";
import type * as Roles from "@/domain/roles";

type Iguales<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Afirmar<T extends true> = T;

export type _Verificaciones = [
  Afirmar<Iguales<Rol, Roles.Rol>>,
  Afirmar<Iguales<TipoVehiculo, Catalogos.TipoVehiculo>>,
  Afirmar<Iguales<TipoFlete, Catalogos.TipoFlete>>,
  Afirmar<Iguales<FranjaHoraria, Catalogos.FranjaHoraria>>,
];
