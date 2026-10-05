declare module "*.wasm" {
  const module: WebAssembly.Module
  export default module
}
declare module "*.ttf" {
  const bytes: ArrayBuffer
  export default bytes
}
