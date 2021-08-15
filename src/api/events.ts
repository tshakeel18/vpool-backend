import { AssertionError } from "assert";
import {
	calculateRecurringEventEndTime,
	calculateSingleEventEndTime,
} from "../datetime";
import { getPlaceDetails } from "../googlemaps";
import {
	carpoolsQuerySelector,
	detailedEventsQuerySelector,
	signupsQuerySelector,
} from "../selectors";
import prisma from "./prisma";

const EVENT_FEED_QUERY_TAKE_AMOUNT = 10;

export async function mostRecentForUser(
	userId: number,
	last: { endTime: Date; id: number } | null
) {
	return await prisma.event.findMany({
		...detailedEventsQuerySelector,
		where: {
			AND: [
				{
					// Verify the event is visible by the user
					OR: [
						{ group: { users: { some: { id: userId } } } },
						{ signups: { some: { userId } } },
						{ creatorId: userId },
					],
				},
				last
					? {
							// Verify the event is after the cursor
							OR: [
								// If the end times are equivalent, take events in descending order by id
								{ endTime: last.endTime, id: { lt: last.id } },
								// If the end times are not equivalent, take events in descending order by endTime
								{ endTime: { lt: last.endTime } },
							],
					  }
					: {},
			],
			...(last ? { endTime: { lt: last.endTime } } : {}),
		},
		orderBy: [{ endTime: "desc" }, { id: "desc" }],
		take: EVENT_FEED_QUERY_TAKE_AMOUNT,
	});
}

export type EventInit = {
	name: string;
	startTime: Date;
	duration: number;
	endDate: Date | null;
	groupId: number;
	placeId: string;
	daysOfWeek: number;
};

export async function create(
	{
		name,
		startTime,
		duration,
		endDate,
		groupId,
		placeId,
		daysOfWeek,
	}: EventInit,
	creatorId: number
) {
	if (duration < 0) {
		throw new AssertionError({ message: "duration cannot be negative" });
	}

	const placeDetails = await getPlaceDetails(placeId);
	if (placeDetails == null) {
		throw new Error("invalid placeId");
	}

	const { latitude, longitude, formattedAddress } = placeDetails;

	const recurring = daysOfWeek !== 0;
	let endTime: Date;
	if (!recurring) {
		endTime = calculateSingleEventEndTime(startTime, duration);
	} else {
		endTime = calculateRecurringEventEndTime(startTime, duration, endDate);
	}

	return await prisma.event.create({
		select: {
			id: true,
		},
		data: {
			name,
			group: {
				connect: {
					id: groupId,
				},
			},

			startTime,
			duration,
			endTime,

			creator: {
				connect: {
					id: creatorId,
				},
			},

			daysOfWeek,

			placeId,
			latitude,
			longitude,
			formattedAddress,
		},
	});
}

export async function signupsBulk(id: number, userIds: number[]) {
	return await prisma.eventSignup.findMany({
		...signupsQuerySelector,
		where: {
			eventId: id,
			userId: {
				in: userIds,
			},
		},
	});
}

export async function signups(id: number) {
	const signups = await prisma.eventSignup.findMany({
		...signupsQuerySelector,
		where: {
			eventId: id,
		},
	});

	return signups;
}

export async function get(eventId: number) {
	const event = await prisma.event.findFirst({
		...detailedEventsQuerySelector,
		where: {
			id: eventId,
		},
	});
	if (!event) {
		return null;
	}
	const signupMap = {};
	for (const signup of event.signups) {
		signupMap[signup.user.id] = signup;
	}
	return {
		...event,
		signups: signupMap,
	};
}

export async function cancel(eventId: number) {
	// Cancel the event. Sets the 'cancelled' field to true.
	await prisma.event.update({
		...detailedEventsQuerySelector,
		where: {
			id: eventId,
		},
		data: {
			cancelled: true,
		},
	});
}
