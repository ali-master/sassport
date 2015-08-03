'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _nodeSass = require('node-sass');

var _nodeSass2 = _interopRequireDefault(_nodeSass);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _ncp = require('ncp');

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var sassUtils = require('node-sass-utils')(_nodeSass2['default']);

var sassport = function sassport(modules) {
  var renderer = arguments[1] === undefined ? _nodeSass2['default'] : arguments[1];

  if (!Array.isArray(modules)) {
    modules = [modules];
  }

  var sassportInstance = new Sassport(null, modules, renderer);

  return sassportInstance;
};

sassport.module = function (name) {
  return new Sassport(name);
};

sassport.wrap = function (unwrappedFunc) {
  var options = arguments[1] === undefined ? {} : arguments[1];

  return (function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var done = args.pop();
    console.log(done);
    var innerDone = function innerDone(result) {
      console.log('innerDone called');
      return done(options.returnSass ? result : sassUtils.castToSass(result));
    };

    args = args.map(function (arg) {
      return sassUtils.castToJs(arg);
    });

    var result = unwrappedFunc.apply(undefined, args.concat([innerDone]));

    return innerDone(result);
  }).bind(this);
};

sassport.utils = sassUtils;

var Sassport = (function () {
  function Sassport(name) {
    var modules = arguments[1] === undefined ? [] : arguments[1];
    var renderer = arguments[2] === undefined ? _nodeSass2['default'] : arguments[2];

    _classCallCheck(this, Sassport);

    this.name = name;
    this.modules = modules;
    this.sass = renderer;

    this._exportMeta = {
      contents: []
    };

    this._exports = {};

    this._mixins = {};

    this._localAssetPath = this._remoteAssetPath = null;

    var options = {
      functions: {
        'asset-url($source, $module: null)': (function (source, module) {
          var modulePath = sassUtils.isNull(module) ? '' : module.getValue();
          var assetPath = source.getValue();
          var assetUrl = 'url(' + _path2['default'].join(this._remoteAssetPath, modulePath, assetPath) + ')';

          return _nodeSass2['default'].types.String(assetUrl);
        }).bind(this)
      },
      importer: this._importer.bind(this)
    };

    modules.map(function (module) {
      _lodash2['default'].merge(options, module.options);
    });

    this.options = options;
  }

  _createClass(Sassport, [{
    key: 'module',
    value: function module(name) {
      this.name = name;

      return this;
    }
  }, {
    key: 'render',
    value: function render(options, emitter) {
      _lodash2['default'].extend(this.options, options);

      return this.sass.render(this.options, emitter);
    }
  }, {
    key: 'renderSync',
    value: function renderSync(options, emitter) {
      _lodash2['default'].extend(this.options, options);

      return this.sass.render(this.options, emitter);
    }
  }, {
    key: 'functions',
    value: function functions(functionMap) {
      _lodash2['default'].extend(this.options.functions, functionMap);

      return this;
    }
  }, {
    key: 'exports',
    value: function exports(exportMap) {
      for (var exportKey in exportMap) {
        var exportPath = exportMap[exportKey];
        var exportMeta = {
          file: null,
          directory: null,
          content: null
        };

        if (exportKey === 'default') {
          this._exportMeta.file = exportPath;

          continue;
        }

        if (_fs2['default'].lstatSync(exportPath).isDirectory()) {
          exportMeta.directory = exportPath;

          delete exportMeta.file;
        } else {
          exportMeta.file = exportPath;
        }

        this._exports[exportKey] = exportMeta;
      }

      return this;
    }
  }, {
    key: '_importer',
    value: function _importer(url, prev, done) {
      var _this = this;

      var _url$split = url.split('/');

      var _url$split2 = _toArray(_url$split);

      var moduleName = _url$split2[0];

      var moduleImports = _url$split2.slice(1);

      var module = null;
      var importerData = {};
      var exportMeta = undefined;

      if (moduleName === this.name) {
        module = this;
      } else {
        module = this.modules.find(function (childModule) {
          childModule.name === moduleName;
        });
      }

      if (!module) return prev;

      exportMeta = module._exportMeta;

      if (moduleImports.length) {
        exportMeta = this._exports[moduleImports[0]];
      }

      if (module._exportMeta.file) {
        if (!exportMeta.contents || !exportMeta.contents.length) {
          importerData.file = exportMeta.file;
        } else {
          importerData.contents = _fs2['default'].readFileSync(exportMeta.file);
        }
      }

      if (exportMeta.contents && exportMeta.contents.length) {
        importerData.contents += exportMeta.contents.join('');
      }

      if (exportMeta.directory) {
        (function () {
          var assetDirPath = _path2['default'].join(_this._localAssetPath, moduleName, moduleImports[0]);

          _mkdirp2['default'](assetDirPath, function (err, res) {
            if (err) console.error(err);

            _ncp.ncp(exportMeta.directory, assetDirPath, function (err, res) {
              done(importerData);
            });
          });
        })();
      } else {
        done(importerData);
      }
    }
  }, {
    key: 'variables',
    value: function variables(variableMap) {
      for (var key in variableMap) {
        var value = variableMap[key];
        var sassValue = sassUtils.sassString(sassUtils.castToSass(value));

        this._exportMeta.contents.push('' + key + ': ' + sassValue + ';');
      }

      return this;
    }
  }, {
    key: 'rulesets',
    value: function rulesets(_rulesets) {
      var _this2 = this;

      _rulesets.map((function (ruleset) {
        var renderedRuleset = _this2.sass.renderSync({ data: ruleset }).css.toString();

        _this2._exportMeta.contents.push(renderedRuleset);
      }).bind(this));

      return this;
    }
  }, {
    key: 'assets',
    value: function assets(localPath) {
      var remotePath = arguments[1] === undefined ? null : arguments[1];

      this._localAssetPath = _path2['default'].join(localPath, 'sassport-assets');
      this._remoteAssetPath = remotePath;

      _mkdirp2['default'].sync(this._localAssetPath);

      return this;
    }
  }]);

  return Sassport;
})();

exports['default'] = sassport;
module.exports = exports['default'];