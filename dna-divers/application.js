System.register([], function (_export, _context) {
  "use strict";

  var cc, Application;
  function traceLoading(name) {
    if (typeof window !== 'undefined' && window.__loadTrace) window.__loadTrace.mark(name);
  }
  // The distribution bootstrap (web-platforms/*.html) is put into index.html by the poki-sdk build hook.
  function platformCall(name, value) {
    var platform = window.__dnaDiversPlatform;
    if (!platform || typeof platform[name] !== 'function') return;
    try {
      platform[name](value);
    } catch (error) {
      console.warn('[Platform] ' + name + ' failed', error);
    }
  }
  // Startup packs (extensions/poki-sdk/dist/native-packs.js, loader inline in index.html): the main bundle's
  // meshes and images come from a few large files. A packed file is handed over from memory; a weak device
  // gets the half-size copy of a 3D texture. Anything else, and any failure, goes the engine's usual way.
  function installPackLoaders(engine) {
    var packs = window.__dnaPacks;
    var downloader = engine.assetManager && engine.assetManager.downloader;
    if (!packs || !downloader || typeof downloader.register !== 'function') return;
    var handlers = downloader.handlers || {};
    var map = {};
    function binLoader(original) {
      return function (url, options, onComplete) {
        var pending = packs.take(url);
        if (!pending) return original(url, options, onComplete);
        pending.then(function (buffer) {
          if (buffer) onComplete(null, buffer);
          else original(url, options, onComplete);
        }, function () { original(url, options, onComplete); });
      };
    }
    function imageType(buffer) {
      var b = new Uint8Array(buffer, 0, Math.min(12, buffer.byteLength));
      if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
      if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
      return 'image/jpeg';
    }
    function imageLoader(original) {
      return function (url, options, onComplete) {
        var pending = packs.take(url);
        if (!pending) {
          var half = packs.halfUrl(url);
          if (!half) return original(url, options, onComplete);
          return original(half, options, function (err, image) {
            if (err) original(url, options, onComplete);
            else onComplete(null, image);
          });
        }
        pending.then(function (buffer) {
          if (!buffer) { original(url, options, onComplete); return; }
          var objectUrl = URL.createObjectURL(new Blob([buffer], { type: imageType(buffer) }));
          var img = new Image();
          img.onload = function () {
            img.onload = img.onerror = null;
            URL.revokeObjectURL(objectUrl);
            onComplete(null, img);
          };
          img.onerror = function () {
            img.onload = img.onerror = null;
            URL.revokeObjectURL(objectUrl);
            original(url, options, onComplete);
          };
          img.src = objectUrl;
        }, function () { original(url, options, onComplete); });
      };
    }
    (packs.exts || []).forEach(function (ext) {
      if (ext === '.bin') {
        var bin = handlers[ext] || downloader._downloadArrayBuffer;
        if (bin) map[ext] = binLoader(bin);
        return;
      }
      var image = handlers[ext] || downloader.downloadDomImage;
      if (image) map[ext] = imageLoader(image);
    });
    if (Object.keys(map).length) downloader.register(map);
  }
  function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
  function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
  function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
  function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
  function _toPrimitive(input, hint) { if (_typeof(input) !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (_typeof(res) !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
  return {
    setters: [],
    execute: function () {
      _export("Application", Application = /*#__PURE__*/function () {
        function Application() {
          _classCallCheck(this, Application);
          this.settingsPath = 'src/settings.json'; // settings.json file path, usually passed in by the editor when building, you can also specify your own path
          this.showFPS = false; // Whether or not to open the profiler, usually passed in when the editor is built, but you can also specify the value you want
        }
        _createClass(Application, [{
          key: "init",
          value: function init(engine) {
            traceLoading('application init');
            if (!window.__dnaDiversPlatform) {
              // Fail visibly: without the bootstrap saves read as empty and gameplay calls throw.
              throw new Error('Web platform is not configured: the poki-sdk build hook did not fill the distribution slot in index.html.');
            }
            cc = engine;
            // Scene loads use the engine's 'scene' preset: 20 parallel downloads. The launch scene pulls
            // hundreds of files, a cold CDN answers each in ~0.8 s and the portal CDNs speak HTTP/2
            // (256 streams), so the download is latency-bound: throughput is about parallel / latency.
            var scenePreset = cc.assetManager && cc.assetManager.presets && cc.assetManager.presets.scene;
            if (scenePreset) scenePreset.maxConcurrency = scenePreset.maxRequestsPerFrame = 64;
            // Downloader.init (inside game.init) keeps registered handlers, so they can go in before it.
            try {
              installPackLoaders(cc);
            } catch (error) {
              console.warn('[Packs] loose files only', error);
            }
            cc.game.onPostBaseInitDelegate.add(this.onPostInitBase.bind(this)); // Listening for engine start process events onPostBaseInitDelegate
            cc.game.onPostSubsystemInitDelegate.add(this.onPostSystemInit.bind(this)); // Listening for engine start process events onPostSubsystemInitDelegate
            cc.game.onPostProjectInitDelegate.add(this.onProjectDataEvent.bind(this));

            //inform the distribution platform that the game is loading.
            platformCall('loadingStart');
          }
        }, {
          key: "onPostInitBase",
          value: function onPostInitBase() {
            traceLoading('engine base initialized');
            // cc.settings.overrideSettings('assets', 'server', '');

            //Set the debug value in the platform SDK based on the build settings.
            platformCall('setDebug', cc.settings.debug);
          }
        }, {
          key: "onPostSystemInit",
          value: function onPostSystemInit() {
            traceLoading('engine subsystems initialized');
          }
        }, {
          key: "onProjectDataEvent",
          value: function onProjectDataEvent() {
            traceLoading('project data initialized');
          }
        }, {
          key: "start",
          value: function start() {
            traceLoading('game.init start');
            return cc.game.init({
              // Run the engine with the required parameters
              debugMode: false ? cc.DebugMode.INFO : cc.DebugMode.ERROR,
              settingsPath: this.settingsPath,
              // Pass in the settings.json path
              overrideSettings: {
                // Override part of the data in the configuration file, this field will be described in detail below
                // Same for loads without a preset (resources.load and the like): the engine default is 15.
                assets: {
                  downloadMaxConcurrency: 64
                },
                // The engine starts loading the launch scene only after its splash; ours draws nothing
                // (no logo) under the HTML loader, so its 0.5 s were pure delay.
                splashScreen: {
                  totalTime: 0
                },
                profiling: {
                  showFPS: this.showFPS
                }
              }
            }).then(function () {
              traceLoading('game.init complete');
              cc.game.run(function () {
                traceLoading('game.run callback');
                //Inform the distribution platform that we have finished loading the game.
                platformCall('loadingFinished');

                // Cocos listens for keyboard on the #GameCanvas element itself,
                // so the canvas (not just the iframe window) must own focus for
                // WASD to work without a click. The portal focuses our iframe, but
                // inside it focus lands on <body>.
                var canvas = document.getElementById('GameCanvas');
                var isTextField = function (el) {
                  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
                };
                var focusCanvas = function () {
                  if (canvas && !isTextField(document.activeElement)) {
                    canvas.focus({ preventScroll: true });
                  }
                };

                window.focus();
                focusCanvas();

                // The portal (re)focuses the iframe window on play and after ads - pass it on.
                window.addEventListener('focus', focusCanvas);
                document.addEventListener('pointerdown', focusCanvas, true);

                // A keypress that lands outside the canvas: grab focus and replay
                // the event on the canvas so the very first press isn't swallowed.
                document.addEventListener('keydown', function (e) {
                  if (canvas && document.activeElement !== canvas && !isTextField(document.activeElement)) {
                    focusCanvas();
                    if (document.activeElement === canvas) {
                      canvas.dispatchEvent(new KeyboardEvent('keydown', e));
                    }
                  }
                });
              });
            });
          }
        }]);
        return Application;
      }());
    }
  };
});
