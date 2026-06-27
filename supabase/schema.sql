-- ============================================================
-- HOTEL MANAGEMENT SYSTEM - DDL COMPLETO
-- Compatible con Supabase PostgreSQL
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- MÓDULO: AUTENTICACIÓN Y USUARIOS (CU01, CU02) — Staff
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre text NOT NULL UNIQUE,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permisos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  modulo text NOT NULL,
  accion text NOT NULL CHECK (accion IN ('leer','crear','modificar','eliminar')),
  descripcion text,
  UNIQUE(modulo, accion)
);

CREATE TABLE IF NOT EXISTS rol_permiso (
  rol_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permiso_id uuid NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  nombre text NOT NULL,
  apellido text NOT NULL,
  rol_id uuid NOT NULL REFERENCES roles(id),
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo','suspendido')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol_id);

-- ============================================================
-- MÓDULO: CLIENTES (Portal Web — Huéspedes con login)
-- ============================================================

CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  tipo_doc text NOT NULL DEFAULT 'DNI' CHECK (tipo_doc IN ('DNI','Pasaporte','CE','RUC')),
  nro_doc text,
  nombres text NOT NULL,
  apellidos text NOT NULL,
  telefono text,
  nacionalidad text DEFAULT 'Peruana',
  fecha_nacimiento date,
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  email_verificado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_clientes_doc ON clientes(nro_doc);

-- ============================================================
-- MÓDULO: HUÉSPEDES (registro operativo, CU03, CU04)
-- ============================================================

CREATE TABLE IF NOT EXISTS huespedes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id uuid REFERENCES clientes(id),
  tipo_doc text NOT NULL DEFAULT 'DNI' CHECK (tipo_doc IN ('DNI','Pasaporte','CE','RUC')),
  nro_doc text NOT NULL,
  nombres text NOT NULL,
  apellidos text NOT NULL,
  nacionalidad text DEFAULT 'Peruana',
  email text,
  telefono text,
  direccion text,
  fecha_nacimiento date,
  preferencias text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tipo_doc, nro_doc)
);

CREATE INDEX IF NOT EXISTS idx_huespedes_doc ON huespedes(nro_doc);
CREATE INDEX IF NOT EXISTS idx_huespedes_email ON huespedes(email);
CREATE INDEX IF NOT EXISTS idx_huespedes_cliente ON huespedes(cliente_id);

-- ============================================================
-- MÓDULO: HABITACIONES (CU05, CU08)
-- ============================================================

CREATE TABLE IF NOT EXISTS tipos_habitacion (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre text NOT NULL UNIQUE,
  descripcion text,
  capacidad int NOT NULL DEFAULT 2,
  precio_base numeric(10,2) NOT NULL,
  amenidades text[],
  imagen_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS habitaciones (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero text NOT NULL UNIQUE,
  piso int NOT NULL DEFAULT 1,
  tipo_id uuid NOT NULL REFERENCES tipos_habitacion(id),
  estado text NOT NULL DEFAULT 'disponible'
    CHECK (estado IN ('disponible','ocupada','limpieza','mantenimiento','fuera_de_servicio')),
  descripcion text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habitaciones_estado ON habitaciones(estado);
CREATE INDEX IF NOT EXISTS idx_habitaciones_tipo ON habitaciones(tipo_id);

-- ============================================================
-- MÓDULO: RESERVAS (CU06, CU07, CU08, CU09)
-- ============================================================

CREATE TABLE IF NOT EXISTS reservas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  huesped_id uuid NOT NULL REFERENCES huespedes(id),
  cliente_id uuid REFERENCES clientes(id),
  habitacion_id uuid NOT NULL REFERENCES habitaciones(id),
  fecha_checkin date NOT NULL,
  fecha_checkout date NOT NULL,
  estado text NOT NULL DEFAULT 'confirmada'
    CHECK (estado IN ('pendiente','confirmada','cancelada','no_show','completada')),
  origen text NOT NULL DEFAULT 'mostrador' CHECK (origen IN ('mostrador','web')),
  adultos int NOT NULL DEFAULT 1,
  ninos int NOT NULL DEFAULT 0,
  total_estimado numeric(10,2),
  notas text,
  motivo_cancelacion text,
  created_by uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_checkout > fecha_checkin)
);

CREATE INDEX IF NOT EXISTS idx_reservas_huesped ON reservas(huesped_id);
CREATE INDEX IF NOT EXISTS idx_reservas_habitacion ON reservas(habitacion_id);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON reservas(estado);
CREATE INDEX IF NOT EXISTS idx_reservas_fechas ON reservas(fecha_checkin, fecha_checkout);
CREATE INDEX IF NOT EXISTS idx_reservas_cliente ON reservas(cliente_id);

-- ============================================================
-- MÓDULO: ESTADÍAS / CHECK-IN / CHECK-OUT (CU10, CU11)
-- ============================================================

CREATE TABLE IF NOT EXISTS estadias (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reserva_id uuid REFERENCES reservas(id),
  habitacion_id uuid NOT NULL REFERENCES habitaciones(id),
  huesped_id uuid NOT NULL REFERENCES huespedes(id),
  checkin_real timestamptz NOT NULL DEFAULT now(),
  checkout_real timestamptz,
  estado text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','cerrada')),
  created_by uuid REFERENCES usuarios(id),
  checkout_by uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estadias_reserva ON estadias(reserva_id);
CREATE INDEX IF NOT EXISTS idx_estadias_habitacion ON estadias(habitacion_id);
CREATE INDEX IF NOT EXISTS idx_estadias_huesped ON estadias(huesped_id);
CREATE INDEX IF NOT EXISTS idx_estadias_estado ON estadias(estado);

-- ============================================================
-- MÓDULO: PRODUCTOS (inventario/servicios)
-- ============================================================

CREATE TABLE IF NOT EXISTS productos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('insumo','servicio','alimento','bebida','otro')),
  precio numeric(10,2) NOT NULL DEFAULT 0,
  stock_actual int NOT NULL DEFAULT 0,
  stock_minimo int NOT NULL DEFAULT 0,
  unidad text NOT NULL DEFAULT 'und',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO: FOLIOS Y CARGOS (CU12, CU15)
-- ============================================================

CREATE TABLE IF NOT EXISTS folios (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  estadia_id uuid NOT NULL REFERENCES estadias(id),
  huesped_id uuid NOT NULL REFERENCES huespedes(id),
  total numeric(12,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','cerrado','pagado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_folios_estadia ON folios(estadia_id);
CREATE INDEX IF NOT EXISTS idx_folios_estado ON folios(estado);

CREATE TABLE IF NOT EXISTS cargos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio_id uuid NOT NULL REFERENCES folios(id),
  producto_id uuid REFERENCES productos(id),
  descripcion text NOT NULL,
  cantidad numeric(10,3) NOT NULL DEFAULT 1,
  precio_unitario numeric(10,2) NOT NULL,
  subtotal numeric(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  tipo text NOT NULL DEFAULT 'consumo' CHECK (tipo IN ('hospedaje','consumo','extra','descuento')),
  notas text,
  created_by uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cargos_folio ON cargos(folio_id);

-- ============================================================
-- MÓDULO: INVENTARIO (CU14)
-- ============================================================

CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id uuid NOT NULL REFERENCES productos(id),
  tipo text NOT NULL CHECK (tipo IN ('entrada','salida','merma','ajuste')),
  cantidad int NOT NULL CHECK (cantidad > 0),
  motivo text,
  ref_id uuid,
  created_by uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mov_producto ON movimientos_inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_mov_fecha ON movimientos_inventario(created_at);

-- ============================================================
-- MÓDULO: FACTURACIÓN (CU12, CU13)
-- ============================================================

CREATE TABLE IF NOT EXISTS metodos_pago (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre text NOT NULL UNIQUE,
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS facturas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio_id uuid NOT NULL REFERENCES folios(id),
  huesped_id uuid NOT NULL REFERENCES huespedes(id),
  tipo text NOT NULL DEFAULT 'boleta' CHECK (tipo IN ('boleta','factura','nota_credito')),
  nro_comprobante text UNIQUE,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  igv numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'emitida'
    CHECK (estado IN ('borrador','emitida','anulada','pagada')),
  fecha_emision timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_facturas_folio ON facturas(folio_id);
CREATE INDEX IF NOT EXISTS idx_facturas_huesped ON facturas(huesped_id);

CREATE TABLE IF NOT EXISTS pagos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  factura_id uuid NOT NULL REFERENCES facturas(id),
  metodo_id uuid NOT NULL REFERENCES metodos_pago(id),
  monto numeric(12,2) NOT NULL CHECK (monto > 0),
  referencia text,
  fecha timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_pagos_factura ON pagos(factura_id);

-- ============================================================
-- DATOS SEMILLA
-- ============================================================

-- Roles
INSERT INTO roles (nombre, descripcion) VALUES
  ('admin', 'Administrador global del sistema'),
  ('gerente', 'Gerente del hotel — gestión y reportes'),
  ('recepcionista', 'Personal de recepción — operación diaria')
ON CONFLICT (nombre) DO NOTHING;

-- Permisos
INSERT INTO permisos (modulo, accion) VALUES
  ('usuarios','leer'), ('usuarios','crear'), ('usuarios','modificar'), ('usuarios','eliminar'),
  ('huespedes','leer'), ('huespedes','crear'), ('huespedes','modificar'), ('huespedes','eliminar'),
  ('habitaciones','leer'), ('habitaciones','crear'), ('habitaciones','modificar'), ('habitaciones','eliminar'),
  ('reservas','leer'), ('reservas','crear'), ('reservas','modificar'), ('reservas','eliminar'),
  ('estadias','leer'), ('estadias','crear'), ('estadias','modificar'),
  ('folios','leer'), ('folios','crear'), ('folios','modificar'),
  ('cargos','leer'), ('cargos','crear'), ('cargos','eliminar'),
  ('facturacion','leer'), ('facturacion','crear'), ('facturacion','modificar'),
  ('inventario','leer'), ('inventario','crear'), ('inventario','modificar'),
  ('reportes','leer'),
  ('productos','leer'), ('productos','crear'), ('productos','modificar'), ('productos','eliminar'),
  ('clientes','leer'), ('clientes','modificar')
ON CONFLICT (modulo, accion) DO NOTHING;

-- Admin: todos los permisos
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p WHERE r.nombre = 'admin'
ON CONFLICT DO NOTHING;

-- Gerente: leer + reportes + modificar
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.nombre = 'gerente'
AND (p.accion = 'leer' OR (p.modulo IN ('huespedes','habitaciones','reservas','clientes') AND p.accion IN ('crear','modificar')))
ON CONFLICT DO NOTHING;

-- Recepcionista: operación diaria
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.nombre = 'recepcionista'
AND p.modulo IN ('huespedes','habitaciones','reservas','estadias','folios','cargos','facturacion','inventario','productos','clientes')
AND p.accion IN ('leer','crear','modificar')
ON CONFLICT DO NOTHING;

-- Métodos de pago
INSERT INTO metodos_pago (nombre) VALUES
  ('efectivo'), ('tarjeta_debito'), ('tarjeta_credito'), ('transferencia'), ('yape_plin')
ON CONFLICT (nombre) DO NOTHING;

-- Tipos de habitación
INSERT INTO tipos_habitacion (nombre, descripcion, capacidad, precio_base, amenidades) VALUES
  ('Simple', 'Habitación individual con cama simple', 1, 80.00, ARRAY['WiFi','TV','Baño privado','Aire acondicionado']),
  ('Doble', 'Habitación doble con cama matrimonial', 2, 120.00, ARRAY['WiFi','TV','Baño privado','Aire acondicionado','Minibar']),
  ('Twin', 'Habitación con dos camas simples', 2, 130.00, ARRAY['WiFi','TV','Baño privado','Aire acondicionado']),
  ('Suite', 'Suite de lujo con sala y dormitorio', 3, 250.00, ARRAY['WiFi','TV','Baño privado','Aire acondicionado','Minibar','Jacuzzi','Sala de estar','Vista panorámica']),
  ('Familiar', 'Habitación amplia para familias', 4, 200.00, ARRAY['WiFi','TV','Baño privado','Aire acondicionado','Minibar','Dos camas dobles'])
ON CONFLICT (nombre) DO NOTHING;

-- Habitaciones de ejemplo
DO $$
DECLARE
  v_simple uuid; v_doble uuid; v_twin uuid; v_suite uuid; v_familiar uuid;
BEGIN
  SELECT id INTO v_simple FROM tipos_habitacion WHERE nombre='Simple';
  SELECT id INTO v_doble FROM tipos_habitacion WHERE nombre='Doble';
  SELECT id INTO v_twin FROM tipos_habitacion WHERE nombre='Twin';
  SELECT id INTO v_suite FROM tipos_habitacion WHERE nombre='Suite';
  SELECT id INTO v_familiar FROM tipos_habitacion WHERE nombre='Familiar';

  INSERT INTO habitaciones (numero, piso, tipo_id, estado) VALUES
    ('101', 1, v_simple, 'disponible'), ('102', 1, v_simple, 'disponible'), ('103', 1, v_simple, 'disponible'),
    ('201', 2, v_doble, 'disponible'), ('202', 2, v_doble, 'disponible'), ('203', 2, v_doble, 'disponible'),
    ('204', 2, v_twin, 'disponible'), ('205', 2, v_twin, 'disponible'), ('206', 2, v_twin, 'disponible'),
    ('301', 3, v_suite, 'disponible'), ('302', 3, v_suite, 'disponible'),
    ('303', 3, v_familiar, 'disponible'), ('304', 3, v_familiar, 'disponible')
  ON CONFLICT (numero) DO NOTHING;
END $$;

-- Productos de ejemplo
INSERT INTO productos (nombre, categoria, precio, stock_actual, stock_minimo, unidad) VALUES
  ('Agua mineral 500ml', 'bebida', 5.00, 100, 20, 'und'),
  ('Gaseosa 355ml', 'bebida', 6.00, 50, 10, 'und'),
  ('Cerveza 355ml', 'bebida', 12.00, 50, 10, 'und'),
  ('Vino tinto 750ml', 'bebida', 45.00, 20, 5, 'und'),
  ('Snack mix', 'alimento', 8.00, 60, 15, 'und'),
  ('Chocolate premium', 'alimento', 10.00, 40, 10, 'und'),
  ('Almuerzo ejecutivo', 'servicio', 35.00, 999, 0, 'und'),
  ('Room service - desayuno', 'servicio', 25.00, 999, 0, 'und'),
  ('Lavandería - prenda', 'servicio', 8.00, 999, 0, 'und'),
  ('Taxi aeropuerto', 'servicio', 60.00, 999, 0, 'und'),
  ('Jabón premium', 'insumo', 3.00, 200, 50, 'und'),
  ('Shampoo 200ml', 'insumo', 4.00, 150, 30, 'und'),
  ('Set amenidades', 'insumo', 12.00, 100, 20, 'set'),
  ('Sábanas queen', 'insumo', 0.00, 50, 10, 'und'),
  ('Toalla de baño', 'insumo', 0.00, 80, 20, 'und')
ON CONFLICT DO NOTHING;
