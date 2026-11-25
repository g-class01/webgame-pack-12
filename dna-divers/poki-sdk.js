/**
 * Universal Offline Poki SDK & Sitelock Immunizer v2.0
 * - Bypasses all Poki Sitelocks (eval, atob, location redirects)
 * - Auto-rewrites root-relative URLs (/assets/...) to relative paths
 * - Emulates Unity Poki Bridge and ads events
 */
(function() {
    'use strict';

    // 1. SITELOCK IMMUNIZER (Hook atob & eval)
    var origAtob = window.atob;
    window.atob = function(str) {
        if (typeof str === 'string') {
            if (str.indexOf('aHR0cHM6Ly9wb2tpLmNvbS9zaXRlbG9jaw') !== -1 || str.indexOf('sitelock') !== -1) {
                console.log('[Offline PokiSDK] Sitelock payload neutralized in atob');
                return 'javascript:void(0)';
            }
        }
        return origAtob.apply(this, arguments);
    };

    var origEval = window.eval;
    window.eval = function(str) {
        if (typeof str === 'string' && (str.indexOf('aHR0cHM6Ly9wb2tpLmNvbS9zaXRlbG9jaw') !== -1 || str.indexOf('sitelock') !== -1)) {
            console.log('[Offline PokiSDK] Sitelock code neutralized in eval');
            return;
        }
        return origEval.apply(this, arguments);
    };

    // 2. ROOT-RELATIVE PATH REWRITER (/assets/... -> ./assets/...)
    var origXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) {
            url = '.' + url;
        }
        return origXhrOpen.apply(this, [method, url].concat(Array.prototype.slice.call(arguments, 2)));
    };

    if (window.fetch) {
        var origFetch = window.fetch;
        window.fetch = function(input, init) {
            if (typeof input === 'string' && input.startsWith('/') && !input.startsWith('//')) {
                input = '.' + input;
            }
            return origFetch.apply(this, arguments);
        };
    }

    // 3. UNITY POKI BRIDGE STUB
    var bridgeName = null;
    window.initPokiBridge = function(e) {
        bridgeName = e;
        console.log('[Offline PokiSDK] initPokiBridge:', e);
        function sendReady() {
            var g = window.unityInstance || window.unityGame;
            if (g) {
                try { g.SendMessage(e, "ready"); } catch(err) {}
            } else {
                setTimeout(sendReady, 50);
            }
        }
        sendReady();
    };

    window.commercialBreak = function(fn) {
        var g = window.unityInstance || window.unityGame;
        if (g && bridgeName) {
            try { g.SendMessage(bridgeName, "commercialBreakCompleted"); } catch(e) {}
        }
        if (typeof fn === 'function') {
            try { fn(); } catch(err) {}
        }
        return Promise.resolve(true);
    };

    window.rewardedBreak = function(fn) {
        var g = window.unityInstance || window.unityGame;
        if (g && bridgeName) {
            try { g.SendMessage(bridgeName, "rewardedBreakCompleted", "true"); } catch(e) {}
        }
        if (typeof fn === 'function') {
            try { fn(true); } catch(err) {}
        }
        return Promise.resolve(true);
    };

    window.shareableURL = function(e) {
        var g = window.unityInstance || window.unityGame;
        if (g && bridgeName) {
            try { g.SendMessage(bridgeName, "shareableURLResolved", window.location.href); } catch(e) {}
        }
    };

    window.getUser = function() {
        var g = window.unityInstance || window.unityGame;
        if (g && bridgeName) {
            try { g.SendMessage(bridgeName, "getUserResolved", "{}"); } catch(e) {}
        }
    };

    window.getToken = function() {
        var g = window.unityInstance || window.unityGame;
        if (g && bridgeName) {
            try { g.SendMessage(bridgeName, "getTokenResolved", ""); } catch(e) {}
        }
    };

    window.login = function() {
        var g = window.unityInstance || window.unityGame;
        if (g && bridgeName) {
            try { g.SendMessage(bridgeName, "loginResolved"); } catch(e) {}
        }
    };

    // 4. POKISDK CLIENT API (Proxy Catch-all v2.2)
    var basePoki = {
        init: function() { return Promise.resolve(true); },
        initWithVideoHB: function() { return Promise.resolve(true); },
        customEvent: function() {},
        commercialBreak: function() { return Promise.resolve(); },
        rewardedBreak: function() { return Promise.resolve(true); },
        displayAd: function() {},
        destroyAd: function() {},
        getLeaderboard: function() { return Promise.resolve([]); },
        getLanguage: function() { return (navigator.language || 'en').substring(0, 2); },
        getURLParam: function(p) { return ''; },
        gameplayStart: function() {},
        gameplayStop: function() {},
        gameLoadingStart: function() {},
        gameLoadingFinished: function() {},
        gameLoadingProgress: function(p) {},
        happyTime: function(scale) {},
        isAdBlocked: function() { return false; },
        setDebug: function() {},
        captureError: function() {},
        logError: function() {},
        roundEnd: function() {},
        roundStart: function() {},
        movePill: function() {},
        openExternalLink: function() {},
        login: function() { return Promise.resolve(); },
        getUser: function() { return Promise.resolve(null); },
        getToken: function() { return Promise.resolve(""); },
        measure: function() {},
        shareableURL: function() { return Promise.resolve(window.location.href); }
    };
    window.PokiSDK = new Proxy(basePoki, {
        get: function(target, prop) {
            if (prop in target) return target[prop];
            return function() { return Promise.resolve(); };
        }
    });
    window.pokiSDK = window.PokiSDK;
})();
