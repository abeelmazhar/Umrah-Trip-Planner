const mongoose = require('mongoose');

/** An Error the central error handler turns into `{ message }` with this HTTP status. */
const httpError = (status, message) => Object.assign(new Error(message), { status });

const isId = (id) => mongoose.Types.ObjectId.isValid(id);

/** Throws 400 unless `id` is a valid ObjectId. */
function assertId(id, label = 'id') {
  if (!isId(id)) throw httpError(400, `Invalid ${label}`);
}

/** Trims a value to a string of at most `max` characters ('' for null/undefined). */
const cleanString = (value, max) => (value === undefined || value === null ? '' : String(value).trim().slice(0, max));

/** Runs a validator; turns any error it throws into a 400 response. */
function validate(fn) {
  try {
    return fn();
  } catch (err) {
    throw httpError(400, err.message);
  }
}

module.exports = { httpError, isId, assertId, cleanString, validate };
