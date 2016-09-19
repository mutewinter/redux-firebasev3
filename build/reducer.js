'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _immutable = require('immutable');

var _constants = require('./constants');

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var emptyState = {
  auth: undefined,
  authError: undefined,
  profile: undefined,
  isInitializing: undefined,
  data: {}
};

var initialState = (0, _immutable.fromJS)(emptyState);

var pathToArr = function pathToArr(path) {
  return path.split(/\//).filter(function (p) {
    return !!p;
  });
};

exports.default = function () {
  var state = arguments.length <= 0 || arguments[0] === undefined ? initialState : arguments[0];
  var action = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
  var path = action.path;

  var pathArr = void 0;
  var retVal = void 0;

  switch (action.type) {

    case _constants.SET:
      var data = action.data;

      pathArr = pathToArr(path);

      retVal = data !== undefined ? state.setIn(['data'].concat(_toConsumableArray(pathArr)), (0, _immutable.fromJS)(data)) : state.deleteIn(['data'].concat(_toConsumableArray(pathArr)));

      return retVal;

    case _constants.NO_VALUE:
      pathArr = pathToArr(path);
      retVal = state.setIn(['data'].concat(_toConsumableArray(pathArr)), (0, _immutable.fromJS)({}));
      return retVal;

    case _constants.SET_PROFILE:
      var profile = action.profile;

      return profile !== undefined ? state.setIn(['profile'], (0, _immutable.fromJS)(profile)) : state.deleteIn(['profile']);

    case _constants.LOGOUT:
      return (0, _immutable.fromJS)({
        auth: null,
        authError: null,
        profile: null,
        isLoading: false,
        data: {}
      });

    case _constants.LOGIN:
      return state.setIn(['auth'], (0, _immutable.fromJS)(action.auth)).setIn(['authError'], null);

    case _constants.LOGIN_ERROR:
      return state.setIn(['authError'], action.authError).setIn(['auth'], null).setIn(['profile'], null);

    case _constants.AUTHENTICATION_INIT_STARTED:
      return initialState.setIn(['isInitializing'], true);
    // return state.setIn(['isInitializing'], true) // throws state.setIn not a function error

    case _constants.AUTHENTICATION_INIT_FINISHED:
      return state.setIn(['isInitializing'], false);

    case _constants.UNAUTHORIZED_ERROR:
      return state.setIn(['authError'], action.authError);

    default:
      return state;

  }
};