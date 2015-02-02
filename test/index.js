var fack = require('../');

var app = fack.express();

app.get('/', function (req, res) {
    res.render('index');
});

app.start();
