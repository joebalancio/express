/*!
 * mio-express
 * https://github.com/mio/express
 */

'use strict';

/**
 * This module can be paired with [mio-ajax](https://github.com/mio/ajax) for
 * automatic client-server communication.
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
 *   .delete('/users', User.routes.destroyAll)
 *   .options('/users', User.routes.describe)
 *   .get('/users/:id', User.routes.show)
 *   .patch('/users/:id', User.routes.update)
 *   .delete('/users/:id', User.routes.destroy)
 *   .options('/users/:id', User.routes.describe);
 * ```
 *
 * @module mio-express
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
        .delete(this.url.collection, this.routes.destroyAll)
        .options(this.url.collection, this.routes.describe)
        .get(this.url.resource, this.routes.show)
        .patch(this.url.resource, this.routes.update)
        .put(this.url.resource, this.routes.update)
        .options(this.url.resource, this.routes.describe)
        .delete(this.url.resource, this.routes.destroy);

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

  Resource.findAll(req.query, function(err, collection) {
    if (err) return next(err);

    Resource.emit('request:findAll', req, collection);

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

    Resource.emit('request:findOne', req, resource);

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

  Resource.emit('request:create', req, resource);

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

    Resource.emit('request:update', req, resource);

    resource.set(req.body).save(function(err) {
      if (err) return next(err);
      res.status(200).send(resource);
    });
  });
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

    Resource.emit('request:destroy', req, resource);

    resource.destroy(function(err) {
      if (err) return next(err);

      res.status(204).end();
    });
  });
};

/**
 * Destroy all resources matching query.
 *
 * DELETE /collection
 *
 * @param {Resource} Resource
 * @param {http.ServerRequest} req
 * @param {http.ServerResponse} res
 * @param {Function(err)} next
 */

exports.destroyAll = function (Resource, req, res, next) {
  if (req.params) merge(req.query, req.params);

  Resource.destroyAll(req.query, function(err, collection) {
    if (err) return next(err);

    Resource.emit('request:destroyAll', req, collection);

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
 */

exports.describe = function(Resource, req, res, next) {
  var attributes = Resource.attributes;

  var desc = {
    resource_url: Resource.url,
    resource_description: Resource.description || undefined,
    resource_schema: {}
  };

  for (var name in attributes) {
    if (attributes[name].serializable !== false) {
      desc.resource_schema[name] = attributes[name];
    }
  }

  res.status(200).send(desc);
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
