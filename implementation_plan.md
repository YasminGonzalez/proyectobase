# Sistema de Gestión Hotelera - Plan de Implementación

## Stack
- **Backend**: Node.js + Express + TypeScript
- **Base de Datos**: Supabase (PostgreSQL local para dev, cloud para prod)
- **Frontend**: HTML/CSS/JS vanilla (spa en carpeta public/)
- **Auth**: JWT + Supabase Auth
- **Deploy**: Render (backend) + Supabase Cloud (prod)

## Roles
1. **Huésped** - Reservar habitaciones vía web pública
2. **Recepcionista** - Operación diaria: check-in/out, folios, cargos
3. **Administrador/Gerente** - CRUD completo + reportes + gestión de usuarios

## Módulos (CU01-CU16)
- Auth (login/logout/JWT)
- Usuarios & Permisos (RBAC)
- Huéspedes (CRUD + historial)
- Habitaciones & Tipos (disponibilidad por fechas)
- Reservas (mostrador + web pública)
- Check-in / Check-out
- Folios & Cargos
- Facturación (boleta/factura)
- Inventario (productos + movimientos)
- Reportes (ocupación, RevPAR, ADR)
