import { maintenanceCheck } from '../server/src/middleware/maintenance.ts';
import type { Request, Response } from 'express';

const mockRequest = (path: string) => ({
  path,
} as Request);

const mockResponse = () => {
  const res: any = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.body = data;
    return res;
  };
  return res as Response;
};

const mockNext = () => {
  console.log('Next called');
};

console.log('--- Testing Maintenance Middleware ---');

// Test 1: Maintenance Mode OFF
console.log('\nTest 1: Maintenance Mode OFF');
process.env.MAINTENANCE_MODE = 'false';
const req1 = mockRequest('/api/test');
const res1 = mockResponse();
let nextCalled1 = false;
maintenanceCheck(req1, res1, () => { nextCalled1 = true; });

if (nextCalled1) {
  console.log('PASS: Next called when maintenance mode is off');
} else {
  console.error('FAIL: Next NOT called when maintenance mode is off');
}

// Test 2: Maintenance Mode ON, API Route
console.log('\nTest 2: Maintenance Mode ON, API Route');
process.env.MAINTENANCE_MODE = 'true';
const req2 = mockRequest('/api/test');
const res2 = mockResponse();
let nextCalled2 = false;
maintenanceCheck(req2, res2, () => { nextCalled2 = true; });

if (!nextCalled2 && (res2 as any).statusCode === 503) {
  console.log('PASS: 503 returned for API route in maintenance mode');
} else {
  console.error(`FAIL: Expected 503, got status ${(res2 as any).statusCode}, nextCalled: ${nextCalled2}`);
}

// Test 3: Maintenance Mode ON, Non-API Route
console.log('\nTest 3: Maintenance Mode ON, Non-API Route');
process.env.MAINTENANCE_MODE = 'true';
const req3 = mockRequest('/other/route');
const res3 = mockResponse();
let nextCalled3 = false;
maintenanceCheck(req3, res3, () => { nextCalled3 = true; });

if (nextCalled3) {
  console.log('PASS: Next called for non-API route in maintenance mode');
} else {
  console.error('FAIL: Next NOT called for non-API route');
}
