var express = require('express'),
  httpProxy = require('http-proxy'),
  passport = require('passport'),
  nconf = require('nconf'),
  GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
  morgan  = require('morgan'),
  cookieParser = require('cookie-parser'),
  session = require('express-session'),
  RedisStore = require('connect-redis')(session);

var sessionStore = new RedisStore();

// load the configuration
nconf.argv()
  .env()
  .file({file: nconf.get('config')});
nconf.defaults({
  'tw5_host': 'localhost',
  'host': 'localhost'
});

// Setup passport
passport.serializeUser(function(user, done) {
  // serialize the _json field
  // Hint: serialize the user_id here
  done(null, user._json);
});

passport.deserializeUser(function(obj, done) {
  // Hint: deserialize the user by its id.
  done(null, obj);
});

passport.use(new GoogleStrategy({
    clientID: nconf.get('client_id'),
    clientSecret: nconf.get('client_secret'),
    callbackURL: nconf.get('mount_point') + '/auth/google/callback'
  }, function(accessToken, refreshToken, profile, done) {
    // Hint: find or create the user in the DB
    // asynchronous verification, for effect...
    process.nextTick(function () {
      return done(null, profile);
    });
  })
);

function isAuthorized(req, user) {
  // Override me for your own need!
  //var domain = nconf.get('domain');
  //var pattern = new RegExp('.*@' + domain.replace('.', '\\.'));
  //return user && user.email.match(pattern);
  var userAllowList = nconf.get('user_allow').split(',');
  return user && (userAllowList.indexOf(user.email)>-1);
}

// Setup express application
//var proxy = new httpProxy.RoutingProxy();
var proxy = httpProxy.createProxyServer({});

var app = express()
  .use(morgan())
  .use(cookieParser('Time is money!!!'))
  .use(session({
    secret: nconf.get('session_secret'),
    store: sessionStore,
    key: 'mySes'
  }))
  .use(passport.initialize())
  .use(passport.session());


// Router

app.get('/auth/google',
  passport.authenticate('google', {
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  }), function(req, res){
    // handled by google.
  }
);

app.get('/auth/google/callback',
  passport.authenticate('google'),
  function(req, res) {
    res.redirect('/');
  }
);

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.all('/*', function(req, res, next) {
  var user = req.user;
  var isAuth = isAuthorized(req, user) && req.isAuthenticated();
//  console.log(req.user, isAuth)
//  if (req.method == 'GET' || req.method == 'HEAD' || (user && isAuth)) {
  if (user && isAuth) {
    return next();
  } else if(!user) {
    res.redirect('/auth/google');
  } else {
    res.send(401);
  }
});

app.all('/*', function (request, response) {
    "use strict";
    return proxy.web(request, response, {
        target: 'http://' + nconf.get('tw5_host') + ':' + nconf.get('tw5_port')
    });
});

app.listen(nconf.get('port'), nconf.get('host'));
