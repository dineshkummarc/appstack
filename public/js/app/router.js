var FRouter = Backbone.Router.extend({
    routes: {
        '/': 'homepage',
        '/driver/:user_id': 'driver',
        '/passenger/:user_id': 'passenger',
        '/commute': 'location',
        '/location': 'location',
        '/dashboard': 'dashboard',
        '/reserve': 'reserve',
        '/pay': 'pay',
        '/search/:query': 'search',
        '/search/:query/p:page': 'search',
        '/help': 'help'
    },

    section: function (s) {
        log('section: ' + s);
        $('body').removeClass('dashboard promo location driver passenger').addClass(s);
        $('section').hide(0);
        $('section#' + s).show();
    },
    reserve: function (s) {
        this.section('reserve');
    },
    location: function (user_id) {
        this.section('location');
    },
    pay: function () {
        this.section('pay');
    },
    driver: function (user_id) {
        this.section('driver');
    },
    passenger: function (user_id) {
        this.section('passenger');
    },
    homepage: function () {
        log('homepage');
        if (app.user) { //if there's a user...
            this.dashboard();
        } else {
            this.promo();
        }
    },
    dashboard: function () {
        this.section('dashboard');
    },
    promo: function () {
        this.section('promo');
    },
    help: function () {
        alert('help');
    },
    search: function (query, page) {
        log(query);
    },



    prevent_default_href: function (css_selector) {
        $(css_selector).click(function (e) {
            //alert('click!');
            var h = $(this).attr('href');
            log('ROUTE: '+h);
            if ((h.indexOf('http://') != 0) && (!$(this).hasClass('norun')) && (h != "")) { // if it's not an external link...
                // TODO: if CTRL key was pressed, let default happen... (open in a new page...)
                e.preventDefault();
                app.router.navigate(h, true);
                //return false;
            }
        })
    }


});