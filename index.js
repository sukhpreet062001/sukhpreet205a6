let express = require('express')
let exphbs  = require('express-handlebars')
const sessions = require('express-session');

const { Client } = require('pg')

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

client.connect()

let app = express()
let router = express.Router()

const oneDay = 1000 * 60 * 60 * 24;
app.use(sessions({
    secret: "secretKey",
    saveUninitialized:true,
    cookie: { maxAge: oneDay },
    resave: false 
}));

let session, cartid, globaluser;

app.use(express.urlencoded({ extended: true }))
app.engine('handlebars', exphbs.engine())
app.set('view engine', 'handlebars')

let hbs = exphbs.create({})
hbs.handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
})

router.get('/', function (req, res) {
  res.render('home')
})

router.get('/home', function (req, res) {
  res.render('home')
})

router.get('/plans', function (req, res) {
  const query = {
    name: 'fetch-plans',
    text: 'SELECT * FROM plans'
  }
  
  client.query(query, (err, response) => {
    if (err) {
      console.log(err.stack)
    } else {
      console.log(req.session.userid);
      res.render('cwh', {data: [response.rows, req.session.userid]});
    }
  })
})

router.get('/plans/:id', function(req, res){
  if(req.session.userid === 'admin') {
    const query = {
      name: 'fetch-plan',
      text: 'SELECT * FROM plans WHERE id=$1',
      values: [req.params.id]
    }
    
    client.query(query, (err, response) => {
      if (err) {
        console.log(err.stack)
      } else {
        res.render('edit', {plan: response.rows[0]})
      }
    })
  } else {
    res.redirect('/plans');
  }
})

router.post('/plans/edit', function(req, res) {
  let id = req.body.id
  let plan = req.body.plan
  let cost = req.body.cost
  let websites = req.body.websites
  let storage = req.body.storage
  let visits = req.body.visits
  let emails = req.body.emails
  let ssl = req.body.ssl
  let domains = req.body.domains
  let bandwidth = req.body.bandwidth
  let featured = req.body.featured ?? "NO"

  const query = {
    name: 'update-plan',
    text: `UPDATE plans SET plan=$1, cost=$2, websites=$3, storage=$4, visits=$5, emails=$6, ssl=$7, domains=$8, bandwidth=$9, featured=$10 WHERE id=$11`,
    values: [plan, cost, websites, storage, visits, emails, ssl, domains, bandwidth, featured, id]
  }
  
  client.query(query, (err, response) => {
    if (err) {
      console.log(err.stack)
    } else {
      res.redirect('/plans')
    }
  })
})

router.get('/dashboard', function(req, res) {
  let data = {
    name: req.query.name,
    username: req.query.user,
    admin: req.query.admin
  }
  globaluser = data.username;
  
  if(data.name !== undefined && data.username !== undefined) {
    if(req.session.userid) {
      res.render('dashboard', data)
    }
  } else {
    res.redirect('/login')
  }
})

router.post('/dashboard', function(req, res) {
  let plan = req.body.plan
  let cost = req.body.cost
  let websites = req.body.websites
  let storage = req.body.storage
  let visits = req.body.visits
  let emails = req.body.emails
  let ssl = req.body.ssl
  let domains = req.body.domains
  let bandwidth = req.body.bandwidth
  let featured = req.body.featured ?? "NO"

  const query = {
    name: 'create-plan',
    text: `INSERT INTO plans (plan, cost, websites, storage, visits, emails, ssl, domains, bandwidth, featured) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    values: [plan, cost, websites, storage, visits, emails, ssl, domains, bandwidth, featured]
  }
  
  client.query(query, (err, response) => {
    if (err) {
      console.log(err.stack)
    } else {
      res.redirect('/plans')
    }
  })
})

router.get('/registration', function (req, res) {
  res.render('registration')
})

router.post('/registration', function (req, res) {
  let username = req.body.username
  let password = req.body.password
  let fullname = req.body.fullname
  let company = req.body.company
  let address = req.body.address
  let phone = req.body.phone
  let admin = req.body.admin ?? "FALSE"

  let usernameError = "", passwordError = "", fullnameError = "", companyError = "", addressError = "", phoneError = "";

  let usernamePattern = /^[a-zA-Z0-9]*$/
  let passwordPattern = /^([a-zA-Z0-9]){6,12}$/
  let fullnamePattern = /^([a-z\s]|[A-Z\s]){1,30}$/ //Maximum 30 characters
  let companyPattern = /^([a-z\s]|[A-Z\s]){1,20}$/
  let addressPattern = /^([a-z\s]|[A-Z\s]){1,100}$/
  let phonePattern = /^([0-9]){1,14}$/

  if(username.trim().length === 0) {
    usernameError = "Username cannot be empty"
  } else if(!usernamePattern.test(username)) {
    usernameError = "Username cannot contain special characters"
  }

  if(password.trim().length === 0) {
    passwordError = "Password cannot be empty"
  } else if(!passwordPattern.test(password)) {
    passwordError = "Password should be 6 to 12 characters long"
  }

  if(fullname.trim().length === 0) {
    fullnameError = "Fullname cannot be empty"
  } else if(!fullnamePattern.test(fullname)) {
    fullnameError = "Fullname should be less than 30 characters"
  }

  if(company.trim().length === 0) {
    companyError = "Company name cannot be empty"
  } else if(!companyPattern.test(company)) {
    companyError = "Company Name should be less than 20 characters"
  }

  if(address.trim().length === 0) {
    addressError = "Address cannot be empty"
  } else if(!addressPattern.test(address)) {
    addressError = "Address should be less than 100 characters"
  }

  if(phone.trim().length === 0) {
    phoneError = "Phone cannot be empty"
  } else if(!phonePattern.test(phone)) {
    phoneError = "Phone should contain less than 15 digits"
  }

  if(usernameError.length === 0 && passwordError.length === 0 && fullnameError.length === 0 && companyError.length === 0 && addressError.length === 0 && phoneError.length === 0) {
    
    const query = {
      name: 'create-user',
      text: `INSERT INTO users (username, password, fullname, company, address, phone, admin) VALUES ($1, crypt($2, gen_salt('bf')), $3, $4, $5, $6, $7)`,
      values: [username, password, fullname, company, address, phone, admin]
    }
    
    client.query(query, (err, response) => {
      if (err) {
        console.log(err.stack)
      } else {
        res.redirect('/login');
      }
    })
  } else {
    res.render('registration', {
      usernameError: usernameError,
      passwordError: passwordError,
      fullnameError: fullnameError,
      companyError: companyError,
      addressError: addressError,
      phoneError: phoneError,
      usernameSent: username,
      passwordSent: password,
      fullnameSent: fullname,
      companySent: company,
      addressSent: address,
      phoneSent: phone,
    })
  }
})

router.get('/login', function (req, res) {
  res.render('login')
})

router.post('/login', function(req, res) {
  let username = req.body.username
  let password = req.body.password

  let usernameError = "", passwordError = "";

  let usernamePattern = /[a-zA-Z0-9]/

  if(username.trim().length === 0) {
    usernameError = "Username cannot be empty"
  } else if(!usernamePattern.test(username)) {
    usernameError = "Username cannot contain special characters"
  }

  if(password.trim().length === 0) {
    passwordError = "Password cannot be empty"
  }

  if(usernameError.length === 0 && passwordError.length === 0) {
    
    const query = {
      name: 'fetch-user',
      text: `SELECT * FROM users WHERE username = $1 AND password = crypt($2, password)`,
      values: [username, password]
    }
    
    client.query(query, (err, response) => {
      if (err) {
        console.log(err.stack)
      } else {
        if(response.rowCount !== 0) {
          let fullname = response.rows[0]['fullname'];
          let username = response.rows[0]['username'];
          let admin = response.rows[0]['admin'];

          session = req.session;
          session.userid = admin === true ? 'admin' : 'user';
          console.log(req.session);
          
          admin === true ? res.redirect('/dashboard?admin=yes&name='+fullname+'&user='+username) : res.redirect('/dashboard?name='+fullname+'&user='+username)
        }
        else {
          res.render('login', {
            usernameError: "Check username and password"
          })
        }
      }
    })
  } else {
    res.render('login', {
      usernameError: usernameError,
      passwordError: passwordError,
      usernameSent: username,
      passwordSent: password
    })
  }
})

router.get('/cart/:id', function(req, res) {
  cartid = req.params.id;
  if(req.session.userid === 'user') {
    const query = {
      name: 'cart-plan',
      text: 'SELECT * FROM plans WHERE id=$1',
      values: [req.params.id]
    }
    
    client.query(query, (err, response) => {
      if (err) {
        console.log(err.stack)
      } else {
        res.render('cart', {plan: response.rows[0]})
      }
    })
  } else {
    res.redirect('/plans');
  }
})

router.get('/checkout', function (req, res) {
  if(cartid) {
    const query = {
      name: 'update-user',
      text: `UPDATE users SET plan=$1 WHERE username=$2`,
      values: [cartid, globaluser]
    }
    
    client.query(query, (err, response) => {
      if (err) {
        console.log(err.stack)
      } else {
        cartid = undefined;
        res.send(`<h1>Your plan has been added to record</h1>`);
      }
    })
  } else {
    res.redirect('/plans')
  }
})

router.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/');
})

let port = process.env.PORT || 3000;
app.use(express.static('views'));
app.use(router);

app.listen(port, function () {
  console.log(`Listening at Port:${port}`)
});