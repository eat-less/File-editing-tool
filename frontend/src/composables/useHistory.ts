import { ref } from 'vue'

export class HistoryManager {
  private stack: any[] = []
  private pointer = -1
  private maxSize = 50

  push(snapshot: any) {
    this.stack = this.stack.slice(0, this.pointer + 1)
    this.stack.push(JSON.parse(JSON.stringify(snapshot)))
    if (this.stack.length > this.maxSize) {
      this.stack.shift()
    } else {
      this.pointer++
    }
  }

  undo(): any | null {
    if (this.pointer <= 0) return null
    this.pointer--
    return JSON.parse(JSON.stringify(this.stack[this.pointer]))
  }

  redo(): any | null {
    if (this.pointer >= this.stack.length - 1) return null
    this.pointer++
    return JSON.parse(JSON.stringify(this.stack[this.pointer]))
  }

  get canUndo() { return this.pointer > 0 }
  get canRedo() { return this.pointer < this.stack.length - 1 }

  clear() {
    this.stack = []
    this.pointer = -1
  }
}
