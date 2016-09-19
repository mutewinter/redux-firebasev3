'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.unWatchEvents = exports.watchEvents = exports.unWatchEvent = exports.watchEvent = undefined;

var _constants = require('../constants');

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

exports.default = { watchEvents: watchEvents, unWatchEvents: unWatchEvents };