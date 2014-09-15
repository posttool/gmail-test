var fs = require('fs');
var cluster = require('cluster');
var express = require('express');
var useCluster = false;
var MongoClient = require('mongodb').MongoClient,
   ObjectID = require('mongodb').ObjectID;
var config = require('./config');

if (useCluster && cluster.isMaster) {
  var cpuCount = require('os').cpus().length;
  for (var i = 0; i < cpuCount; i += 1) {
    cluster.fork();
  }
  cluster.on('exit', function (worker) {
    console.log('Worker ' + worker.id + ' died');
    cluster.fork();
  });

} else {
  var express = require('express');
  var app = express();

  app.set('views', __dirname + '/views');
  app.use(express.static(__dirname + '/public'));

  MongoClient.connect(config.mongo, function (err, db) {
    if (err) throw err;

    var users = db.collection('user');
    var mails = db.collection('mail');
    var relationships = db.collection('relationship');

    app.get('/', function (req, res, next) {
      res.render('index.ejs');
    });

    app.get('/1/:year/:week', function (req, res, next) {
      var q = {week: Number(req.params.week), year: Number(req.params.year), receiver: config.imap.user};
      relationships.find(q).sort({hits: -1}).toArray(function(err, rels){
        res.json(rels);
      })
    });

    app.get('/2/:relid', function (req, res, next) {
      relationships.find({_id: new ObjectID(req.params.relid)}).toArray(function(err, rels){
        mails.find({_id: { $in: rels[0].mail}}).sort({date: -1}).toArray(function(err, mails){
          res.json(mails);
        });
      })
    });

    app.listen(3001);
    console.log("ready")
  });
}

//process.on('uncaughtException', function (err) {
//  console.error('uncaughtException:', err.message);
//  console.error(err.stack);
//});

//server.cms/app.on('error', function (err) {
//  console.error(err);
//});

