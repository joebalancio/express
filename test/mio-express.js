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
    expect(ExpressResource).to.be.a('function');
    expect(ExpressResource({
      url: {
        resource: '/users/:id',
        collection: '/users'
      }
    })).to.be.a('function');
  });
});

describe('plugin', function() {
  var User = mio.Resource.extend()
    .use(ExpressResource({
      url: {
        resource: '/users/:id',
        collection: '/users'
      }
    }))
    .attr('id', { primary: true })
    .attr('name')
    .attr('group_id');

  var app = express()
    .use(bodyParser.json())
    .get('/users', User.routes.index)
    .post('/users', User.routes.create)
    .delete('/users', User.routes.destroyAll)
    .options('/users', User.routes.describe)
    .get('/users/:id', User.routes.show)
    .put('/users/:id', User.routes.update)
    .delete('/users/:id', User.routes.destroy)
    .options('/users/:id', User.routes.describe)
    .use(function(err, req, res, next) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      next();
    });

  it('creates express route handlers for resource', function(done) {
    User.should.have.property('routes');
    User.routes.should.have.property('index');
    User.routes.should.have.property('show');
    User.routes.should.have.property('create');
    User.routes.should.have.property('update');
    User.routes.should.have.property('destroy');
    done();
  });

  describe('.mount()', function() {
    it('registers express route handlers', function (done) {
      User.mount(app);
      expect(app._router.stack.length).to.equal(21);
      done();
    });
  });

  describe('.index()', function() {
    it('responds to GET /users', function(done) {
      User.findAll = function(query, callback) {
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
      User.findAll = function(query, callback) {
        callback(new Error("uh oh"));
      };
      request(app)
        .get('/users')
        .set('Accept', 'application/json')
        .expect(500)
        .end(function(err, res) {
          if (err) return done(err);
          res.body.should.have.property('error');
          done();
        });
    });
  });

  describe('.show()', function(done) {
    it('responds to GET /users/123', function(done) {
      User.findOne = function(id, callback) {
        callback(null, { id: 123, name: "bob" });
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

    it('passes error along to response', function(done) {
      User.findOne = function(callback) {
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

  describe('.create()', function(done) {
    it('responds to POST /users', function(done) {
      User.before('create', function(model, changed, cb) {
        cb(null, { id: 123, name: "bob" });
      });
      request(app)
        .post('/users')
        .send({ id: 123, name: "bob" })
        .set('Accept', 'application/json')
        .end(function(err, res) {
          if (err) return done(err);
          res.status.should.equal(201);
          res.body.should.have.property('id', 123);
          done();
        });
    });

    it('Adds parameters that match attributes to request body', function(done) {
      app.post('/groups/:group_id/users', User.routes.create);
      User.before('create', function(model, changed, cb) {
        cb(null, { id: 123, name: "bob" });
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
      User.before('create', function(model, changed, cb) {
        cb(new Error("error"));
      });
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

  describe('.update()', function(done) {
    it('responds to PUT /users/123', function(done) {
      User.listeners = {};
      User.before('update', function(model, changed, cb) {
        cb(null, { id: 123, name: 'jeff' });
      });
      User.findOne = function(id, callback) {
        callback(null, new User({ id: 123, name: "bob" }));
      };
      request(app)
        .put('/users/123')
        .send({ name: "jeff" })
        .set('Accept', 'application/json')
        .end(function(err, res) {
          if (err) return done(err);
          res.body.should.have.property('id', 123);
          res.body.should.have.property('name', 'jeff');
          done();
        });
    });

    it('passes error along to response', function(done) {
      User.findOne = function(id, callback) {
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

  describe('.destroy()', function(done) {
    var user = new User({ id: 123, name: "jeff" });

    it('responds to DELETE /users/123', function(done) {
      User.findOne = function(id, callback) {
        callback(null, user);
      };
      user.destroy = function(callback) {
        callback(null);
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

    it('passes error along to response', function(done) {
      User.findOne = function(id, callback) {
        callback(null, { id: 123 });
      };
      user.destroy = function(callback) {
        callback(new Error("uh oh"));
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

  describe('.destroyAll()', function() {
    it('responds to DELETE /users', function(done) {
      User.destroyAll = function(query, callback) {
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
      User.destroyAll = function(query, callback) {
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

  describe('.describe()', function() {
    it('introspects and describes Model as resource', function(done) {
      request(app)
        .options('/users')
        .expect(200)
        .set('Accept', 'application/json')
        .end(function(err, res) {
          if (err) return done(err);
          res.body.should.have.property('resource_url');
          res.body.should.have.property('resource_schema');
          done();
        });
    });
  });
});
