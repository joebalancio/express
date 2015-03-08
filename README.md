# mio-express [![Build Status](http://img.shields.io/travis/mio/express.svg?style=flat)](http://travis-ci.org/mio/express) [![Coverage Status](https://img.shields.io/coveralls/mio/express.svg?style=flat)](https://coveralls.io/r/mio/express?branch=master) [![NPM version](http://img.shields.io/npm/v/mio-express.svg?style=flat)](https://www.npmjs.org/package/mio-express) [![Dependency Status](http://img.shields.io/david/mio/express.svg?style=flat)](https://david-dm.org/mio/express)

> Expose Mio resources via Express middleware.

- Pair with [mio-ajax](https://github.com/mio/ajax) for automatic
  client-server communication.
- PATCH support with
  [fast-json-patch](https://github.com/Starcounter-Jack/Fast-JSON-Patch)
- Responds with 405 status for unsupported methods
- Support [`Prefer`](http://tools.ietf.org/html/rfc7240#section-4.2)
  header to control whether PUT and PATCH return the resource
- Includes `Location` header for created resources
- Emits events for accessing requests

**Example**  
```javascript
var mio = require('mio');
var ServerRoutes = require('mio-express').plugin;

var User = mio.Resource.extend({
  attributes: {
    id: { primary: true }
  }
}, {
  baseUrl: '/users'
});

User.use(ServerRoutes());
```

This will expose Express routing middleware via `User.router`:

```javascript
var bodyParser = require('body-parser');
var express = require('express');
var app = express();

app
  .use(bodyParser.json())
  .use(User.router);
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
  * [event: "response"](#event_response)
  * [event: "request:get"](#module_mio-express..request_get)
  * [event: "response:get"](#module_mio-express..response_get)
  * [event: "request:post"](#module_mio-express..request_post)
  * [event: "response:post"](#module_mio-express..response_post)
  * [event: "request:put"](#module_mio-express..request_put)
  * [event: "response:put"](#module_mio-express..response_put)
  * [event: "request:patch"](#module_mio-express..request_patch)
  * [event: "response:patch"](#module_mio-express..response_patch)
  * [event: "request:delete"](#module_mio-express..request_delete)
  * [event: "response:delete"](#module_mio-express..response_delete)
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

Handlers return [`http-errors`](https://github.com/jshttp/http-errors).
These should be handled by your downstream error handling middleware.

**Params**

- \[options\] `Object`  

**Returns**: `MioExpressPlugin`  
**Example**  
```javascript
User.use(require('mio-express').plugin());
```

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

<a name="event_response"></a>
##event: "response"
Emitted by route handlers on response.

**Params**

- response `express.Response`  

**Scope**: inner event of [mio-express](#module_mio-express)  
**Example**  
```javascript
Resource.on('response', function (res) {
  res.cookie('name', 'tobi', { domain: '.example.com', path: '/admin', secure: true });
});
```

<a name="module_mio-express..request_get"></a>
##event: "request:get"
Emitted by route handlers on GET request.

**Params**

- request `express.Request`  

**Scope**: inner event of [mio-express](#module_mio-express)  
<a name="module_mio-express..response_get"></a>
##event: "response:get"
Emitted by route handlers on GET response.

**Params**

- response `express.Response`  

**Scope**: inner event of [mio-express](#module_mio-express)  
<a name="module_mio-express..request_post"></a>
##event: "request:post"
Emitted by route handlers on POST request.

**Params**

- request `express.Request`  

**Scope**: inner event of [mio-express](#module_mio-express)  
<a name="module_mio-express..response_post"></a>
##event: "response:post"
Emitted by route handlers on POST response.

**Params**

- response `express.Response`  

**Scope**: inner event of [mio-express](#module_mio-express)  
<a name="module_mio-express..request_put"></a>
##event: "request:put"
Emitted by route handlers on PUT request.

**Params**

- request `express.Request`  

**Scope**: inner event of [mio-express](#module_mio-express)  
<a name="module_mio-express..response_put"></a>
##event: "response:put"
Emitted by route handlers on PUT response.

**Params**

- response `express.Response`  

**Scope**: inner event of [mio-express](#module_mio-express)  
<a name="module_mio-express..request_patch"></a>
##event: "request:patch"
Emitted by route handlers on PATCH request.

**Params**

- request `express.Request`  

**Scope**: inner event of [mio-express](#module_mio-express)  
<a name="module_mio-express..response_patch"></a>
##event: "response:patch"
Emitted by route handlers on PATCH response.

**Params**

- response `express.Response`  

**Scope**: inner event of [mio-express](#module_mio-express)  
<a name="module_mio-express..request_delete"></a>
##event: "request:delete"
Emitted by route handlers on DELETE request.

**Params**

- request `express.Request`  

**Scope**: inner event of [mio-express](#module_mio-express)  
<a name="module_mio-express..response_delete"></a>
##event: "response:delete"
Emitted by route handlers on DELETE response.

**Params**

- response `express.Response`  

**Scope**: inner event of [mio-express](#module_mio-express)  


## Contributing

Please submit all issues and pull requests to the [mio/mio-express](http://github.com/mio/express) repository!

## Tests

Run tests using `npm test` or `gulp test`.

## Code coverage

Generate code coverage using `gulp coverage` and open `coverage.html` in your
web browser.

## Support

If you have any problem or suggestion please open an issue [here](https://github.com/mio/express/issues).
