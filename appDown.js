var express = require('express')
  , http = require('http')
  , https = require('https')
  , path = require('path')
  , nib = require('nib')
  , stylus = require('stylus')
  , fs = require('fs');

var options = {
  key: fs.readFileSync('./keys/privkey.pem'),
  cert: fs.readFileSync('./keys/root.cer')
};

var app = express();

function compile(str, path) {
  return stylus(str)
    .set('filename', path)
    .set('compress', true)
    .use(nib());
}

app.configure(function() {
  app.set('port', process.env.PORT || 3700);
  app.set('sport', process.env.SPORT || 3701);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('lala - key - haha'));
  app.use(express.cookieSession());
  app.use(express.session());
  app.use(stylus.middleware( {
      src: __dirname + '/public',
      compile: compile
  }));
  app.use(express.static(path.join(__dirname, 'public')));
});

http.createServer(app).listen(app.get('port'), function() {
  console.log("Express server listening on port " + app.get('port'));
});

https.createServer(options, app).listen(app.get('sport'), function() {
  console.log("Express secure server listening on port " + app.get('sport'));
});

app.get('*', function(req, res) {
  res.render('maintenance',
    { title: 'maintenance page' }
  );
});
