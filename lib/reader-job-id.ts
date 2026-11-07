import 'server-only';
import { createHash } from 'node:crypto';
import type { ReaderJob } from './reader-protocol';

/** Version metadata results independently of queue transport and other caches. */
export function readerJobId(job: ReaderJob) {
  return createHash('sha256').update(JSON.stringify(job) + (job.kind === 'drama' ? ':english-v2' : '')).digest('hex');
}
