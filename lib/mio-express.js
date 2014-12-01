/*!
 * mio-express
 * https://github.com/mio/express
 */

var jsonpatch = require('fast-json-patch');

'use strict';

/**
 * * Pair with [mio-ajax](https://github.com/mio/ajax) for automatic
 *   client-server communication.
 * * PATCH support with
 *   [fast-json-patch](https://github.com/Starcounter-Jack/Fast-JSON-Patch)
 * * Emits events for accessing requests
 *
 * @example
 *
 * ```javascript
 * var mio = require('mio');
 * var ExpressResource = require('mio-express');
 * var express = require('express');
 *
 * var User = mio.Resource.extend({
 *   attributes: {
 *     id: { primary: true }
 *   }
 * });
 *
 * User.use(ExpressResource({
 *   url: {
 *     resource: '/users/:id'
 *     collection: '/users'
 *   }
 * });
 *
 * var app = express();
 *
 * // creates route handlers
 * User.mount(app);
 * ```
 *
 * `Resource.mount(app)` is sugar for:
 *
 * ```javascript
 * app
 *   .get('/users', User.routes.index)
 *   .post('/users', User.routes.create)
 *   .put('/users', User.routes.updateMany)
 *   .patch('/users', User.routes.updateMany)
 *   .delete('/users', User.routes.destroyMany)
 *   .options('/users', User.routes.describeCollection)
 *   .get('/users/:id', User.routes.show)
 *   .put('/users/:id', User.routes.update)
 *   .patch('/users/:id', User.routes.update)
 *   .delete('/users/:id', User.routes.destroy)
 *   .options('/users/:id', User.routes.describeResource);
 * ```
 *
 * @module mio-express
 */

/**
 * Returns Mio plugin function.
 *
 * @param {Object} settings
 * @param {Object} settings.url
 * @param {String} settings.url.resource
 * @param {String} settings.url.collection
 * @param {Boolean} settings.allowPatch use PATCH routes and JSON-Patch (default: true)
 * @alias module:mio-express
 */

module.exports = function (settings) {
  return function (Resource) {
    Resource.routes = {};

    if (typeof settings !== 'object' || !settings.url
    || !settings.url.resource || !settings.url.collection) {
      throw new Error(
        "{ url : { resource, collection } } settings are required"
      );
    }

    // create route middleware for resource actions
    Object.keys(exports).forEach(function (action) {
      Resource.routes[action] = function (req, res, next) {
        exports[action](Resource, req, res, next);
      };
    });

    Resource.url = settings.url;
    Resource.options.allowPatch = settings.allowPatch === false ? false : true;

    /**
     * Register resource route handlers for given express `app`.
     *
     * @param {express.Application} app
     * @return {Resource}
     */

    Resource.mount = function (app) {
      app
        .get(this.url.collection, this.routes.index)
        .post(this.url.collection, this.routes.create)
        .put(this.url.collection, this.routes.updateMany)
        .delete(this.url.collection, this.routes.destroyMany)
        .options(this.url.collection, this.routes.describeCollection)
        .get(this.url.resource, this.routes.show)
        .put(this.url.resource, this.routes.update)
        .options(this.url.resource, this.routes.describeResource)
        .delete(this.url.resource, this.routes.destroy);

      if (Resource.options.allowPatch) {
        app
          .patch(this.url.resource, this.routes.update)
          .patch(this.url.collection, this.routes.updateMany);
      }

      return this;
    };
  };
};

/**
 * Retrieve collection resource.
 *
 * GET /collection
 *
 * @param {Resource} Resource
 * @param {http.ServerRequest} req
 * @param {http.ServerResponse} res
 * @param {Function(err)} next
 */

exports.index = function(Resource, req, res, next) {
  if (req.params) merge(req.query, req.params);

  Resource.find(req.query, function(err, collection) {
    if (err) return next(err);

    Resource.emit('request find many', req, collection);

    res.status(200).send(collection);
  });
};

/**
 * Retrieve resource.
 *
 * GET /collection/:id
 *
 * @param {Resource} Resource
 * @param {http.ServerRequest} req
 * @param {http.ServerResponse} res
 * @param {Function(err)} next
 */

exports.show = function(Resource, req, res, next) {
  merge(req.query, req.params);

  Resource.findOne(req.query, function(err, resource) {
    if (err) return next(err);
    if (!resource) return next();

    Resource.emit('request find one', req, resource);

    res.status(200).send(resource);
  });
};

/**
 * Create resource.
 *
 * POST /collection
 *
 * @param {Resource} Resource
 * @param {http.ServerRequest} req
 * @param {http.ServerResponse} res
 * @param {Function(err)} next
 */

exports.create = function(Resource, req, res, next) {
  // Add url parameters that match attribute names to the request body.
  if (req.params) mergeParams(Resource, req.body, req.params);

  var resource = Resource.create().set(req.body);

  Resource.emit('request create', req, resource);

  resource.save(function(err) {
    if (err) return next(err);
    res.status(201).send(resource);
  });
};

/**
 * Replace or update resource.
 *
 * PUT|PATCH /collection/:id
 *
 * @param {Resource} Resource
 * @param {http.ServerRequest} req
 * @param {http.ServerResponse} res
 * @param {Function(err)} next
 */

exports.update = function(Resource, req, res, next) {
  if (req.params) mergeParams(Resource, req.query, req.params);

  Resource.findOne(req.query, function(err, resource) {
    if (err) return next(err);
    if (!resource) return next();

    Resource.emit('request update', req, resource);

    if (req.method === 'PATCH' && Resource.options.allowPatch) {
      if (req.body.length) {
        jsonpatch.apply(resource, req.body);
      } else {
        jsonpatch.apply(resource, [req.body]);
      }
    } else {
      resource.set(req.body);
    }

    resource.save(function(err) {
      if (err) return next(err);
      res.status(200).send(resource);
    });
  });
};

/**
 * Update resources matching query.
 *
 * PUT|PATCH /collection
 *
 * @param {Resource} Resource
 * @param {http.ServerRequest} req
 * @param {http.ServerResponse} res
 * @param {Function(err)} next
 */

exports.updateMany = function (Resource, req, res, next) {
  if (req.params) merge(req.query, req.params);

  function update (body) {
    Resource.update(req.query, body, function(err) {
      if (err) return next(err);

      Resource.emit('request update many', req, req.query, body);

      res.status(204).end();
    });
  }

  if (req.method === 'PATCH' && Resource.options.allowPatch) {
    Resource.find(req.query, function(err, resources) {
      if (err) return next(err);

      resources.forEach(function(resource, i) {
        if (req.body.length) {
          jsonpatch.apply(resource, req.body[i]);
        } else {
          jsonpatch.apply(resource, [req.body]);
        }
      });

      update(resources);
    });
  } else {
    update(req.body);
  }
};

/**
 * Destroy resource.
 *
 * DELETE /collection/:id
 *
 * @param {Resource} Resource
 * @param {http.ServerRequest} req
 * @param {http.ServerResponse} res
 * @param {Function(err)} next
 */

exports.destroy = function(Resource, req, res, next) {
  if (req.params) mergeParams(Resource, req.query, req.params);

  Resource.findOne(req.query, function(err, resource) {
    if (err) return next(err);
    if (!resource) return next();

    Resource.emit('request destroy', req, resource);

    resource.destroy(function(err) {
      if (err) return next(err);

      res.status(204).end();
    });
  });
};

/**
 * Destroy resources matching query.
 *
 * DELETE /collection
 *
 * @param {Resource} Resource
 * @param {http.ServerRequest} req
 * @param {http.ServerResponse} res
 * @param {Function(err)} next
 */

exports.destroyMany = function (Resource, req, res, next) {
  if (req.params) merge(req.query, req.params);

  Resource.destroy(req.query, function(err, collection) {
    if (err) return next(err);

    Resource.emit('request destroy many', req, collection);

    res.status(204).end();
  });
};

/**
 * Describe resource by introspecting Resource definition.
 *
 * OPTIONS /collection
 * OPTIONS /collection/:id
 *
 * @param {Resource} Resource
 * @param {http.ServerRequest} req
 * @param {http.ServerResponse} res
 * @param {Function(err)} next
 * @private
 */

exports.describe = function(Resource, req, res, next) {
  var attributes = Resource.attributes;

  var body = {
    url: Resource.url,
    resource_description: Resource.description || undefined,
    resource_schema: {}
  };

  for (var name in attributes) {
    if (attributes[name].serializable !== false) {
      body.resource_schema[name] = attributes[name];
    }
  }

  res.status(200).send(body);
};

/**
 * Describe resource by introspecting Resource definition.
 *
 * OPTIONS /collection
 * OPTIONS /collection/:id
 *
 * @param {Resource} Resource
 * @param {http.ServerRequest} req
 * @param {http.ServerResponse} res
 * @param {Function(err)} next
 */

exports.describeResource = function(Resource, req, res, next) {
  var methods = ['GET','PUT','DELETE','OPTIONS','HEAD'];
  if (Resource.options.allowPatch) {
    methods.push('PATCH');
  }
  res.set('Allow', methods);
  exports.describe(Resource, req, res, next);
};

/**
 * Describe collection by introspecting Resource definition.
 *
 * OPTIONS /collection
 * OPTIONS /collection/:id
 *
 * @param {Resource} Resource
 * @param {http.ServerRequest} req
 * @param {http.ServerResponse} res
 * @param {Function(err)} next
 */

exports.describeCollection = function(Resource, req, res, next) {
  var methods = ['GET','PUT','POST','DELETE','OPTIONS','HEAD'];
  if (Resource.options.allowPatch) {
    methods.push('PATCH');
  }
  res.set('Allow', methods);
  exports.describe(Resource, req, res, next);
};

/**
 * Merge request parameters into given `target`.
 *
 * @param {Resource} Resource
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

function merge(a, b) {
  for (var key in b) {
    a[key] = b[key];
  }
  return a;
};
