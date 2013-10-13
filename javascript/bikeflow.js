    // globals
    var defaultSystemName='capitalbikeshare';
    var map;
    var bikeTrack;
    var selectedSystem;

    // Add some useful methods to Number
    if (typeof Number.prototype.degToRad == 'undefined') {
      Number.prototype.degToRad = function() {
	return this * Math.PI / 180;
      }
    }
    if (typeof Number.prototype.radToDeg == 'undefined') {
      Number.prototype.radToDeg = function() {
	return this * 180 / Math.PI;
      }
    }
    if (typeof Number.prototype.degToMicroDeg == 'undefined') {
      Number.prototype.degToMicroDeg = function() {
	return this * 1000000;
      }
    }
    if (typeof Number.prototype.microDegToDeg == 'undefined') {
      Number.prototype.microDegToDeg = function() {
	return this * 0.000001;
      }
    }

    // Add method to google maps LatLng
    google.maps.LatLng.prototype.newLatLngFromMicroDeg = function(lat, lng) {
      return new this.LatLng((0.000001 * lat), (0.000001 * lng));
    }

    // Functions to draw or redraw each box

    // URL of SF network: http://bayareabikeshare.com/stations/json/

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

    function changeSystem() {
    }

    function updateSettingsBox(Y, data) {
      var userPos = getUserLocation();
      var systemOptions = "";
      var selectOption;
      
      if (userPos) {
	Y.one('#user-coordinates').setHTML(userPos.latitude.toFixed(3),
	  userPos.longitude.toFixed(3));
      }

      Y.Array.each(data, function(system,value){
	systemOptions += '\t<option value="' + value + '" ' +
	((selectedSystem && system.name === selectedSystem.name) ?
	      'selected' : '') + '>' + system.name + '</option>\n';
      });
      selectOption = Y.one('p select#system-list');
      selectedSystem = data[selectOption.get('value')];
    
      Y.one('#system-list').setHTML(systemOptions);
      Y.one('p#system-lat-lng').setHTML('System coordinates: ' +
		(0.000001 * selectedSystem.lat).toFixed(3) +
		', ' + (0.000001 * selectedSystem.lng).toFixed(3));
    }

    function drawDataBox(Y, data) {
      var bikeLatAccE6 = 0, bikeLngAccE6 = 0, dockLatAccE6 = 0, dockLngAccE6 = 0,
	bikesAcc = 0, docksAcc = 0, bikeCenter;
      var a, c, d;
      var R = 6371 / 1.609344; // miles
      var maxBikes = 0, bikeOldLatDeg, bikeOldLngDeg, bikeLatAvgDeg, bikeLngAvgDeg;
      Y.Array.each(data, function(station,value){
	var bikes = station.bikes;
	var docks = station.free;
	bikesAcc += bikes;
	bikeLatAccE6 += bikes * station.lat;
	bikeLngAccE6 += bikes * station.lng;
	docksAcc += docks;
	dockLatAccE6 += docks * station.lat;
	dockLngAccE6 += docks * station.lng;
      });
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
	  bikeCenter.setMap(map);
	}

    }

    function updateDataBox(Y, data) {
      drawDataBox(Y, data);
    }

    function drawMapBox(mapBox) {
      if (!map) {
	map = new google.maps.Map(document.getElementById("mapBox"), {
	  center: new google.maps.LatLng(38.9, -77.0),
	  zoom: 14,
	  mapTypeId: google.maps.MapTypeId.ROADMAP
	});
      }
      map.setCenter(new google.maps.LatLng((0.000001 * selectedSystem.lat),
					(0.000001 * selectedSystem.lng)));
    }

    function updateMapBox(mapBox) {
      drawMapBox(mapBox);
    }

    function initialize() {
      YUI().use('graphics', 'selector-css3', 'node', 'jsonp', 'jsonp-url', function (Y) {
      
    // draw the base page
    var mapBox = Y.one('#mapBox');
    drawMapBox(mapBox);
    bikeTrack = new google.maps.MVCArray([]);

    function prepareJSONPUrl(url, proxy, username) {
      return Y.Lang.sub(url, {
	callback: proxy,
	name: selectedSystem.name
      });
    }

    function handleSystemList(data) {
      updateSettingsBox(Y, data);
    }

    function handleSystemData(data) {
      updateDataBox(Y, data);
      updateMapBox();
    }

    function handleJSONPFailure() {
    }

    function handleJSONPTimeout() {
    }

      new Y.JSONPRequest('http://api.citybik.es/networks.json', {
	on: {
	  success: handleSystemList,
	  failure: handleJSONPFailure,
	  timeout: handleJSONPTimeout,
	  type: 'text/javascript'
	},
	timeout: 5000
      }).send();

      var urlTemplate = 'http://api.citybik.es/{name}.json?callback={callback}';
      var systemData = new Y.JSONPRequest(urlTemplate, {
	on: {
	  success: handleSystemData,
	  failure: handleJSONPFailure,
	  timeout: handleJSONPTimeout,
	  type: 'text/javascript'
	},
	timeout: 5000,
	format: prepareJSONPUrl
      });
      window.setInterval( function() {
	systemData.send();
      }, 10000);
    });
  }
  google.maps.event.addDomListener(window, 'load', initialize);
