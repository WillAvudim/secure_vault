// http://eslint.org/docs/user-guide/configuring.html#configuring-rules
/*eslint no-console:0 quotes:0*/
/*global
Vue $
*/

// index.js
console.log('Client-side JS is working.');

// -------------------------------------------------------------------------
// TODO: Test Vue with precompiled/injected here render function.

// TODO: I need a token that will stay in-place (in comments) and will automatically lead to the in-place render function injection on the server side.
// TODO: every time .pug changes, render functions are re-injected into static javascript.

let global_app = null;

$(function() {
  const app = new Vue({
    el: "#app",
    data: {
      name: 'mail.ru',
      notes: 'Some notes',
      fields: [{name: '1'}, {name: '2', hide: 'true'}, {name: '3'}]
    },
    render: global_render_registry["edit"].render,
    staticRenderFns: global_render_registry["edit"].staticRenderFns
  });

  global_app = app;
});
