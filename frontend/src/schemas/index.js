import { VELOCLOUD_SCHEMA, VELOCLOUD_ID_KEY } from './velocloudSchema';
import { ARISTA_SCHEMA, ARISTA_ID_KEY } from './aristaSchema';

export function getSchema(section) {
  return section === 'velocloud' ? VELOCLOUD_SCHEMA : ARISTA_SCHEMA;
}

export function getIdKey(section) {
  return section === 'velocloud' ? VELOCLOUD_ID_KEY : ARISTA_ID_KEY;
}

export { VELOCLOUD_SCHEMA, VELOCLOUD_ID_KEY, ARISTA_SCHEMA, ARISTA_ID_KEY };
