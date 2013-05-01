var assert = require('assert');
var express = require('express');

var persevere = require('../');

test('setup', function(done) {
    var app = express();
    var fails = 0;

    app.get('/good', function(req, res) {
        res.send('hello');
    });

    app.get('/retry', function(req, res) {
        if (++fails >= 3) {
            return res.send('ok');
        }

        res.send(404);
    });

    app.get('/fail', function(req, res) {
        res.send(500);
    });

    app.listen(12345, done);
});

test('good result', function(done) {
    var request = persevere('http://localhost:12345');

    request.get('/good').end(function(err, res, body) {
        assert.ifError(err);
        assert.equal(body, 'hello');
        done();
    });
});

test('retry', function(done) {
    var request = persevere('http://localhost:12345');

    request.get('/retry').end(function(err, res, body) {
        assert.ifError(err);
        assert.equal(body, 'ok');
        done();
    });
});

test('fail', function(done) {
    var request = persevere('http://localhost:12345');

    request.get('/fail').end(function(err, res, body) {
        assert.equal(err.message, 'response not ok');
        done();
    });
});
