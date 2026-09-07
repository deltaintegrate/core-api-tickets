import 'reflect-metadata';

process.env.JWT_SECRET = 'test-jwt-secret-for-unit-and-integration-tests';
process.env.ECDH_CURVE = 'prime256v1';
process.env.NODE_ENV = 'test';
