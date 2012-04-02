$(function(){
  // START!
  app = {};
  // First, we fetch data from Server...
  
  $.get('/api/user', function(data){
      log(data);
      app.user = new User(data);
      $('body').addClass('logged').removeClass('not-logged');
      app.router = new FRouter();
      var route_has_run = Backbone.history.start({pushState: true});
      
      if(!route_has_run) app.router.navigate('home', {trigger: true});
      
      
      app.router.prevent_default_href('#navbar a, #settings a, #option_menu a, nav a, #start a, a.route'); //will invalidate EXTERNAL links as well: TODO: be explicit...
      
      
    });
    
    
  // TODO: The ROutes arent running, create a basic nav...
  
})