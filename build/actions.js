'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resetPassword = exports.createUser = exports.logout = exports.login = exports.createUserProfile = exports.init = exports.unWatchEvents = exports.watchEvents = exports.unWatchEvent = exports.watchEvent = undefined;

var _constants = require('./constants');

var _es6Promise = require('es6-promise');

var _lodash = require('lodash');

var _jwtDecode = require('jwt-decode');

var _jwtDecode2 = _interopRequireDefault(_jwtDecode);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var defaultJWTKeys = ['aud', 'auth_time', 'exp', 'firebase', 'iat', 'iss', 'sub', 'user_id'];

var getWatchPath = function getWatchPath(event, path) {
  return event + ':' + (path.substring(0, 1) === '/' ? '' : '/') + path;
};

/**
 * @description Set a new watcher
 * @param {Object} firebase - Internal firebase object
 * @param {String} event - Type of event to watch for
 * @param {String} path - Path to watch with watcher
 * @param {String} queryId - Id of query
 */
var setWatcher = function setWatcher(firebase, event, path) {
  var queryId = arguments.length <= 3 || arguments[3] === undefined ? undefined : arguments[3];

  var id = queryId ? event + ':/' + queryId : getWatchPath(event, path);

  if (firebase._.watchers[id]) {
    firebase._.watchers[id]++;
  } else {
    firebase._.watchers[id] = 1;
  }

  return firebase._.watchers[id];
};

/**
 * @description Get count of currently attached watchers
 * @param {Object} firebase - Internal firebase object
 * @param {String} event - Type of event to watch for
 * @param {String} path - Path to watch with watcher
 * @param {String} queryId - Id of query
 */
var getWatcherCount = function getWatcherCount(firebase, event, path) {
  var queryId = arguments.length <= 3 || arguments[3] === undefined ? undefined : arguments[3];

  var id = queryId ? event + ':/' + queryId : getWatchPath(event, path);
  return firebase._.watchers[id];
};

/**
 * @description Get query id from query path
 * @param {String} path - Path from which to get query id
 */
var getQueryIdFromPath = function getQueryIdFromPath(path) {
  var origPath = path;
  var pathSplitted = path.split('#');
  path = pathSplitted[0];

  var isQuery = pathSplitted.length > 1;
  var queryParams = isQuery ? pathSplitted[1].split('&') : [];
  var queryId = isQuery ? queryParams.map(function (param) {
    var splittedParam = param.split('=');
    if (splittedParam[0] === 'queryId') {
      return splittedParam[1];
    }
  }).filter(function (q) {
    return q;
  }) : undefined;

  return queryId && queryId.length > 0 ? queryId[0] : isQuery ? origPath : undefined;
};

/**
 * @description Remove/Unset a watcher
 * @param {Object} firebase - Internal firebase object
 * @param {String} event - Type of event to watch for
 * @param {String} path - Path to watch with watcher
 * @param {String} queryId - Id of query
 */
var unsetWatcher = function unsetWatcher(firebase, event, path) {
  var queryId = arguments.length <= 3 || arguments[3] === undefined ? undefined : arguments[3];

  var id = queryId || getQueryIdFromPath(path);
  path = path.split('#')[0];

  if (!id) {
    id = getWatchPath(event, path);
  }

  if (firebase._.watchers[id] <= 1) {
    delete firebase._.watchers[id];
    if (event !== 'first_child') {
      firebase.database().ref().child(path).off(event);
    }
  } else if (firebase._.watchers[id]) {
    firebase._.watchers[id]--;
  }
};

/**
 * @description Watch a specific event type
 * @param {Object} firebase - Internal firebase object
 * @param {Function} dispatch - Action dispatch function
 * @param {String} event - Type of event to watch for
 * @param {String} path - Path to watch with watcher
 * @param {String} dest
 * @param {Boolean} onlyLastEvent - Whether or not to listen to only the last event
 */
var watchEvent = exports.watchEvent = function watchEvent(firebase, dispatch, event, path, dest) {
  var onlyLastEvent = arguments.length <= 5 || arguments[5] === undefined ? false : arguments[5];

  var isQuery = false;
  var queryParams = [];
  var queryId = getQueryIdFromPath(path);

  if (queryId) {
    var pathSplitted = path.split('#');
    path = pathSplitted[0];
    isQuery = true;
    queryParams = pathSplitted[1].split('&');
  }

  var watchPath = !dest ? path : path + '@' + dest;
  var counter = getWatcherCount(firebase, event, watchPath, queryId);

  if (counter > 0) {
    if (onlyLastEvent) {
      // listen only to last query on same path
      if (queryId) {
        unsetWatcher(firebase, event, path, queryId);
      } else {
        return;
      }
    }
  }

  setWatcher(firebase, event, watchPath, queryId);

  if (event === 'first_child') {
    // return
    return firebase.database().ref().child(path).orderByKey().limitToFirst(1).once('value', function (snapshot) {
      if (snapshot.val() === null) {
        dispatch({
          type: _constants.NO_VALUE,
          path: path
        });
      }
    });
  }

  var query = firebase.database().ref().child(path);

  if (isQuery) {
    (function () {
      var doNotParse = false;

      queryParams.forEach(function (param) {
        param = param.split('=');
        switch (param[0]) {
          case 'orderByValue':
            query = query.orderByValue();
            doNotParse = true;
            break;
          case 'orderByPriority':
            query = query.orderByPriority();
            doNotParse = true;
            break;
          case 'orderByKey':
            query = query.orderByKey();
            doNotParse = true;
            break;
          case 'orderByChild':
            query = query.orderByChild(param[1]);
            break;
          case 'limitToFirst':
            query = query.limitToFirst(parseInt(param[1]));
            break;
          case 'limitToLast':
            query = query.limitToLast(parseInt(param[1]));
            break;
          case 'equalTo':
            var equalToParam = !doNotParse ? parseInt(param[1]) || param[1] : param[1];
            equalToParam = equalToParam === 'null' ? null : equalToParam;
            query = param.length === 3 ? query.equalTo(equalToParam, param[2]) : query.equalTo(equalToParam);
            break;
          case 'startAt':
            var startAtParam = !doNotParse ? parseInt(param[1]) || param[1] : param[1];
            startAtParam = startAtParam === 'null' ? null : startAtParam;
            query = param.length === 3 ? query.startAt(startAtParam, param[2]) : query.startAt(startAtParam);
            break;
          case 'endAt':
            var endAtParam = !doNotParse ? parseInt(param[1]) || param[1] : param[1];
            endAtParam = endAtParam === 'null' ? null : endAtParam;
            query = param.length === 3 ? query.endAt(endAtParam, param[2]) : query.endAt(endAtParam);
            break;
          default:
            break;
        }
      });
    })();
  }

  var runQuery = function runQuery(q, e, p) {
    q.on(e, function (snapshot) {
      var data = e === 'child_removed' ? undefined : snapshot.val();
      var resultPath = dest || e === 'value' ? p : p + '/' + snapshot.key;
      if (dest && e !== 'child_removed') {
        data = {
          _id: snapshot.key,
          val: snapshot.val()
        };
      }
      dispatch({
        type: _constants.SET,
        path: resultPath,
        data: data,
        snapshot: snapshot
      });
    });
  };

  runQuery(query, event, path);
};

/**
 * @description Remove watcher from an event
 * @param {Object} firebase - Internal firebase object
 * @param {String} event - Event for which to remove the watcher
 * @param {String} path - Path of watcher to remove
 */
var unWatchEvent = exports.unWatchEvent = function unWatchEvent(firebase, event, path) {
  var queryId = arguments.length <= 3 || arguments[3] === undefined ? undefined : arguments[3];
  return unsetWatcher(firebase, event, path, queryId);
};

/**
 * @description Add watchers to a list of events
 * @param {Object} firebase - Internal firebase object
 * @param {Function} dispatch - Action dispatch function
 * @param {Array} events - List of events for which to add watchers
 */
var watchEvents = exports.watchEvents = function watchEvents(firebase, dispatch, events) {
  return events.forEach(function (event) {
    return watchEvent(firebase, dispatch, event.name, event.path);
  });
};

/**
 * @description Remove watchers from a list of events
 * @param {Object} firebase - Internal firebase object
 * @param {Array} events - List of events for which to remove watchers
 */
var unWatchEvents = exports.unWatchEvents = function unWatchEvents(firebase, events) {
  return events.forEach(function (event) {
    return unWatchEvent(firebase, event.name, event.path);
  });
};

/**
 * @description Dispatch login error action
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} authError - Error object
 */
var dispatchLoginError = function dispatchLoginError(dispatch, authError) {
  return dispatch({
    type: _constants.LOGIN_ERROR,
    authError: authError
  });
};

/**
 * @description Dispatch login error action
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} authError - Error object
 */
var dispatchUnauthorizedError = function dispatchUnauthorizedError(dispatch, authError) {
  return dispatch({
    type: _constants.UNAUTHORIZED_ERROR,
    authError: authError
  });
};
/**
 * @description Dispatch login action
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} auth - Auth data object
 */
var dispatchLogin = function dispatchLogin(dispatch, auth) {
  return dispatch({
    type: _constants.LOGIN,
    auth: auth,
    authError: null
  });
};

/**
 * @description Remove listener from user profile
 * @param {Object} firebase - Internal firebase object
 */
var unWatchUserProfile = function unWatchUserProfile(firebase) {
  var authUid = firebase._.authUid;
  var userProfilesPath = getUserProfilesPath(firebase, authUid);
  if (firebase._.profileWatch) {
    firebase.database().ref().child(userProfilesPath + '/' + authUid).off('value', firebase._.profileWatch);
    firebase._.profileWatch = null;
  }
};

/**
 * @description Watch user profile
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} firebase - Internal firebase object
 */
var watchUserProfile = function watchUserProfile(dispatch, firebase, authData) {
  var authUid = firebase._.authUid;
  var userProfilesPath = getUserProfilesPath(firebase, authUid);

  unWatchUserProfile(firebase);
  if (userProfilesPath) {
    firebase._.profileWatch = firebase.database().ref().child(userProfilesPath + '/' + authUid).on('value', function (snap) {
      dispatch({
        type: _constants.SET_PROFILE,
        profile: snap.val()
      });
    });
  }
};

/**
 * @description Get the path to the user profiles.
 * @param {Object} firebase - Internal firebase object
 */
var getUserProfilesPath = function getUserProfilesPath(firebase, authUid) {
  var userProfile = firebase._.config.userProfile;

  return typeof userProfile === 'function' ? userProfile(authUid) : userProfile;
};

/**
 * @description Get correct login method and params order based on provided credentials
 * @param {Object} credentials - Login credentials
 * @param {String} credentials.email - Email to login with (only needed for email login)
 * @param {String} credentials.password - Password to login with (only needed for email login)
 * @param {String} credentials.provider - Provider name such as google, twitter (only needed for 3rd party provider login)
 * @param {String} credentials.type - Popup or redirect (only needed for 3rd party provider login)
 * @param {String} credentials.token - Custom or provider token
 */
var getLoginMethodAndParams = function getLoginMethodAndParams(_ref, firebase) {
  var email = _ref.email;
  var password = _ref.password;
  var provider = _ref.provider;
  var type = _ref.type;
  var token = _ref.token;

  if (provider) {
    if (token) {
      return {
        method: 'signInWithCredential',
        params: [provider, token]
      };
    }
    var authProvider = new firebase.auth[(0, _lodash.capitalize)(provider) + 'AuthProvider']();
    authProvider.addScope('email');
    if (type === 'popup') {
      return {
        method: 'signInWithPopup',
        params: [authProvider]
      };
    }
    return {
      method: 'signInWithRedirect',
      params: [authProvider]
    };
  }
  if (token) {
    return {
      method: 'signInWithCustomToken',
      params: [token]
    };
  }
  return {
    method: 'signInWithEmailAndPassword',
    params: [email, password]
  };
};

/**
 * @description Initialize authentication state change listener that
 * watches user profile and dispatches login action
 * @param {Function} dispatch - Action dispatch function
 */
var init = exports.init = function init(dispatch, firebase) {
  dispatch({ type: _constants.AUTHENTICATION_INIT_STARTED });

  firebase.auth().onAuthStateChanged(function (authData) {
    if (!authData) {
      return dispatch({ type: _constants.LOGOUT });
    }

    firebase._.authUid = authData.uid;
    watchUserProfile(dispatch, firebase, authData);

    dispatchLogin(dispatch, authData);
  });
  dispatch({ type: _constants.AUTHENTICATION_INIT_FINISHED });

  firebase.auth().currentUser;
};

var createUserProfile = exports.createUserProfile = function createUserProfile(dispatch, firebase, userData, profile) {
  var userProfilesPath = getUserProfilesPath(firebase, userData.uid);
  // Check for user profiles path is provided
  if (!userProfilesPath) {
    return _es6Promise.Promise.resolve(userData);
  }
  return firebase.database().ref().child(userProfilesPath + '/' + userData.uid).once('value').then(function (profileSnap) {
    return profileSnap.ref.update(profile).then(function () {
      return profile;
    }).catch(function (err) {
      // Error setting profile
      dispatchUnauthorizedError(dispatch, err);
      return _es6Promise.Promise.reject(err);
    });
  }).catch(function (err) {
    // Error reading user profile
    dispatchUnauthorizedError(dispatch, err);
    return _es6Promise.Promise.reject(err);
  });
};

/**
 * @description Login with errors dispatched
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} firebase - Internal firebase object
 * @param {Object} credentials - Login credentials
 * @param {Object} credentials.email - Email to login with (only needed for email login)
 * @param {Object} credentials.password - Password to login with (only needed for email login)
 * @param {Object} credentials.provider - Provider name such as google, twitter (only needed for 3rd party provider login)
 * @param {Object} credentials.type - Popup or redirect (only needed for 3rd party provider login)
 * @param {Object} credentials.token - Custom or provider token
 */
var login = exports.login = function login(dispatch, firebase, credentials) {
  var _firebase$auth;

  dispatchLoginError(dispatch, null);

  var _getLoginMethodAndPar = getLoginMethodAndParams(credentials, firebase);

  var method = _getLoginMethodAndPar.method;
  var params = _getLoginMethodAndPar.params;

  return (_firebase$auth = firebase.auth())[method].apply(_firebase$auth, _toConsumableArray(params)).then(function (userData) {
    // For email auth return uid (createUser is used for creating a profile)
    if (userData.email) return userData.uid;
    // For token auth, the user key doesn't exist. Instead, return the JWT.
    if (method === 'signInWithCustomToken') {
      // Extract the extra data in the JWT token and use it to create the
      // user.
      var _userData$toJSON = userData.toJSON();

      var accessToken = _userData$toJSON.stsTokenManager.accessToken;
      var uid = _userData$toJSON.uid;

      var jwtData = (0, _jwtDecode2.default)(accessToken);
      var extraJWTData = (0, _lodash.omit)(jwtData, defaultJWTKeys);
      return createUserProfile(dispatch, firebase, { uid: uid }, extraJWTData);
    }
    // Create profile when logging in with external provider
    var user = userData.user;

    return createUserProfile(dispatch, firebase, user, Object.assign({}, {
      email: user.email,
      providerData: user.providerData
    }));
  }).catch(function (err) {
    dispatchLoginError(dispatch, err);
    return _es6Promise.Promise.reject(err);
  });
};

/**
 * @description Logout of firebase and dispatch logout event
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} firebase - Internal firebase object
 */
var logout = exports.logout = function logout(dispatch, firebase) {
  firebase.auth().signOut();
  dispatch({ type: _constants.LOGOUT });
  firebase._.authUid = null;
  unWatchUserProfile(firebase);
};

/**
 * @description Create a new user in auth and add an account to userProfile root
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} firebase - Internal firebase object
 * @param {Object} credentials - Login credentials
 * @return {Promise}
 */
var createUser = exports.createUser = function createUser(dispatch, firebase, _ref2, profile) {
  var email = _ref2.email;
  var password = _ref2.password;

  dispatchLoginError(dispatch, null);

  if (!email || !password) {
    dispatchLoginError(dispatch, new Error('Email and Password are required to create user'));
    return _es6Promise.Promise.reject('Email and Password are Required');
  }

  return firebase.auth().createUserWithEmailAndPassword(email, password).then(function (userData) {
    // Login to newly created account
    login(dispatch, firebase, { email: email, password: password }).then(function () {
      return createUserProfile(dispatch, firebase, userData, profile);
    }).catch(function (err) {
      if (err) {
        switch (err.code) {
          case 'auth/user-not-found':
            dispatchLoginError(dispatch, new Error('The specified user account does not exist.'));
            break;
          default:
            dispatchLoginError(dispatch, err);
        }
      }
      return _es6Promise.Promise.reject(err);
    });
  }).catch(function (err) {
    dispatchLoginError(dispatch, err);
    return _es6Promise.Promise.reject(err);
  });
};

/**
 * @description Send password reset email to provided email
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} firebase - Internal firebase object
 * @param {String} email - Email to send recovery email to
 * @return {Promise}
 */
var resetPassword = exports.resetPassword = function resetPassword(dispatch, firebase, email) {
  dispatchLoginError(dispatch, null);
  return firebase.auth().sendPasswordResetEmail(email).catch(function (err) {
    if (err) {
      switch (err.code) {
        case 'INVALID_USER':
          dispatchLoginError(dispatch, new Error('The specified user account does not exist.'));
          break;
        default:
          dispatchLoginError(dispatch, err);
      }
      return _es6Promise.Promise.reject(err);
    }
  });
};

exports.default = { watchEvents: watchEvents, unWatchEvents: unWatchEvents, init: init, logout: logout, createUser: createUser, resetPassword: resetPassword };