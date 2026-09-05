import { Injectable, signal } from '@angular/core';

/** A shared local clock for class UI state. It does not make network requests. */
@Injectable({ providedIn: 'root' })
export class ClassSessionClockService {
  readonly now = signal(Date.now());

  constructor() {
    window.setInterval(() => this.now.set(Date.now()), 30_000);
  }
}
