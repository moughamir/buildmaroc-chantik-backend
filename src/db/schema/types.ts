import { customType } from 'drizzle-orm/pg-core';

export type GeometryPoint = { lng: number; lat: number };

// Decode a 2D Point from EWKB (PostGIS). postgres.js has no parser registered
// for the PostGIS `geometry` OID, so the driver hands the column back as a
// text-formatted hex EWKB string (and, in binary mode, a raw Buffer). Neither
// is directly usable by the frontend, which expects `{ lat, lng }`.
//
// EWKB layout for a 2D point:
//   [byteOrder:1][type:uint32][(srid:uint32)][x:float64][y:float64]
// The 0x20000000 flag in `type` marks the presence of the optional SRID field
// (4326 for this column). A bare point is 21 bytes, an SRID-carrying one 25.
function decodeEwkbPoint(value: string | Buffer): GeometryPoint {
  const buf = typeof value === 'string'
    ? Buffer.from(value.replace(/^0x/, ''), 'hex')
    : value;

  // Need at least 5 bytes for the header and 21 for a bare 2D point.
  if (!Buffer.isBuffer(buf) || buf.length < 21) {
    return { lng: NaN, lat: NaN };
  }

  const littleEndian = buf[0] === 1;
  const readUInt32 = (offset: number) => littleEndian
    ? buf.readUInt32LE(offset)
    : buf.readUInt32BE(offset);
  const readDouble = (offset: number) => littleEndian
    ? buf.readDoubleLE(offset)
    : buf.readDoubleBE(offset);

  const type = readUInt32(1);
  // PostGIS typmods (`geometry(Point, 4326)`) reject non-Point values, so any
  // well-formed EWKB reaching us is a Point; bail out defensively otherwise.
  if ((type & 0x00000001) !== 0x00000001) {
    return { lng: NaN, lat: NaN };
  }

  let offset = 5;
  if ((type & 0x20000000) !== 0) offset += 4; // skip SRID (4326)

  return { lng: readDouble(offset), lat: readDouble(offset + 8) };
}

export const geometryPoint = customType<{ data: GeometryPoint; driverData: string | Buffer }>({
  dataType() { return 'geometry(Point, 4326)'; },
  toDriver(value) { return `SRID=4326;POINT(${value.lng} ${value.lat})`; },
  fromDriver(value) { return decodeEwkbPoint(value); },
});
