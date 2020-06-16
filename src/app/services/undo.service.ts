import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UndoService {
  stack = [];
  MAX_LENGTH = 20;
  constructor() { }

  add(item: any): void {
    const i = JSON.parse(JSON.stringify(item));
    this.stack.push(i);
    if (this.stack.length > this.MAX_LENGTH) {
      this.stack.shift();
    }
  }

  undo(): any {
    return this.stack.pop();
  }
}
