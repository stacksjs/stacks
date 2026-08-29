ALTER TABLE "delivery_stops" ADD COLUMN "type" TEXT CHECK ("type" IN ('pickup', 'dropoff')) default 'dropoff';
