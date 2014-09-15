var _ = require('lodash');
var MongoClient = require('mongodb').MongoClient;

var Fetcher = require('./fetcher');
var config = require('./config');
var forEach = require('./utils').forEach;

var fetcher = new Fetcher(config.imap);
var _db = null;


MongoClient.connect(config.mongo, function (err, db) {
  if (err) throw err;
  _db = db;
  fetcher.initDb(db, function(){
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
      computeRelationships(function () {
        process.exit(1);
      });

  });
});


function getMailBoxes(cb) {
  fetcher.imap.getBoxes(function (err, boxes) {
    for (var p in boxes) {
      console.log(p);
      var c = boxes[p].children;
      for (var pc in c) {
        console.log("  " + pc);
      }
    }
    cb();
  });
}


function importAll(cb) {
  fetcher.imap.getBoxes(function (err, boxes) {
    forEach(_.keys(boxes), function (box, next_box) {
      fetcher.fetchAllMailFromBox(box, function () {
        forEach(_.keys(boxes[box].children), function (child_box, next_child) {
          fetcher.fetchAllMailFromBox(box + '/' + child_box, function () {
            next_child();
          });
        }, next_box);
      });
    }, function () {
      cb();
    });
  });
}


// computing relationships between people
function computeRelationships(complete) {
  _db.collection('mail').find({}, function (err, resultCursor) {
    function processItem(err, item) {
      if (item === null)
        return complete();
      forEach(item.to, function (t, n) {
        var w = getWeekNumber(item.date);
        _db.collection('relationships').findAndModify(
          {sender: item.from, receiver: t, year: w[0], week: w[1]}, null,
          {$setOnInsert: {sender: item.from, receiver: t, year: w[0], week: w[1]}, $inc: {hits: 1}, $addToSet: {mail: item._id}},
          {upsert: true, 'new': true}, function (err, rdoc) {
            if (err) throw err;
            //console.log("relationship", rdoc)
            n();
          });
      }, function (err) {
        resultCursor.nextObject(processItem);
      });
    }
    resultCursor.nextObject(processItem);
  });
}

