export class ReaderPending extends Error {
  constructor() {
    super("The catalog reader is preparing this request.");
  }
}
export class ReaderUnavailable extends Error {
  constructor() {
    super("The catalog reader is unavailable. Please try again shortly.");
  }
}
