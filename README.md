# 🏨 Hotel Luxe — Sistema de Gestión Hotelera

Sistema integral de gestión hotelera desarrollado con **Node.js + Express + Supabase**.

## 👥 Roles del Sistema

| Rol | Descripción | Accesos |
|-----|-------------|---------|
| **Admin** | Administrador global | Todo el sistema |
| **Gerente** | Gerente del hotel | Gestión + Reportes |
| **Recepcionista** | Personal de recepción | Operación diaria |

## 🚀 Inicio Rápido (Desarrollo Local)

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar Supabase

**Opción A — Supabase Cloud (Recomendado):**
1. Crea un proyecto en https://supabase.com
2. Ve a **SQL Editor** y ejecuta `supabase/schema.sql`
3. Copia las credenciales al `.env`:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
JWT_SECRET=tu-secret-jwt-super-seguro-minimo-32-chars
```

**Opción B — Supabase Local (Docker):**
```bash
npx supabase start
npx supabase db push
```

### 3. Inicializar usuarios de prueba
```bash
npm run db:seed
```

### 4. Iniciar servidor
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 🔑 Credenciales de Prueba

| Usuario | Email | Password | Rol |
|---------|-------|----------|-----|
| Admin | admin@hotel.com | Admin123! | Administrador |
| Gerente | gerente@hotel.com | Gerente123! | Gerente |
| Recepcionista | recepcion@hotel.com | Recep123! | Recepcionista |

## 🌐 Vistas del Sistema

| Vista | URL | Descripción |
|-------|-----|-------------|
| **Portal Web** | `/` | Reservas públicas de huéspedes |
| **Login Staff** | `/` → Staff Login | Login para personal |
| **Dashboard** | `/` (post-login) | Panel principal |
| **Reservas** | Dashboard → Reservas | Gestión de reservaciones |
| **Check-in/out** | Dashboard → Check-in | Ingreso/egreso huéspedes |
| **Estadías** | Dashboard → Estadías | Huéspedes actuales + folios |
| **Huéspedes** | Dashboard → Huéspedes | Base de datos de clientes |
| **Habitaciones** | Dashboard → Habitaciones | Mapa y estado de habitaciones |
| **Inventario** | Dashboard → Inventario | Stock y productos |
| **Reportes** | Dashboard → Reportes | Dashboard de métricas |
| **Usuarios** | Dashboard → Usuarios | CRUD de personal |

## 📡 API REST

Base URL: `http://localhost:3000/api/v1`

| Módulo | Endpoints |
|--------|-----------|
| Auth | `POST /auth/login`, `GET /auth/me` |
| Usuarios | `GET/POST/PUT /usuarios` |
| Huéspedes | `GET/POST/PUT /huespedes` |
| Habitaciones | `GET/POST/PUT/PATCH /habitaciones` |
| Reservas | `GET/POST/PUT/PATCH /reservas` |
| Estadías | `POST /estadias/checkin`, `POST /estadias/:id/checkout` |
| Folios | `GET /folios/:id`, `POST /folios/:id/cargos` |
| Inventario | `GET/POST /inventario/productos` |
| Reportes | `GET /reportes/dashboard`, `/ingresos`, `/ocupacion` |
| Web | `GET /web/habitaciones`, `POST /web/reservas` |

## 🏗️ Arquitectura

```
hotel/
├── src/
│   ├── app.js              # Configuración Express
│   ├── index.js            # Entry point
│   ├── config/
│   │   ├── supabase.js     # Cliente Supabase
│   │   └── seed.js         # Datos iniciales
│   ├── middleware/
│   │   ├── auth.js         # JWT + RBAC
│   │   └── errorHandler.js
│   ├── modules/
│   │   ├── auth/           # Login/logout
│   │   ├── usuarios/       # Gestión de personal
│   │   ├── huespedes/      # Clientes
│   │   ├── habitaciones/   # Rooms
│   │   ├── reservas/       # Bookings
│   │   ├── estadias/       # Check-in/out
│   │   ├── folios/         # Billing
│   │   ├── inventario/     # Stock
│   │   ├── reportes/       # Analytics
│   │   └── web/            # Portal público
│   └── utils/
│       └── response.js     # Helpers API
├── public/                 # Frontend SPA
│   ├── index.html
│   ├── css/styles.css
│   └── js/app.js
└── supabase/
    └── schema.sql          # DDL completo
```

## 🚢 Deploy en Render

1. Crea un nuevo **Web Service** en Render
2. Conecta tu repositorio GitHub
3. Configura:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Agrega las variables de entorno del `.env.example`
5. Usa Supabase Cloud como base de datos

## 📊 Casos de Uso Implementados

| CU | Descripción | Estado |
|----|-------------|--------|
| CU01 | Registro de usuarios | ✅ |
| CU02 | Configuración de permisos RBAC | ✅ |
| CU03 | Registro de huéspedes | ✅ |
| CU04 | Historial de huéspedes | ✅ |
| CU05 | Gestión de habitaciones | ✅ |
| CU06 | Reserva mostrador | ✅ |
| CU07 | Cancelación de reserva | ✅ |
| CU08 | Consulta web disponibilidad | ✅ |
| CU09 | Reserva online (portal web) | ✅ |
| CU10 | Check-in | ✅ |
| CU11 | Check-out | ✅ |
| CU12 | Cálculo de cuenta (folio) | ✅ |
| CU13 | Facturación | ✅ |
| CU14 | Gestión de inventario | ✅ |
| CU15 | Cargos de consumos | ✅ |
| CU16 | Reportes y dashboard | ✅ |
