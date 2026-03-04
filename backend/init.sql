-- Initialisierung der Datenbank-Tabellen
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    distance DECIMAL(10,2),
    type VARCHAR(20) DEFAULT 'unclassified',
    purpose TEXT,
    start_address TEXT,
    end_address TEXT
);

CREATE TABLE IF NOT EXISTS waypoints (
    id SERIAL PRIMARY KEY,
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    speed DECIMAL(10,2),
    altitude DECIMAL(10,2),
    accuracy DECIMAL(10,2)
);
