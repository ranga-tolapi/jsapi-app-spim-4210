import { Helper } from 'dxf';

export function parseDxf(dxfString: string, geometryType: string) {
  const helper = new Helper(dxfString);

  switch (geometryType) {
    case 'Point':
      return helper.parsed.entities.filter((x) => x.type === 'POINT');
    case 'Polygon':
      return helper.parsed.entities.filter((x) => x.type === 'LWPOLYLINE' && x.closed == true);
    case 'Polyline':
      return helper.parsed.entities.filter((x) => x.type === 'LWPOLYLINE' && x.closed == false);
    default:
      return helper.parsed.entities;
  }
}

export async function parseDxfFile(dxfFile: string, geometryType: string) {
  const res = await fetch(dxfFile);
  const body = await res.text();

  const helper = new Helper(body);

  switch (geometryType) {
    case 'Point':
      return helper.parsed.entities.filter((x) => x.type === 'POINT');
    case 'Polygon':
      return helper.parsed.entities.filter((x) => x.type === 'LWPOLYLINE' && x.closed == true);
    case 'Polyline':
      return helper.parsed.entities.filter((x) => x.type === 'LWPOLYLINE' && x.closed == false);
    default:
      return helper.parsed.entities;
  }
}
