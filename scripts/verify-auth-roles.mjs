/**
 * Node verification of auth role isolation (local store).
 * Run: node scripts/verify-auth-roles.mjs
 */

import { webcrypto } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const memory = new Map();

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
};

const storeUrl = pathToFileURL(path.resolve('src/lib/localAuthStore.js')).href;
const { localAuthStore } = await import(storeUrl);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

memory.clear();
await localAuthStore.init();

const unique = `test_${Date.now()}@demo.local`;
const registered = await localAuthStore.signUp({
  email: unique,
  password: 'secret12',
  displayName: 'Тест Юзер',
  role: 'user',
});
assert(registered.user.email === unique, 'register email');
assert(registered.roles.includes('user'), 'register role user');
assert(!registered.isOwner && !registered.isAdmin, 'new user is not owner/admin');

await localAuthStore.signOut();
assert((await localAuthStore.getSessionBundle()) === null, 'logout clears session');

const loggedIn = await localAuthStore.signIn(unique, 'secret12');
assert(loggedIn.profile.display_name === 'Тест Юзер', 'session restored name');

const updated = await localAuthStore.updateProfile(loggedIn.user.id, {
  display_name: 'Иван Обновлённый',
  city: 'Пермь',
  bio: 'Люблю хариуса',
});
assert(updated.profile.display_name === 'Иван Обновлённый', 'profile update');

await localAuthStore.signOut();
const again = await localAuthStore.signIn(unique, 'secret12');
assert(again.profile.display_name === 'Иван Обновлённый', 'profile persists after re-login');

const userBundle = await localAuthStore.signIn('user@demo.local', 'demo1234');
assert(!userBundle.isOwner && !userBundle.isAdmin, 'demo user roles');

let denied = false;
try {
  localAuthStore.getOwnerBase(userBundle.user.id, 'own_base_1');
} catch {
  denied = true;
}
assert(denied, 'USER cannot read OWNER base');

denied = false;
try {
  localAuthStore.updateOwnerBase(userBundle.user.id, 'own_base_1', { name: 'Hack' });
} catch {
  denied = true;
}
assert(denied, 'USER cannot edit OWNER base');

const ownerBundle = await localAuthStore.signIn('owner@demo.local', 'demo1234');
assert(ownerBundle.isOwner && !ownerBundle.isAdmin, 'demo owner roles');
const own = localAuthStore.getOwnerBase(ownerBundle.user.id, 'own_base_1');
assert(own.name.includes('Чусовские'), 'owner reads own base');

denied = false;
try {
  localAuthStore.setUserStatus(ownerBundle.user.id, userBundle.user.id, 'blocked');
} catch {
  denied = true;
}
assert(denied, 'OWNER cannot admin-block users');

const adminBundle = await localAuthStore.signIn('admin@demo.local', 'demo1234');
assert(adminBundle.isAdmin, 'demo admin role');
localAuthStore.setUserStatus(adminBundle.user.id, userBundle.user.id, 'active');

console.log('OK auth scenarios passed:');
console.log('- register → login → profile → logout → re-login');
console.log('- USER denied OWNER data');
console.log('- OWNER denied ADMIN actions');
console.log('- ADMIN can manage users');
