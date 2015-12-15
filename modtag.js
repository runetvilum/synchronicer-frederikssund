var config = require('./config.json');
var express = require('express');
var basicAuth = require('basic-auth');
var xmlparser = require('express-xml-bodyparser');
var parseString = require('xml2js').parseString;
var nano = require('nano')({
  "url": config.url,
  "parseUrl": false
});
var fs = require('fs');
var app = express();

//app.use(xmlparser());
var auth = function (req, res, next) {
  function unauthorized(res) {
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.send(401);
  }

  function login(user, req, res, next) {
    var couchdb = require('nano')({
      "url": "http://geo.os2geo.dk/couchdb",
      "parseUrl": false
    });
    couchdb.auth(user.name, user.pass, function (err, body, headers) {
      if (err) {
        return unauthorized(res);
      }
      req.userCtx = body;
      return next();
    });
  }
  var user = basicAuth(req);
  if (typeof user === 'undefined') {
    return unauthorized(res);
  }
  return login(user, req, res, next);
};

var find = function (id, db) {
  return new Promise(function (resolve, reject) {
    db.list({
      include_docs: true
    }, function (err, body) {
      if (err) {
        reject("fejl ved hentning af dokumenter");
      }
      for (var i = 0; i < body.rows.length; i++) {
        var row = body.rows[i];
        if (row.doc && row.doc.properties && row.doc.properties.Dato) {
          var dato = new Date(row.doc.properties.Dato);
          var docid = dato.getTime();
          if (docid === id) {
            resolve(row.doc);
          }
        }
      }
      reject();
    });
  });
};
var insert = function (doc, db) {
  return new Promise(function (resolve, reject) {
    db.insert(doc, doc._id, function (err, body) {
      if (err) {
        reject(err);
      } else {
        resolve(body);
      }
    });
  });
};

app.post('/:db', auth, xmlparser(), function (req, res) {
  if (!req.params.db) {
    return res.status(500).send('Database ikke angivet');
  }
  if (!(req.body && req.body.import && req.body.import.tour && req.body.import.tour.length > 0)) {
    return res.status(500).send('XML indeholder ikke tour');
  }
  var tour = req.body.import.tour[0];
  if (!(tour.registration && tour.registration.length > 0)) {
    return res.status(500).send('tour indeholder ikke registration');
  }
  var registration = tour.registration[0];
  if (!(registration.hasOwnProperty('$') && registration['$'].hasOwnProperty('reg_reference') && registration['$'].hasOwnProperty('reg_status'))) {
    return res.status(500).send('registration indeholder ikke reg_reference og reg_status');
  }
  var id = parseInt(registration['$'].reg_reference);
  var reg_status = parseInt(registration['$'].reg_status);
  if (reg_status !== 3) {
    return res.status(500).send('reg_status er ikke lig med 3');
  }
  var db = nano.use(req.params.db);
  find(id, db).then(function (doc) {
    doc.properties.Status = 'Udbedres';
    console.log(doc);
    return insert(doc, db);
  }).then(function (body) {
    console.log(body);
    res.json(body);
  }).catch(function (err) {
    console.log(err);
    res.sendStatus(500);
  })

});
app.listen(4000);
console.log('Listening on port 4000');
/*fs.readFile(__dirname + '/FS7.xml', function (err, data) {
  parseString(data, function (err, result) {
    console.dir(result);
    console.log('Done');
  });
});*/