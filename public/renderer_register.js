/*
  Maintains a collection of statically compiled vue renderers.
*/
const global_render_registry = {};
function RegisterRender(name, render, staticRenderFns) {
  global_render_registry[name] = {render: render, staticRenderFns: staticRenderFns};
}
