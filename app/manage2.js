var MongoClient = require('mongodb').MongoClient;

var Fetcher = require('./fetcher');
var config = require('./config');

var fetcher = new Fetcher(config.imap);

console.log(fetcher);

MongoClient.connect(config.mongo, function (err, db) {
  if (err) throw err;
  fetcher.initDb(db);
  var cmd = process.argv[2];
  if ('clean' == cmd)
    fetcher.clean(function () {
      process.exit(1);
    });
  else if ('mailboxes' == cmd)
    getMailBoxes(function () {
      process.exit(1);
    });
  else if ('import' == cmd)
    importAll(function () {
      process.exit(1);
    });
  else if ('relationships' == cmd)
    getRelationships(function () {
      process.exit(1);
    });
});




function getMailBoxes(cb) {
  fetcher.imap.getBoxes(function (err, b) {
    for (var p in b) {
      console.log(p);
      var c = b[p].children;
      for (var pc in c) {
        console.log("  " + pc);
      }
    }
    cb();
  });
}

function importAll(cb) {
        imap.getBoxes(function (err, b) {
          for (var p in b) {
            console.log(p);
            user.lastUids[p] = 0;
            fetch(function(){
              var c = b[p].children;
              for (var pc in c) {
                console.log("  "+pc);
              }
            });
          }
        });
}

function getRelationships(cb){
        computeRelationships(function(){
          console.log("DONE!");
        });
}


