
import sass from 'node-sass';
import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import { ncp } from 'ncp';
import mkdirp from 'mkdirp';

const sassUtils = require('node-sass-utils')(sass);

let sassport = function(modules, renderer = sass) {
  if (!Array.isArray(modules)) {
    modules = [modules];
  }

  let sassportInstance = new Sassport(null, modules, renderer);

  return sassportInstance;
};

sassport.module = function(name) {
  return new Sassport(name);
};

sassport.wrap = function(unwrappedFunc, options = {}) {
  return function(...args) {
    let done = args.pop();
    console.log(done);
    let innerDone = function(result) {
      console.log('innerDone called');
      return done(options.returnSass ? result : sassUtils.castToSass(result));
    };

    args = args.map(arg => sassUtils.castToJs(arg));

    let result = unwrappedFunc(...args, innerDone);

    return innerDone(result);
  }.bind(this);
};

sassport.utils = sassUtils;

class Sassport {
  constructor(name, modules = [], renderer = sass) {
    this.name = name;
    this.modules = modules;
    this.sass = renderer;

    this._exportMeta = {
      contents: []
    };

    this._exports = {};

    this._mixins = {};

    this._localAssetPath = this._remoteAssetPath = null;

    let options = {
      functions: {
        'asset-url($source, $module: null)': function(source, module) {
          let modulePath = sassUtils.isNull(module) ? '' : module.getValue();
          let assetPath = source.getValue();
          let assetUrl = `url(${path.join(this._remoteAssetPath, modulePath, assetPath)})`;

          return sass.types.String(assetUrl);
        }.bind(this)
      },
      importer: this._importer.bind(this)
    };

    modules.map(module => {
      _.merge(options, module.options);
    });

    this.options = options;
  }

  module(name) {
    this.name = name;

    return this;
  }

  render(options, emitter) {
    _.extend(this.options, options);

    return this.sass.render(this.options, emitter);
  }

  renderSync(options, emitter) {
    _.extend(this.options, options);

    return this.sass.render(this.options, emitter);
  }

  functions(functionMap) {
    _.extend(this.options.functions, functionMap);

    return this;
  }

  exports(exportMap) {
    for (let exportKey in exportMap) {
      let exportPath = exportMap[exportKey];
      let exportMeta = {
        file: null,
        directory: null,
        content: null
      };

      if (exportKey === 'default') {
        this._exportMeta.file = exportPath;

        continue;
      }

      if (fs.lstatSync(exportPath).isDirectory()) {
        exportMeta.directory = exportPath;

        delete exportMeta.file;
      } else {
        exportMeta.file = exportPath;
      }

      this._exports[exportKey] = exportMeta;
    }

    return this;
  }

  _importer(url, prev, done) {
    let [ moduleName, ...moduleImports ] = url.split('/');
    let module = null;
    let importerData = {};
    let exportMeta;

    if (moduleName === this.name) {
      module = this;
    } else {
      module = this.modules.find((childModule) => {
        childModule.name === moduleName;
      });
    }

    if (!module) return prev;

    exportMeta = module._exportMeta;

    if (moduleImports.length) {
      exportMeta =  this._exports[moduleImports[0]];
    }

    if (module._exportMeta.file) {
      if (!exportMeta.contents || !exportMeta.contents.length) {
        importerData.file = exportMeta.file;
      } else {
        importerData.contents = fs.readFileSync(exportMeta.file);
      }
    }

    if (exportMeta.contents && exportMeta.contents.length) {
      importerData.contents += exportMeta.contents.join('');
    }

    if (exportMeta.directory) {
      let assetDirPath = path.join(this._localAssetPath, moduleName, moduleImports[0]);

      mkdirp(assetDirPath, (err, res) => {
        if (err) console.error(err);

        ncp(exportMeta.directory, assetDirPath, (err, res) => {
          done(importerData);
        });
      });
    } else {
      done(importerData);
    }
  }

  variables(variableMap) {
    for (let key in variableMap) {
      let value = variableMap[key];
      let sassValue = sassUtils.sassString(sassUtils.castToSass(value));

      this._exportMeta.contents.push(`${key}: ${sassValue};`)
    }

    return this;
  }

  rulesets(rulesets) {
    rulesets.map((ruleset) => {
      let renderedRuleset = this.sass
        .renderSync({ data: ruleset })
        .css.toString();

      this._exportMeta.contents.push(renderedRuleset);
    }.bind(this));

    return this;
  }

  assets(localPath, remotePath = null) {
    this._localAssetPath = path.join(localPath, 'sassport-assets');
    this._remoteAssetPath = remotePath;

    mkdirp.sync(this._localAssetPath);

    return this;
  }
}

export default sassport;
