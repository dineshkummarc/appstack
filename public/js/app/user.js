var User = Backbone.Model.extend({
  promptColor: function() {
    var cssColor = prompt("Please enter a CSS color:");
    this.set({color: cssColor});
  },
  
  initialize: function() { 
    // Fetch user from server...
    // do local stuff, possibly validation, units, etc
    console.log('user created locally');
    log(this);
  },

  author: function() {  },

  coordinates: function() {}
  
  
});

