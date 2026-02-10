import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// User roles
export type UserRole = 'user' | 'organizer' | 'admin';

// User status enum values
export const USER_STATUSES = ['active', 'inactive', 'banned'] as const;
export type UserStatus = typeof USER_STATUSES[number];

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  renaissanceId: text('renaissanceId').unique(), // Renaissance app user ID
  phone: text('phone').unique(), // Primary login method
  email: text('email'), // Optional
  username: text('username'),
  name: text('name'), // Display name
  pfpUrl: text('pfpUrl'), // Profile picture URL
  displayName: text('displayName'), // App-specific name (editable)
  profilePicture: text('profilePicture'), // App-specific profile picture (editable)
  accountAddress: text('accountAddress'), // Wallet address
  pinHash: text('pinHash'), // bcrypt hash of 4-digit PIN
  failedPinAttempts: integer('failedPinAttempts').default(0), // Failed PIN attempts counter
  lockedAt: integer('lockedAt', { mode: 'timestamp' }), // Timestamp when account was locked
  status: text('status').$type<UserStatus>().default('active'), // User status: active, inactive, banned
  role: text('role').$type<UserRole>().default('user').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

// Denver events (legacy unified table; RA and Meetup now use separate tables)
export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    eventDate: text('eventDate').notNull(), // YYYY-MM-DD
    startTime: text('startTime').notNull(),
    endTime: text('endTime'),
    eventName: text('eventName').notNull(),
    organizer: text('organizer'),
    venue: text('venue'),
    registrationUrl: text('registrationUrl'),
    imageUrl: text('imageUrl'),
    notes: text('notes'),
    createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  },
  (table) => [
    uniqueIndex('events_date_name_start').on(table.eventDate, table.eventName, table.startTime),
  ]
);

// Meetup events (full detail for Denver)
export const meetupEvents = sqliteTable('meetup_events', {
  id: text('id').primaryKey(), // meetup-{meetupId}
  meetupId: text('meetupId').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  dateTime: text('dateTime'), // ISO string
  eventUrl: text('eventUrl'),
  venue: text('venue', { mode: 'json' }), // { name, address, city, state, country }
  group: text('group', { mode: 'json' }), // { name, urlname, keyGroupPhoto: { baseUrl, highResUrl } }
  featuredEventPhoto: text('featuredEventPhoto', { mode: 'json' }), // { baseUrl, highResUrl }
  rsvps: text('rsvps', { mode: 'json' }), // { totalCount, yesRsvpCount, ... }
  eventData: text('eventData', { mode: 'json' }), // full raw payload
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

// RA events (full detail for Denver)
export const raEvents = sqliteTable('ra_events', {
  id: text('id').primaryKey(), // ra-{raId}
  raId: text('raId').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  startTime: text('startTime'),
  endTime: text('endTime'),
  title: text('title').notNull(),
  contentUrl: text('contentUrl'),
  flyerFront: text('flyerFront'),
  imageUrl: text('imageUrl'), // resolved absolute URL
  venue: text('venue', { mode: 'json' }), // { id, name, contentUrl }
  artists: text('artists', { mode: 'json' }), // [{ id, name }]
  images: text('images', { mode: 'json' }), // [{ id, filename, type }]
  isTicketed: integer('isTicketed', { mode: 'boolean' }),
  interestedCount: integer('interestedCount'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});
