var express = require('express'),
    http = require('http'),
    https = require('https'),
    mysql = require('mysql'),
    path = require('path'),
    nib = require('nib'),
    stylus = require('stylus'),
    fs = require('fs');

// global
config = require('./config.json');

var options = {
  key: fs.readFileSync('./keys/privkey.pem'),
  cert: fs.readFileSync('./keys/root.cer')
};

var app = express();

var pool = mysql.createPool( {
    host     : config.db.host,
    database : config.db.database,
    user     : config.db.user,
    password : config.db.password,
    waitForConnections: config.db.watingForConnections,
    connectionLimit: config.db.connectionLimit
});

function compile(str, path) {
  return stylus(str)
    .set('filename', path)
    .set('compress', true)
    .use(nib());
}

// all environment
app.configure(function() {
  app.set('port', config.app.port);
  app.set('sport', config.app.sport);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser(config.app.cookieParser));
  app.use(express.cookieSession());
  app.use(express.session());
  app.use(stylus.middleware( {
      src: __dirname + '/public',
      compile: compile
  }));
  app.use(express.static(path.join(__dirname, 'public')));
});

// development environment (NODE_ENV) only
app.configure('development', function() {
  app.use(express.errorHandler());
});

require('./server/admin.js')(app, pool);
require('./server/routes.js')(app, pool);

http.createServer(app).listen(app.get('port'), function() {
  console.log("Express server listening on port " + app.get('port'));
});

https.createServer(options, app).listen(app.get('sport'), function() {
  console.log("Express secure server listening on port " + app.get('sport'));
});

