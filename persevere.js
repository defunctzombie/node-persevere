var http = require('http');
var https = require('https');
var url = require('url');
var querystring = require('querystring');

// vendor
var retry = require('retry');

var Host = function(opt) {
    if (!(this instanceof Host)) {
        return new Host(opt);
    }

    var self = this;
    self._opt = opt;

    var proto = self._proto = (self._opt.ssl) ? https : http;
    var agent = self._agent = new proto.Agent();
    agent.maxSockets = 5;
};

Host.prototype.get = function(path) {
    return Request(this, path, 'GET');
};

Host.prototype.post = function(path) {
    return Request(this, path, 'POST');
};

Host.prototype.request = function(req, cb) {
    var self = this;

    var post_body = '';
    var query = '';

    // TODO referer?
    var headers = {};

    if (req._post) {
        post_body = querystring.stringify(req._post);
        headers['content-type'] = 'application/x-www-form-urlencoded';
        headers['content-length'] = post_body.length;
    }

    if (req._query) {
        query = '?' + querystring.stringify(req._query);
    }

    var opt = {
        host: self._opt.host,
        port: self._opt.port,
        path: req._path + query,
        method: req._method,
        agent: self._agent,
        headers: headers
    };

    var op = retry.operation({
        retries: 3
    });

    op.attempt(function(currAttempt) {
        var req = self._proto.request(opt, function(res) {
            res.setEncoding('utf8');

            var body = '';
            res.on('data', function(chunk) {
                body += chunk;
            });

            res.on('end', function() {
                if (res.statusCode !== 200) {
                    if (op.retry(new Error('response not ok'))) {
                        return;
                    }

                    return cb(new Error('response not ok'));
                }

                // indicate no error
                op.retry(null);
                cb(null, res, body);
            });

            res.on('error', function(err) {
                if (op.retry(err)) {
                    return;
                }

                cb(err);
            });
        });

        req.on('error', function(err) {
            if (op.retry(err)) {
                return;
            }

            cb(err);
        });

        req.end(post_body);
    });
};

var Request = function(host, path, method) {
    if (!(this instanceof Request)) {
        return new Request(host, path, method);
    }

    var self = this;
    self._path = path;
    self._host = host;
    self._method = method;
};

Request.prototype.send = function(obj) {
    this._post = obj;
    return this;
};

Request.prototype.query = function(obj) {
    this._query = obj;
    return this;
};

// make request
Request.prototype.end = function(cb) {
    var self = this;
    return self._host.request(this, cb);
};

module.exports = function(opt) {
    var parsed = url.parse(opt);
    var ssl = parsed.protocol === 'https:' || opt.ssl;

    return Host({
        ssl: ssl,
        host: parsed.hostname,
        port: parsed.port || ((ssl) ? 443 : 80)
    });
};
