# mio-express [![Build Status](http://img.shields.io/travis/mio/express.svg?style=flat)](http://travis-ci.org/mio/express) [![Coverage Status](https://img.shields.io/coveralls/mio/express.svg?style=flat)](https://coveralls.io/r/mio/express?branch=master) [![NPM version](http://img.shields.io/npm/v/mio-express.svg?style=flat)](https://www.npmjs.org/package/mio-express) [![Dependency Status](http://img.shields.io/david/mio/express.svg?style=flat)](https://david-dm.org/mio/express)

> Expose Mio resources via Express middleware.

This module can be paired with [mio-ajax](https://github.com/mio/ajax) for
automatic client-server communication.

**Example**  
```javascript
var mio = require('mio');
var ExpressResource = require('mio-express');
var express = require('express');

var User = mio.Resource.extend({
  attributes: {
    id: { primary: true }
  }
});

User.use(ExpressResource({
  url: {
    resource: '/users/:id'
    collection: '/users'
  }
});

var app = express();

// creates route handlers
User.mount(app);
```

`Resource.mount(app)` is sugar for:

```javascript
app
  .get('/users', User.routes.index)
  .post('/users', User.routes.create)
  .delete('/users', User.routes.destroyAll)
  .options('/users', User.routes.describe)
  .get('/users/:id', User.routes.show)
  .patch('/users/:id', User.routes.update)
  .delete('/users/:id', User.routes.destroy)
  .options('/users/:id', User.routes.describe);
```

## Installation

Install using [npm](https://www.npmjs.org/):

```sh
npm install mio-express
```

## API Reference
**Members**

* [mio-express](#module_mio-express)
  * [mio-express.index(Resource, req, res, next)](#module_mio-express.index)
  * [mio-express.show(Resource, req, res, next)](#module_mio-express.show)
  * [mio-express.create(Resource, req, res, next)](#module_mio-express.create)
  * [mio-express.update(Resource, req, res, next)](#module_mio-express.update)
  * [mio-express.destroy(Resource, req, res, next)](#module_mio-express.destroy)
  * [mio-express.destroyAll(Resource, req, res, next)](#module_mio-express.destroyAll)
  * [mio-express.describe(Resource, req, res, next)](#module_mio-express.describe)

<a name="module_mio-express.index"></a>
##mio-express.index(Resource, req, res, next)
Retrieve collection resource.

GET /collection

**Params**

- Resource `Resource`  
- req `http.ServerRequest`  
- res `http.ServerResponse`  
- next `function`  

<a name="module_mio-express.show"></a>
##mio-express.show(Resource, req, res, next)
Retrieve resource.

GET /collection/:id

**Params**

- Resource `Resource`  
- req `http.ServerRequest`  
- res `http.ServerResponse`  
- next `function`  

<a name="module_mio-express.create"></a>
##mio-express.create(Resource, req, res, next)
Create resource.

POST /collection

**Params**

- Resource `Resource`  
- req `http.ServerRequest`  
- res `http.ServerResponse`  
- next `function`  

<a name="module_mio-express.update"></a>
##mio-express.update(Resource, req, res, next)
Replace or update resource.

PUT|PATCH /collection/:id

**Params**

- Resource `Resource`  
- req `http.ServerRequest`  
- res `http.ServerResponse`  
- next `function`  

<a name="module_mio-express.destroy"></a>
##mio-express.destroy(Resource, req, res, next)
Destroy resource.

DELETE /collection/:id

**Params**

- Resource `Resource`  
- req `http.ServerRequest`  
- res `http.ServerResponse`  
- next `function`  

<a name="module_mio-express.destroyAll"></a>
##mio-express.destroyAll(Resource, req, res, next)
Destroy all resources matching query.

DELETE /collection

**Params**

- Resource `Resource`  
- req `http.ServerRequest`  
- res `http.ServerResponse`  
- next `function`  

<a name="module_mio-express.describe"></a>
##mio-express.describe(Resource, req, res, next)
Describe resource by introspecting Resource definition.

OPTIONS /collection
OPTIONS /collection/:id

**Params**

- Resource `Resource`  
- req `http.ServerRequest`  
- res `http.ServerResponse`  
- next `function`  



## Contributing

Please submit all issues and pull requests to the [mio/mio-express](http://github.com/mio/express) repository!

## Tests

Run tests using `npm test` or `gulp test`.

## Code coverage

Generate code coverage using `gulp coverage` and open `coverage.html` in your
web browser.

## Support

If you have any problem or suggestion please open an issue [here](https://github.com/mio/express/issues).
