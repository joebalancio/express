/*!
 * mio-express
 * https://github.com/mio/express
 */

'use strict';

/**
 * - Pair with [mio-ajax](https://github.com/mio/ajax) for automatic
 *   client-server communication.
 * - PATCH support with
 *   [fast-json-patch](https://github.com/Starcounter-Jack/Fast-JSON-Patch)
 * - Responds with 405 status for unsupported methods
 * - Support [`Prefer`](http://tools.ietf.org/html/rfc7240#section-4.2)
 *   header to control whether PUT and PATCH return the resource
 * - Includes `Location` header for created resources
 * - Emits events for accessing requests
 *
 * @example
 *
 * ```javascript
 * var mio = require('mio');
 * var ServerRoutes = require('mio-express').plugin;
 *
 * var User = mio.Resource.extend({
 *   attributes: {
 *     id: { primary: true }
 *   }
 * }, {
 *   baseUrl: '/users'
 * });
 *
 * User.use(ServerRoutes());
 * ```
 *
 * This will expose Express routing middleware via `User.router`:
 *
 * ```javascript
 * var bodyParser = require('body-parser');
 * var express = require('express');
 * var app = express();
 *
 * app
 *   .use(bodyParser.json())
 *   .use(User.router);
 * ```
 *
 * @module mio-express
 */

/**
 * @external mio
 * @see {@link https://github.com/mio/mio}
 */

/**
 * @name Resource
 * @memberof external:mio
 */

/**
 * Emitted by route handlers on request.
 *
 * @example
 *
 * ```javascript
 * Resource.on('request', function (req) {
 *   req.body.createdBy = req.session.userId;
 * });
 * ```
 *
 * @event request
 * @param {express.Request} request
 */

var defaults = require('defaults');
var HttpError = require('http-errors');
var jsonpatch = require('fast-json-patch');
var pathToRegExp = require('path-to-regexp');

/**
 * Returns Mio plugin function.
 *
 * Handlers return [`http-errors`](https://github.com/jshttp/http-errors).
 * These should be handled by your downstream error handling middleware.
 *
 * @example
 *
 * ```javascript
 * User.use(require('mio-express').plugin());
 * ```
 *
 * @param {Object=} options
 * @return {MioExpressPlugin}
 */
exports.plugin = function (options) {
  options = options || {};

  /**
   * Extends Mio resource with `Resource.router` and `Resource.routes`
   * middleware.
   *
   * @param {mio.Resource} Resource
   */
  return function MioExpressPlugin (Resource) {

    /**
     * Map of methods to route handlers.
     *
     * @memberof external:mio.Resource
     * @name routes
     * @type {Object}
     */
    Resource.routes = {
      /**
       * Map of collection methods to route handlers.
       *
       * @memberof external:mio.Resource.routes
       * @name collection
       * @type {Object}
       */
      collection: {}
    };

    var paths = {};

    // create route middleware for resource actions
    Object.keys(Resource.url()).forEach(function (action) {
      if (exports[action]) {
        Resource.routes[action] = function (req, res, next) {
          exports[action].call(Resource, req, res, next);
        };
      }
    });

    Object.keys(Resource.Collection.url()).forEach(function (action) {
      if (exports.collection[action]) {
        Resource.routes.collection[action] = function (req, res, next) {
          exports.collection[action].call(Resource, req, res, next);
        };
      }
    });

    Resource.routes.options = function (req, res, next) {
      exports.options.call(Resource, req, res, next);
    };

    Resource.routes.collection.options = Resource.routes.options;

    Resource.router = (new ResourceRouter(Resource)).middleware();
  };
};

/**
 * Handle GET request by retrieving resource.
 *
 * Responds with 200 status and body of resource if found, otherwise an
 * 404 error is passed to `next()` to be handled by downstream middleware.
 *
 * @this {mio.Resource} Resource
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.Request.next} next
 * @fires request
 * @function external:Resource.routes.get
 */
exports.get = function (req, res, next) {
  mergeParams(this, (req.query.where = req.query.where || {}), req.params);

  /**
   * Emitted by route handlers on GET request.
   *
   * @event request:get
   * @param {express.Request} request
   */
  this.emit('request', req);
  this.emit('request:get', req);

  this.get(req.query, function(err, resource) {
    if (err) return next(err);

    if (resource) {
      res.status(200).send(resource);
    } else {
      next(HttpError(404, 'Not Found'));
    }
  });
};

/**
 * Handle POST request by creating a new resource.
 *
 * Responds with 201 status and body of created resource, as well as a
 * `Location` header with the URL of the newly created resource.
 *
 * @this {mio.Resource} Resource
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.Request.next} next
 * @fires request
 * @function external:mio.Resource.routes.post
 */
exports.post = function (req, res, next) {
  var Resource = this;

  // Add url parameters that match attribute names to the request body.
  if (req.params) {
    mergeParams(Resource, req.body, req.params);
  }

  /**
   * Emitted by route handlers on POST request.
   *
   * @event request:post
   * @param {express.Request} request
   */
  this.emit('request', req);
  this.emit('request:post', req);

  if (!req.is('application/json')) {
    return next(HttpError(415, 'Unsupported Media Type'));
  }

  Resource.post(req.body, function(err, resource) {
    if (err) return next(err);

    var location = Resource.url('get');

    if (location) {
      res.set('Location', location.replace(/:(\w+)/g, function(match, attr) {
        if (attr === 'primary') {
          attr = Resource.primaryKey;
        }

        if (Resource.attributes[attr] && resource[attr]) {
            return resource[attr];
        }

        return attr;
      }));
    }

    res.status(201).send(resource);
  });
};

/**
 * Handle a PUT request by replacing or creating a resource.
 *
 * Responds with 204 status unless the HTTP header contains `Prefer:
 * return=representation`, in which case a 200 status is used and the
 * response body will contain the resource.
 *
 * Responds with 201 if the resource does not already exist and one is created.
 *
 * @this {mio.Resource} Resource
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.Request.next} next
 * @fires request
 * @function external:mio.Resource.routes.put
 */
exports.put = function (req, res, next) {
  if (req.params) {
    mergeParams(this, (req.query.where = req.query.where || {}), req.params);
  }

  /**
   * Emitted by route handlers on PUT request.
   *
   * @event request:put
   * @param {express.Request} request
   */
  this.emit('request', req);
  this.emit('request:put', req);

  if (!req.is('application/json')) {
    return next(HttpError(415, 'Unsupported Media Type'));
  }

  this.get(req.query, function(err, resource) {
    if (err) return next(err);

    var status = 204;

    if (!resource) {
      status = 201;
      resource = new this();
    }

    resource.set(req.body).put(function(err) {
      if (err) return next(err);

      var prefer = req.get('prefer');

      if (status === 201) {
        res.status(201).send(resource);
      } else {
        // support RFC 7240 `Prefer` header
        if (prefer && prefer.match(/return=representation/i)) {
          res.status(200).send(resource);
        } else {
          res.status(204).end();
        }
      }
    });
  });
};

/**
 * Handle PATCH request by updating resource using provided JSON-Patch.
 *
 * Responds with 204 status unless the HTTP header contains `Prefer:
 * return=representation`, in which case a 200 status is used and the
 * response body will contain the resource.
 *
 * @this {mio.Resource} Resource
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.Request.next} next
 * @fires request
 * @function external:mio.Resource.routes.patch
 */
exports.patch = function (req, res, next) {
  if (req.params) {
    mergeParams(this, (req.query.where = req.query.where || {}), req.params);
  }

  /**
   * Emitted by route handlers on PATCH request.
   *
   * @event request:patch
   * @param {express.Request} request
   */
  this.emit('request', req);
  this.emit('request:patch', req);

  if (!req.is('application/json') && !req.is('application/json-patch+json')) {
    return next(HttpError(415, 'Unsupported Media Type'));
  }

  this.get(req.query, function(err, resource) {
    if (err) return next(err);

    if (resource) {
      if (req.is('application/json-patch+json')) {
        try {
          if (req.body.length) {
            jsonpatch.apply(resource, req.body);
          } else {
            jsonpatch.apply(resource, [req.body]);
          }
        } catch (error) {
          return next(
            HttpError(400, "JSON-Patch because malformed or invalid.")
          );
        }
      } else {
        resource.set(req.body);
      }

      resource.patch(function(err) {
        if (err) return next(err);

        var prefer = req.get('prefer');

        // support RFC 7240 `Prefer` header
        if (prefer && prefer.match(/return=representation/i)) {
          res.status(200).send(resource);
        } else {
          res.status(204).end();
        }
      });
    } else {
      return next(HttpError(404, 'Not Found'));
    }
  });
};

/**
 * Handle DELETE request by removing resource.
 *
 * Responds with 204 status if resource was removed.
 *
 * @this {mio.Resource} Resource
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.Request.next} next
 * @fires request
 * @function external:mio.Resource.routes.delete
 */
exports.delete = function (req, res, next) {
  if (req.params) {
    mergeParams(this, (req.query.where = req.query.where || {}), req.params);
  }

  /**
   * Emitted by route handlers on DELETE request.
   *
   * @event request:delete
   * @param {express.Request} request
   */
  this.emit('request', req);
  this.emit('request:delete', req);

  this.get(req.query, function(err, resource) {
    if (err) return next(err);

    if (!resource) {
      return next(HttpError(404, 'Not Found'));
    }

    resource.delete(function(err) {
      if (err) return next(err);

      res.status(204).end();
    });
  });
};

exports.collection = {};

/**
 * Handle GET request by retrieving resource collection.
 *
 * Responds with 200 status and body of resource collection.
 *
 * @this {mio.Resource} Resource
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.Request.next} next
 * @fires request
 * @function external:mio.Resource.routes.collection.get
 */
exports.collection.get = function (req, res, next) {
  if (req.params) {
    mergeParams(this, (req.query.where = req.query.where || {}), req.params);
  }

  this.emit('request', req);
  this.emit('request:get', req);

  this.Collection.get(req.query, function(err, collection) {
    if (err) return next(err);

    res.status(200).send(collection);
  });
};

/**
 * Handle PATCH request by updating resources using provided JSON-Patch.
 *
 * Responds with 204 status unless the HTTP header contains `Prefer:
 * return=representation`, in which case a 200 status is used and the
 * response body will contain the resources updated.
 *
 * @this {mio.Resource} Resource
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.Request.next} next
 * @fires request
 * @function external:mio.Resource.routes.collection.patch
 */
exports.collection.patch = function (req, res, next) {
  if (req.params) {
    mergeParams(this, (req.query.where = req.query.where || {}), req.params);
  }

  this.emit('request', req);
  this.emit('request:patch', req);

  if (!req.is('application/json') && !req.is('application/json-patch+json')) {
    return next(HttpError(415, 'Unsupported Media Type'));
  }

  this.Collection.get(req.query, function(err, resources) {
    if (err) return next(err);

    if (req.is('application/json-patch+json')) {
      resources.forEach(function(resource, i) {
        if (req.body.length) {
          jsonpatch.apply(resource, req.body[i]);
        } else {
          jsonpatch.apply(resource, [req.body]);
        }
      });
    } else {
      resources.forEach(function(resource, i) {
        resource.set(req.body);
      });
    }

    this.Collection.patch(req.query, req.body, function(err) {
      if (err) return next(err);

      var prefer = req.get('prefer');

      // support RFC 7240 `Prefer` header
      if (prefer && prefer.match(/return=representation/i)) {
        res.status(200).send(resources);
      } else {
        res.status(204).end();
      }
    });
  });
};

/**
 * Handle DELETE request by removing resources
 *
 * Responds with 204 status if resources were removed.
 *
 * @this {mio.Resource} Resource
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.Request.next} next
 * @fires request
 * @function external:mio.Resource.routes.collection.delete
 */

exports.collection.delete = function (req, res, next) {
  if (req.params) {
    mergeParams(this, (req.query.where = req.query.where || {}), req.params);
  }

  this.emit('request', req);
  this.emit('request:delete', req);

  this.Collection.delete(req.query, function(err) {
    if (err) return next(err);

    res.status(204).end();
  });
};

/**
 * Handle OPTIONS request by introspecting resource definition.
 *
 * Responds with 200 status and information about the resource in the response
 * body.
 *
 * @this {mio.Resource} Resource
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {Function(err)} next
 * @fires request
 * @function external:mio.Resource.routes.options
 */
exports.options = function (req, res, next) {
  var attributes = this.attributes;

  var body = {
    actions: this.urls,
    resource_description: this.description || undefined,
    resource_schema: {}
  };

  for (var name in attributes) {
    if (attributes[name].serializable !== false) {
      body.resource_schema[name] = attributes[name].description || {
        required: !!attributes[name].required
      };
    }
  }

  setAllowedActions(req.route.path, this, res);

  res.status(200).send(body);
};

/**
 * Respond with 405 Method Not Allowed.
 *
 * @this {mio.Resource} Resource
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.Request.next} next
 * @private
 */
exports.methodNotAllowed = function (req, res, next) {
  setAllowedActions(req.route.path, this, res);
  next(HttpError(405, 'Method Not Allowed'));
};

/**
 * Create a new router for given `Resource`.
 *
 * @param {mio.Resource} Resource
 * @return {Router}
 * @class
 * @private
 */
function ResourceRouter (Resource) {
  var router = this;
  var urls = Resource.url();
  var collectionUrls = Resource.Collection.url();

  this.Resource = Resource;
  this.routes = [];

  Object.keys(urls).forEach(function (method) {
    var route = {
      action: method,
      path: urls[method],
      method: method.toUpperCase(),
      handler: Resource.routes[method],
      params: []
    };

    route.regexp = pathToRegExp(Resource.url(method), route.params);

    router.routes.push(route);
  });

  Object.keys(collectionUrls).forEach(function (method) {
    var route = {
      action: method,
      path: collectionUrls[method],
      method: method.toUpperCase(),
      handler: Resource.routes.collection[method],
      params: []
    };

    route.regexp = pathToRegExp(Resource.Collection.url(method), route.params);

    router.routes.push(route);
  });
}

/**
 * Match request and return array of resource routes and populate `req.query`.
 *
 * @param {express.Request} req
 * @return {Array|null}
 * @private
 */
ResourceRouter.prototype.match = function (req) {
  var matches;
  var matched = [];

  for (var i=0, l=this.routes.length; i<l; i++) {
    if (matches = this.routes[i].regexp.exec(req.path)) {
      req.params = req.params || {};

      for (var ii=1, ll=matches.length; ii<ll; ii++) {
        req.params[this.routes[i].params[ii-1].name] = matches[ii];
      }

      matched.push(this.routes[i]);
    }
  }

  return matched.length && matched;
};

/**
 * Returns Express middleware function.
 *
 * @return {MioExpressRouterMiddleware}
 * @private
 */
ResourceRouter.prototype.middleware = function () {
  var router = this;
  var Resource = this.Resource;

  /**
   * Resource router middleware.
   *
   * @param {express.Request} req
   * @param {express.Response} res
   * @param {express.Request.next} next
   * @function external:mio.Resource.router
   */
  return function MioExpressRouterMiddleware (req, res, next) {
    var matched;

    if (matched = router.match(req)) {
      req.route = matched[0];

      for (var i=0, l=matched.length; i<l; i++) {
        if (matched[i].method === req.method) {
          return matched[i].handler(req, res, next);
        }
      }

      exports.methodNotAllowed.call(Resource, req, res, next);
    } else {
      next();
    }
  };
};

/**
 * Set `Allow` header.
 *
 * @param {String} path route path
 * @param {mio.Resource} Resource
 * @param {express.Response} res
 * @private
 */
function setAllowedActions (path, Resource, res) {
  var urls = Resource.url();
  var allowed = [];

  for (var method in urls) {
    if (path === urls[method]) {
      allowed.push(urls[method]);
    }
  }

  res.set('Allow', allowed);
}

/**
 * Merge request parameters into given `target`.
 *
 * @param {mio.Resource} Resource
 * @param {Object} target
 * @param {Object} params
 * @return {Object} returns target
 * @private
 */
function mergeParams (Resource, target, params) {
  var attributes = Object.keys(Resource.attributes);

  Object.keys(params).forEach(function (param) {
    if (param === 'primary') param = Resource.primaryKey;
    if (~attributes.indexOf(param)) {
      target[param] = params[param];
      if (typeof params[param] == 'string' && !isNaN(params[param])) {
        target[param] = Number(params[param]);
      }
    }
  });

  return target;
};

/**
 * Merge object `b` into object `a`.
 *
 * @private
 */
function merge (a, b) {
  for (var key in b) {
    a[key] = b[key];
  }
  return a;
};
