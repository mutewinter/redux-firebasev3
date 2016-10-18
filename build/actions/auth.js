'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resetPassword = exports.createUser = exports.logout = exports.login = exports.createUserProfile = exports.init = undefined;

var _constants = require('../constants');

var _es6Promise = require('es6-promise');

var _lodash = require('lodash');

var _jwtDecode = require('jwt-decode');

var _jwtDecode2 = _interopRequireDefault(_jwtDecode);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var defaultJWTKeys = ['aud', 'auth_time', 'exp', 'firebase', 'iat', 'iss', 'sub', 'user_id'];

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
    watchUserProfile(dispatch, firebase);

    dispatchLogin(dispatch, authData);
  });
  dispatch({ type: _constants.AUTHENTICATION_INIT_FINISHED });

  firebase.auth().currentUser;
};

/**
 * @description Remove listener from user profile
 * @param {Object} firebase - Internal firebase object
 */
var unWatchUserProfile = function unWatchUserProfile(firebase) {
  var authUid = firebase._.authUid;
  var userProfilePath = getUserProfilePath(firebase, authUid);
  if (firebase._.profileWatch) {
    firebase.database().ref().child(userProfilePath).off('value', firebase._.profileWatch);
    firebase._.profileWatch = null;
  }
};

/**
 * @description Watch user profile
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} firebase - Internal firebase object
 */
var watchUserProfile = function watchUserProfile(dispatch, firebase) {
  var authUid = firebase._.authUid;
  var userProfilePath = getUserProfilePath(firebase, authUid);
  unWatchUserProfile(firebase);
  if (userProfilePath) {
    firebase._.profileWatch = firebase.database().ref().child(userProfilePath).on('value', function (snap) {
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
var getUserProfilePath = function getUserProfilePath(firebase, authUid) {
  var userProfile = firebase._.config.userProfile;

  if (typeof userProfile === 'function') {
    return userProfile(authUid);
  }
  return userProfile + '/' + authUid;
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

var createUserProfile = exports.createUserProfile = function createUserProfile(dispatch, firebase, userData, profile) {
  var userProfilePath = getUserProfilePath(firebase, userData.uid);
  // Check for user's profile at userProfile path if provided
  if (!userProfilePath) {
    return _es6Promise.Promise.resolve(userData);
  }
  return firebase.database().ref().child(userProfilePath).once('value').then(function (profileSnap) {
    // Update the profile
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
      // Extract the extra data in the JWT token for user object
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
 * @return {Promise}
 */
var logout = exports.logout = function logout(dispatch, firebase) {
  var promise = firebase.auth().signOut();
  try {
    dispatch({ type: _constants.LOGOUT });
    unWatchUserProfile(firebase);
    firebase._.authUid = null;
  } catch (error) {
    console.error('Error logging out', error);
  }
  return promise;
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
  var signIn = _ref2.signIn;

  dispatchLoginError(dispatch, null);

  if (!email || !password) {
    dispatchLoginError(dispatch, new Error('Email and Password are required to create user'));
    return _es6Promise.Promise.reject('Email and Password are Required');
  }

  return firebase.auth().createUserWithEmailAndPassword(email, password).then(function (userData) {
    return (
      // Login to newly created account if signIn
      firebase.auth().currentUser || !!signIn && signIn === false ? createUserProfile(dispatch, firebase, userData, profile) : login(dispatch, firebase, { email: email, password: password }).then(function () {
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
      })
    );
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

exports.default = { init: init, logout: logout, createUser: createUser, resetPassword: resetPassword };