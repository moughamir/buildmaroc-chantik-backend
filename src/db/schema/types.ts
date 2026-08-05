import { customType } from 'drizzle-orm/pg-core';

export const geometryPoint = customType<{ data: { lng: number; lat: number }; driverData: string }>({
  dataType() { return 'geometry(Point, 4326)'; },
  toDriver(value) { return `SRID=4326;POINT(${value.lng} ${value.lat})`; },
  fromDriver(value) { return value as any; },
});