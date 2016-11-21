'use strict';
/*eslint no-console:0, quotes:0, no-debugger:0*/
/*global
require, __dirname
*/

const bluebird = require('bluebird');
const fs = bluebird.promisifyAll(require('fs'));
const path = require('path');
const timers = bluebird.promisifyAll(require('timers'));
const pug = require('pug');

// ------------------------------------------------------------
// Compilation of .vue components.

// Watches the specified dir. 
// Calls OnChange(full_file_path) when that file is first discovered or changed.
// No action on file removals, unless they are re-introduced back again.
function WatchDir(dir, OnChange) {
  const file_list = {};
  function ScanDir() {
    // DO: test non-existing folder
    fs.readdirAsync(dir).then(files => {
      for (const file of files) {
        if (!file.endsWith('.vue')) {
          continue;
        }

        const full_path = dir + '/' + file;
        fs.statAsync(full_path).then(function (stats) {
          if (file_list[full_path] !== stats.mtime.toJSON()) {
            file_list[full_path] = stats.mtime.toJSON();
            OnChange(full_path);
          }
        }).catch(e => { debugger; });
      }
    }).catch(e => { debugger; 'Fix the path to UI components!'; });
  }

  ScanDir();
  timers.setInterval(ScanDir, 3000);
}

// Compiles all updated .vue components into static renderers.
const template_compiler = require('vue-template-compiler');
function CompileVueComponents(path_to_vue_components, path_to_output_modules) {
  WatchDir(path_to_vue_components, function (filename) {
    fs.readFileAsync(filename, 'utf8').then(file_content => {
      const pug_content = template_compiler.parseComponent(file_content).template.content;
      const html = pug.render(pug_content);
      const renderers = template_compiler.compile(html);

      // Put into different files as
      // RegisterMe(component-name, render, staticRenderFns);
      //+ scan for changes off timer & update; full scan in the beginning
      const component_name = path.basename(filename, '.vue');
      let static_fns = '';
      for (const static_fn of renderers.staticRenderFns) {
        if (static_fns.length > 0) {
          static_fns += ',';
        }
        static_fns += `function() { ${static_fn} }`;
      }

      const register_render_code = `
        RegisterRender(
          "${component_name}",
          function() { ${renderers.render} }, 
          [ ${static_fns} ]
        );`;
      fs.writeFileAsync(path_to_output_modules + '/' + component_name + '.js', register_render_code)
        .then(() => { console.info("Successfully compiled:", filename); })
        .catch(e => { debugger; });
    }).catch(e => { debugger; });
  });
}

CompileVueComponents('../../ui/secure_vault_ui/src/components', './public/gens');

// ------------------------------------------------------------
// Serving. 
var express = require('express');
var app = express();

app.use(express.static(path.join(__dirname, 'public')));

// Views are pug templates: resnpose.render(...).
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.get('/', function (request, response) {
  // render with a parameter
  // response.render('index', { title: 'First App!' });
  response.render('index', {});
});

app.listen(3000);

// ------------------------------------------------------------
// Open the browser for interactive live coding.
const opn = require('opn');
opn('http://127.0.0.1:3000/');

// ------------------------------------------------------------
// Compile as a Chrome extension.
// Per instructions from
// https://developer.chrome.com/webstore/get_started_simple#step5
// at
// https://chrome.google.com/webstore/developer/dashboard
const fse = require('fs-extra');
const child_process = require('child_process');
// const child_process = bluebird.promisifyAll(require('child_process'));
Promise.all([
  RenderPugFile('views/index.pug', 'extension/index.html'),
  CopyAllJsFiles('public/gens', 'extension/gens'),
  CopyAllJsFiles('public', 'extension'),
  CopyFile('public/style.css', 'extension/style.css')
]).then(() => {
  child_process.spawn('zip', ['-r', 'extension.zip', 'extension'])
    .on('close', (code) => {
      debugger;
    });
});

function RenderPugFile(source_pug_file, dest_html_file) {
  return new Promise((resolve, reject) => {
    fs.readFileAsync(source_pug_file, 'utf8').then(file_content => {
      const html = pug.render(file_content);
      fs.writeFileAsync(dest_html_file, html)
        .then(resolve)
        .catch(reject);
    });
  });
}

function CopyAllJsFiles(from_dir, to_dir) {
  return new Promise((resolve, reject) => {
    fs.readdirAsync(from_dir).then(files => {
      let all_copy_promises = [];
      for (const file of files) {
        if (!file.endsWith('.js')) {
          continue;
        }
        const base_name = path.basename(file);
        all_copy_promises.push(CopyFile(
          from_dir + '/' + base_name,
          to_dir + '/' + base_name));
      }

      Promise.all(all_copy_promises).then(resolve).catch(reject);
    });
  });
}

function CopyFile(from, to) {
  return new Promise((resolve, reject) => {
    fse.copy(from, to, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
    //fs.createReadStream(from).pipe(fs.createWriteStream(to));
  });
}
