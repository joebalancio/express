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
```javascript
var mio = require('mio');
var ExpressResource = require('mio-express');

var User = mio.Resource.extend({
  attributes: {
    id: { primary: true }
  }
}, {
  baseUrl: '/users'
});

User.use(ExpressResource.plugin());
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
  .get('/users', User.routes.get)
  .post('/users', User.routes.post)
  .patch('/users', User.routes.collection.patch)
  .delete('/users', User.routes.collection.delete)
  .options('/users', User.routes.options)
  .all('/users', User.routes.methodNotAllowed)
  .get('/users/:id', User.routes.get)
  .put('/users/:id', User.routes.put)
  .patch('/users/:id', User.routes.patch)
  .delete('/users/:id', User.routes.delete)
  .options('/users/:id', User.routes.options)
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
  * [mio-express.plugin([options])](#module_mio-express.plugin)
  * [event: "request"](#event_request)
  * [mio-express~mio](#external_mio)
    * [mio.Resource](#external_mio.Resource)
      * [Resource.routes](#external_mio.Resource.routes)
        * [routes.collection](#external_mio.Resource.routes.collection)
          * [collection.get(req, res, next)](#external_mio.Resource.routes.collection.get)
          * [collection.patch(req, res, next)](#external_mio.Resource.routes.collection.patch)
          * [collection.delete(req, res, next)](#external_mio.Resource.routes.collection.delete)
        * [routes.post(req, res, next)](#external_mio.Resource.routes.post)
        * [routes.put(req, res, next)](#external_mio.Resource.routes.put)
        * [routes.patch(req, res, next)](#external_mio.Resource.routes.patch)
        * [routes.delete(req, res, next)](#external_mio.Resource.routes.delete)
        * [routes.options(req, res, next)](#external_mio.Resource.routes.options)
      * [Resource.router(req, res, next)](#external_mio.Resource.router)

<a name="module_mio-express.plugin"></a>
##mio-express.plugin([options])
Returns Mio plugin function.

**Params**

- \[options\] `Object`  

**Returns**: `MioExpressPlugin`  
**Example**  
```javascript
User.use(ExpressResource.plugin());
```

**404 Errors**

Note that `show`, `update`, and `remove` handlers return
[`HttpError`](https://github.com/c9/node-http-error) errors for missing
resources. These errors should be handled by your downstream error handling
middleware.

<a name="event_request"></a>
##event: "request"
Emitted by route handlers on request.

**Params**

- request `express.Request`  

**Scope**: inner event of [mio-express](#module_mio-express)  
**Example**  
```javascript
Resource.on('request', function (req) {
  req.body.createdBy = req.session.userId;
});
```



## Contributing

Please submit all issues and pull requests to the [mio/mio-express](http://github.com/mio/express) repository!

## Tests

Run tests using `npm test` or `gulp test`.

## Code coverage

Generate code coverage using `gulp coverage` and open `coverage.html` in your
web browser.

## Support

If you have any problem or suggestion please open an issue [here](https://github.com/mio/express/issues).
