/*!
 * mio-express
 * https://github.com/mio/express
 */

'use strict';

var expect = require('chai').expect;
var should = require('chai').should();
var express = require('express');
var bodyParser = require('body-parser');
var mio  = require('mio');
var request = require('supertest');

var ExpressResource = process.env.JSCOV ? require('../lib-cov/mio-express') : require('../lib/mio-express');

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
          return res.status(500).json({ error: err.message });
        }
        next();
      });
  };

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

  describe('.get()', function(done) {
    beforeEach(createUserAndApp);

    it('responds to GET /users/123', function(done) {
      User.get = function(id, callback) {
        callback.call(User, null, { id: 123, name: "bob" });
      };
      request(app)
        .get('/users/123')
        .set('Accept', 'application/json')
        .end(function(err, res) {
          if (err) return done(err);
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
          if (err) return done(err);
          expect(res.body).to.have.property('error', '404: Not Found');
          done();
        });
    });

    it('passes error along to response', function(done) {
      User.get = function(query, callback) {
        callback(new Error("uh oh"));
      };
      request(app)
        .get('/users/123')
        .set('Accept', 'application/json')
        .expect(500)
        .end(function(err, res) {
          if (err) return done(err);
          res.body.should.have.property('error');
          done();
        });
    });
  });

  describe('.post()', function(done) {
    beforeEach(createUserAndApp);

    it('responds to POST /users', function(done) {
      User.post = function(body, cb) {
        cb(null, new User({ id: 123, name: "bob" }));
      };
      request(app)
        .post('/users')
        .send({ id: 123, name: "bob" })
        .set('Accept', 'application/json')
        .expect(201)
        .end(function(err, res) {
          if (err) return done(err);
          res.body.should.have.property('id', 123);
          done();
        });
    });

    it('Adds parameters that match attributes to request body', function(done) {
      app.post('/groups/:group_id/users', User.routes.post);
      User.before('post', function(changed, cb) {
        cb(null, changed);
      });
      request(app)
        .post('/groups/3/users')
        .send({ id: 123, name: "bob" })
        .set('Accept', 'application/json')
        .end(function(err, res) {
          User.stores = [];
          if (err) return done(err);
          res.status.should.equal(201);
          res.body.should.have.property('id', 123);
          res.body.should.have.property('group_id', 3);
          done();
        });
    });

    it('passes error along to response', function(done) {
      User.post = function(cb) {
        cb(new Error("error"));
      };
      request(app)
        .post('/users')
        .set('Accept', 'application/json')
        .expect(500)
        .end(function(err, res) {
          User.stores = [];
          if (err) return done(err);
          res.body.should.have.property('error');
          done();
        });
    });
  });

  describe('.put()', function(done) {
    beforeEach(createUserAndApp);

    it('responds to PUT /users/123', function(done) {
      User.get = function(id, callback) {
        callback.call(User, null, new User({ id: 123, name: "bob" }));
      };
      User.put = function(cb) {
        this.reset({id: 123, name: 'jeff' });
        cb();
      };
      request(app)
        .put('/users/123')
        .send({ name: "jeff" })
        .set('Accept', 'application/json')
        .expect(204)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('creates new resource if it one did not exist', function(done) {
      User.get = function(query, cb) {
        cb.call(this);
      };
      User.prototype.put = function(cb) {
        this.reset({ id: 123, name: 'jeff'});
        cb();
      };
      request(app)
        .put('/users/123')
        .send({ name: "jeff" })
        .set('Accept', 'application/json')
        .expect(201)
        .end(function(err, res) {
          if (err) return done(err);
          expect(res.body).to.have.property('id', 123);
          expect(res.body).to.have.property('name', 'jeff');
          done();
        });
    });

    it('passes error along to response', function(done) {
      User.get = function(id, callback) {
        callback(new Error("uh oh"));
      };
      request(app)
        .put('/users/123')
        .send({ name: "jeff" })
        .set('Accept', 'application/json')
        .expect(500)
        .end(function(err, res) {
          if (err) return done(err);
          res.body.should.have.property('error');
          done();
        });
    });
  });

  describe('.patch()', function () {

    it('responds to PATCH /users/123', function(done) {
      User.get = function(id, callback) {
        callback.call(User, null, new User({ id: 123, name: "bob" }));
      };
      User.patch = function(cb) {
        this.reset({id: 123, name: 'jeff' });
        cb();
      };
      request(app)
        .patch('/users/123')
        .send({ name: "jeff" })
        .set('Accept', 'application/json')
        .expect(204)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });
  });

  describe('.delete()', function(done) {
    beforeEach(createUserAndApp);

    it('responds to DELETE /users/123', function(done) {
      User.get = function(query, callback) {
        callback.call(User, null, new User({ id: 123 }));
      };
      request(app)
        .del('/users/123')
        .set('Accept', 'application/json')
        .end(function(err, res) {
          if (err) return done(err);
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
          if (err) return done(err);
          expect(res.body).to.have.property('error', '404: Not Found');
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
          if (err) return done(err);
          res.body.should.have.property('error');
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
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('passes error along to response', function(done) {
      var find = User.find;
      User.Collection.get = function(query, callback) {
        callback(new Error("uh oh"));
      };
      request(app)
        .get('/users')
        .set('Accept', 'application/json')
        .expect(500)
        .end(function(err, res) {
          User.find = find;
          if (err) return done(err);
          res.body.should.have.property('error');
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
        .end(function(err, res) {
          if (err) return done(err);
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
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('passes error along to response', function(done) {
      User.Collection.patch = function(query, changes, callback) {
        callback(new Error("uh oh"));
      };
      request(app)
        .patch('/users')
        .set('Accept', 'application/json')
        .send([{ name: 'alex' }])
        .expect(500)
        .end(function(err, res) {
          if (err) return done(err);
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
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('passes error along to response', function(done) {
      User.Collection.delete = function(query, callback) {
        callback(new Error("uh oh"));
      };
      request(app)
        .delete('/users')
        .set('Accept', 'application/json')
        .expect(500)
        .end(function(err, res) {
          if (err) return done(err);
          res.body.should.have.property('error');
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
          if (err) return done(err);
          res.body.should.have.property('actions');
          res.body.should.have.property('resource_schema');
          request(app)
            .options('/users/1')
            .expect(200)
            .set('Accept', 'application/json')
            .end(function(err, res) {
              if (err) return done(err);
              res.body.should.have.property('actions');
              res.body.should.have.property('resource_schema');
              done();
            });
        });
    });
  });
});
