var _ = require('underscore');
var logule = require('logule').init(module);

var defaultView = require.resolve('./views/password.jade');

module.exports = globalpassword;

function globalpassword(options) {
    options = _.defaults(options || {}, {
        passwords: [],
        view: defaultView,
    });

    return function loginMiddleware(req, res, next) {
        if (!req.session) {
            logule.warn("missing session", req.route, req.headers);
            req.session = {};
        }
        if (!req.session.isLogged) {
            var passwords = options.passwords;
            if (null == passwords || passwords.length == 0) {
                next();
            } else {
                var passwordParam = req.param('password');
                var isLoggedByForm = _.contains(passwords, passwordParam);
                var isLoggedByCookies = _.contains(passwords, req.cookies.password);
                var isLogged = isLoggedByForm || isLoggedByCookies;
                if (!isLogged) {
                    logule.debug("not logged in, requesting password");
                    res.render(options.view);
                } else {
                    req.session.isLogged = true;
                    if (!isLoggedByCookies) {
                        var cookieMaxAge = 60 * 24 * 3600 * 1000;
                        res.cookie('password', passwordParam, { maxAge: cookieMaxAge, path: '/' });
                    }
                    res.redirect(req.url);
                }
            }
        } else {
            next();
        }
    };
}