var _ = require('underscore');
var logger = require('./bunyule');

var defaultView = require.resolve('./views/password.jade');

var IS_LOGGED_KEY = 'globalpassword_islogged';

module.exports = globalpassword;

function globalpassword(options) {
    options = _.defaults(options || {}, {
        passwords: [],
        view: defaultView,
    });

    return function loginMiddleware(req, res, next) {
        if (!req.session) {
            logger.warn("missing session", req.route, req.headers);
            req.session = {};
        }
        if (!req.session[IS_LOGGED_KEY]) {
            var passwords = options.passwords;
            if (null == passwords || passwords.length == 0) {
                next();
            } else {
                var passwordParam = req.param('password');
                var isLoggedByForm = _.contains(passwords, passwordParam);
                var isLoggedByCookies = _.contains(passwords, req.cookies.password);
                var isLogged = isLoggedByForm || isLoggedByCookies;
                if (!isLogged) {
                    logger.debug("not logged in, requesting password");
                    res.render(options.view);
                } else {
                    req.session[IS_LOGGED_KEY] = true;
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

module.exports.IS_LOGGED_KEY = IS_LOGGED_KEY;
