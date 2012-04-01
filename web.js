var async = require('async');
var express = require('express');
var util = require('util');
var gm      = require('googlemaps');  //https://github.com/moshen/node-googlemaps/blob/master/lib/googlemaps.js
/*
var geohash = require("geohash").GeoHash;

var _       = require('underscore')._;
*/

///////////////////////////////////////////////////////////////////
//    Database
////////////////////////////////////////////////////////////////
// app.js
var databaseUrl = process.env.MONGOHQ_URL; //""; // "username:password@example.com/mydb"
var collections = ["users", "events"]
var db = require("mongojs").connect(databaseUrl, collections);

db.users.ensureIndex({id:1});  //info: http://www.mongodb.org/display/DOCS/Indexes


//geo loc indexes
db.users.ensureIndex({'home.loc': '2d' }); 
db.users.ensureIndex({'work.loc': '2d' }); 




///////////////////////////////////////////////////////////////////
//    DB EXAMPLES
////////////////////////////////////////////////////////////////

// examples....  (http://howtonode.org/node-js-and-mongodb-getting-started-with-mongojs)
/*
db.users.find({sex: "female"}, function(err, users) {
  if( err || !users) console.log("No female users found");
  else users.forEach( function(femaleUser) {
    console.log(femaleUser);
  } );
});

db.users.save({email: "srirangan@gmail.com", password: "iLoveMongo", sex: "male"}, function(err, saved) {
  if( err || !saved ) console.log("User not saved");
  else console.log("User saved");
});

db.users.update({email: "srirangan@gmail.com"}, {$set: {password: "iReallyLoveMongo"}}, function(err, updated) {
  if( err || !updated ) console.log("User not updated");
  else console.log("User updated");
});
*/


//var ArticleProvider = require('./articleprovider-mongodb').ArticleProvider;
//var articleProvider = new ArticleProvider('localhost', 27017); //mongo host
///////////////////////////////////////////////////////////////////
//    Express server setup
////////////////////////////////////////////////////////////////

// create an express webserver
var app = express.createServer(
express.logger(), express.static(__dirname + '/public'), express.bodyParser(),
//express.bodyDecoder(), //for stripe??
express.cookieParser(),
// set this to a secret value to encrypt session cookies
express.session({
    secret: process.env.SESSION_SECRET || 'topsecret55887456'
}), require('faceplate').middleware({
    app_id: process.env.FACEBOOK_APP_ID,
    secret: process.env.FACEBOOK_SECRET,
    scope: 'user_likes,user_photos,user_photo_video_tags,email,user_work_history,location,friends,languages,user_website' 
    //NOTE: SCOPE is set on CLIENT SIDE TOKEN!
}));

app.debug = true;

//app.use(Session);
//app.use(express.bodyParser()); //used to parse posted JSON //already there...
// listen to the PORT given to us in the environment
var port = process.env.PORT || 3000;

app.listen(port, function () {
    console.log("Listening on " + port);
});

app.dynamicHelpers({
    'host': function (req, res) {
        return req.headers['host'];
    },
    'scheme': function (req, res) {
        req.headers['x-forwarded-proto'] || 'http'
    },
    'url': function (req, res) {
        return function (path) {
            return app.dynamicViewHelpers.scheme(req, res) + app.dynamicViewHelpers.url_no_scheme(path);
        }
    },
    'url_no_scheme': function (req, res) {
        return function (path) {
            return '://' + app.dynamicViewHelpers.host(req, res) + path;
        }
    },
});

function render_page(req, res) {
    req.facebook.app(function (app) {
        req.facebook.me(function (user) {
            res.render('index.ejs', {
                layout: false,
                req: req,
                app: app,
                user: user
            });
        });
    });
}


///////////////////////////////////////////////////////////////////
//    email server
////////////////////////////////////////////////////////////////
var SendGrid = require('sendgrid').SendGrid;
var sendgrid = new SendGrid(
process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD);

app.get('/emailme', function (req, res) { //testing route - should work locally as well once .env is populated with credential
    sendgrid.send({
        to: 'info@iplanwebsites.com',
        from: 'test@example.com',
        subject: 'test',
        text: 'Sending email with NodeJS through SendGrid!'
    }, function () {
        res.send('email sent!'); //handle error callback??
    });
});



///////////////////////////////////////////////////////////////////
//    Payment Provider  //tut: http://www.catonmat.net/blog/stripe-payments-with-node/
////////////////////////////////////////////////////////////////
var stripe_secret = process.env.STRIPE_SECRET;
var stripe_secret_dev = process.env.STRIPE_SECRET_DEV;

var stripe = require('stripe')(stripe_secret_dev); //maybe publi key goes here??
//app = express.createServer(express.bodyDecoder);
app.post("/plans/browserling_developer", function (req, res) {
    stripe.customers.create({
        card: req.body.stripeToken,
        email: req.session.email, //  // customer's email (get it from db or session)"...",
        plan: "test" // this value has to be created on stripe.com as well...
    }, function (err, customer) {
        if (err) {
            var msg = customer.error.message || "unknown";
            res.send("Error while processing your payment: " + msg);
        } else {
            var id = customer.id;
            console.log('Success! Customer with Stripe ID ' + id + ' just signed up!');
            // save this customer to your database here!
            res.send('ok');
        }
    });
});


/*
app.get('/aaa', function (req, res) {
    // returns current user DATA in JSON.
    //req.session.test = "fat cat";
    res.send('data22aaaa'); //plain json
});*/


app.get('/pay', function (req, res) {
    res.render('pay_form.ejs', {
        title: 'New Template Page',
        layout: true
    });
});



///////////////////////////////////////////////////////////////////
//    FB connect  //http://howtonode.org/facebook-connect
////////////////////////////////////////////////////////////////
function handle_facebook_request(req, res) {

    // if the user is logged in
    if (req.facebook.token) {

        async.parallel([

        function (cb) {
            // query 4 friends and send them to the socket for this socket id
            req.facebook.get('/me/friends', {
                limit: 20
            }, function (friends) {
                req.friends = friends;
                cb();
            });
        }, function (cb) {
            // query 16 photos and send them to the socket for this socket id
            req.facebook.get('/me/photos', {
                limit: 16
            }, function (photos) {
                req.photos = photos;
                cb();
            });
        }, function (cb) {
            // query 4 likes and send them to the socket for this socket id
            req.facebook.get('/me/likes', {
                limit: 20
            }, function (likes) {
                req.likes = likes;
                cb();
            });
        }, function (cb) {
            // use fql to get a list of my friends that are using this app
            req.facebook.fql('SELECT uid, name, is_app_user, pic_square FROM user WHERE uid in (SELECT uid2 FROM friend WHERE uid1 = me()) AND is_app_user = 1', function (result) {
                req.friends_using_app = result;
                cb();
            });
        }], function () {
            render_page(req, res);
        });

    } else {
        render_page(req, res);
    }
}

///////////////////////////////////////////////////////////////////
//    Facebook user data fetch tries
////////////////////////////////////////////////////////////////



app.get('/', handle_facebook_request);
app.post('/', handle_facebook_request);

app.get('/echo', function (req, res) {
    echo = req.param("echo", "no param")
    res.send('ECHO: ' + echo);
});

app.get('/template', function (req, res) {
    res.render('test.ejs', {
        title: 'New Template Page',
        layout: true
    });
});

app.post('/posttest', function (req, res) {
    res.send(req.body);
});


app.get('/friends', function (req, res) {
    req.facebook.get('/me/friends', {
        limit: 5000
    }, function (friends) {
        //res.send('friends: ' + require('util').inspect(friends));
        res.send(friends); //plain json
    });
});

app.get('/me', function (req, res) {
    req.facebook.get('/me', {}, function (data) {
        //res.send('friends: ' + require('util').inspect(data));
        res.send(data); //plain json
    });
});

app.get('/me2', function (req, res) {
    req.facebook.get('/me', {
        fields: 'email, name, locale, work, languages, education, location, website,friends'
    }, function (data) {
        //res.send('' + require('util').inspect(data));
        res.send(data); //plain json
    });
});
/*
app.get('/me2', function (req, res) {
    req.facebook.get('/me', {
        fields: 'email, name, locale, work, languages, education, location, website,friends'
    }, function (data) {
        //res.send('' + require('util').inspect(data));
        res.send(data); //plain json
    });
});

app.get('/me3', function (req, res) {
    req.facebook.get('/me', {
        fields: 'email, name, locale, work, languages, education, location, website,friends'
    }, function (data) {
        //res.send('' + require('util').inspect(data));
        res.send(data); //plain json
    });
});

app.post('/api/setCity', function (req, res) {
    var id = '12345'
    db.users.update({
        id: id
    }, {
        $inc: {
            level: 1
        }
    }, {
        multi: false
    }, function (err) {
        // the update is complete
    });
});*/


///////////////////////////////////////////////////////////////////
//    USER methods
////////////////////////////////////////////////////////////////


/*
app.get('/ensuresession', function(req, res){ // sets session ID according to FB id
  if( (! req.session.uid) || (req.session.uid == undefined)){
    req.facebook.get('/me', { fields: 'id'}, function(data) {
        var id =  data.id ; //plain str
        req.session.uid = id;
        res.send(id); //res.send('uid (FB just setted) = ' + id );
      });
  }else{
    id = req.session.uid ;
    res.send( id ); //res.send('uid = '+ ' (session...)' + id );
  }
});*/


function ensureSession(req, res, callback){  // make sure that user is connected, and session are set
  // TODO, make sure the FB token exists as well, if not, redirect to homepage, don't call the callback...
  if( (! req.session.uid) || (req.session.uid == undefined)){
    req.facebook.get('/me', { fields: 'id'}, function(data) {
        var id =  data.id ; //plain str
        req.session.uid = id;
       console.log('uid (FB just setted) = ' + id );
       callback(req, res);
      });
  }else{
    console.log('uid = '+ ' (session...)' + id );
    callback(req, res);
    // id = req.session.uid ;
    
  }
}



/*
app.get('/aaa', function (req, res) {
    // returns current user DATA in JSON.
    //req.session.test = "fat cat";
    res.send('data22aaaa'); //plain json
});*/

app.get('/user', function(req, res){ // fetch data on facebook for our user, saves it to the database.
  
  
  // res.send('user');
  // if no facebook token, return error, ask to login...
  
  // 1.
  // check if user exist... (poll mongo...)
  // var uid = req.session.uid;

/*
   db.users.find({id: uid}, function(err, users) {
     if( err || !users) console.log("No female users found");
     else users.forEach( function(femaleUser) {
       console.log(femaleUser);
     } );
   });*/
   
   
  async.parallel([
    function (cb) {
        // query 4 friends and send them to the socket for this socket id
        req.facebook.get('/me/friends', {
            limit: 2000
        }, function (friends) {
            req.friends = friends;
            cb();
        });
    }, function (cb) {
        // query 16 photos and send them to the socket for this socket id
        req.facebook.get('/me', {
          fields: 'email, name, locale, work, languages, education, location, website, picture, gender, about, birthday' //add more fields as required, just make sure scope match...
          
        }, function (me) {
            req.me = me;
            cb();
        });
    }, function (cb) {
        // query 4 likes and send them to the socket for this socket id
        req.facebook.get('/me/likes', {
            limit: 20
        }, function (likes) {
            req.likes = likes;
            cb();
        });
    }, function (cb) {
        // use fql to get a list of my friends that are using this app
        req.facebook.fql('SELECT uid, name, is_app_user, pic_square FROM user WHERE uid in (SELECT uid2 FROM friend WHERE uid1 = me()) AND is_app_user = 1', function (result) {
            req.friends_using_app = result;
            cb();
        });
    }], function () { //Once we received all data from FB...
        

        //create user object to be inserted
        var user = {
            id: id,
            email: req.me.email, 
            sex: req.me.gender,
            birthday: req.me.birthday,
            
            photo: "http://graph.facebook.com/"+req.session.uid+"/picture?type=large",
            photo_square: "http://graph.facebook.com/"+req.session.uid+"/picture?type=square",
            
            friends: req.friends,
            me: req.me
          }
        
          db.users.save(user, function(err, saved) {
            if( err || !saved ) console.log("User not saved");
            else console.log("User saved");
          });
      
      
      
      
      
          // set sessions
          var id = req.me.id
          req.session.uid = id;
          req.session.email = req.me.email;
          
          
        res.send(user);
        //render_page(req, res);
    }); //eo async fb callback
  
});


//   /api/setlocation/?home=laval&work=montreal
// http://127.0.0.1:5000/api/setlocation?home=laval&work=montreal

//app.get('api/setlocation', function(req, res){ // fetch data on facebook for our user, saves it to the database.
 app.get('/setlocation', function(req, res){ // fetch data on facebook for our user, saves it to the database.
 
 // TODO: ENsure user is logged!
 
  ///:home/:work
  async.parallel([ // call google-maps for both addresses async
    function (cb) {
        gm.geocode(req.param("home") || 'montreal', function (err, data) {
            req.home = data.results[0];
            req.home['loc'] = [req.home.geometry.location.lng, req.home.geometry.location.lat];//for geospatial indexing
            cb();
            //var coords = data.results[0].geometry.location; //return the geometry of the top matching location...
            //res.send(coords);
        });
    }, function (cb) {
      gm.geocode(req.param("work") || 'toronto', function (err, data) {
          req.work = data.results[0];
          req.work['loc'] = [req.work.geometry.location.lng, req.work.geometry.location.lat]; //for geospatial indexing
          cb();
          //var coords = data.results[0].geometry.location; //return the geometry of the top matching location...
          //res.send(coords);
      });
    },
    function (cb) {
      // exports.distance = function(origins, destinations, callback, sensor, mode, alternatives, avoid, units, language){
      gm.distance(req.param("home")|| 'montreal', req.param("work")|| 'toronto', function (err, data) {
        req.commute = data.rows[0].elements[0]; //only keep distance + duration.
        cb();
          //var coords = data.results[0].geometry.location; //return the geometry of the top matching location...
          //res.send(coords);
      });
    }], function () { //Once we received all data from FB...

            var loc = {
                home: req.home,
                work: req.work,
                commute: req.commute,
                updated: new Date()
              }
              
              var uid = req.session.uid;
              db.users.update({id: uid}, {$set: {loc: loc}}, function(err, updated) {
                if( err || !updated ) console.log("User not updated: "+req.session.uid);
                else console.log("User updated");
              });
              
/*
              db.users.put(loc, function(err, saved) {
                if( err || !saved ) console.log("User not saved");
                else console.log("User saved");
              });*/

            res.send(loc);
            
        });//eo parrallel calls
      
  
  
  
});


///////////////////////////////////////////////////////////////////
//    Geo Location API V1
////////////////////////////////////////////////////////////////
app.get('/geohash/:id', function (req, res) {
    var latlon = geohash.decodeGeoHash(req.params['id']);
    lat = latlon.latitude[2];
    lon = latlon.longitude[2];
    zoom = req.params["id"].length + 2;
    res.render('geohash.ejs', {
        layout: false,
        lat: lat,
        lon: lon,
        zoom: zoom,
        geohash: req.params['id']
    });
});

app.get('/reverseGeo/:lat/:long', function (req, res) {
    gm.reverseGeocode('41.850033,-87.6500523', function (err, data) {
        util.puts(JSON.stringify(data));
        res.send(data);
    });
});

app.get('/getCoord/:address', function (req, res) {
    // var address = '520 rue fortune, montreal';
    var address = req.param("address", "montreal")
    gm.geocode(address, function (err, data) {
        util.puts(JSON.stringify(data));
        var coords = data.results[0].geometry.location; //return the geometry of the top matching location...
        res.send(coords);
    });
});



function getElevation(lat, lng, callback) {
    var options = {
        host: 'maps.googleapis.com',
        port: 80,
        path: '/maps/api/elevation/json?locations=' + lat + ',' + lng + '&sensor=true'
    };
    http.get(options, function (res) {
        data = "";
        res.on('data', function (chunk) {
            data += chunk;
        });
        res.on('end', function (chunk) {
            el_response = JSON.parse(data);
            callback(el_response.results[0].elevation);
        });
    });
};



///////////////////////////////////////////////////////////////////
//    FINI
////////////////////////////////////////////////////////////////

/*
function get_distance(points) { //return the computed driving distance from google maps API
getElevation(40.714728,-73.998672, function(elevation){
  elevations.push(elevation);

elevations.push(elevation);
console.log("Elevations: "+elevations); });

var elevations= []
};
*/

//})