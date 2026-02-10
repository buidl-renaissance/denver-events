CREATE TABLE `meetup_events` (
	`id` text PRIMARY KEY NOT NULL,
	`meetupId` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`dateTime` text,
	`eventUrl` text,
	`venue` text,
	`group` text,
	`featuredEventPhoto` text,
	`rsvps` text,
	`eventData` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ra_events` (
	`id` text PRIMARY KEY NOT NULL,
	`raId` text NOT NULL,
	`date` text NOT NULL,
	`startTime` text,
	`endTime` text,
	`title` text NOT NULL,
	`contentUrl` text,
	`flyerFront` text,
	`imageUrl` text,
	`venue` text,
	`artists` text,
	`images` text,
	`isTicketed` integer,
	`interestedCount` integer,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
