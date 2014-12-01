# mio-express [![Build Status](http://img.shields.io/travis/mio/express.svg?style=flat)](http://travis-ci.org/mio/express) [![Coverage Status](https://img.shields.io/coveralls/mio/express.svg?style=flat)](https://coveralls.io/r/mio/express?branch=master) [![NPM version](http://img.shields.io/npm/v/mio-express.svg?style=flat)](https://www.npmjs.org/package/mio-express) [![Dependency Status](http://img.shields.io/david/mio/express.svg?style=flat)](https://david-dm.org/mio/express)

> Expose Mio resources via Express middleware.

* Pair with [mio-ajax](https://github.com/mio/ajax) for automatic
  client-server communication.
* PATCH support with
  [fast-json-patch](https://github.com/Starcounter-Jack/Fast-JSON-Patch)
* Emits events for accessing requests

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
  .put('/users', User.routes.updateMany)
  .patch('/users', User.routes.updateMany)
  .delete('/users', User.routes.destroyMany)
  .options('/users', User.routes.describeCollection)
  .get('/users/:id', User.routes.show)
  .put('/users/:id', User.routes.update)
  .patch('/users/:id', User.routes.update)
  .delete('/users/:id', User.routes.destroy)
  .options('/users/:id', User.routes.describeResource);
```

## Installation

Install using [npm](https://www.npmjs.org/):

```sh
npm install mio-express
```

## API Reference
<a name="exp_module_mio-express"></a>
##module.exports(settings) ⏏
Returns Mio plugin function.

**Params**

- settings `Object`  
  - url `Object`  
  - resource `String`  
  - collection `String`  
  - allowPatch `Boolean` - use PATCH routes and JSON-Patch (default: true)  



## Contributing

Please submit all issues and pull requests to the [mio/mio-express](http://github.com/mio/express) repository!

## Tests

Run tests using `npm test` or `gulp test`.

## Code coverage

Generate code coverage using `gulp coverage` and open `coverage.html` in your
web browser.

## Support

If you have any problem or suggestion please open an issue [here](https://github.com/mio/express/issues).
