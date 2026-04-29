const Datastore = require('nedb-promises');
const path = require('path');

const contacts = Datastore.create({
  filename: path.join(__dirname, 'data', 'contacts.db'),
  autoload: true
});

module.exports = { contacts };
