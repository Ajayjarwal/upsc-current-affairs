import assert from 'node:assert/strict';
import test from 'node:test';
import { safeRelativeReturnPath, safeLoginReturnPath, loginPagePath, authNavigationAllowed, signInPath, signOutPath } from '../app/auth-paths.ts';

test('login return destinations reject external URLs and authentication endpoints', () => {
  for (const path of ['https://example.com', '//example.com', '/\\example.com', 'javascript:alert(1)', '/signin-with-chatgpt?return_to=/login', '/signout-with-chatgpt', '/callback', '/auth/sign-in', '/auth/sign-out', '/auth/google/callback', '/auth/google/callback/']) {
    assert.equal(safeRelativeReturnPath(path), '/');
  }
});

test('sign-in and sign-out destinations remain within the application', () => {
  assert.match(signInPath('/'), /^\/auth\/sign-in\?/);
  assert.match(signOutPath('/login'), /^\/auth\/sign-out\?/);
});

test('cross-site sign-in and sign-out navigations are rejected', () => {
  assert.equal(authNavigationAllowed(new Request('https://notes.example.com/auth/sign-out', { headers: { origin: 'https://evil.example' } })), false);
  assert.equal(authNavigationAllowed(new Request('https://notes.example.com/auth/sign-out', { headers: { 'sec-fetch-site': 'cross-site' } })), false);
  assert.equal(authNavigationAllowed(new Request('https://notes.example.com/auth/sign-in', { headers: { origin: 'https://notes.example.com' } })), true);
});

test('login destinations preserve local paths and prevent login redirect loops', () => {
  assert.equal(safeLoginReturnPath('/?subject=Economy#notes'), '/?subject=Economy#notes');
  assert.equal(safeLoginReturnPath('/login?return_to=/login'), '/');
  assert.equal(safeLoginReturnPath('/login/'), '/');
  assert.equal(safeLoginReturnPath(['/', '//example.com']), '/');
  assert.equal(loginPagePath('/?subject=Economy'), '/login?return_to=%2F%3Fsubject%3DEconomy');
});
