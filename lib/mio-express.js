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
 * - Emits events for accessing requests
 *
 * @example
 *
 * Use the plugin and specify `resource` and `collection` URLs:
 *
 * ```javascript
 * var mio = require('mio');
 * var ExpressResource = require('mio-express');
 *
 * var User = mio.Resource.extend({
 *   attributes: {
 *     id: { primary: true }
 *   }
 * });
 *
 * User.use(ExpressResource.plugin({
 *   url: {
 *     resource: '/users/:id'
 *     collection: '/users'
 *   }
 * });
 * ```
 *
 * This will expose Express route handlers at `User.routes` and a resource
 * routing middleware via `User.router`.
 *
 * Use `User.router` to route all actions:
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
 * Use `User.routes` handlers individually for complete control:
 *
 * ```javascript
 * app
 *   .get('/users', User.routes.index)
 *   .post('/users', User.routes.create)
 *   .patch('/users', User.routes.updateMany)
 *   .delete('/users', User.routes.destroyMany)
 *   .options('/users', User.routes.describe)
 *   .all('/users', User.routes.methodNotAllowed)
 *   .get('/users/:id', User.routes.show)
 *   .put('/users/:id', User.routes.replace)
 *   .patch('/users/:id', User.routes.update)
 *   .delete('/users/:id', User.routes.destroy)
 *   .options('/users/:id', User.routes.describeMany)
 *   .all('/users/:id', User.routes.methodNotAllowed);
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
 * @event request
 * @param {express.Request} request
 */

var HTTPError = require('http-error');
var jsonpatch = require('fast-json-patch');
var pathToRegExp = require('path-to-regexp');

var actionsToMethods = {
  describe: 'OPTIONS',
  describeMany: 'OPTIONS',
  index: 'GET',
  show: 'GET',
  create: 'POST',
  replace: 'PUT',
  update: 'PATCH',
  updateMany: 'PATCH',
  destroy: 'DELETE',
  destroyMany: 'DELETE'
};

/**
 * Returns Mio plugin function.
 *
 * @example
 *
 * Provide all available REST actions:
 *
 * ```javascript
 * User.use(exports({
 *   url: {
 *     resource: '/users/:id',
 *     collection: '/users'
 *   }
 * });
 * ```
 *
 * Provide only specified REST actions:
 *
 * ```javascript
 * User.use(exports({
 *   url: {
 *     resource: '/users/:id',
 *     collection: '/users',
 *     actions: {
 *       show: '/users/:id',
 *       update: '/users/:id',
 *       create: '/users'
 *     }
 *   }
 * });
 * ```
 *
 * **404 Errors**
 *
 * Note that `show`, `update`, and `destroy` handlers return
 * [`HttpError`](https://github.com/c9/node-http-error) errors for missing
 * resources. These errors should be handled by your downstream error handling
 * middleware.
 *
 * @param {Object} settings
 * @param {Object} settings.url
 * @param {String} settings.url.resource
 * @param {String} settings.url.collection
 * @param {Object=} settings.url.actions handlers that should be created/mounted
 * @return {MioExpressPlugin}
 */
exports.plugin = function MioExpressPluginFactory (settings) {

  /**
   * Extends Mio resource with `Resource.router` and `Resource.routes`
   * middleware.
   *
   * @param {mio.Resource} Resource
   */
  return function MioExpressPlugin (Resource) {
    var url = Resource.url || (settings && settings.url);

    if (!url || !url.resource || !url.collection) {
      throw new Error(
        "mio-express requires settings { url : { resource, collection } }"
      );
    }

    if (!url.actions) {
      url.actions = {
        show: url.resource,
        update: url.resource,
        replace: url.resource,
        destroy: url.resource,
        describe: url.resource,
        index: url.collection,
        create: url.collection,
        updateMany: url.collection,
        destroyMany: url.collection,
        describeMany: url.collection
      };
    }

    Resource.url = url;

    /**
     * Map of actions to route handlers.
     *
     * @memberof external:mio.Resource
     * @name routes
     * @type {Object}
     */
    Resource.routes = {};

    // create route middleware for resource actions
    Object.keys(url.actions).forEach(function (action) {
      Resource.routes[action] = function (req, res, next) {
        exports[action].call(Resource, req, res, next);
      };
    });

    Resource.router = (new ResourceRouter(Resource)).middleware();
  };
};

/**
 * Handle GET request to `Resource.url.collection` by retrieving resources.
 *
 * Responds with 200 status and body of resource collection.
 *
 * @this {mio.Resource} Resource
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.Request.next} next
 * @fires request
 * @function external:mio.Resource.routes.index
 */
exports.index = function (req, res, next) {
  if (req.params) merge(req.query, req.params);

  this.emit('request', req);

  this.find(req.query, function(err, collection) {
    if (err) return next(err);

    res.status(200).send(collection);
  });
};

/**
 * Handle GET request to `Resource.url.resource` by retrieving resource.
 *
 * Responds with 200 status and body of resource if found, otherwise an
 * `HTTPError.NotFound` error is passed to `next()` to be handled by
 * downstream middleware.
 *
 * @this {mio.Resource} Resource
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.Request.next} next
 * @fires request
 * @function external:Resource.routes.show
 */
exports.show = function (req, res, next) {
  merge(req.query, req.params);

  this.emit('request', req);

  this.findOne(req.query, function(err, resource) {
    if (err) return next(err);

    if (resource) {
      res.status(200).send(resource);
    } else {
      next(new HTTPError.NotFound());
    }
  });
};

/**
 * Handle POST request to `Resource.url.collection` by creating a new resource.
 *
 * Responds with 201 status and body of created resource, as well as a
 * `Location` header with the URL of the newly created resource.
 *
 * @this {mio.Resource} Resource
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.Request.next} next
 * @fires request
 * @function external:mio.Resource.routes.create
 */
exports.create = function (req, res, next) {
  var Resource = this;

  // Add url parameters that match attribute names to the request body.
  if (req.params) mergeParams(Resource, req.body, req.params);

  Resource.emit('request', req);

  var resource = Resource.create().set(req.body);

  resource.save(function(err) {
    if (err) return next(err);

    res
      .set('Location', mergeParams(Resource, resource, Resource.url.resource))
      .status(201)
      .send(resource);
  });
};

/**
 * Handle a PUT request to `Resource.url.collection` by replacing a resource.
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
 * @function external:mio.Resource.routes.replace
 */
exports.replace = function (req, res, next) {
  if (req.params) mergeParams(this, req.query, req.params);

  this.emit('request', req);

  this.findOne(req.query, function(err, resource) {
    if (err) return next(err);

    var status = 204;

    if (!resource) {
      status = 201;
      resource = new this();
    }

    resource.set(req.body).save(function(err) {
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
 * Handle PATCH request to `Resource.url.resource` by updating resource using
 * provided JSON-Patch.
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
 * @function external:mio.Resource.routes.update
 */
exports.update = function (req, res, next) {
  if (req.params) mergeParams(this, req.query, req.params);

  this.emit('request', req);

  this.findOne(req.query, function(err, resource) {
    if (err) return next(err);

    if (resource) {
      // use fast-json-patch to apply patches to resource
      if (req.body.length) {
        jsonpatch.apply(resource, req.body);
      } else {
        jsonpatch.apply(resource, [req.body]);
      }

      resource.save(function(err) {
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
      return next(new HTTPError.NotFound());
    }
  });
};

/**
 * Handle PATCH request to `Resource.url.collection` by updating resources using
 * provided JSON-Patch.
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
 * @function external:mio.Resource.routes.updateMany
 */
exports.updateMany = function (req, res, next) {
  if (req.params) merge(req.query, req.params);

  this.emit('request', req);

  this.find(req.query, function(err, resources) {
    if (err) return next(err);

    resources.forEach(function(resource, i) {
      if (req.body.length) {
        jsonpatch.apply(resource, req.body[i]);
      } else {
        jsonpatch.apply(resource, [req.body]);
      }
    });

    this.update(req.query, req.body, function(err) {
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
 * Handle DELETE request to `Resource.url.resource` by destroying resource.
 *
 * Responds with 204 status if resource was destroyed.
 *
 * @this {mio.Resource} Resource
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.Request.next} next
 * @fires request
 * @function external:mio.Resource.routes.destroy
 */
exports.destroy = function (req, res, next) {
  if (req.params) mergeParams(this, req.query, req.params);

  this.emit('request', req);

  this.findOne(req.query, function(err, resource) {
    if (err) return next(err);

    if (!resource) {
      return next(new HTTPError.NotFound());
    }

    resource.remove(function(err) {
      if (err) return next(err);

      res.status(204).end();
    });
  });
};

/**
 * Handle DELETE request to `Resource.url.collection` by destroying resources
 *
 * Responds with 204 status if resources were destroyed.
 *
 * @this {mio.Resource} Resource
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.Request.next} next
 * @function external:mio.Resource.routes.destroyMany
 */

exports.destroyMany = function (req, res, next) {
  if (req.params) merge(req.query, req.params);

  this.emit('request', req);

  this.remove(req.query, function(err) {
    if (err) return next(err);

    res.status(204).end();
  });
};

/**
 * Handle OPTIONS request to either `Resource.url.collection` or
 * `Resource.url.resource` by introspecting resource definition.
 *
 * Responds with 200 status and information about the resource in the response
 * body.
 *
 * @this {mio.Resource} Resource
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {Function(err)} next
 * @fires request
 * @function external:mio.Resource.routes.describe
 */
exports.describe = function (req, res, next) {
  var attributes = this.attributes;

  var body = {
    url: this.url,
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
 * Alias of `describe`.
 *
 * @alias external:mio.Resource.routes.describeMany
 * @private
 */

exports.describeMany = exports.describe;

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
  next(new HTTPError.MethodNotAllowed());
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
  var actions = Resource.url.actions;

  this.Resource = Resource;
  this.routes = [];

  Object.keys(actions).forEach(function (action) {
    var route = {
      action: action,
      path: actions[action],
      method: actionsToMethods[action],
      handler: Resource.routes[action],
      params: []
    };

    route.regexp = pathToRegExp(Resource.url.actions[action], route.params);

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
  var actions = Resource.url.actions;
  var allowed = [];

  for (var action in actionsToMethods) {
    if (path === actions[action]) {
      allowed.push(actionsToMethods[action]);
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

  for (var param in params) {
    if (~attributes.indexOf(param)) {
      target[param] = params[param];
      if (typeof params[param] == 'string' && !isNaN(params[param])) {
        target[param] = Number(params[param]);
      }
    }
  }

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
