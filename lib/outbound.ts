import 'server-only';
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { Agent } from 'undici';

export function isPublicAddress(value: string) {
  try { return ipaddr.process(value).range() === 'unicast'; } catch { return false; }
}

/** DNS checks happen inside connect(), so a second lookup cannot change the address. */
export const publicDispatcher = new Agent({ connections: 4, connect: { timeout: 2500, lookup: (hostname, options, callback) => {
  lookup(hostname, { all: true, verbatim: true }).then(records => {
    if (!records.length || records.some(record => !isPublicAddress(record.address))) throw new Error('Blocked destination');
    if (options.all) callback(null, records);
    else callback(null, records[0].address, records[0].family);
  }).catch(() => callback(Object.assign(new Error('Public host lookup failed'), { code: 'ENOTFOUND' }), '', 4));
} } });
