import type { ReaderJob } from "./reader-protocol";
export async function executeReaderJob(_job: ReaderJob): Promise<unknown> {
  throw new Error("Source readers are not included in the website deployment.");
}
export async function startConfiguredReader():Promise<{ready:()=>boolean}>{
  throw new Error('Source readers are not included in the website deployment.');
}
