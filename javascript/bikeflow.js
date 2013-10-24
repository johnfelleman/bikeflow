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
  var userLocation;

  // URL of SF network: http://bayareabikeshare.com/stations/json/

  // some google maps classes and methods
  var  magnifier = {
    onAdd: function() {
      // var magContent = Y.Node.create('<div id="mag-content">mag me up</div>').appendTo(
    },

    draw: function() {
    },

    onRemove: function() {
    }

  };

  function requestSystemList() {
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

  function displayUserLocation(element) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
	function(position) {
	  userLocation = new google.maps.LatLng(position.coords.latitude,
						position.coords.longitude);
	  requestSystemList();
	  console.log('getCurrentPosition returned ' + position.coords.latitude + ', ' +
			position.coords.longitude);
	  element.setHTML(position.coords.latitude.toFixed(3) +
		  ', ' + position.coords.longitude.toFixed(3));
	},
	function showError(error) {
	  console.log('getCurrentPosition returned ' + error.code);
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
      console.log('no geolocation');
      userLocation = new google.maps.LatLng(38.894, -76.948);
      requestSystemList();
      element.setHTML('38.894, -76.948');
      // element.setHTML('Your browser does not support gelocation');
    }
  }
  magnifier.prototype = new google.maps.OverlayView();

  function setSystemCoordinates() {
    Y.one('p#system-lat-lng').setHTML('System coordinates: ' +
      (0.000001 * systemList[selectedSystemIndex].lat).toFixed(3) +
      ', ' +
      (0.000001 * systemList[selectedSystemIndex].lng).toFixed(3));
    systemMap.setCenter(new google.maps.LatLng((0.000001 *
	  systemList[selectedSystemIndex].lat),
	      (0.000001 * systemList[selectedSystemIndex].lng)));
    }

  function changeSelectedSystem() {
    selectedSystemIndex = parseInt(Y.one('p select#system-list').get('value'));
    if (bikeTrack) {
      bikeTrack.clear();
    }
  }

  function setSelectedSystem() {
    var urlTemplate = 'http://api.citybik.es/{name}.json?callback={callback}';

    if (bikeTrack) {
      bikeTrack.clear();
    }
    if (dataTimer) {
      window.clearInterval(dataTimer);
    }
    setSystemCoordinates();
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
    
    // Some systems return the info as strings
    // For simplicity, we check one value and then branch as needed.
    if (typeof systemData[0].bikes === 'string') {
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
    var newPoint = new google.maps.LatLng(bikeLatAvgDeg, bikeLngAvgDeg);
    switch (bikeTrack.push(newPoint)) {
	case 1:
	  new google.maps.Marker({
	  position: newPoint,
	  map: systemMap,
	  title: "Initial Center of Bikes"
	});
	systemMap.setCenter(newPoint);
	break;

	case 2:
	bikeCenter = new google.maps.Polyline({
	  path: bikeTrack,
	  strokeColor: '#FF0000',
	  strokeOpacity: 1.0,
	  strokeWeight: 3
	});
	bikeCenter.setMap(systemMap);
	break;

	default:
	break;
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

  function handleSystemList(data) {
    systemList = data;
    Y.Array.each(systemList, function(system, value) {
      system.distanceAway = sphCosDist((0.000001 * system.lat),
					  (0.000001 * system.lng),
					  userLocation.lat(),
					  userLocation.lng());
      console.log(system.distanceAway + 'km from ' + system.name + ' at ' +
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

  function initialize() {

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
	  changeSelectedSystem()
	  setSelectedSystem();
	  updateSettingsBox();
	});
      });
      
    systemMap = new google.maps.Map(document.getElementById("map_canvas"), {
      zoom: 14,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    });

    bikeTrack = new google.maps.MVCArray([]);
  }
  google.maps.event.addDomListener(window, 'load', initialize);
});
