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

function sphCosDist(lat1, lon1, lat2, lon2) {
  var R = 6371; // km
  var lat1 = lat1 * Math.PI / 180.0;
  var lat2 = lat2 * Math.PI / 180.0;
  var lon1 = lon1 * Math.PI / 180.0;
  var lon2 = lon2 * Math.PI / 180.0;
  return Math.acos(Math.sin(lat1)*Math.sin(lat2) + 
                  Math.cos(lat1)*Math.cos(lat2) *
		                    Math.cos(lon2-lon1)) * R;
}

function haversineDist(lat1, lon1, lat2, lon2) {
  var R = 6371; // km
  var lat1 = lat1 * Math.PI / 180.0;
  var lat2 = lat2 * Math.PI / 180.0;
  var lon1 = lon1 * Math.PI / 180.0;
  var lon2 = lon2 * Math.PI / 180.0;
  var dLat = (lat2-lat1);
  var dLon = (lon2-lon1);

  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

function bearingAtoB(a, b) {
  var lat1 = a.lat() * Math.PI / 180.0;
  var lat2 = b.lat() * Math.PI / 180.0;
  var lon1 = a.lng() * Math.PI / 180.0;
  var lon2 = b.lng() * Math.PI / 180.0;
  var dLon = lon2 - lon1;

  var y = Math.sin(dLon) * Math.cos(lat2);
  var x = Math.cos(lat1)*Math.sin(lat2) -
        Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
  return Math.atan2(y, x) * 180.0 / Math.PI;
}

var yui = YUI().use(
    'graphics',
    'selector-css3',
    'node',
    'jsonp',
    'jsonp-url',
    'querystring-parse-simple',
    function (Y) {
  
  // globals
  var ajaxTimeout, refreshTime;
  var showStations = true;
  var systemMap;
  var bikeTrack;
  var selectedSystemIndex = 0;
  var systemList;
  var systemData;
  var prevBikesAtSta;
  var stationDeltas;
  var stationMarkers;
  var userLocation;
  var iterations = 0;
  var bikeMark;
  var groups = [];
  var activeGroups = [];
  var prevPoint, prevBearing, prevDistance;
  
  var queryValues = Y.QueryString.parse(window.location.search.slice(1));

  if (queryValues.cbStage && queryValue.cbStage == "true") {
    cbBaseUrl = "http://staging.citybik.es/";
    cbUrlExt = '';
  } else {
    cbBaseUrl = "http://api.citybik.es/";
    cbUrlExt = '.json';
  }

  function doLog(message) {
    console.log(new Date().toLocaleString() + ': ' + message);
  }

  function doNotLog(message) {}

  var logThis = (queryValues.logging && queryValues.logging == "true") ? doLog : doNotLog;
  logThis('logging is on');

  var  magnifier = {
    onAdd: function() {
      // var magContent = Y.Node.create('<div id="mag-content">mag me up</div>').appendTo(
    },

    draw: function() {
    },

    onRemove: function() {
    }

  };

  function displayUserLocation(element) {

    function handleSystemList(data) {
      systemList = data;
      Y.Array.each(systemList, function(system, value) {
	system.distanceAway = sphCosDist((0.000001 * system.lat),
					    (0.000001 * system.lng),
					    userLocation.lat(),
					    userLocation.lng());
	logThis(system.distanceAway + 'km from ' + system.name + ' at ' +
	  (0.000001 * system.lat) + ', ' +
	  (0.000001 * system.lng) + ', ' +
	  userLocation.lat() + ', ' +
	  userLocation.lng());
      });
      sortSystems( Y.one('input.sort:checked').get('value'));
      if (Storage && localStorage.selectedSystemName) {
	Y.Array.each(systemList, function(system, value) {
	  if (system.name === localStorage.selectedSystemName) {
	    selectedSystemIndex = value;
	    return true;
	  }
	});
      }
      setSelectedSystem();
      updateSettingsBox();
    }

    function requestSystemList() {
      new Y.JSONPRequest(cbBaseUrl + 'networks' + cbUrlExt, {
	on: {
	  success: handleSystemList,
	  failure: handleJSONPFailure,
	  timeout: handleJSONPTimeout,
	  type: 'text/javascript'
	},
	timeout: 5000
      }).send();
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
	function(position) {
	  userLocation = new google.maps.LatLng(position.coords.latitude,
						position.coords.longitude);
	  requestSystemList();
	  logThis('getCurrentPosition returned ' + position.coords.latitude + ', ' +
			position.coords.longitude);
	  element.setHTML(position.coords.latitude.toFixed(3) +
		  ', ' + position.coords.longitude.toFixed(3));
	},
	function showError(error) {
	  logThis('getCurrentPosition returned ' + error.code);
	  switch(error.code) {
	    case error.PERMISSION_DENIED:
	    userLocation = new google.maps.LatLng(38.894, -76.948);
	    requestSystemList();
	    element.setHTML('38.894, -76.948');
	    // element.setHTML('Enable user location to see and use your position');
	    break;

	    case error.POSITION_UNAVAILABLE:
	    case error.TIMEOUT:
	    case error.UNKNOWN_ERROR:
	    userLocation = new google.maps.LatLng(38.894, -76.948);
	    requestSystemList();
	    element.setHTML('I am unable to determine your current location.');
	    break;
	  }
	});
    } else {
      logThis('no geolocation');
      userLocation = new google.maps.LatLng(38.894, -76.948);
      requestSystemList();
      element.setHTML('38.894, -76.948');
      // element.setHTML('Your browser does not support gelocation');
    }
  }
  magnifier.prototype = new google.maps.OverlayView();

  function setSelectedSystem() {
    var urlTemplate = cbBaseUrl + '{name}' + cbUrlExt + '?callback={callback}';
    var dataTimer;
    prevBikesAtSta = [];
    stationDeltas = [];
    stationMarkers = [];
    activeGroups = [];

    function setSystemCoordinates() {
      Y.one('p#system-lat-lng').setHTML('System coordinates: ' +
	(0.000001 * systemList[selectedSystemIndex].lat).toFixed(3) +
	', ' +
	(0.000001 * systemList[selectedSystemIndex].lng).toFixed(3));
      systemMap.setCenter(new google.maps.LatLng(( 0.000001 * systemList[selectedSystemIndex].lat),
		(0.000001 * systemList[selectedSystemIndex].lng)));
      }

    function startMapping(data) {
      Y.Array.each(data, function(station, index) {
	stationDeltas[index] = 0;
	prevBikesAtSta[index] = station.bikes;
	stationMarkers[index] = new google.maps.Marker({
	  position: new google.maps.LatLng(0.000001 * station.lat, 0.000001 * station.lng),
	  map: systemMap,
	  icon: {
	      path: google.maps.SymbolPath.CIRCLE,
	      fillColor: 'black',
	      fillOpacity: 0.5,
	      strokeWeight: 1,
	      scale: 1
	  },
	  title: station.name
	});
      });
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
	}, 5000);
      }

    if (bikeTrack) {
      bikeTrack.clear();
    }
    if (dataTimer) {
      window.clearInterval(dataTimer);
    }
    setSystemCoordinates();
    new Y.JSONPRequest(urlTemplate, {
      on: {
	  success: startMapping,
	  failure: handleJSONPFailure,
	  timeout: handleJSONPTimeout,
	  type: 'text/javascript'
	},
	  timeout: 5000,
	  format: prepareJSONPUrl
	}).send();
    if (typeof(Storage)) {
      localStorage.selectedSystemName = systemList[selectedSystemIndex].name;
      localStorage.sortMethod = Y.one('input.sort:checked').get('value');
    }
  }

  // Functions to draw or redraw each box
  function updateSettingsBox() {
    var systemOptions = "";
    
    Y.Array.each(systemList, function(system,value) {
      systemOptions += '\t<option value="' + value + '" ' ;
      systemOptions += ((value === selectedSystemIndex) ?
	    'selected' : '') ;
      systemOptions += '>' + system.name + ' (' + system.distanceAway.toFixed(0) + 'km)</option>\n';
    });
    Y.one('#system-list').setHTML(systemOptions);
  }

  function drawDataBox() {
    var bikeLatAccE6 = 0, bikeLngAccE6 = 0, dockLatAccE6 = 0, dockLngAccE6 = 0,
      bikesAcc = 0, docksAcc = 0, bikeCenter;
    var a, c, d;
    var R = 6371 / 1.609344; // miles
    var maxBikes = 0, bikeOldLatDeg, bikeOldLngDeg, bikeLatAvgDeg, bikeLngAvgDeg;
    var icon, color;
    var bikon;
    var currentBearing;
    
    logThis('Iteration: ' + iterations + ' map center: ' + systemMap.getCenter().toString() +
			' zoom: ' + systemMap.getZoom());
    iterations++;
    if (typeof systemData[0].bikes === 'string') {
      alert('stringto number failed');
    } else {
      Y.Array.each(systemData, function(station,value){

	// Do the math
	var bikes = station.bikes;
	var docks = station.free;
	var delta = Math.floor(stationDeltas[value]);
	station.lat *= 0.000001;
	station.lng *= 0.000001;
	bikesAcc += bikes;
	bikeLatAccE6 += bikes * station.lat;
	bikeLngAccE6 += bikes * station.lng;
	docksAcc += docks;
	dockLatAccE6 += docks * station.lat;
	dockLngAccE6 += docks * station.lng;

	// Then the graphics
	stationMarkers[value].setTitle(iterations + ' ' + station.name +
	      '\nbikes/docks (\u0394)\n' + station.bikes + '/' + station.free + '(' + delta + ')');
	icon =  stationMarkers[value].getIcon();
	icon.scale = 0.6 *bikes;
	icon.strokeWeight = docks / 2;
	icon.fillOpacity = bikes / (bikes + docks),
	color = (delta > 0) ? 'ff0000' : ((delta === 0) ? '000000' : '00ff00' );
	icon.strokeColor = color;
	icon.fillColor = color;
	icon.fillOpacity = 0.5;
	stationMarkers[value].setIcon(icon);
      });
    }

    Y.Array.each(activeGroups, function(thisGroup, index) {
      thisGroup.bikes = 0;
      thisGroup.docks = 0;
      thisGroup.delta = 0;
      Y.Array.each(thisGroup.stations, function(station, index) {
	thisGroup.bikes += systemData[station].bikes;
	thisGroup.docks += systemData[station].free;
	thisGroup.delta += stationDeltas[index];
      });
      console.log(Date().toLocaleString() + ': Group ' + thisGroup.name + '\n\tbikes: ' +
      thisGroup.bikes + '\tdocks: ' + thisGroup.docks + '\tdelta: ' + thisGroup.delta);
    });
    // More math
    bikeLatAvgDeg = bikeLatAccE6 / bikesAcc;
    bikeLngAvgDeg = bikeLngAccE6 / bikesAcc;
    dockLatAvgDeg = dockLatAccE6 / docksAcc;
    dockLngAvgDeg = dockLngAccE6 / docksAcc;
    if (bikesAcc > maxBikes) {
      maxBikes = bikesAcc;
    }
    var currentPoint = new google.maps.LatLng(bikeLatAvgDeg, bikeLngAvgDeg);
    // debug code
    if (!prevPoint) { logThis('no previous point');}
    else if (prevPoint === currentPoint) { logThis('current point same as pre point'); }
    else {logThis('computed bearing: ' + bearingAtoB(prevPoint, currentPoint) + 180.0); }
    currentBearing = (prevPoint && prevPoint != currentPoint) ?
	  (bearingAtoB(prevPoint, currentPoint) + 180.0) :
	  ((prevBearing) ? prevBearing : 0.0);

    // DOM
    Y.one('#zero-two').set('text', bikesAcc);
    Y.one('#one-two').set('text', maxBikes);
    Y.one('#two-two').set('text', docksAcc);
    Y.one('#three-two').set('text', ( bikeLatAvgDeg.toFixed(3) +
	', ' + bikeLngAvgDeg.toFixed(3)));

    // Map
    var starkon = {
      anchor: new google.maps.Point(0,14),
      url: 'images/purpletarget.png'
    }
    bikon = {
      anchor: new google.maps.Point(0,18),
      origin: new google.maps.Point(36 * currentBearing / 16.0, 0),
      // scaledSize: new google.maps.Size(36, 36),
      size: new google.maps.Size(36, 36),
      url: 'images/bike_sprite-36-purple.png'
    }
    if (bikeMark) {
      bikeMark.setMap(null);
    }
    bikeMark = new google.maps.Marker({
      position: currentPoint,
      icon:bikon,
      map: systemMap,
      title: 'Current center:\n' + new Date().toLocaleString() + '\n' +
		currentPoint.lat().toFixed(3) + ', ' + currentPoint.lng().toFixed(3) +
		    '\nBearing:' + currentBearing.toFixed(0) + '\nVelocity:' + 'coming soon'
    });
    switch (bikeTrack.push(currentPoint)) {

	case 1:
	// TODO Load the weathervane
	/*
	new google.maps.Marker({
	  position: currentPoint,
	  draggable: true,
	  icon: 'images/bikeVane.png',
	  map: systemMap,
	  title: 'Start tracking:\n' + new Date().toLocaleString() + '\n' +
		currentPoint.lat().toFixed(3) + ', ' + currentPoint.lng().toFixed(3)
	});
	*/
	new google.maps.Marker({
	  position: currentPoint,
	  icon: starkon,
	  map: systemMap,
	  title: 'Start tracking:\n' + new Date().toLocaleString() + '\n' +
		currentPoint.lat().toFixed(3) + ', ' + currentPoint.lng().toFixed(3)
	});
	systemMap.setCenter(currentPoint);
	break;

	case 2:
	bikeCenter = new google.maps.Polyline({
	  path: bikeTrack,
	  strokeColor: 'a600d6',
	  strokeOpacity: 1.0,
	  strokeWeight: 2
	});
	bikeCenter.setMap(systemMap);
	break;

	default:
	break;
      }

    // And a little more math
    prevPoint = currentPoint;
    if (currentBearing) {
      prevBearing = currentBearing;
    }
  }

  function handleSystemData(data) {
    Y.Array.each(data, function(station, index) {
      stationDeltas[index] = stationDeltas[index] / 2 + 16 * (station.bikes - prevBikesAtSta[index]);
      prevBikesAtSta[index] = station.bikes;
    });

    systemData = data;

    // if data was returned as strings, convert to numbers
    if (typeof systemData[0].bikes === 'string') {
      Y.Array.each(systemData, function(station,value){
	station.bikes = parseInt(station.bikes);
	station.free = parseInt(station.free);
	station.lat = parseInt(station.lat);
	station.lng = parseInt(station.lng);
      });
    }

    drawDataBox();
  }

  function handleJSONPFailure() {
  }

  function handleJSONPTimeout() {
  logThis('ajax call timed out after ' + ajaxTimeout + ' seconds.');
  }

  function prepareJSONPUrl(url, proxy, username) {
    return Y.Lang.sub(url, {
      callback: proxy,
      name: systemList[selectedSystemIndex].name
    });
  }

  function sortSystems(key) {
    var comparator;
    switch (key) {
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
	var dista = sphCosDist((0.000001 * a.lat), (0.000001 * a.lng), userLocation.lat(),
	      userLocation.lng());
	var distb = sphCosDist((0.000001 * b.lat), (0.000001 * b.lng), userLocation.lat(),
	      userLocation.lng());
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
  }


  // use this service for info about location someday:
  // http://askgeo.com/#web-api

  function initialize() {

    function changeSelectedSystem() {
      selectedSystemIndex = parseInt(Y.one('p select#system-list').get('value'));
      prevBikesAtSta.length = 0;
      stationDeltas.length = 0;
      iterations = 0;
      if (bikeTrack) {
	bikeTrack.clear();
      }
    }

    function changeSortMethod() {
      var saveSelected = systemList[selectedSystemIndex].name;
      sortSystems(Y.one('input.sort:checked').get('value'));
      Y.Array.each(systemList, function(system, value) {
	if (system.name === saveSelected) {
	  selectedSystemIndex = value;
	}
      });
      if (typeof(Storage)) {
	localStorage.sortMethod = Y.one('input.sort:checked').get('value');
      }
      updateSettingsBox();
    }

    var bbCoords;
    var groupButton = Y.one('button#create-group');
    var group = {};
    var splot;
    var groupBB;
    groupButton.on('click', function() {
      if (groupButton.get('value') === 'Finish') {
	splot.setDraggable(false);
	splot.setEditable(false);
	groupButton.set('value', 'Start');
	groupButton.set('text', 'Start');

	var center = splot.getCenter();
	var yRad = splot.getRadius() / 111000;
	var xRad = yRad / Math.cos(center.lat() * Math.PI / 180.0);
	bbCoords = {
	    ll: new google.maps.LatLng(center.lat() - yRad, center.lng() - xRad),
	    ul: new google.maps.LatLng(center.lat() + yRad, center.lng() - xRad),
	    ur: new google.maps.LatLng(center.lat() + yRad, center.lng() + xRad),
	    lr: new google.maps.LatLng(center.lat() - yRad, center.lng() + xRad),
	};

	groupBB = new google.maps.Polygon({
	  clickable: false,
	  map: systemMap,
	  paths: [ bbCoords.ll, bbCoords.ul, bbCoords.ur, bbCoords.lr ],
	  visible: false
	});
	
	group.splot = splot;
	group.system = systemList[selectedSystemIndex].id;
	group.stations = [];
	group.name = 'group no.: ' + groups.length;
	console.log('creating ' + group.name);

	Y.Array.each(stationMarkers, function(station, value) {
	  // Check each station to see if it is in the circle
	  // first check against a bounding box, then do a more precise check
	  if (google.maps.geometry.poly.containsLocation(station.getPosition(), groupBB)) {
	    group.stations.push(value);
	    console.log('Added ' + station.title + ' to ' + group.name);
	  }
	});

      google.maps.event.addListener(splot, 'mouseover', function() {
          console.log('this was a mouseover');
      });
      google.maps.event.addListener(splot, 'mouseoff', function() {
          console.log('this was a mouseoff');
      });
      groups.push(group);
      activeGroups.push(group);
      } else {
	splot = new google.maps.Circle({
	  center: systemMap.getCenter(),
	  map: systemMap,
	  fillColor: 'red',
	  fillOpacity: 0.3,
	  strokeWeight: 1,
	  strokeColor: 'red',
	  strokeOpacity: 1.0,
	  radius: 300,
	  editable: true,
	  draggable: true,
	  zindex: 100000,
	  title: 'Drag and resize to taste'
	});
	groupButton.set('value', 'Finish');
	groupButton.set('text', 'Finish');
      }
    });

    if (Storage && localStorage.selectedSystemIndex) {
      Y.one('input.sort[value="' + localStorage.sortMethod + '"]').
	    setAttribute('checked', 'checked');
    }
    displayUserLocation(Y.one('#user-coordinates'));
    Y.all('input.sort').on('click', changeSortMethod);
    Y.one('p select#system-list').
      on('change', function() {
	this.siblings('button#change-system-button').
	removeAttribute('disabled').
	on('click', function() {
	  this.setAttribute('disabled');
	  changeSelectedSystem();
	  setSelectedSystem();
	  updateSettingsBox();
	});
      });
      
    systemMap = new google.maps.Map(document.getElementById("map_canvas"), {
      zoom: 14,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    });
	var circle = new google.maps.Circle({
	  center: systemMap.getCenter(),
	  map: systemMap,
	  fillColor: 'red',
	  fillOpacity: 1.0,
	  strokeWeight: 1,
	  strokeColor: 'red',
	  strokeOpacity: 1.0,
	  radius: 3000
	});

    bikeTrack = new google.maps.MVCArray([]);
  }
  google.maps.event.addDomListener(window, 'load', initialize);
});
