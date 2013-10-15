// Add some useful methods to Number
if (Number.prototype.degToRad === 'undefined') {
  Number.prototype.degToRad = function() {
    return this * Math.PI / 180;
  }
}
if (Number.prototype.radToDeg === 'undefined') {
  Number.prototype.radToDeg = function() {
    return this * 180 / Math.PI;
  }
}
if (Number.prototype.degToMicroDeg === 'undefined') {
  Number.prototype.degToMicroDeg = function() {
    return this * 1000000;
  }
}
if (Number.prototype.microDegToDeg === 'undefined') {
  Number.prototype.microDegToDeg = function() {
    return this * 0.000001;
  }
}

// Add method to google maps LatLng
google.maps.LatLng.prototype.newLatLngFromMicroDeg = function(lat, lng) {
  return new this.LatLng((0.000001 * lat), (0.000001 * lng));
}

function getUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(position) {
	return new google.maps.LatLng(
	  position.coords.latitude,
	  position.coords.longitude
	);
      },
      function showError(error) {
	switch(error.code) {
	  case error.PERMISSION_DENIED:
	  case error.POSITION_UNAVAILABLE:
	  case error.TIMEOUT:
	  case error.UNKNOWN_ERROR:
	  return undefined;
	  break;
	}
      });
  } else {
    return undefined;
  }
}

var yui = YUI().use(
    'graphics',
    'selector-css3',
    'node',
    'jsonp',
    'jsonp-url',
    function (Y) {
  
  // globals
  var systemMap;
  var bikeTrack;
  var selectedSystemIndex = 0;
  var systemList;
  var systemData;
  var dataTimer;

  // URL of SF network: http://bayareabikeshare.com/stations/json/

  function setCoordinates() {
    Y.one('p#system-lat-lng').setHTML('System coordinates: ' +
      (0.000001 * systemList[selectedSystemIndex].lat).toFixed(3) +
      ', ' +
      (0.000001 * systemList[selectedSystemIndex].lng).toFixed(3));
    systemMap.setCenter(new google.maps.LatLng((0.000001 *
	  systemList[selectedSystemIndex].lat),
	      (0.000001 * systemList[selectedSystemIndex].lng)));
    }

  function setSelectedSystem() {

    var urlTemplate = 'http://api.citybik.es/{name}.json?callback={callback}';
    selectedSystemIndex = parseInt(Y.one('p select#system-list').get('value'));
    if (dataTimer) {
      window.clearInterval(dataTimer);
    }
    setCoordinates();
    dataTimer = window.setInterval( function() {
    new Y.JSONPRequest(urlTemplate, {
      on: {
	  success: handleSystemData,
	  failure: handleJSONPFailure,
	  timeout: handleJSONPTimeout,
	  type: 'text/javascript'
	},
	  timeout: 5000,
	  format: prepareJSONPUrl
	}).send();
      }, 10000);
  };

  // Functions to draw or redraw each box
  function updateSettingsBox() {
    var userPos = getUserLocation();
    var systemOptions = "";
    
    if (userPos) {
      Y.one('#user-coordinates').setHTML(userPos.latitude.toFixed(3),
      userPos.longitude.toFixed(3));
    }
    Y.Array.each(systemList, function(system,value) {
      systemOptions += '\t<option value="' + value + '" ' ;
      systemOptions += ((value === selectedSystemIndex) ?
	    'selected' : '') ;
      systemOptions += '>' + system.name + '</option>\n';
    });
    Y.one('#system-list').setHTML(systemOptions);
  }

function drawDataBox() {
  var bikeLatAccE6 = 0, bikeLngAccE6 = 0, dockLatAccE6 = 0, dockLngAccE6 = 0,
    bikesAcc = 0, docksAcc = 0, bikeCenter;
  var a, c, d;
  var R = 6371 / 1.609344; // miles
  var maxBikes = 0, bikeOldLatDeg, bikeOldLngDeg, bikeLatAvgDeg, bikeLngAvgDeg;
  
  // Some systems return the info as strings
  // For simplicity, we check one value and then branch as needed.
  if (typeof systemData[0].bikes === String) {
    Y.Array.each(systemData, function(station,value){
      var bikes = parseInt(station.bikes);
      var docks = parseInt(station.free);
      bikesAcc += bikes;
      bikeLatAccE6 += bikes * parseInt(station.lat);
      bikeLngAccE6 += bikes * parseInt(station.lng);
      docksAcc += docks;
      dockLatAccE6 += docks * parseInt(station.lat);
      dockLngAccE6 += docks * parseInt(station.lng);
    });
  } else {
    Y.Array.each(systemData, function(station,value){
      var bikes = station.bikes;
      var docks = station.free;
      bikesAcc += bikes;
      bikeLatAccE6 += bikes * station.lat;
      bikeLngAccE6 += bikes * station.lng;
      docksAcc += docks;
      dockLatAccE6 += docks * station.lat;
      dockLngAccE6 += docks * station.lng;
    });
  }
  bikeLatAvgDeg = 0.000001 * bikeLatAccE6 / bikesAcc;
  bikeLngAvgDeg = 0.000001 * bikeLngAccE6 / bikesAcc;
  dockLatAvgDeg = 0.000001 * dockLatAccE6 / docksAcc;
  dockLngAvgDeg = 0.000001 * dockLngAccE6 / docksAcc;
  if (bikesAcc > maxBikes) {
    maxBikes = bikesAcc;
  }
  Y.one('#zero-two').set('text', bikesAcc);
  Y.one('#one-two').set('text', maxBikes);
  Y.one('#two-two').set('text', docksAcc);
  Y.one('#three-two').set('text', ( bikeLatAvgDeg.toFixed(3) +
      ', ' + bikeLngAvgDeg.toFixed(3)));
  if (bikeTrack.push(new google.maps.LatLng(bikeLatAvgDeg,
      bikeLngAvgDeg)) === 2) {
      bikeCenter = new google.maps.Polyline({
	path: bikeTrack,
	strokeColor: '#FF0000',
	strokeOpacity: 1.0,
	strokeWeight: 3
      });
      bikeCenter.setMap(systemMap);
    }

}

function handleSystemData(data) {
  systemData = data;
  drawDataBox();
}

function handleJSONPFailure() {
}

function handleJSONPTimeout() {
}

function prepareJSONPUrl(url, proxy, username) {
  return Y.Lang.sub(url, {
    callback: proxy,
    name: systemList[selectedSystemIndex].name
  });
}

function drawSettingsBox() {
  var comparator;
  switch (Y.one('input.sort:checked').get('value')) {
    case "lat":
    comparator = function (a, b) {
      if (a.lat < b.lat) {
	return 1;
      } else if (a.lat > b.lat) {
	return -1;
      } else {
	return 0;
      }
    }
    break;

    case "lng":
    comparator = function (a, b) {
      if (a.lng + 180 > b.lng + 180) {
	return 1;
      } else if (a.lng < b.lng) {
	return -1;
      } else {
	return 0;
      }
    }
    break;

    case "dist":
    comparator = function (a, b) {
      var dista = Math.sqrt(a.lat * a.lat + a.lng * a.lng);
      var distb = Math.sqrt(b.lat * b.lat + b.lng * b.lng);
      if (dista > distb) {
	return 1;
      } else if (dista < distb) {
	return -1;
      } else {
	return 0;
      }
    }
    break;

    case "alpha":
    comparator = function (a, b) {
      if (a.name > b.name) {
	return 1;
      } else if (a.name < b.name) {
	return -1;
      } else {
	return 0;
      }
    };
    default:
    break;
  }
  systemList.sort(comparator);
  setSelectedSystem();
  updateSettingsBox();
}

function handleSystemList(data) {
  systemList = data;
  drawSettingsBox();
}

function initialize() {

  // draw the base page
  Y.one('p select#system-list').
    on('change', function() {
      this.siblings('button#change-system-button').
      removeAttribute('disabled').
      on('click', function() {
	this.setAttribute('disabled');
	setSelectedSystem();
	updateSettingsBox();
      });
    });
    
    systemMap = new google.maps.Map(document.getElementById("mapBox"), {
      zoom: 14,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    });

  bikeTrack = new google.maps.MVCArray([]);

  Y.all('input.sort').on('click', drawSettingsBox);
  new Y.JSONPRequest('http://api.citybik.es/networks.json', {
    on: {
      success: handleSystemList,
      failure: handleJSONPFailure,
      timeout: handleJSONPTimeout,
      type: 'text/javascript'
    },
    timeout: 5000
  }).send();

  }
google.maps.event.addDomListener(window, 'load', initialize);
});
