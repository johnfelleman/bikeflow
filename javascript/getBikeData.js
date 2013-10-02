var jsdom = require('jsdom');
var jquery = require('jquery');
var window = jsdom.jsdom().parentWindow;

var bikeOldLatDeg, bikeOldLngDeg, bikeLatAvgDeg, bikeLngAvgDeg;

if (typeof Number.prototype.toRad == 'undefined') {
  Number.prototype.toRad = function() {
      return this * Math.PI / 180;
  }
}

/** Converts radians to numeric (signed) degrees */
if (typeof Number.prototype.toDeg == 'undefined') {
    Number.prototype.toDeg = function() {
	return this * 180 / Math.PI;
    }
}
	
window.setInterval(function() {
jquery.getJSON( 'http://api.citybik.es/capitalbikeshare.json')
  .done(function(msg) {

    var bikeLatAccE6 = 0, bikeLngAccE6 = 0, dockLatAccE6 = 0, dockLngAccE6 = 0,
      bikesAcc = 0, docksAcc = 0;
    var R, dLat, dLon, a, c, d;

    jquery.each(msg, function(index, value) {
      var bikes = value.bikes;
      var docks = value.free;
      bikesAcc += bikes;
      bikeLatAccE6 += bikes * value.lat;
      bikeLngAccE6 += bikes * value.lng;
      docksAcc += docks;
      dockLatAccE6 += docks * value.lat;
      dockLngAccE6 += docks * value.lng;
    });
    bikeLatAvgDeg = 0.000001 * bikeLatAccE6 / bikesAcc;
    bikeLngAvgDeg = 0.000001 * bikeLngAccE6 / bikesAcc;
    dockLatAvgDeg = 0.000001 * dockLatAccE6 / docksAcc;
    dockLngAvgDeg = 0.000001 * dockLngAccE6 / docksAcc;

/*
var x = (lon2-lon1) * Math.cos((lat1+lat2)/2);
var y = (lat2-lat1);
var d = Math.sqrt(x*x + y*y) * R;

*/
    R = 6371 / 1.609344; // miles
    dLat = 0;
    dLng = 0;
    if (bikeOldLatDeg !== undefined && bikeOldLngDeg !== undefined) {
      dLat = (bikeLatAvgDeg - bikeOldLatDeg).toRad();
      dLon = (bikeLngAvgDeg - bikeOldLngDeg).toRad();
    } else {
      bikeOldLatDeg = bikeLatAvgDeg;
      bikeOldLngDeg = bikeLngAvgDeg;
    }

    a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.sin(dLon/2) * Math.sin(dLon/2) *
	Math.cos(bikeOldLatDeg.toRad()) * Math.cos(bikeOldLngDeg.toRad()); 
    d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 

    console.log('Bike Status for Capital Bikeshare:');
    console.log('Timestamp\t\tBikes\tDocks\tBike center\Dock center\tdelta');
    console.log(msg[0].timestamp + ': '
	+ bikesAcc +'\t' + docksAcc
	+ '\t' + bikeLatAvgDeg.toFixed(2)
	+ ', ' + bikeLngAvgDeg.toFixed(2)
	+ '\t' + dockLatAvgDeg.toFixed(2)
	+ ', ' + dockLngAvgDeg.toFixed(2)
	+ '\t' + d);
    bikeOldLatDeg = bikeLatAvgDeg;
    bikeOldLngDeg = bikeLngAvgDeg;
  })
  .fail(function(jqXHR, textStatus) {
      console.log("Request failed: " + textStatus);
  });
},3000);
