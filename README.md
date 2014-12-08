# mio-express [![Build Status](http://img.shields.io/travis/mio/express.svg?style=flat)](http://travis-ci.org/mio/express) [![Coverage Status](https://img.shields.io/coveralls/mio/express.svg?style=flat)](https://coveralls.io/r/mio/express?branch=master) [![NPM version](http://img.shields.io/npm/v/mio-express.svg?style=flat)](https://www.npmjs.org/package/mio-express) [![Dependency Status](http://img.shields.io/david/mio/express.svg?style=flat)](https://david-dm.org/mio/express)

> Expose Mio resources via Express middleware.

- Pair with [mio-ajax](https://github.com/mio/ajax) for automatic
  client-server communication.
- PATCH support with
  [fast-json-patch](https://github.com/Starcounter-Jack/Fast-JSON-Patch)
- Responds with 405 status for unsupported methods
- Support [`Prefer`](http://tools.ietf.org/html/rfc7240#section-4.2)
  header to control whether PUT and PATCH return the resource
- Emits events for accessing requests

**Example**  
Use the plugin and specify `resource` and `collection` URLs:

```javascript
var mio = require('mio');
var ExpressResource = require('mio-express');

var User = mio.Resource.extend({
  attributes: {
    id: { primary: true }
  }
});

User.use(ExpressResource.plugin({
  url: {
    resource: '/users/:id'
    collection: '/users'
  }
});
```

This will expose Express route handlers at `User.routes` and a resource
routing middleware via `User.router`.

Use `User.router` to route all actions:

```javascript
var bodyParser = require('body-parser');
var express = require('express');
var app = express();

app
  .use(bodyParser.json())
  .use(User.router);
```

Use `User.routes` handlers individually for complete control:

```javascript
app
  .get('/users', User.routes.index)
  .post('/users', User.routes.create)
  .patch('/users', User.routes.updateMany)
  .delete('/users', User.routes.destroyMany)
  .options('/users', User.routes.describe)
  .all('/users', User.routes.methodNotAllowed)
  .get('/users/:id', User.routes.show)
  .put('/users/:id', User.routes.replace)
  .patch('/users/:id', User.routes.update)
  .delete('/users/:id', User.routes.destroy)
  .options('/users/:id', User.routes.describeMany)
  .all('/users/:id', User.routes.methodNotAllowed);
```

## Installation

Install using [npm](https://www.npmjs.org/):

```sh
npm install mio-express
```

## API Reference
**Members**

* [mio-express](#module_mio-express)
  * [mio-express.plugin(settings)](#module_mio-express.plugin)
  * [mio-express~mio](#external_mio)
    * [mio.Resource](#external_mio.Resource)
      * [Resource.routes](#external_mio.Resource.routes)
        * [routes.index(req, res, next)](#external_mio.Resource.routes.index)
        * [routes.create(req, res, next)](#external_mio.Resource.routes.create)
        * [routes.replace(req, res, next)](#external_mio.Resource.routes.replace)
        * [routes.update(req, res, next)](#external_mio.Resource.routes.update)
        * [routes.updateMany(req, res, next)](#external_mio.Resource.routes.updateMany)
        * [routes.destroy(req, res, next)](#external_mio.Resource.routes.destroy)
        * [routes.destroyMany(req, res, next)](#external_mio.Resource.routes.destroyMany)
        * [routes.describe(req, res, next)](#external_mio.Resource.routes.describe)
      * [Resource.router(req, res, next)](#external_mio.Resource.router)

<a name="module_mio-express.plugin"></a>
##mio-express.plugin(settings)
Returns Mio plugin function.

**Params**

- settings `Object`  
  - url `Object`  
  - resource `String`  
  - collection `String`  
  - \[actions\] `Object` - handlers that should be created/mounted  

**Returns**: `MioExpressPlugin`  
**Example**  
Provide all available REST actions:

```javascript
User.use(exports({
  url: {
    resource: '/users/:id',
    collection: '/users'
  }
});
```

Provide only specified REST actions:

```javascript
User.use(exports({
  url: {
    resource: '/users/:id',
    collection: '/users',
    actions: {
      show: '/users/:id',
      update: '/users/:id',
      create: '/users'
    }
  }
});
```

**404 Errors**

Note that `show`, `update`, and `destroy` handlers return
[`HttpError`](https://github.com/c9/node-http-error) errors for missing
resources. These errors should be handled by your downstream error handling
middleware.

**Events**

- request `express.Request` emitted by route handlers on request



## Contributing

Please submit all issues and pull requests to the [mio/mio-express](http://github.com/mio/express) repository!

## Tests

Run tests using `npm test` or `gulp test`.

## Code coverage

Generate code coverage using `gulp coverage` and open `coverage.html` in your
web browser.

## Support

If you have any problem or suggestion please open an issue [here](https://github.com/mio/express/issues).
