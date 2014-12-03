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
    .use(new ExpressResource({
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
    .put('/users', User.routes.updateMany)
    .patch('/users', User.routes.updateMany)
    .delete('/users', User.routes.destroyMany)
    .options('/users', User.routes.describeCollection)
    .get('/users/:id', User.routes.show)
    .put('/users/:id', User.routes.update)
    .patch('/users/:id', User.routes.update)
    .delete('/users/:id', User.routes.destroy)
    .options('/users/:id', User.routes.describeResource)
    .use(function(err, req, res, next) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      next();
    });

  it('throws error if missing settings', function () {
    expect(function() {
      mio.Resource.extend().use(ExpressResource());
    }).to.throw(/settings are required/);
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
      expect(app._router.stack.length).to.equal(26);
      done();
    });
  });

  describe('.index()', function() {
    it('responds to GET /users', function(done) {
      User.find = function(query, callback) {
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
      User.find = function(query, callback) {
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

    it('returns 404 error for missing resource', function(done) {
      User.findOne = function(id, callback) {
        callback();
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
        .expect(204)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('returns 404 error for missing resource', function(done) {
      User.findOne = function(id, callback) {
        callback();
      };
      request(app)
        .put('/users/123')
        .send({ name: "jeff" })
        .set('Accept', 'application/json')
        .expect(500)
        .end(function(err, res) {
          if (err) return done(err);
          expect(res.body).to.have.property('error', '404: Not Found');
          done();
        });
    });

    it('responds to PATCH /users/123 with single patch', function(done) {
      User.findOne = function(query, callback) {
        callback(null, {
          save: function(cb) {
            cb();
          }
        });
      };
      request(app)
        .patch('/users/123')
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

    it('responds to PATCH /users/123 with array of patches', function(done) {
      User.findOne = function(query, callback) {
        callback(null, {
          save: function(cb) {
            cb();
          }
        });
      };
      request(app)
        .patch('/users/123')
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

  describe('.updateMany()', function() {
    it('responds to PATCH /users with single patch', function(done) {
      User.update = function(query, changes, callback) {
        callback();
      };
      User.find = function(query, callback) {
        callback(null, [{ active: false }]);
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
      User.update = function(query, changes, callback) {
        callback();
      };
      User.find = function(query, callback) {
        callback(null, [{ active: false }]);
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
      User.update = function(query, changes, callback) {
        callback(new Error("uh oh"));
      };
      request(app)
        .put('/users')
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

    it('returns 404 error for missing resource', function(done) {
      User.findOne = function(id, callback) {
        callback();
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

  describe('.destroyMany()', function() {
    it('responds to DELETE /users', function(done) {
      User.destroy = function(query, callback) {
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
      User.destroy = function(query, callback) {
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
          res.body.should.have.property('url');
          res.body.should.have.property('resource_schema');
          request(app)
            .options('/users/1')
            .expect(200)
            .set('Accept', 'application/json')
            .end(function(err, res) {
              if (err) return done(err);
              res.body.should.have.property('url');
              res.body.should.have.property('resource_schema');
              done();
            });
        });
    });
  });
});
