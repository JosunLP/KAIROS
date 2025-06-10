-- Initialisierungsscript für PostgreSQL
-- Wird beim ersten Start des Containers ausgeführt

-- Datenbank kairos erstellen (falls nicht bereits vorhanden)
SELECT 'CREATE DATABASE kairos'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kairos')\gexec

-- Verbindung zur kairos Datenbank
\c kairos;

-- Aktiviere UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Kommentar für Dokumentation
COMMENT ON DATABASE kairos IS 'KAIROS Stock Analysis Database';
