/* jshint node: true */
/* globals describe, beforeEach, it */

/*!
 * mio-express
 * https://github.com/mio/express
 */

'use strict';

var expect = require('chai').expect;
var express = require('express');
var bodyParser = require('body-parser');
var mio  = require('mio');
var request = require('supertest');

var ExpressResource = process.env.JSCOV ? require('../lib-cov/mio-express') : require('../lib/mio-express');

// Should attaches onto Object
require('chai').should();

describe('mio-express module', function() {
  it('exports plugin factory', function() {
    expect(ExpressResource.plugin).to.be.a('function');
    expect(ExpressResource.plugin({
      baseUrl: '/users'
    })).to.be.a('function');
  });
});

describe('plugin', function() {
  var User, app;

  function createUserAndApp() {
    User = mio.Resource.extend({
      attributes: {
        id: { primary: true },
        name: {},
        group_id: {}
      }
    }, {
      baseUrl: '/users'
    })
    .use(ExpressResource.plugin());

    app = express()
      .use(bodyParser.json())
      .use(User.router)
      .use(function(err, req, res, next) {
        if (err) {
          process.env.DEBUG && console.error(err.stack);
          return res.status(500).json({ error: err.message });
        }
        next();
      });
  }

  beforeEach(createUserAndApp);

  it('creates express route handlers for resource', function(done) {
    User.should.have.property('routes');
    User.routes.should.have.property('get');
    User.routes.should.have.property('put');
    User.routes.should.have.property('post');
    User.routes.should.have.property('patch');
    User.routes.should.have.property('delete');
    done();
  });

  describe('.get()', function() {
    beforeEach(createUserAndApp);

    it('responds to GET /users/123', function(done) {
      User.get = function(id, callback) {
        callback.call(User, null, { id: 123, name: 'bob' });
      };
      request(app)
        .get('/users/123')
        .set('Accept', 'application/json')
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          res.body.should.have.property('id', 123);
          res.body.should.have.property('name', 'bob');
          done();
        });
    });

    it('returns 404 error for missing resource', function(done) {
      User.get = function(id, callback) {
        callback.call(User);
      };
      request(app)
        .get('/users/123')
        .set('Accept', 'application/json')
        .expect(500)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          expect(res.body).to.have.property('error', 'Not Found');
          done();
        });
    });

    it('passes error along to response', function(done) {
      User.get = function(query, callback) {
        callback(new Error('uh oh'));
      };
      request(app)
        .get('/users/123')
        .set('Accept', 'application/json')
        .expect(500)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          res.body.should.have.property('error');
          done();
        });
    });

    it('should fire events', function(done) {
      var events = [];

      User.get = function(id, callback) {
        callback.call(User, null, { id: 123, name: 'bob' });
      };

      User
        .on('request', function (req) {
          events.push(['request', req]);
        })
        .on('request:get', function (req) {
          events.push(['request:get', req]);
        })
        .on('response', function (res) {
          events.push(['response', res]);
        })
        .on('response:get', function (res) {
          events.push(['response:get', res]);
        });

      request(app)
        .get('/users/123')
        .end(function(err) {
          if (err) {
            return done(err);
          }
          expect(events).to.have.lengthOf(4);
          expect(events[0][0]).to.equal('request');
          expect(events[0][1]).to.be.ok();
          expect(events[1][0]).to.equal('request:get');
          expect(events[1][1]).to.be.ok();
          expect(events[2][0]).to.equal('response');
          expect(events[2][1]).to.be.ok();
          expect(events[3][0]).to.equal('response:get');
          expect(events[3][1]).to.be.ok();
          done();
        });
    });
  });

  describe('.post()', function() {
    beforeEach(createUserAndApp);

    it('responds to POST /users', function(done) {
      User.post = function(body, cb) {
        cb(null, new User({ id: 123, name: 'bob' }));
      };
      request(app)
        .post('/users')
        .send({ id: 123, name: 'bob' })
        .set('Accept', 'application/json')
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          res.body.should.have.property('id', 123);
          done();
        });
    });

    it('Adds parameters that match attributes to request body', function(done) {
      app.post('/groups/:group_id/users', User.routes.post);
      User.hook('post', function(changed, cb) {
        cb(null, new User(changed));
      });
      User.hook('collection:post', function(changed, cb) {
        cb(null, new User.Collection([new User(changed[0])]));
      });
      request(app)
        .post('/groups/3/users')
        .send({ id: 123, name: 'bob' })
        .set('Accept', 'application/json')
        .end(function(err, res) {
          User.stores = [];
          if (err) {
            return done(err);
          }
          res.status.should.equal(201);
          res.body.should.have.property('id', 123);
          res.body.should.have.property('group_id', 3);

          request(app)
            .post('/groups/3/users')
            .send([{ id: 123, name: 'bob' }])
            .set('Accept', 'application/json')
            .end(function(err, res) {
              User.stores = [];
              if (err) {
                return done(err);
              }
              res.status.should.equal(201);
              res.body.should.be.an('array');
              res.body.should.have.property('length', 1);
              res.body[0].should.be.an('object');
              res.body[0].should.have.property('id', 123);
              done();
            });
        });
    });

    it('passes error along to response', function(done) {
      User.post = function(cb) {
        cb(new Error('error'));
      };
      request(app)
        .post('/users')
        .set('Accept', 'application/json')
        .expect(500)
        .end(function(err, res) {
          User.stores = [];
          if (err) {
            return done(err);
          }
          res.body.should.have.property('error');
          done();
        });
    });

    it('creates collection of resources', function (done) {
      User.hook('collection:post', function(body, cb) {
        cb(null, new User.Collection([new User({ id: 123, name: 'bob' })]));
      });
      request(app)
        .post('/users')
        .send([{ id: 123, name: 'bob' }])
        .set('Accept', 'application/json')
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          expect(res.body).to.be.an('array');
          expect(res.body[0]).to.be.an('object');
          expect(res.body[0]).to.have.property('name', 'bob');
          done();
        });
    });

    it('should fire events', function(done) {
      var events = [];

      User.post = function(body, cb) {
        cb(null, new User({ id: 123, name: 'bob' }));
      };

      User
        .on('request', function (req) {
          events.push(['request', req]);
        })
        .on('request:post', function (req) {
          events.push(['request:post', req]);
        })
        .on('response', function (res) {
          events.push(['response', res]);
        })
        .on('response:post', function (res) {
          events.push(['response:post', res]);
        });

      request(app)
        .post('/users')
        .send({ id: 123, name: 'bob' })
        .end(function(err) {
          if (err) {
            return done(err);
          }
          expect(events).to.have.lengthOf(4);
          expect(events[0][0]).to.equal('request');
          expect(events[0][1]).to.be.ok();
          expect(events[1][0]).to.equal('request:post');
          expect(events[1][1]).to.be.ok();
          expect(events[2][0]).to.equal('response');
          expect(events[2][1]).to.be.ok();
          expect(events[3][0]).to.equal('response:post');
          expect(events[3][1]).to.be.ok();
          done();
        });
    });
  });

  describe('.put()', function() {
    beforeEach(createUserAndApp);

    it('responds to PUT /users/123', function(done) {
      User.get = function(id, callback) {
        callback.call(User, null, new User({ id: 123, name: 'bob' }));
      };
      User.put = function(query, body, cb) {
        cb();
      };
      request(app)
        .put('/users/123')
        .send({ name: 'jeff' })
        .set('Accept', 'application/json')
        .expect(204)
        .end(function(err) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('creates new resource if it one did not exist', function(done) {
      User.get = function(query, cb) {
        cb.call(this);
      };
      User.hook('put', function (query, data, cb) {
        data.id = 123;
        cb(null, new User(data));
      });
      request(app)
        .put('/users/123')
        .send({ name: 'jeff' })
        .set('Accept', 'application/json')
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          expect(res.body).to.have.property('id', 123);
          expect(res.body).to.have.property('name', 'jeff');
          done();
        });
    });

    it('passes error along to response', function(done) {
      User.get = function(id, callback) {
        callback(new Error('uh oh'));
      };
      request(app)
        .put('/users/123')
        .send({ name: 'jeff' })
        .set('Accept', 'application/json')
        .expect(500)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          res.body.should.have.property('error');
          done();
        });
    });
    it('should fire events', function(done) {
      var events = [];

      User.get = function(id, callback) {
        callback.call(User, null, new User({ id: 123, name: 'bob' }));
      };
      User.put = function(query, body, cb) {
        cb();
      };

      User
        .on('request', function (req) {
          events.push(['request', req]);
        })
        .on('request:put', function (req) {
          events.push(['request:put', req]);
        })
        .on('response', function (res) {
          events.push(['response', res]);
        })
        .on('response:put', function (res) {
          events.push(['response:put', res]);
        });

      request(app)
        .put('/users/123')
        .send({ name: 'jeff' })
        .end(function(err) {
          if (err) {
            return done(err);
          }
          expect(events).to.have.lengthOf(4);
          expect(events[0][0]).to.equal('request');
          expect(events[0][1]).to.be.ok();
          expect(events[1][0]).to.equal('request:put');
          expect(events[1][1]).to.be.ok();
          expect(events[2][0]).to.equal('response');
          expect(events[2][1]).to.be.ok();
          expect(events[3][0]).to.equal('response:put');
          expect(events[3][1]).to.be.ok();
          done();
        });
    });
  });

  describe('.patch()', function () {
    beforeEach(createUserAndApp);

    it('responds to PATCH /users/123', function (done) {
      User.get = function(id, callback) {
        callback.call(User, null, new User({ id: 123, name: 'bob' }));
      };
      User.patch = function(cb) {
        this.reset({id: 123, name: 'jeff' });
        cb();
      };
      request(app)
        .patch('/users/123')
        .send({ name: 'jeff' })
        .set('Accept', 'application/json')
        .expect(204)
        .end(function(err) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('passes error along to response', function (done) {
      User.get = function (id, callback) {
        callback.call(User, null, new User({ id: 123, name: 'bob' }));
      };
      User.prototype.patch = function (cb) {
        cb(new Error('uh oh'));
      };
      request(app)
        .patch('/users/123')
        .set('Accept', 'application/json')
        .expect(500)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          res.body.should.have.property('error');
          done();
        });
    });
    it('should fire events', function(done) {
      var events = [];

      User.get = function(id, callback) {
        callback.call(User, null, new User({ id: 123, name: 'bob' }));
      };
      User.patch = function(cb) {
        this.reset({id: 123, name: 'jeff' });
        cb();
      };

      User
        .on('request', function (req) {
          events.push(['request', req]);
        })
        .on('request:patch', function (req) {
          events.push(['request:patch', req]);
        })
        .on('response', function (res) {
          events.push(['response', res]);
        })
        .on('response:patch', function (res) {
          events.push(['response:patch', res]);
        });

      request(app)
        .patch('/users/123')
        .send({ name: 'jeff' })
        .end(function(err) {
          if (err) {
            return done(err);
          }
          expect(events).to.have.lengthOf(4);
          expect(events[0][0]).to.equal('request');
          expect(events[0][1]).to.be.ok();
          expect(events[1][0]).to.equal('request:patch');
          expect(events[1][1]).to.be.ok();
          expect(events[2][0]).to.equal('response');
          expect(events[2][1]).to.be.ok();
          expect(events[3][0]).to.equal('response:patch');
          expect(events[3][1]).to.be.ok();
          done();
        });
    });
  });

  describe('.delete()', function() {
    beforeEach(createUserAndApp);

    it('responds to DELETE /users/123', function(done) {
      User.get = function(query, callback) {
        callback.call(User, null, new User({ id: 123 }));
      };
      request(app)
        .del('/users/123')
        .set('Accept', 'application/json')
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          res.status.should.equal(204);
          done();
        });
    });

    it('returns 404 error for missing resource', function(done) {
      User.get = function(id, callback) {
        callback.call(User);
      };
      request(app)
        .del('/users/123')
        .set('Accept', 'application/json')
        .expect(500)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          expect(res.body).to.have.property('error', 'Not Found');
          done();
        });
    });

    it('passes error along to response', function(done) {
      User.get = function(query, callback) {
        callback(new Error('error'));
      };
      request(app)
        .del('/users/123')
        .set('Accept', 'application/json')
        .expect(500)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          res.body.should.have.property('error');
          done();
        });
    });
    it('should fire events', function(done) {
      var events = [];

      User.get = function(query, callback) {
        callback.call(User, null, new User({ id: 123 }));
      };

      User
        .on('request', function (req) {
          events.push(['request', req]);
        })
        .on('request:delete', function (req) {
          events.push(['request:delete', req]);
        })
        .on('response', function (res) {
          events.push(['response', res]);
        })
        .on('response:delete', function (res) {
          events.push(['response:delete', res]);
        });

      request(app)
        .del('/users/123')
        .end(function(err) {
          if (err) {
            return done(err);
          }
          expect(events).to.have.lengthOf(4);
          expect(events[0][0]).to.equal('request');
          expect(events[0][1]).to.be.ok();
          expect(events[1][0]).to.equal('request:delete');
          expect(events[1][1]).to.be.ok();
          expect(events[2][0]).to.equal('response');
          expect(events[2][1]).to.be.ok();
          expect(events[3][0]).to.equal('response:delete');
          expect(events[3][1]).to.be.ok();
          done();
        });
    });
  });

  describe('.collection.get()', function() {
    beforeEach(createUserAndApp);

    it('responds to GET /users', function(done) {
      User.Collection.get = function(query, callback) {
        callback(null, []);
      };
      request(app)
        .get('/users')
        .set('Accept', 'application/json')
        .expect(200)
        .end(function(err) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('passes error along to response', function(done) {
      var find = User.find;
      User.Collection.get = function(query, callback) {
        callback(new Error('uh oh'));
      };
      request(app)
        .get('/users')
        .set('Accept', 'application/json')
        .expect(500)
        .end(function(err, res) {
          User.find = find;
          if (err) {
            return done(err);
          }
          res.body.should.have.property('error');
          done();
        });
    });
    it('should fire events', function(done) {
      var events = [];

      User.Collection.get = function(query, callback) {
        callback(null, []);
      };

      User
        .on('request', function (req) {
          events.push(['request', req]);
        })
        .on('request:collection:get', function (req) {
          events.push(['request:get', req]);
        })
        .on('response', function (res) {
          events.push(['response', res]);
        })
        .on('response:collection:get', function (res) {
          events.push(['response:get', res]);
        });

      request(app)
        .get('/users')
        .end(function(err) {
          if (err) {
            return done(err);
          }
          expect(events).to.have.lengthOf(4);
          expect(events[0][0]).to.equal('request');
          expect(events[0][1]).to.be.ok();
          expect(events[1][0]).to.equal('request:get');
          expect(events[1][1]).to.be.ok();
          expect(events[2][0]).to.equal('response');
          expect(events[2][1]).to.be.ok();
          expect(events[3][0]).to.equal('response:get');
          expect(events[3][1]).to.be.ok();
          done();
        });
    });
  });

  describe('.collection.patch()', function() {
    beforeEach(createUserAndApp);

    it('responds to PATCH /users with single patch', function(done) {
      User.Collection.patch = function(query, changes, callback) {
        callback.call(User);
      };
      User.Collection.get = function(query, callback) {
        callback.call(User, null, new User.Collection([{ active: false }]));
      };
      request(app)
        .patch('/users')
        .set('Accept', 'application/json')
        .send({
          op: 'replace',
          path: '/active',
          value: true
        })
        .expect(204)
        .end(function(err) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('responds to PATCH /users with patches array', function(done) {
      User.Collection.patch = function(query, changes, callback) {
        callback.call(User);
      };
      User.Collection.get = function(query, callback) {
        callback.call(User, null, new User.Collection([{ active: false }]));
      };
      request(app)
        .patch('/users')
        .set('Accept', 'application/json')
        .send([{
          op: 'replace',
          path: '/active',
          value: true
        }])
        .expect(204)
        .end(function(err) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('passes error along to response', function(done) {
      User.Collection.get = function (query, callback) {
        callback.call(User.Collection, null, new User.Collection());
      };
      User.Collection.patch = function (query, changes, callback) {
        callback.call(User.Collection, new Error('uh oh'));
      };
      request(app)
        .patch('/users')
        .set('Accept', 'application/json')
        .send([{ name: 'alex' }])
        .expect(500)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          res.body.should.have.property('error');
          done();
        });
    });
  });

  describe('.collection.delete()', function() {
    beforeEach(createUserAndApp);

    it('responds to DELETE /users', function(done) {
      User.Collection.delete = function(query, callback) {
        callback(null, []);
      };
      request(app)
        .delete('/users')
        .set('Accept', 'application/json')
        .expect(204)
        .end(function(err) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('passes error along to response', function(done) {
      User.Collection.delete = function(query, callback) {
        callback(new Error('uh oh'));
      };
      request(app)
        .delete('/users')
        .set('Accept', 'application/json')
        .expect(500)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          res.body.should.have.property('error');
          done();
        });
    });
    it('should fire events', function(done) {
      var events = [];

      User.Collection.delete = function(query, callback) {
        callback(null, []);
      };

      User
        .on('request', function (req) {
          events.push(['request', req]);
        })
        .on('request:collection:delete', function (req) {
          events.push(['request:delete', req]);
        })
        .on('response', function (res) {
          events.push(['response', res]);
        })
        .on('response:collection:delete', function (res) {
          events.push(['response:delete', res]);
        });

      request(app)
        .delete('/users')
        .end(function(err) {
          if (err) {
            return done(err);
          }
          expect(events).to.have.lengthOf(4);
          expect(events[0][0]).to.equal('request');
          expect(events[0][1]).to.be.ok();
          expect(events[1][0]).to.equal('request:delete');
          expect(events[1][1]).to.be.ok();
          expect(events[2][0]).to.equal('response');
          expect(events[2][1]).to.be.ok();
          expect(events[3][0]).to.equal('response:delete');
          expect(events[3][1]).to.be.ok();
          done();
        });
    });
  });

  describe('.options()', function() {
    beforeEach(createUserAndApp);

    it('introspects and describes Model as resource', function(done) {
      request(app)
        .options('/users')
        .expect(200)
        .set('Accept', 'application/json')
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          res.body.should.have.property('actions');
          res.body.should.have.property('resource_schema');
          request(app)
            .options('/users/1')
            .expect(200)
            .set('Accept', 'application/json')
            .end(function(err, res) {
              if (err) {
                return done(err);
              }
              res.body.should.have.property('actions');
              res.body.should.have.property('resource_schema');
              done();
            });
        });
    });
  });
});
