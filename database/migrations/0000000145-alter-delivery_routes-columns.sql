ALTER TABLE "delivery_routes" ADD COLUMN "courier_id" INTEGER REFERENCES "couriers"("id");
