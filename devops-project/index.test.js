const request = require('supertest');
const app = require('./index');

describe('GET /', () => {
  it('should return 200 OK and a JSON message', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'DevOps Project Active');
  });
});
