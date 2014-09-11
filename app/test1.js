var Imap = require('imap'),
  inspect = require('util').inspect;

var imap = new Imap({
  user: 'david@posttool.com',
  password: 'hello2pt',
  host: 'imap.gmail.com',
  port: 993,
  tls: true
});

var q = {};
var s = 16000;
var w = 50;
var user, mail;

var MongoClient = require('mongodb').MongoClient
    , format = require('util').format;

  MongoClient.connect('mongodb://localhost:27017/mailtesster', function(err, db) {
    if(err) throw err;

    user = db.collection('user');
    mail = db.collection('mail');

     imap.once('ready', function () {
      imap.openBox('INBOX', true, function (err, box) {
        if (err) throw err;
        going();
      });
    });

    imap.once('error', function (err) {
      console.log(err);
    });

    imap.once('end', function () {
      console.log('Connection ended');
    });

    imap.connect();
  });


function going() {
  fetch(s + ':' + (s + w - 1), function (err, res) {
    if (err) throw err;
    if (res.length == 0)
      return;
    for (var i = 0; i < res.length; i++) {
      //console.log(inspect(res[i]));
      var from = res[i].body.from[0];
      var m = from.match(/(.*)\<(.*)\>/);
      if (m) {
        var n = m[1].replace('"', '').replace('"', '').trim();
        var e = m[2];
           mail.insert({
             from: e,
             seqno: res[i].seqno,
             subject: res[i].body.subject[0],
             to: res[i].body.to,
             date: res[i].body.date[0],
             attributes: res[i].attributes}, function (err, mdoc) {
             console.log("Y", err, mdoc);
             user.findAndModify({email: e}, null, {$set: {email: e}, $addToSet: {aka: n}, $inc: {messages: 1}}, {upsert: true}, function (err, udoc) {
               console.log("X", err, udoc);

             });
           });
      }
    }
    console.log('---------------------------------')
    s += w;
    going();
  });
}



function fetch(id, cb) {
  var f = imap.seq.fetch(id, {
    bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
    struct: true
  });
  var results = [];
  f.on('message', function (msg, seqno) {
    var o = {seqno: seqno, body: "", attributes: null};
    results.push(o);
    msg.on('body', function (stream, info) {
      stream.on('data', function (chunk) {
        o.body += chunk.toString('utf8');
      });
      stream.once('end', function () {
        o.body = Imap.parseHeader(o.body);
      });
    });
    msg.once('attributes', function (attrs) {
      o.attributes = attrs;
    });
    msg.once('end', function () {
    });
  });
  f.once('error', function (err) {
    cb(err);
  });
  f.once('end', function () {
    cb(null, results);
  });

}