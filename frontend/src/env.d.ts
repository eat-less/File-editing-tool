declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'konva' {
  const konva: any
  export default konva
}

declare module 'vue-konva' {
  const VueKonva: any
  export default VueKonva
}
