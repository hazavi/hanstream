import 'server-only';
import { createHash } from 'node:crypto';
import type { ReaderJob } from './reader-protocol';

/** Version metadata results independently of queue transport and other caches. */
export function readerJobId(job: ReaderJob) {
  return createHash('sha256').update(JSON.stringify(job) + (['drama','artwork','search','popular','home','rankings','browse'].includes(job.kind) ? ':asian-catalog-v3' : '')).digest('hex');
}
