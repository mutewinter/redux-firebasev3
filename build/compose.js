'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _firebase = require('firebase');

var _firebase2 = _interopRequireDefault(_firebase);

var _actions = require('./actions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (config, otherConfig) {
  return function (next) {
    return function (reducer, initialState) {
      var defaultConfig = {
        userProfile: null,
        enableLogging: false
      };

      var store = next(reducer, initialState);
      var dispatch = store.dispatch;
      var apiKey = config.apiKey;
      var authDomain = config.authDomain;
      var databaseURL = config.databaseURL;
      var storageBucket = config.storageBucket;

      // Throw for missing Firebase Data

      if (!databaseURL) throw new Error('Firebase databaseURL is required');
      if (!authDomain) throw new Error('Firebase authDomain is required');
      if (!apiKey) throw new Error('Firebase apiKey is required');

      // Combine all configs
      var configs = Object.assign({}, defaultConfig, config, otherConfig);

      // Initialize Firebase
      try {
        _firebase2.default.initializeApp({ apiKey: apiKey, authDomain: authDomain, databaseURL: databaseURL, storageBucket: storageBucket });
      } catch (err) {}

      // TODO: Handle firebasev2 logging
      // Enable Logging based on config
      if (configs.enableLogging) {
        _firebase2.default.database.enableLogging(configs.enableLogging);
      }

      var ref = _firebase2.default.database().ref();

      var firebase = Object.defineProperty(_firebase2.default, '_', {
        value: {
          watchers: {},
          config: configs,
          authUid: null
        },
        writable: true,
        enumerable: true,
        configurable: true
      });

      var set = function set(path, value, onComplete) {
        return ref.child(path).set(value, onComplete);
      };

      var push = function push(path, value, onComplete) {
        return ref.child(path).push(value, onComplete);
      };

      var update = function update(path, value, onComplete) {
        return ref.child(path).update(value, onComplete);
      };

      var remove = function remove(path, onComplete) {
        return ref.child(path).remove(onComplete);
      };

      var uniqueSet = function uniqueSet(path, value, onComplete) {
        return ref.child(path).once('value').then(function (snap) {
          if (snap.val && snap.val() !== null) {
            var err = new Error('Path already exists.');
            if (onComplete) onComplete(err);
            return Promise.reject(err);
          }
          return ref.child(path).set(value, onComplete);
        });
      };

      var watchEvent = function watchEvent(eventName, eventPath) {
        return _actions.queryActions.watchEvent(firebase, dispatch, eventName, eventPath, true);
      };

      var unWatchEvent = function unWatchEvent(eventName, eventPath) {
        var queryId = arguments.length <= 2 || arguments[2] === undefined ? undefined : arguments[2];
        return _actions.queryActions.unWatchEvent(firebase, eventName, eventPath, queryId);
      };

      var login = function login(credentials) {
        return _actions.authActions.login(dispatch, firebase, credentials);
      };

      var logout = function logout() {
        return _actions.authActions.logout(dispatch, firebase);
      };

      var createUser = function createUser(credentials, profile) {
        return _actions.authActions.createUser(dispatch, firebase, credentials, profile);
      };

      var resetPassword = function resetPassword(credentials) {
        return _actions.authActions.resetPassword(dispatch, firebase, credentials);
      };

      firebase.helpers = {
        set: set,
        uniqueSet: uniqueSet,
        push: push,
        remove: remove,
        update: update,
        login: login,
        logout: logout,
        createUser: createUser,
        resetPassword: resetPassword,
        watchEvent: watchEvent,
        unWatchEvent: unWatchEvent
      };

      _actions.authActions.init(dispatch, firebase);

      store.firebase = firebase;

      return store;
    };
  };
};