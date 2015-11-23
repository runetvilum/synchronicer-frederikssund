var config = require('./config.json');
var request = require('request');
var http = require('http');
var nano = require('nano')({
  "url": config.url,
  "parseUrl": false
});

var db = nano.db.use(config.dbname);
var list = function () {
  db.list({ include_docs: true }, function (err, body) {
    //db.get('066d1a39335d7a8560f936f75a3399d4',function(err, doc) {
    if (!err) {
      body.rows.forEach(function (row) {
        var doc = row.doc;
        if (doc && doc.properties && doc.properties.Art) {
          //console.log(doc.doc.properties.Art);
          var url = 'http://dawa.aws.dk/adgangsadresser/reverse?x=' + doc.geometry.coordinates[0] + '&y=' + doc.geometry.coordinates[1];
          request(url, function (error, response, body) {
            if (!error && response.statusCode == 200) {
              sendXml(doc, body);
            } else {
              console.log(err);
            }
          });
        }
      });
    }
  });
};
var sendXml = function (doc, body) {

  var res = JSON.parse(body);
  var reg_type = "";
  switch (doc.properties.Art) {
    case 'Manglende lys':
      reg_type = "VEJ_ML";
      break;
    case "Beskadiget lampe":
      reg_type = "VEJ_BL";
      break;
    case "Beskadiget mast":
      reg_type = "VEJ_BM";
      break;
    case "Beskadiget skab":
      reg_type = "VEJ_BS";
      break;
    case "Manglende træbeskæring":
      reg_type = "VEJ_MT";
      break;
    case "Fare for stød":
      reg_type = "VEJ_FS";
      break;
    case "Lyssignal eller trafiklys":
      reg_type = "VEJ_LT";
      break;
    case "Andet":
      reg_type = "VEJ_G";
      break;
  }
  var dato = new Date(doc.properties.Dato);
  var id = dato.getTime();
  var st_date = dato.toLocaleDateString();
  var st_time = dato.toLocaleTimeString();
  dato.setTime(dato.getTime() + 14 * 24 * 60 * 60 * 1000);
  var late_date = dato.toLocaleDateString();
  var late_time = dato.toLocaleTimeString();
  var dst_adress = res.vejstykke.navn;
  var dst_adress2 = res.husnr;
  var dst_zipcode = res.postnummer.nr;
  var dst_city = res.postnummer.navn;
  var dst_lat = doc.geometry.coordinates[1].toString().replace('.', ',');
  var dst_long = doc.geometry.coordinates[0].toString().replace('.', ',');
  var obs_em = doc.properties.Email || '';
  var besked = doc.properties.Kommentar || '';
  var xml = '<?xml version="1.0" encoding="utf-8" ?>';
  xml += '<import owner="FS">';
  xml += '<tour tour_reference="pool" st_date="' + st_date + '" st_time="' + st_time + '" end_date="' + st_date + '" end_time="' + st_time + '">';
  xml += '<tour_type>BORGER</tour_type>';
  xml += '<tour_provider></tour_provider>';
  xml += '<tour_contact></tour_contact>';
  xml += '<employee1></employee1>';
  xml += '<employee2></employee2>';
  xml += '<vehicle></vehicle>';
  xml += '<group></group>';
  xml += '<registration reg_reference="' + id + '" early_date="' + st_date + '" early_time="' + st_time + '" late_date="' + late_date + '" late_time="' + late_time + '">';
  xml += '<reg_type>' + reg_type + '</reg_type>';
  xml += '<reg_provider></reg_provider>';
  xml += '<reg_contact></reg_contact>';
  xml += '<destination></destination>';
  xml += '<dst_name>' + id + '</dst_name>';
  xml += '<dst_adress>' + dst_adress + '</dst_adress>';
  xml += '<dst_adress2>' + dst_adress2 + '</dst_adress2>';
  xml += '<dst_zipcode>' + dst_zipcode + '</dst_zipcode>';
  xml += '<dst_city>' + dst_city + '</dst_city>';
  //xml += '<dst_adress></dst_adress>';
  //xml += '<dst_adress2></dst_adress2>';
  //xml += '<dst_zipcode></dst_zipcode>';
  //xml += '<dst_city></dst_city>';
  xml += '<dst_country></dst_country>';
  xml += '<dst_lat>' + dst_lat + '</dst_lat>';
  xml += '<dst_long>' + dst_long + '</dst_long>';
  xml += '<dst_phone></dst_phone>';
  xml += '<item_value item_type="OBS_EM" value="' + obs_em + '"/>';
  xml += '<item_value item_type="OBS_CID" value= "" />';
  xml += '<item_value item_type="OBS_NVN" value= "" />';
  xml += '<item_value item_type="OBS_INF" value= "" />';
  xml += '<item_value item_type="OBS_TLF" value= "" />';
  xml += '<item_value item_type="OBS_VER" value= "" />';
  xml += '<item_value item_type="BESKED_CLI" value= "" />';
  xml += '<item_value item_type="BESKED" value= "' + besked + '" />';
  xml += '<item_value item_type="BESKED_SRV" value= "" />';
  xml += '<item_value item_type="I1" value= "" />';
  xml += '<item_value item_type="I2" value= "" />';
  xml += '<item_value item_type="I3" value= "" />';
  xml += '<item_value item_type="I4" value= "" />';
  xml += '<item_value item_type="I5" value= "" />';
  xml += '<item_value item_type="I6" value= "" />';
  xml += '<item_value item_type="I7" value= "" />';
  xml += '<item_value item_type="I8" value= "" />';
  xml += '<item_value item_type="I9" value= "" />';
  xml += '</registration>';
  xml += '</tour>';
  xml += '</import>';
  var postRequest = {
    host: config.host,
    path: "/XMLIMPORT/cgirelays.exe",
    port: 80,
    method: "POST",
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(xml)
    }
  };

  var req = http.request(postRequest, function (res) {
    //console.log(res.statusCode);
    var buffer = "";
    res.on("data", function (data) {
      buffer = buffer + data;
    });
    res.on("end", function (data) {
      //console.log(buffer);
    });

  });
  req.on('error', function (e) {
    console.log('problem with request: ' + e.message);
  });
  req.write(xml);
  req.end();
};

var feed = db.follow({ since: "now", include_docs: true });
feed.on('change', function (change) {
  var doc = change.doc;
  if (doc && doc.properties && doc.properties.Art) {
    var url = 'http://dawa.aws.dk/adgangsadresser/reverse?x=' + doc.geometry.coordinates[0] + '&y=' + doc.geometry.coordinates[1];
    request(url, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        sendXml(doc, body);
      } else {
        console.log(error);
      }
    });
  }
});
feed.follow();